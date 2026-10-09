import { eventPhase } from '../lib/eventPhase.js';
import { mergeAnnouncements } from '../lib/announcementsFeed.js';

// Shared by the Directory/Events teaser blocks. Takes a Supabase client so it
// works identically whether called at Astro build time (supabaseBuild, anon
// key) or client-side in the admin canvas/preview (supabaseBrowser).
// 'all' means "show the whole source on this page" -- there's no unbounded
// query option in postgrest, so we just cap it far above any realistic
// directory/calendar size instead of branching the query shape.
const ALL_SENTINEL_LIMIT = 500;

const EVENT_LIST_COLUMNS = 'id, title, description, start_at, end_at, all_day, location, slug';

function resolveLimit(count) {
  if (count === 'all') return ALL_SENTINEL_LIMIT;
  return Number(count) || 3;
}

export async function fetchDirectoryTeaserItems(client, sourceType, count) {
  const { data, error } = await client
    .from('directory_entries')
    .select('id, name, photo_url, bio, extra_fields')
    .eq('directory_kind', sourceType)
    .eq('status', 'published')
    .order('sort_order')
    .limit(resolveLimit(count));
  if (error) {
    console.error('directory-teaser fetch failed:', error.message);
    return [];
  }
  return data || [];
}

// Used by DirectoryPersonDialog.jsx (the "larger preview" opened when a
// visitor clicks a person card) -- fetched on demand rather than bundled
// into the teaser list above, since most visitors never open it.
export async function fetchDirectoryEntry(client, id) {
  const { data, error } = await client
    .from('directory_entries')
    .select('id, name, photo_url, bio, extra_fields')
    .eq('id', id)
    .eq('status', 'published')
    .maybeSingle();
  if (error) {
    console.error('directory entry fetch failed:', error.message);
    return null;
  }
  return data;
}

export async function fetchDirectoryFieldDefinitions(client, sourceType) {
  const { data, error } = await client
    .from('directory_field_definitions')
    .select('field_key, label')
    .or(`directory_kind.eq.${sourceType},directory_kind.is.null`)
    .order('sort_order');
  if (error) {
    console.error('directory field definitions fetch failed:', error.message);
    return [];
  }
  return data || [];
}

export async function fetchEventsTeaserItems(client, count, timeframe = 'upcoming', now = new Date()) {
  // "Upcoming" means not over YET (so an event in progress still shows), and
  // "over" depends on the event's own end rules (see lib/eventPhase.js) --
  // not something a SQL filter on start_at can express. The events table is
  // small, so fetch the published ones and sort them out here.
  const { data, error } = await client
    .from('calendar_events')
    .select(EVENT_LIST_COLUMNS)
    .eq('status', 'published')
    .order('start_at');
  if (error) {
    console.error('events-teaser fetch failed:', error.message);
    return [];
  }
  const all = (data || []).map((e) => ({ ...e, phase: eventPhase(e, now) }));
  let events;
  if (timeframe === 'past') events = all.filter((e) => e.phase === 'past').reverse(); // most recent first
  else if (timeframe === 'all') events = all;
  else events = all.filter((e) => e.phase !== 'past');
  return attachEventLinks(client, events.slice(0, resolveLimit(count)));
}

// Adds `links: { announcement?: {slug, title}, album?: {id, title} }` to each
// event, from the public_event_links view (0029) -- the event's published
// announcement ("Read more") and its album once it has published photos
// ("Photos"). One batched query for the whole list, not one per event. A
// failure here just means no extra links; it must never take the events
// themselves down with it.
export async function attachEventLinks(client, events) {
  if (events.length === 0) return events;
  const { data, error } = await client
    .from('public_event_links')
    .select('event_id, kind, target_id, slug, title')
    .in('event_id', events.map((e) => e.id));
  if (error) {
    console.error('event links fetch failed:', error.message);
    return events;
  }
  const byEvent = {};
  for (const row of data || []) {
    const links = (byEvent[row.event_id] ||= {});
    // Several of one kind can be linked; the card has room for one of each.
    if (row.kind === 'announcement' && !links.announcement) links.announcement = { slug: row.slug, title: row.title };
    if (row.kind === 'album' && !links.album) links.album = { id: row.target_id, title: row.title };
  }
  return events.map((e) => ({ ...e, links: byEvent[e.id] || {} }));
}

// Unlike calendar_events (small, denormalized query above), the Photo Gallery
// block can point at one specific album or "all" published photos across
// every album -- see the `album-select` field kind in BlockConfigPanel.jsx.
export async function fetchGalleryTeaserItems(client, albumFilter, count) {
  let query = client
    .from('gallery_photos')
    .select('id, image_url, caption, alt_text')
    .eq('status', 'published');
  if (albumFilter && albumFilter !== 'all') {
    query = query.eq('album_id', albumFilter);
  }
  const { data, error } = await query.order('sort_order').limit(resolveLimit(count));
  if (error) {
    console.error('gallery fetch failed:', error.message);
    return [];
  }
  return data || [];
}

// Unlike directory_entries/calendar_events, blog_posts has NO public read
// policy on the base table (draft_blocks would leak) -- so this always reads
// through the public_blog_posts view instead, for both anon (build time) and
// authenticated (admin canvas/preview) callers. See the security_invoker note
// on that view in 0001_init.sql, and the authenticated grant added in 0006.
export async function fetchPostsTeaserItems(client, count, now = new Date()) {
  const limit = resolveLimit(count);
  const [postsResult, eventsResult] = await Promise.all([
    client.from('public_blog_posts').select('id, slug, title, excerpt, cover_image_url, published_at')
      .order('published_at', { ascending: false }).limit(limit),
    // Events that opted into the announcements feed (their "Show in
    // announcements" toggle). Whether each is still upcoming is decided in
    // mergeAnnouncements, from the same end-of-event rules as everywhere else.
    client.from('calendar_events')
      .select('id, slug, title, description, location, start_at, end_at, all_day, status, published_at, show_in_announcements')
      .eq('status', 'published').eq('show_in_announcements', true),
  ]);
  if (postsResult.error) {
    console.error('posts-teaser fetch failed:', postsResult.error.message);
    return [];
  }
  // A failing events query must never take the announcements down with it.
  if (eventsResult.error) console.error('announced events fetch failed:', eventsResult.error.message);
  return mergeAnnouncements(postsResult.data, eventsResult.error ? [] : eventsResult.data, now, limit);
}

// What the "Event Details" block shows: the event record itself, plus its
// phase worked out HERE (once, on the server) so a page's server HTML and the
// browser's first render agree -- a clock read at render time could differ
// between the two and cause a hydration mismatch.
export async function fetchEventDetails(client, eventId, now = new Date()) {
  if (!eventId) return null;
  const { data, error } = await client
    .from('calendar_events')
    .select('id, title, description, location, start_at, end_at, all_day, slug')
    .eq('id', eventId)
    .maybeSingle();
  if (error || !data) return null;
  return { ...data, phase: eventPhase(data, now) };
}

// What the "Event Photos" block shows: the photos of the album linked to this
// event -- but only once that album is published AND has published photos
// (the public_event_links view enforces both), so an empty or unpublished
// album never produces a blank "Photos" section.
export async function fetchEventPhotos(client, eventId) {
  if (!eventId) return [];
  const { data: links, error } = await client
    .from('public_event_links').select('target_id').eq('event_id', eventId).eq('kind', 'album');
  if (error || !links || links.length === 0) return [];
  return fetchGalleryTeaserItems(client, links[0].target_id, 'all');
}

// Scans a page's block array for teaser blocks and pre-fetches their data,
// keyed by block id -- used by Astro public pages (server-side, no client JS)
// before handing off to BlockRenderer via its `teaserData` prop.
export async function resolveTeaserData(blocks, client) {
  const map = {};
  await Promise.all(
    (blocks || []).map(async (block) => {
      if (block.type === 'directory-teaser') {
        map[block.id] = await fetchDirectoryTeaserItems(client, block.props.sourceType, block.props.count);
      } else if (block.type === 'events-teaser') {
        map[block.id] = await fetchEventsTeaserItems(client, block.props.count, block.props.timeframe);
      } else if (block.type === 'posts-teaser') {
        map[block.id] = await fetchPostsTeaserItems(client, block.props.count);
      } else if (block.type === 'event-details') {
        map[block.id] = await fetchEventDetails(client, block.props.eventId);
      } else if (block.type === 'event-photos') {
        map[block.id] = await fetchEventPhotos(client, block.props.eventId);
      } else if (block.type === 'gallery') {
        map[block.id] = await fetchGalleryTeaserItems(client, block.props.albumFilter, block.props.count);
      }
    })
  );
  return map;
}

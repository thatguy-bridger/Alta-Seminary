// Shared by the Directory/Events teaser blocks. Takes a Supabase client so it
// works identically whether called at Astro build time (supabaseBuild, anon
// key) or client-side in the admin canvas/preview (supabaseBrowser).
// 'all' means "show the whole source on this page" -- there's no unbounded
// query option in postgrest, so we just cap it far above any realistic
// directory/calendar size instead of branching the query shape.
const ALL_SENTINEL_LIMIT = 500;

function resolveLimit(count) {
  if (count === 'all') return ALL_SENTINEL_LIMIT;
  return Number(count) || 3;
}

export async function fetchDirectoryTeaserItems(client, sourceType, count) {
  const { data, error } = await client
    .from('directory_entries')
    .select('id, name, photo_url, bio')
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

export async function fetchEventsTeaserItems(client, count, timeframe = 'upcoming') {
  let query = client
    .from('calendar_events')
    .select('id, title, description, start_at, end_at, all_day, location')
    .eq('status', 'published');
  if (timeframe !== 'all') {
    query = query.gte('start_at', new Date().toISOString());
  }
  const { data, error } = await query.order('start_at').limit(resolveLimit(count));
  if (error) {
    console.error('events-teaser fetch failed:', error.message);
    return [];
  }
  return data || [];
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
export async function fetchPostsTeaserItems(client, count) {
  const { data, error } = await client
    .from('public_blog_posts')
    .select('id, slug, title, excerpt, cover_image_url, published_at')
    .order('published_at', { ascending: false })
    .limit(resolveLimit(count));
  if (error) {
    console.error('posts-teaser fetch failed:', error.message);
    return [];
  }
  return data || [];
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
      } else if (block.type === 'gallery') {
        map[block.id] = await fetchGalleryTeaserItems(client, block.props.albumFilter, block.props.count);
      }
    })
  );
  return map;
}

import { supabaseBrowser } from '../lib/supabase/browser-client';
import { withBase } from '../lib/url.js';

export const itemKey = (kind, id) => `${kind}:${id}`;

// Events, announcements and photo albums live in three different tables with
// three different shapes. The admin works with all of them as one list, so
// this flattens each into the same minimal item -- everything the list needs
// to sort, filter and display -- and keeps the original row on `raw` for the
// kind-specific actions (edit, publish, copy, create-and-link).
//
// Everything arrives in ONE round of parallel queries, links included: the
// per-row "how many links does this have" fetches the old per-screen panels
// did were an N+1 that got slower with every announcement added.
export async function loadContentIndex() {
  const [events, posts, albums, photos, linkRows] = await Promise.all([
    supabaseBrowser.from('calendar_events').select('*'),
    supabaseBrowser.from('blog_posts').select('*'),
    supabaseBrowser.from('gallery_albums').select('*'),
    supabaseBrowser.from('gallery_photos').select('album_id'),
    supabaseBrowser.from('content_links').select('a_kind, a_id, b_kind, b_id'),
  ]);

  const photoCounts = {};
  for (const p of photos.data || []) if (p.album_id) photoCounts[p.album_id] = (photoCounts[p.album_id] || 0) + 1;

  const items = [
    ...(events.data || []).map((r) => ({
      key: itemKey('event', r.id), kind: 'event', id: r.id, title: r.title, status: r.status, sortAt: r.start_at, raw: r,
    })),
    ...(posts.data || []).map((r) => ({
      key: itemKey('announcement', r.id), kind: 'announcement', id: r.id, title: r.title, status: r.status,
      sortAt: r.published_at || r.publish_at || r.created_at, raw: r,
    })),
    ...(albums.data || []).map((r) => ({
      key: itemKey('album', r.id), kind: 'album', id: r.id, title: r.name, status: r.status, sortAt: r.created_at,
      photoCount: photoCounts[r.id] || 0, raw: r,
    })),
  ];

  // content_links stores each pair once; the list needs it from both sides.
  const links = new Map();
  const add = (from, to) => {
    if (!links.has(from)) links.set(from, new Set());
    links.get(from).add(to);
  };
  for (const l of linkRows.data || []) {
    const a = itemKey(l.a_kind, l.a_id);
    const b = itemKey(l.b_kind, l.b_id);
    add(a, b);
    add(b, a);
  }
  return { items, links, byKey: new Map(items.map((i) => [i.key, i])) };
}

// Linked items that still exist -- a link whose other side was deleted is
// just ignored here rather than shown as a dead chip.
export function relatedItems(index, item) {
  return [...(index.links.get(item.key) || [])].map((k) => index.byKey.get(k)).filter(Boolean)
    .sort((a, b) => a.title.localeCompare(b.title));
}

// Where "Edit" goes for each kind: announcements and albums have real editor
// screens of their own; events edit in a dialog inside the Content screen.
export function editHref(item) {
  if (item.kind === 'announcement') return withBase(`/admin/posts/edit?slug=${item.raw.slug}`);
  if (item.kind === 'album') return withBase(`/admin/gallery?album=${item.id}`);
  return withBase(`/admin/content?item=${item.key}`);
}

// Deleting something should also drop its links -- content_links is a
// polymorphic join table with no foreign keys, so nothing else cleans up.
export async function deleteLinksFor(kind, ids) {
  if (!ids.length) return;
  await Promise.all([
    supabaseBrowser.from('content_links').delete().eq('a_kind', kind).in('a_id', ids),
    supabaseBrowser.from('content_links').delete().eq('b_kind', kind).in('b_id', ids),
  ]);
}

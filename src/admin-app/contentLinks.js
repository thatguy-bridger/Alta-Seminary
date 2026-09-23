import { supabaseBrowser } from '../lib/supabase/browser-client';
import { withBase } from '../lib/url.js';

// The 3 content kinds that can be cross-linked to each other (any pair --
// event<->announcement, event<->album, announcement<->album), all through
// one generic content_links join table instead of a different bespoke FK
// column per direction. See that table's own migration comment
// (0028_generic_content_links.sql) for why each pair is stored as exactly
// one canonically-ordered row.
export const CONTENT_KINDS = ['event', 'announcement', 'album'];

// slugField is only set for 'announcement' -- calendar_events/gallery_albums
// have no slug column at all, so the select string below must never ask
// for one on those (Postgrest errors on a genuinely nonexistent column,
// it doesn't just come back null).
const KIND_META = {
  event: { table: 'calendar_events', titleField: 'title', label: 'Event', icon: '📅' },
  announcement: { table: 'blog_posts', titleField: 'title', slugField: 'slug', label: 'Announcement', icon: '📣' },
  album: { table: 'gallery_albums', titleField: 'name', label: 'Photo Album', icon: '🖼' },
};

function selectColumns(meta) {
  return ['id', meta.titleField, meta.slugField].filter(Boolean).join(', ');
}

function comparePair(kind, id) {
  return `${kind}:${id}`;
}

// Always orders a link the same way regardless of which side initiated it,
// so linking from either direction lands on the same row (and unlinking
// from either direction removes it).
function canonicalPair(aKind, aId, bKind, bId) {
  const [first, second] = [{ kind: aKind, id: aId }, { kind: bKind, id: bId }]
    .sort((p, q) => comparePair(p.kind, p.id).localeCompare(comparePair(q.kind, q.id)));
  return { a_kind: first.kind, a_id: first.id, b_kind: second.kind, b_id: second.id };
}

export async function linkContent(aKind, aId, bKind, bId) {
  const pair = canonicalPair(aKind, aId, bKind, bId);
  await supabaseBrowser.from('content_links').upsert(pair, { onConflict: 'a_kind,a_id,b_kind,b_id', ignoreDuplicates: true });
}

export async function unlinkContent(aKind, aId, bKind, bId) {
  const pair = canonicalPair(aKind, aId, bKind, bId);
  await supabaseBrowser.from('content_links').delete().match(pair);
}

// Every href needed is knowable from the row's own id/slug -- gallery
// albums and events have no per-item admin route of their own beyond
// "open the list and find it" (?album=/?event= just pre-selects it),
// announcements have a real per-slug edit page.
function hrefFor(kind, row) {
  if (kind === 'announcement') return withBase(`/admin/posts/edit?slug=${row.slug}`);
  if (kind === 'album') return withBase(`/admin/gallery?album=${row.id}`);
  return withBase(`/admin/events?event=${row.id}`);
}

// Every item of one kind, for the "link an existing X" picker -- id +
// display title only, sorted by title.
export async function fetchAllOfKind(kind) {
  const meta = KIND_META[kind];
  const { data } = await supabaseBrowser.from(meta.table).select(selectColumns(meta));
  return (data || [])
    .map((row) => ({ kind, id: row.id, title: row[meta.titleField], href: hrefFor(kind, row) }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

// Everything linked to (kind, id), regardless of which side of the stored
// row it's on -- real titles/hrefs resolved in one batched query per other
// kind involved, not one query per link.
export async function fetchLinkedItems(kind, id) {
  const [{ data: asA }, { data: asB }] = await Promise.all([
    supabaseBrowser.from('content_links').select('b_kind, b_id').eq('a_kind', kind).eq('a_id', id),
    supabaseBrowser.from('content_links').select('a_kind, a_id').eq('b_kind', kind).eq('b_id', id),
  ]);
  const others = [
    ...(asA || []).map((r) => ({ kind: r.b_kind, id: r.b_id })),
    ...(asB || []).map((r) => ({ kind: r.a_kind, id: r.a_id })),
  ];
  const idsByKind = {};
  for (const o of others) (idsByKind[o.kind] ||= []).push(o.id);

  const results = [];
  await Promise.all(Object.entries(idsByKind).map(async ([otherKind, ids]) => {
    const meta = KIND_META[otherKind];
    const { data } = await supabaseBrowser.from(meta.table).select(selectColumns(meta)).in('id', ids);
    for (const row of data || []) {
      results.push({ kind: otherKind, id: row.id, title: row[meta.titleField], href: hrefFor(otherKind, row) });
    }
  }));
  return results.sort((a, b) => a.title.localeCompare(b.title));
}

export function kindLabel(kind) { return KIND_META[kind]?.label || kind; }
export function kindIcon(kind) { return KIND_META[kind]?.icon || ''; }

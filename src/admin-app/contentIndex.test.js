import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeSupabase } from '../test/fakeSupabase.js';

const h = vi.hoisted(() => ({ client: null }));
vi.mock('../lib/supabase/browser-client', () => ({ get supabaseBrowser() { return h.client; } }));

import { loadContentIndex, relatedItems, editHref, deleteLinksFor, itemKey } from './contentIndex.js';

const tables = {
  calendar_events: [{ id: 'e1', slug: 'junior-soda-social', title: 'Junior Soda Social', status: 'published', show_in_announcements: true, start_at: '2026-10-30T18:30:00Z', end_at: '2026-10-30T19:30:00Z', all_day: false }],
  blog_posts: [
    { id: 'p1', slug: 'junior-soda', title: 'Junior Soda Social', status: 'published', published_at: '2026-10-02T00:00:00Z', created_at: '2026-10-01T00:00:00Z' },
    { id: 'p2', slug: 'other', title: 'Another Post', status: 'draft', created_at: '2026-10-03T00:00:00Z' },
  ],
  gallery_albums: [{ id: 'a1', name: 'Tailgate Party', status: 'draft', created_at: '2026-09-01T00:00:00Z' }],
  gallery_photos: [{ album_id: 'a1' }, { album_id: 'a1' }, { album_id: null }],
  // stored once each, canonical order (album < announcement < event)
  content_links: [
    { a_kind: 'announcement', a_id: 'p1', b_kind: 'event', b_id: 'e1' },
    { a_kind: 'album', a_id: 'a1', b_kind: 'event', b_id: 'e1' },
    { a_kind: 'announcement', a_id: 'GONE', b_kind: 'event', b_id: 'e1' }, // its announcement was deleted
  ],
};

beforeEach(() => { h.client = createFakeSupabase({ tables }); });

describe('loadContentIndex', () => {
  it('flattens all three kinds into one list with the right titles, statuses and counts', async () => {
    const { items } = await loadContentIndex();
    expect(items).toHaveLength(4);
    expect(items.find((i) => i.key === 'album:a1')).toMatchObject({ kind: 'album', title: 'Tailgate Party', photoCount: 2 });
    expect(items.find((i) => i.key === 'event:e1')).toMatchObject({ kind: 'event', title: 'Junior Soda Social', status: 'published' });
    expect(items.find((i) => i.key === 'announcement:p2').status).toBe('draft');
  });

  it('makes every link visible from BOTH sides', async () => {
    const { links } = await loadContentIndex();
    expect(links.get('event:e1')).toEqual(new Set(['announcement:p1', 'album:a1', 'announcement:GONE']));
    expect(links.get('announcement:p1')).toEqual(new Set(['event:e1']));
    expect(links.get('album:a1')).toEqual(new Set(['event:e1']));
  });
});

describe('event items', () => {
  it('know whether they are over, and whether they are in announcements', async () => {
    const { byKey } = await loadContentIndex();
    const e = byKey.get('event:e1');
    expect(e.showInAnnouncements).toBe(true);
    expect(['upcoming', 'live', 'past']).toContain(e.phase);
  });

  it('are archived once their end time has passed', async () => {
    h.client = createFakeSupabase({ tables: { ...tables, calendar_events: [{ ...tables.calendar_events[0], start_at: '2020-01-01T18:00:00Z', end_at: '2020-01-01T19:00:00Z' }] } });
    expect((await loadContentIndex()).byKey.get('event:e1').phase).toBe('past');
  });
});

describe('relatedItems', () => {
  it('returns linked items sorted by title and silently drops links to deleted items', async () => {
    const index = await loadContentIndex();
    const related = relatedItems(index, index.byKey.get('event:e1'));
    expect(related.map((r) => r.key)).toEqual(['announcement:p1', 'album:a1'].sort((a, b) =>
      index.byKey.get(a).title.localeCompare(index.byKey.get(b).title)));
    expect(related.some((r) => r.key.endsWith('GONE'))).toBe(false);
  });

  it('is empty for an item with no links', async () => {
    const index = await loadContentIndex();
    expect(relatedItems(index, index.byKey.get('announcement:p2'))).toEqual([]);
  });
});

describe('editHref', () => {
  it('sends each kind to the right editor', async () => {
    const { byKey } = await loadContentIndex();
    expect(editHref(byKey.get('announcement:p1'))).toBe('/admin/posts/edit?slug=junior-soda');
    expect(editHref(byKey.get('album:a1'))).toBe('/admin/gallery?album=a1');
    // an event's editor is its page; its date/place/description edit in a dialog
    expect(editHref(byKey.get('event:e1'))).toBe('/admin/events/edit?slug=junior-soda-social');
  });
});

describe('deleteLinksFor', () => {
  it('removes links from both sides of the stored pair', async () => {
    await deleteLinksFor('event', ['e1']);
    const deletes = h.client.log.filter((l) => l.table === 'content_links' && l.op === 'delete');
    expect(deletes).toHaveLength(2); // once as the a side, once as the b side
  });

  it('does nothing for an empty list', async () => {
    await deleteLinksFor('event', []);
    expect(h.client.log).toHaveLength(0);
  });
});

it('itemKey is kind:id', () => { expect(itemKey('album', 'x')).toBe('album:x'); });

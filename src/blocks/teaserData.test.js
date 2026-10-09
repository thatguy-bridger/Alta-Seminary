import { describe, it, expect, vi } from 'vitest';
import { createFakeSupabase } from '../test/fakeSupabase.js';
import { attachEventLinks } from './teaserData.js';

const events = [{ id: 'e1', title: 'One' }, { id: 'e2', title: 'Two' }, { id: 'e3', title: 'Three' }];

describe('attachEventLinks', () => {
  it('attaches each event its own announcement and album', async () => {
    const client = createFakeSupabase({ tables: { public_event_links: [
      { event_id: 'e1', kind: 'announcement', target_id: 'p1', slug: 'one-post', title: 'One' },
      { event_id: 'e1', kind: 'album', target_id: 'a1', slug: null, title: 'One Photos' },
      { event_id: 'e2', kind: 'announcement', target_id: 'p2', slug: 'two-post', title: 'Two' },
    ] } });
    const result = await attachEventLinks(client, events);
    expect(result[0].links).toEqual({ announcement: { slug: 'one-post', title: 'One' }, album: { id: 'a1', title: 'One Photos' } });
    expect(result[1].links).toEqual({ announcement: { slug: 'two-post', title: 'Two' } });
    expect(result[2].links).toEqual({}); // e3 has nothing linked
  });

  it('keeps the first of a kind when several are linked', async () => {
    const client = createFakeSupabase({ tables: { public_event_links: [
      { event_id: 'e1', kind: 'announcement', target_id: 'p1', slug: 'first', title: 'First' },
      { event_id: 'e1', kind: 'announcement', target_id: 'p2', slug: 'second', title: 'Second' },
    ] } });
    expect((await attachEventLinks(client, events))[0].links.announcement.slug).toBe('first');
  });

  it('returns the events untouched if the links query fails -- never loses the events', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const client = createFakeSupabase({ errors: { public_event_links: 'view missing' } });
    expect(await attachEventLinks(client, events)).toBe(events);
    spy.mockRestore();
  });

  it('does not query at all for an empty list', async () => {
    const client = createFakeSupabase();
    const spy = vi.spyOn(client, 'from');
    expect(await attachEventLinks(client, [])).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });
});

import { fetchEventsTeaserItems, fetchPostsTeaserItems, fetchEventDetails, fetchEventPhotos, resolveTeaserData } from './teaserData.js';

// Rows are given in start order, as the database returns them (.order('start_at')).
const ev = (id, start, end, over = {}) => ({ id, slug: id, title: id, start_at: start, end_at: end, all_day: false, location: '', description: '', ...over });
const NOW = new Date('2026-10-05T12:00:00Z');
const events3 = [
  ev('past', '2026-09-22T18:00:00Z', '2026-09-22T19:00:00Z'),
  ev('live', '2026-10-05T11:00:00Z', '2026-10-05T13:00:00Z'),
  ev('soon', '2026-10-09T18:30:00Z', '2026-10-09T19:30:00Z'),
];
const clientWith = (tables, errors) => createFakeSupabase({ tables: { public_event_links: [], ...tables }, errors });

describe('fetchEventsTeaserItems (timeframes)', () => {
  it('"upcoming" includes an event in progress and drops the ones that are over', async () => {
    const items = await fetchEventsTeaserItems(clientWith({ calendar_events: events3 }), 'all', 'upcoming', NOW);
    expect(items.map((e) => [e.id, e.phase])).toEqual([['live', 'live'], ['soon', 'upcoming']]);
  });

  it('"past" is the archive: only what is over, most recent first', async () => {
    const more = [ev('older', '2026-08-01T18:00:00Z', '2026-08-01T19:00:00Z'), ...events3];
    const items = await fetchEventsTeaserItems(clientWith({ calendar_events: more }), 'all', 'past', NOW);
    expect(items.map((e) => e.id)).toEqual(['past', 'older']);
  });

  it('"all" returns everything, each labeled with its phase', async () => {
    const items = await fetchEventsTeaserItems(clientWith({ calendar_events: events3 }), 'all', 'all', NOW);
    expect(items.map((e) => e.phase)).toEqual(['past', 'live', 'upcoming']);
  });

  it('applies the count limit AFTER removing events that do not belong', async () => {
    const items = await fetchEventsTeaserItems(clientWith({ calendar_events: events3 }), '1', 'upcoming', NOW);
    expect(items.map((e) => e.id)).toEqual(['live']); // not the (filtered-out) past one
  });

  it('returns an empty list rather than throwing if the query fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await fetchEventsTheaserSafe()).toEqual([]);
    spy.mockRestore();
    async function fetchEventsTheaserSafe() { return fetchEventsTeaserItems(clientWith({}, { calendar_events: 'boom' }), 'all', 'upcoming', NOW); }
  });
});

describe('fetchPostsTeaserItems (the announcements feed)', () => {
  const posts = [{ id: 'p1', slug: 'p1', title: 'Post', excerpt: '', published_at: '2026-10-01T18:00:00Z' }];
  const announcedEvent = { ...ev('e1', '2026-10-20T18:30:00Z', '2026-10-20T19:30:00Z'), status: 'published', show_in_announcements: true, published_at: '2026-10-03T18:00:00Z' };

  it('merges announcements with events that opted in and are not over', async () => {
    const feed = await fetchPostsTeaserItems(clientWith({ public_blog_posts: posts, calendar_events: [announcedEvent] }), 'all', NOW);
    expect(feed.map((i) => [i.id, i.kind])).toEqual([['e1', 'event'], ['p1', 'announcement']]);
  });

  it('drops an announced event once it is over -- it moves to the archive', async () => {
    const over = { ...announcedEvent, start_at: '2026-09-01T18:00:00Z', end_at: '2026-09-01T19:00:00Z' };
    const feed = await fetchPostsTeaserItems(clientWith({ public_blog_posts: posts, calendar_events: [over] }), 'all', NOW);
    expect(feed.map((i) => i.id)).toEqual(['p1']);
  });

  it('still shows the announcements if the events query fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const feed = await fetchPostsTeaserItems(clientWith({ public_blog_posts: posts }, { calendar_events: 'boom' }), 'all', NOW);
    expect(feed.map((i) => i.id)).toEqual(['p1']);
    spy.mockRestore();
  });
});

describe('event block data', () => {
  it('fetchEventDetails adds the phase, computed once so server and browser agree', async () => {
    const details = await fetchEventDetails(clientWith({ calendar_events: [events3[2]] }), 'soon', NOW);
    expect(details).toMatchObject({ id: 'soon', phase: 'upcoming' });
  });

  it('fetchEventDetails gives null for no id or a missing event', async () => {
    expect(await fetchEventDetails(clientWith({}), '', NOW)).toBeNull();
    expect(await fetchEventDetails(clientWith({ calendar_events: [] }), 'nope', NOW)).toBeNull();
  });

  it('fetchEventPhotos returns the linked album\'s photos, or nothing when no album is linked/published', async () => {
    const photos = [{ id: 'ph1', image_url: 'u', caption: '' }];
    const linked = clientWith({ public_event_links: [{ target_id: 'album-1' }], gallery_photos: photos });
    expect(await fetchEventPhotos(linked, 'e1')).toEqual(photos);
    expect(await fetchEventPhotos(clientWith({ public_event_links: [], gallery_photos: photos }), 'e1')).toEqual([]);
    expect(await fetchEventPhotos(linked, '')).toEqual([]);
  });

  it('resolveTeaserData prefetches both new blocks by their own event id', async () => {
    const client = clientWith({ calendar_events: [events3[2]], public_event_links: [] });
    const map = await resolveTeaserData([
      { id: 'b1', type: 'event-details', props: { eventId: 'soon' } },
      { id: 'b2', type: 'event-photos', props: { eventId: 'soon' } },
    ], client);
    expect(map.b1).toMatchObject({ id: 'soon' });
    expect(map.b2).toEqual([]);
  });
});

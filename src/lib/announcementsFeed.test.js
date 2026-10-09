import { describe, it, expect } from 'vitest';
import { mergeAnnouncements } from './announcementsFeed.js';

const now = new Date('2026-10-05T12:00:00Z');
const post = (id, published_at) => ({ id, slug: id, title: `Post ${id}`, excerpt: 'x', published_at });
const event = (id, published_at, over = {}) => ({
  id, slug: id, title: `Event ${id}`, description: 'desc', location: 'Chapel', status: 'published', show_in_announcements: true,
  published_at, start_at: '2026-10-20T18:30:00Z', end_at: '2026-10-20T19:30:00Z', all_day: false, ...over,
});

describe('mergeAnnouncements', () => {
  it('interleaves posts and announced events newest-first', () => {
    const feed = mergeAnnouncements(
      [post('p1', '2026-10-01T00:00:00Z'), post('p2', '2026-10-03T00:00:00Z')],
      [event('e1', '2026-10-02T00:00:00Z')], now);
    expect(feed.map((i) => i.id)).toEqual(['p2', 'e1', 'p1']);
  });

  it('labels each item and gives events their own date details', () => {
    const [e] = mergeAnnouncements([], [event('e1', '2026-10-02T00:00:00Z')], now);
    expect(e).toMatchObject({ kind: 'event', slug: 'e1', excerpt: 'desc', event: { location: 'Chapel', all_day: false } });
    expect(mergeAnnouncements([post('p1', '2026-10-01T00:00:00Z')], [], now)[0].kind).toBe('announcement');
  });

  it('leaves out events that did not opt in, are drafts, or are already over', () => {
    const feed = mergeAnnouncements([], [
      event('on', '2026-10-02T00:00:00Z'),
      event('off', '2026-10-02T00:00:00Z', { show_in_announcements: false }),
      event('draft', '2026-10-02T00:00:00Z', { status: 'draft' }),
      event('over', '2026-10-02T00:00:00Z', { start_at: '2026-10-01T18:30:00Z', end_at: '2026-10-01T19:30:00Z' }),
    ], now);
    expect(feed.map((i) => i.id)).toEqual(['on']);
  });

  it('keeps an event that is happening right now', () => {
    const live = event('live', '2026-10-02T00:00:00Z', { start_at: '2026-10-05T11:00:00Z', end_at: '2026-10-05T13:00:00Z' });
    expect(mergeAnnouncements([], [live], now)).toHaveLength(1);
  });

  it('applies the limit to the combined list, not to each source', () => {
    const feed = mergeAnnouncements(
      [post('p1', '2026-10-01T00:00:00Z')],
      [event('e1', '2026-10-04T00:00:00Z'), event('e2', '2026-10-03T00:00:00Z')], now, 2);
    expect(feed.map((i) => i.id)).toEqual(['e1', 'e2']);
  });

  it('does not leak its internal sort key', () => {
    expect(mergeAnnouncements([post('p1', '2026-10-01T00:00:00Z')], [], now)[0]).not.toHaveProperty('sortAt');
  });

  it('copes with nothing at all', () => {
    expect(mergeAnnouncements(undefined, undefined, now)).toEqual([]);
  });
});

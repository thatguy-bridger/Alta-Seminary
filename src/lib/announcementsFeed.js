import { isAnnounced } from './eventPhase.js';

// The announcements feed is announcements PLUS events that opted in (their
// "Show in announcements" toggle) and haven't ended yet. Merged newest-first by
// when each went live, then cut to the block's limit -- the limit applies to
// the combined list, so a busy week of events can't push every post off it.
//
// Each item says what it is (`kind`) so the card can link to /events/<slug> or
// /announcements/<slug> and show an event's own date rather than a publish date.
export function mergeAnnouncements(posts, events, now = new Date(), limit = Infinity) {
  const fromPosts = (posts || []).map((p) => ({ ...p, kind: 'announcement', sortAt: p.published_at }));
  const fromEvents = (events || [])
    .filter((e) => isAnnounced(e, now))
    .map((e) => ({
      id: e.id, slug: e.slug, title: e.title, excerpt: e.description || '', published_at: e.published_at,
      kind: 'event', event: { start_at: e.start_at, end_at: e.end_at, all_day: e.all_day, location: e.location },
      sortAt: e.published_at,
    }));
  return [...fromPosts, ...fromEvents]
    .sort((a, b) => new Date(b.sortAt || 0) - new Date(a.sortAt || 0))
    .slice(0, limit)
    .map(({ sortAt, ...item }) => item);
}

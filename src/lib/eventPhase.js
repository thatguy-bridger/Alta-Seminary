// Is an event upcoming, happening now, or over? Everything about "archiving"
// an event is derived from this plus the clock -- there is no archived flag to
// set, forget, or get out of sync, and no scheduled job that has to run:
// the moment an event ends it simply reads as past, everywhere, at once.

// A timed event with no end time is treated as lasting this long. (Most
// assemblies and socials do; an admin who knows better sets an end time.)
const DEFAULT_TIMED_DURATION_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// When the event is over. An all-day event stores midnight of its FIRST day as
// the start, and midnight of its LAST day as the optional end -- it runs
// through that whole last day, so it ends a day after whichever it is.
export function eventEnd(event) {
  const start = new Date(event.start_at);
  if (event.all_day) return new Date((event.end_at ? new Date(event.end_at) : start).getTime() + DAY_MS);
  return event.end_at ? new Date(event.end_at) : new Date(start.getTime() + DEFAULT_TIMED_DURATION_MS);
}

// 'upcoming' | 'live' | 'past'
export function eventPhase(event, now = new Date()) {
  if (now < new Date(event.start_at)) return 'upcoming';
  return now < eventEnd(event) ? 'live' : 'past';
}

export const isPast = (event, now = new Date()) => eventPhase(event, now) === 'past';

// Shown in the announcements feed: opted in, published, and not yet over.
export function isAnnounced(event, now = new Date()) {
  return event.status === 'published' && !!event.show_in_announcements && !isPast(event, now);
}

// "archive" is reserved for /events/archive, so no event may take that slug.
export const RESERVED_EVENT_SLUGS = ['archive'];

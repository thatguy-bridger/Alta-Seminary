// Every date/time shown on the PUBLIC site goes through here, pinned to one
// locale and one time zone -- the seminary's own (Sandy, Utah).
//
// Why not just toLocaleDateString(undefined, ...) like before? "undefined"
// means "whatever locale and time zone the code happens to be running in".
// Public pages render twice: once on the server (UTC, en-US) and again in the
// visitor's browser when React hydrates. A date near midnight, or any event
// time, then formats as DIFFERENT TEXT in the two places, which React treats
// as a hydration mismatch (error #418): it throws away the server-rendered
// HTML for that whole tree and re-renders it from scratch in the browser --
// flashing the page and, worse, dropping anything that only renders correctly
// as server HTML (that's what made full-width header images lose their
// edge-to-edge width on exactly the pages that show dates).
//
// It's also simply more correct: an assembly at 12:30 PM Utah time should read
// 12:30 PM for a parent in another state too, not their local equivalent.
export const SITE_TIME_ZONE = 'America/Denver';
const SITE_LOCALE = 'en-US';

export function formatSiteDate(iso, options = { month: 'short', day: 'numeric' }) {
  return new Date(iso).toLocaleDateString(SITE_LOCALE, { timeZone: SITE_TIME_ZONE, ...options });
}

export function formatSiteTime(iso, options = { hour: 'numeric', minute: '2-digit' }) {
  return new Date(iso).toLocaleTimeString(SITE_LOCALE, { timeZone: SITE_TIME_ZONE, ...options });
}

// "Friday, October 9, 2026 · 12:30 – 1:30 PM" -- the date line on an event's
// own page. Spelled out in full (weekday, long month) because it's the one
// place the date is the headline rather than a badge, and always written in
// the seminary's time zone for the same reason as everything above.
//   all-day:   "Friday, October 9, 2026"  /  "Friday, October 9 – Sunday, October 11, 2026"
//   timed:     "Friday, October 9, 2026 · 12:30 – 1:30 PM"  (or "12:30 PM" with no end,
//              or both full dates if it runs past midnight)
export function formatEventWhen(event) {
  const day = { weekday: 'long', month: 'long', day: 'numeric' };
  const dayYear = { ...day, year: 'numeric' };
  const sameDay = (a, b) => formatSiteDate(a, dayYear) === formatSiteDate(b, dayYear);

  if (event.all_day) {
    if (!event.end_at || sameDay(event.start_at, event.end_at)) return formatSiteDate(event.start_at, dayYear);
    return `${formatSiteDate(event.start_at, day)} – ${formatSiteDate(event.end_at, dayYear)}`;
  }
  const start = formatSiteTime(event.start_at);
  if (!event.end_at) return `${formatSiteDate(event.start_at, dayYear)} · ${start}`;
  if (sameDay(event.start_at, event.end_at)) {
    // "12:30 – 1:30 PM" when both are the same half of the day, else spell both out.
    const end = formatSiteTime(event.end_at);
    const [startClock, startAmPm] = start.split(' ');
    const [, endAmPm] = end.split(' ');
    const range = startAmPm === endAmPm ? `${startClock} – ${end}` : `${start} – ${end}`;
    return `${formatSiteDate(event.start_at, dayYear)} · ${range}`;
  }
  return `${formatSiteDate(event.start_at, dayYear)}, ${start} – ${formatSiteDate(event.end_at, dayYear)}, ${formatSiteTime(event.end_at)}`;
}

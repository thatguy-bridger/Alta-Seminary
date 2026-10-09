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

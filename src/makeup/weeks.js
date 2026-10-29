// Come, Follow Me is published one lesson a week, Monday to Sunday, and the Church gives each week's lesson its dates. This is how
// the journey and the admin think about those weeks. Pure and free of time zones: a day is a calendar date ("2026-10-28") and
// everything is counted in whole days, so a phone set to a different time zone cannot land a student in the wrong week.
//
// A "week" is a lesson with a week_start and a week_end (both included). The student is shown the week that today falls in; if
// they missed earlier weeks they can choose one of those instead. Weeks that have not begun yet are never offered.

const DAY_MS = 86400000;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = (n) => String(n).padStart(2, '0');

// '2026-10-28' -> { y, m, d }, or null if it is not a real calendar date.
export function parseDay(s) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? '').trim());
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(y, m - 1, d));
  return check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d ? { y, m, d } : null;
}
export const dayNumber = (s) => { const p = parseDay(s); return p ? Math.round(Date.UTC(p.y, p.m - 1, p.d) / DAY_MS) : NaN; };
export const dayFromNumber = (n) => { const t = new Date(n * DAY_MS); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; };

// Today on the student's own calendar.
export const todayLocal = (now = new Date()) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

export const isWeekly = (l) => !!l && l.kind === 'comefollowme';
export const hasWeek = (l) => !!l && Number.isFinite(dayNumber(l.week_start)) && Number.isFinite(dayNumber(l.week_end)) && dayNumber(l.week_end) >= dayNumber(l.week_start);

// "January 5–11", or "December 29–January 4" across a month. Written the way the Church writes it.
export function weekLabel(l) {
  if (!hasWeek(l)) return '';
  const a = parseDay(l.week_start), b = parseDay(l.week_end);
  return a.m === b.m ? `${MONTHS[a.m - 1]} ${a.d}–${b.d}` : `${MONTHS[a.m - 1]} ${a.d}–${MONTHS[b.m - 1]} ${b.d}`;
}

export const isCurrentWeek = (l, day) => hasWeek(l) && dayNumber(day) >= dayNumber(l.week_start) && dayNumber(day) <= dayNumber(l.week_end);

const byStartAsc = (a, b) => dayNumber(a.week_start) - dayNumber(b.week_start) || String(a.id).localeCompare(String(b.id));

// The weeks a student may choose from: every week that has begun, newest first. Before the first week has begun, that week alone
// (so there is always something to show). Lessons with no usable dates are not weeks.
export function weeksUpTo(lessons, day) {
  const weeks = (lessons || []).filter((l) => isWeekly(l) && hasWeek(l)).sort(byStartAsc);
  const begun = weeks.filter((l) => dayNumber(l.week_start) <= dayNumber(day));
  return (begun.length ? begun : weeks.slice(0, 1)).slice().reverse();
}

// The week today falls in. After the last week, or between two courses, the most recent one; before the first, the first.
export const currentWeek = (lessons, day) => weeksUpTo(lessons, day)[0] || null;

// Which lessons to give for `count` Come, Follow Me picks in one journey: the chosen week first (this week unless the student chose
// another), then the weeks before it, one at a time, then any later weeks that have begun. A week is not repeated while another is available.
export function chooseWeeks(lessons, count, { day, weekId = '' } = {}) {
  const avail = weeksUpTo(lessons, day);
  if (!avail.length || count < 1) return [];
  const at = Math.max(0, avail.findIndex((l) => l.id === weekId));
  const order = [avail[at], ...avail.slice(at + 1), ...avail.slice(0, at).reverse()];
  return Array.from({ length: count }, (_, i) => order[i % order.length].id);
}

// What the student sees in the "Which week?" list.
export function weekOptions(lessons, day) {
  const avail = weeksUpTo(lessons, day);
  return avail.map((l) => ({ id: l.id, current: isCurrentWeek(l, day), label: `${weekLabel(l)}${isCurrentWeek(l, day) ? ' (this week)' : ''}`, title: l.title || '', reference: l.reference || '' }));
}

// Turns the database's usage summary into what the Usage card shows. Pure, so it can be tested without a screen.
export const AREAS = [{ value: 'site', label: 'Public site' }, { value: 'makeup', label: 'Makeup Work' }, { value: 'admin', label: 'Admin' }];
export const RANGES = [{ value: 7, label: '7 days' }, { value: 30, label: '30 days' }, { value: 90, label: '90 days' }];

const STEP_ORDER = ['begin', 'choose', 'learn', 'truth', 'understand', 'commit', 'done'];
const STEP_LABEL = { begin: 'Started', choose: 'Chose how to learn', learn: 'Studied a lesson', truth: 'Found a truth', understand: 'Wrote their thoughts', commit: 'Made a commitment', done: 'Finished' };
const ACTION_LABEL = { notes: 'Opened their notes', scripture: 'Opened a scripture', 'timeline-red': 'Tapped a skipped part', back: 'Went back a step', forward: 'Went forward a step', start: 'Began a new journey', resumed: 'Came back to a saved place' };

const LESSON_LABEL = { scripture: 'Studied a scripture chapter', talk: 'Studied a talk', audio: 'Studied a recording', video: 'Studied a video', comefollowme: 'Studied a Come, Follow Me lesson', proclamation: 'Studied a proclamation', lesson: 'Studied a lesson' };

export function prettyName(name, area) {
  const n = String(name || '');
  if (area === 'makeup') {
    if (ACTION_LABEL[n]) return ACTION_LABEL[n];
    if (n.startsWith('lesson:')) return LESSON_LABEL[n.slice(7)] || `Studied a ${n.slice(7)} lesson`;
  }
  return n;
}

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

// "Visitors are up 24% in the second half of this period" (or down, or steady), from the daily counts.
export function trendText(daily) {
  const days = Array.isArray(daily) ? daily : [];
  if (days.length < 4) return 'Not enough days yet to show a trend.';
  const half = Math.floor(days.length / 2);
  const sum = (xs) => xs.reduce((n, d) => n + (Number(d.visitors) || 0), 0);
  const early = sum(days.slice(0, half)), late = sum(days.slice(days.length - half));
  if (early === 0 && late === 0) return 'No visitors in this period yet.';
  if (early === 0) return 'Visitors have started coming in the second half of this period.';
  const change = Math.round(((late - early) / early) * 100);
  if (Math.abs(change) < 5) return 'Visitors are steady across this period.';
  return `Visitors are ${change > 0 ? 'up' : 'down'} ${Math.abs(change)}% in the second half of this period.`;
}

export function summarizeUsage(data, area) {
  const d = data || {};
  const visitors = Number(d.visitors) || 0;
  const steps = (Array.isArray(d.steps) ? d.steps : []).filter((s) => STEP_ORDER.includes(s.name)).sort((a, b) => STEP_ORDER.indexOf(a.name) - STEP_ORDER.indexOf(b.name));
  const started = steps.find((s) => s.name === 'begin')?.count || steps[0]?.count || 0;
  return {
    tiles: [
      { label: 'Visitors', value: visitors },
      { label: 'Visits', value: Number(d.visits) || 0 },
      { label: area === 'makeup' ? 'Steps taken' : 'Page views', value: area === 'makeup' ? steps.reduce((n, s) => n + (Number(s.count) || 0), 0) : Number(d.views) || 0 },
      { label: 'Came back', value: `${pct(Number(d.returning) || 0, visitors)}%`, note: 'of visitors had been before' },
    ],
    trend: trendText(d.daily),
    daily: (Array.isArray(d.daily) ? d.daily : []).map((x) => ({ day: x.day, visitors: Number(x.visitors) || 0 })),
    top: (Array.isArray(d.top) ? d.top : []).map((t) => ({ name: prettyName(t.name, area), count: Number(t.count) || 0, visitors: Number(t.visitors) || 0 })),
    entries: (Array.isArray(d.entries) ? d.entries : []).map((t) => ({ name: t.name, count: Number(t.count) || 0 })),
    paths: (Array.isArray(d.paths) ? d.paths : []).map((t) => ({ from: t.from, to: t.to, count: Number(t.count) || 0 })),
    funnel: steps.map((s) => ({ name: STEP_LABEL[s.name], count: Number(s.count) || 0, share: pct(Number(s.count) || 0, started) })),
    empty: !visitors && !(Number(d.views) || 0) && steps.length === 0,
  };
}

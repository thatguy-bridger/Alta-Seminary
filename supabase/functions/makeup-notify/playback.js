// What a student really played of a recording or video: the timeline they see (played in green, skipped in red) and the
// detail their teacher is given. Pure and free of imports, because the email function carries an identical copy of this file.
//
// Seconds are whole. A `seen` range is [from, to] with BOTH ends included (the shape the played-time tracker saves); a
// `skipped` range is [from, to) with the first second included and the last not. `reached` is the furthest the playhead has
// been, even if it only got there by jumping. Everything before that point that was not played is skipped; what is after it
// has simply not been reached yet.

export const clock = (seconds) => {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
};

// Green for what was played, red for what was skipped, grey for what the student has not got to.
export const COLORS = { played: '#3f9d78', skipped: '#d6455d', ahead: 'rgba(140,140,150,.35)' };

const MAX = 86400;
const whole = (n) => (Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), MAX) : 0);
const validRange = (r) => Array.isArray(r) && Number.isFinite(r[0]) && Number.isFinite(r[1]) && r[1] >= r[0];

// Where the playhead has been, as a whole second: the one it is on now is not judged yet.
const limitOf = (reached, duration) => whole(duration > 0 ? Math.min(reached, duration) : reached);

// The parts before the furthest point that were never played.
export function skippedRanges(seen, reached, duration) {
  const limit = limitOf(reached, duration);
  const played = (Array.isArray(seen) ? seen : []).filter(validRange).map(([a, b]) => [whole(a), whole(b) + 1]).sort((x, y) => x[0] - y[0]);
  const gaps = [];
  let cursor = 0;
  for (const [from, to] of played) {
    if (cursor >= limit) break;
    if (from > cursor) gaps.push([cursor, Math.min(from, limit)]);
    cursor = Math.max(cursor, to);
  }
  if (cursor < limit) gaps.push([cursor, limit]);
  return gaps.filter(([a, b]) => b > a);
}

export const skippedTotal = (gaps) => (Array.isArray(gaps) ? gaps : []).reduce((n, r) => n + (validRange(r) ? r[1] - r[0] : 0), 0);

// "1:05 to 1:40, 3:10 to 3:15 and 2 more"
export function describeRanges(gaps, max = 6) {
  const list = (Array.isArray(gaps) ? gaps : []).filter(validRange);
  const shown = list.slice(0, max).map(([a, b]) => `${clock(a)} to ${clock(b)}`).join(', ');
  return list.length > max ? `${shown} and ${list.length - max} more` : shown;
}

// One lesson's playback as it is saved with a submission, and shown to the teacher.
export function mediaDetail({ id, title, kind, duration, seen, reached, played }) {
  const d = Number.isFinite(duration) && duration > 0 ? Math.min(duration, MAX) : 0;
  const cleanSeen = (Array.isArray(seen) ? seen : []).filter(validRange).map(([a, b]) => [whole(a), whole(b)]);
  return {
    source_id: String(id || ''), title: String(title || ''), kind: String(kind || ''), duration: Math.round(d),
    played: whole(played), reached: Math.round(Math.min(Number.isFinite(reached) ? Math.max(reached, 0) : 0, d || MAX)),
    seen: cleanSeen, skipped: skippedRanges(cleanSeen, reached, d),
  };
}

// The whole length laid out as pieces: played, skipped, and not reached yet. Always covers 0 to the duration.
export function timelineParts(seen, reached, duration) {
  const total = whole(duration);
  if (!total) return [];
  const limit = limitOf(reached, total);
  const played = new Uint8Array(total);
  for (const r of Array.isArray(seen) ? seen : []) {
    if (!validRange(r)) continue;
    for (let s = whole(r[0]); s <= Math.min(whole(r[1]), total - 1); s++) played[s] = 1;
  }
  const parts = [];
  for (let s = 0; s < total; s++) {
    const kind = played[s] ? 'played' : s < limit ? 'skipped' : 'ahead';
    const tail = parts[parts.length - 1];
    if (tail && tail.kind === kind) tail.to = s + 1; else parts.push({ kind, from: s, to: s + 1 });
  }
  return parts;
}

// Where to start when a student taps a skipped part: the beginning of the first transcript line that touches it, not the exact
// second they skipped. A line that began just before the skip counts (it is where that part of the talk starts, and playing from
// there covers all of the red). If no line touches it, the part's own start.
export function skipStart(transcript, from, to) {
  const lines = (Array.isArray(transcript) ? transcript : []).filter((l) => l && Number.isFinite(l.start)).sort((a, b) => a.start - b.start);
  for (let i = 0; i < lines.length; i++) {
    const end = Number.isFinite(lines[i].end) ? lines[i].end : (i + 1 < lines.length ? lines[i + 1].start : Infinity);
    if (end > from && lines[i].start < to) return lines[i].start;
  }
  return from;
}

// "Played 3:12 of 10:00. Skipped 1:05 in 2 parts: 1:05 to 1:40, 3:10 to 3:15."
export function summarize({ duration, played, skipped }) {
  const gaps = Array.isArray(skipped) ? skipped : [];
  const out = [`Played ${clock(played)} of ${clock(duration)}.`];
  if (gaps.length) out.push(`Skipped ${clock(skippedTotal(gaps))} in ${gaps.length} part${gaps.length > 1 ? 's' : ''}: ${describeRanges(gaps)}.`);
  return out.join(' ');
}

// A submission's saved playback, tidied for reading, one entry per recording or video: skip anything that is not a lesson with a
// length, work the skipped parts out again from what was played (so they can be trusted), and put it in words.
export function playbackLines(media) {
  return (Array.isArray(media) ? media : []).filter((m) => m && typeof m === 'object' && Number(m.duration) > 0).map((m) => {
    const duration = whole(Number(m.duration));
    const seen = (Array.isArray(m.seen) ? m.seen : []).filter(validRange);
    const reached = Number.isFinite(Number(m.reached)) ? Number(m.reached) : 0;
    const skipped = skippedRanges(seen, reached, duration);
    const played = whole(Number(m.played));
    return { title: String(m.title || 'A lesson'), kind: String(m.kind || ''), duration, played, reached, seen, skipped,
      summary: `${summarize({ duration, played, skipped })}${skipped.length ? '' : ' Nothing skipped.'}` };
  });
}

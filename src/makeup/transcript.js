// Transcripts for the videos and audio students learn from. Every segment has
// a start and end time in seconds, so the player can highlight the line being
// spoken, a student can click a line to jump there, and "where did you find
// this truth" can be a real moment ("Faith in action, 2:41"). A transcript is
// also the captions for anyone who cannot hear the audio, so video and audio
// sources are required to have one.

const MAX_SEGMENTS = 6000;

// "00:01:02.500", "01:02.500", "1:02,5" -> seconds, or null.
export function parseTime(raw) {
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/.exec(String(raw).trim());
  if (!m) return null;
  const [, h = '0', mm, ss, frac = '0'] = m;
  if (Number(ss) > 59) return null;
  return Number(h) * 3600 + Number(mm) * 60 + Number(ss) + Number(frac.padEnd(3, '0')) / 1000;
}

export function formatTimestamp(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

// A transcript back into WebVTT text, so an existing one can be opened for editing in the same box used to add one.
const pad2 = (n) => String(n).padStart(2, '0');
const vttTime = (sec) => { const t = Math.max(0, sec); return `${pad2(Math.floor(t / 3600))}:${pad2(Math.floor((t % 3600) / 60))}:${(t % 60).toFixed(3).padStart(6, '0')}`; };
export const segmentsToVtt = (segs) => `WEBVTT\n\n${(segs || []).map((s) => `${vttTime(s.start)} --> ${vttTime(s.end)}\n${s.text}`).join('\n\n')}\n`;

export const timestampRef = (title, seconds) => `${title} · ${formatTimestamp(seconds)}`;

const cleanText = (t) => t.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

// Reads WebVTT or SRT text (the two formats captions come in). Returns
// { segments, errors }. Plain text with no times is reported, not guessed at.
export function parseTranscript(input) {
  const text = String(input || '').replace(/\r/g, '').replace(/^﻿/, '');
  const errors = [];
  const blocks = text.split(/\n{2,}/);
  const segments = [];
  let sawTiming = false;
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    if (!lines.length || /^(WEBVTT|NOTE|STYLE|REGION)/.test(lines[0])) continue;
    const ti = lines.findIndex((l) => l.includes('-->'));
    if (ti === -1) continue;
    sawTiming = true;
    const [a, b] = lines[ti].split('-->').map((x) => x.trim().split(/\s+/)[0]);
    const start = parseTime(a), end = parseTime(b);
    const body = cleanText(lines.slice(ti + 1).join(' '));
    if (start === null || end === null) { errors.push(`Could not read the time "${lines[ti].trim()}".`); continue; }
    if (!body) continue;
    segments.push({ start: Math.round(start * 100) / 100, end: Math.round(end * 100) / 100, text: body });
  }
  if (!sawTiming && text.trim()) errors.push('No timestamps found. Upload a .vtt or .srt caption file, not plain text.');
  if (segments.length > MAX_SEGMENTS) errors.push(`Too many lines (${segments.length}); the limit is ${MAX_SEGMENTS}.`);
  return { segments: normalizeSegments(segments), errors };
}

// Sorted, end not before start, empty lines removed.
export function normalizeSegments(segs) {
  return (segs || [])
    .filter((s) => s && Number.isFinite(s.start) && Number.isFinite(s.end) && typeof s.text === 'string' && s.text.trim() && s.start >= 0)
    .map((s) => ({ start: s.start, end: Math.max(s.end, s.start + 0.5), text: s.text.trim() }))
    .sort((a, b) => a.start - b.start)
    .slice(0, MAX_SEGMENTS);
}

// The line that most recently began, which stays current through a pause in the speaking until the next line starts.
// (The transcript view uses this so the highlight never goes dark and the lines never all dim at once.)
export function currentIndex(segs, t) {
  let lo = 0, hi = segs.length - 1, found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (segs[mid].start <= t) { found = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return found;
}

// Which line is being spoken at time t? Short gaps between lines keep the previous one lit.
export function activeIndex(segs, t, gap = 1.5) {
  let lo = 0, hi = segs.length - 1, found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (segs[mid].start <= t) { found = mid; lo = mid + 1; } else hi = mid - 1;
  }
  if (found === -1) return -1;
  return t < segs[found].end + gap ? found : -1;
}

export const transcriptText = (segs) => segs.map((s) => s.text).join(' ');

// How much of the media the transcript covers (0 to 1). A low number usually means a missing half.
export function coverage(segs, durationSeconds) {
  if (!segs.length || !(durationSeconds > 0)) return 0;
  const spoken = segs.reduce((n, s) => n + Math.max(0, Math.min(s.end, durationSeconds) - Math.min(s.start, durationSeconds)), 0);
  return Math.min(1, spoken / durationSeconds);
}

// What an admin needs to know before saving: is it usable, and is anything odd?
export function checkTranscript(segs, durationSeconds) {
  const problems = [], warnings = [];
  if (!segs.length) problems.push('The transcript has no lines.');
  if (!(durationSeconds > 0)) problems.push('Add the length of the video or audio.');
  if (segs.length && durationSeconds > 0) {
    const last = segs[segs.length - 1];
    if (last.start > durationSeconds + 2) problems.push(`The transcript runs past the end (${formatTimestamp(last.start)} against ${formatTimestamp(durationSeconds)}).`);
    const cov = coverage(segs, durationSeconds);
    if (cov < 0.5) warnings.push(`The transcript only covers ${Math.round(cov * 100)}% of the ${formatTimestamp(durationSeconds)}. Is part of it missing?`);
  }
  return { ok: problems.length === 0, problems, warnings };
}

// How much of a video/audio the student actually played (scrubbing past a part does not count).
export const playedFraction = (playedSeconds, durationSeconds) => (durationSeconds > 0 ? Math.min(1, playedSeconds / durationSeconds) : 0);

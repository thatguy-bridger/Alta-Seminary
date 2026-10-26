// Keeps a student's place in the Makeup Work journey on their own device, so closing the page (or the phone) and coming
// back puts everything where it was: the answers, the notes, how much of each lesson was played, and the numbers behind the
// teacher's signal. It is only ever written by the student page, and only to this browser.
//
// Nothing read back is trusted: storage may be old, damaged, or edited, and the lessons or classes may have changed since
// it was written. Everything is checked and fitted to what exists now, and a save that cannot be used is dropped.
import { STEPS, initialState, sourcesNeeded } from './journey.js';
import { fromRanges, toRanges } from './playedTracker.js';

export const PROGRESS_KEY = 'alta-makeup-progress';
export const PROGRESS_VERSION = 1;
export const KEEP_DAYS = 14;               // a save this old is let go; a returning student starts fresh
const DAY_MS = 24 * 3600 * 1000;
const TEXT_MAX = 6000, NOTES_MAX = 30000;

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const text = (v, max = TEXT_MAX) => (typeof v === 'string' ? v.slice(0, max) : '');
const count = (v, max = 1e9) => (Number.isFinite(v) && v >= 0 ? Math.min(v, max) : 0);
const whole = (v, max) => Math.floor(count(v, max));
const strings = (v, limit = 20) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, limit) : []);
const textMap = (v, limit = 200) => (isObj(v) ? Object.fromEntries(Object.entries(v).filter(([, t]) => typeof t === 'string').slice(0, limit).map(([k, t]) => [k.slice(0, 200), t.slice(0, TEXT_MAX)])) : {});

export const emptyTotals = () => ({ watched: 0, source: 0, readSeconds: 0, muted: 0 });
export const learnKey = (index, sourceId) => `${index}:${sourceId}`;

// Is there anything worth keeping? A page that was only opened is not saved.
export const hasProgress = (S, notes = '') => !!(S && (S.step > 0 || S.name.trim() || S.days > 0 || notes.trim()));

function cleanState(raw) {
  const r = isObj(raw) ? raw : {};
  const base = initialState();
  return {
    ...base,
    step: whole(r.step, STEPS.length - 2),                  // a finished journey is never saved
    learnIndex: whole(r.learnIndex, 20),
    name: text(r.name, 200), cls: text(r.cls, 100), code: text(r.code, 200), closer: text(r.closer, 400), word: text(r.word, 200),
    days: whole(r.days, 20), styleOffset: whole(r.styleOffset, 1000), voiceSeconds: whole(r.voiceSeconds, 36000),
    mode: r.mode === 'voice' ? 'voice' : 'text',
    truth: text(r.truth), where: text(r.where, 400), whereSeconds: Number.isFinite(r.whereSeconds) && r.whereSeconds >= 0 ? r.whereSeconds : null,
    understanding: text(r.understanding), text: text(r.text), inv: text(r.inv, 100), commit: text(r.commit), bless: text(r.bless),
    settled: r.settled === true, learned: r.learned === true,
    sourceIds: strings(r.sourceIds, 8), picks: strings(r.picks, 8),
  };
}

function cleanLearn(raw) {
  if (!isObj(raw) || typeof raw.key !== 'string') return null;
  return {
    key: raw.key.slice(0, 200), played: whole(raw.played, 86400), duration: count(raw.duration, 86400), readSeconds: whole(raw.readSeconds, 86400), mutedPlayed: whole(raw.mutedPlayed, 86400),
    time: count(raw.time, 86400), seen: toRanges(new Set(fromRanges(raw.seen))), quiet: toRanges(new Set(fromRanges(raw.quiet))),
  };
}

function cleanCites(raw) {
  return (Array.isArray(raw) ? raw : []).slice(0, 100)
    .filter((c) => isObj(c) && typeof c.sourceId === 'string' && Number.isFinite(c.seconds) && c.seconds >= 0)
    .map((c) => ({ sourceId: c.sourceId.slice(0, 100), title: text(c.title, 300), seconds: c.seconds }));
}

// What the student page needs to put things back, or null when there is nothing usable.
export function readProgress(storage, { now = Date.now(), classes = [], sources = [] } = {}) {
  let saved;
  try { saved = JSON.parse(storage.getItem(PROGRESS_KEY) || 'null'); } catch { return null; }
  if (!isObj(saved) || saved.v !== PROGRESS_VERSION || !Number.isFinite(saved.savedAt)) return null;
  if (now - saved.savedAt > KEEP_DAYS * DAY_MS || saved.savedAt - now > DAY_MS) return null;   // too old, or from a clock that was wrong

  const S = cleanState(saved.S);
  const notes = text(saved.notes, NOTES_MAX);
  let learn = cleanLearn(saved.learn);
  let totals = { ...emptyTotals(), ...(isObj(saved.totals) ? Object.fromEntries(Object.keys(emptyTotals()).map((k) => [k, count(saved.totals[k], 1e7)])) : {}) };

  // Fit it to what exists now.
  if (S.cls && !classes.some((c) => c.id === S.cls)) S.cls = '';
  if (!S.cls && S.step > 0) S.step = 0;                                      // their class is gone: choose again
  const known = new Set(sources.map((x) => x.id));
  if (S.sourceIds.some((id) => !known.has(id))) {                            // a lesson was removed: choose again, keep the rest
    S.sourceIds = []; S.picks = []; S.learned = false; S.learnIndex = 0; learn = null;
    totals = emptyTotals();
    if (S.step > STEPS.indexOf('choose')) S.step = STEPS.indexOf('choose');
  }
  if (S.sourceIds.length && S.sourceIds.length !== sourcesNeeded(S.days)) { S.sourceIds = []; S.picks = []; S.learned = false; learn = null; if (S.step > STEPS.indexOf('choose')) S.step = STEPS.indexOf('choose'); }
  if (S.learnIndex >= Math.max(1, S.sourceIds.length)) S.learnIndex = 0;
  if (learn && S.sourceIds[S.learnIndex] !== learn.key.split(':').slice(1).join(':')) learn = null;   // it was for a different lesson

  if (!hasProgress(S, notes)) return null;
  const tr = isObj(saved.tracker) ? saved.tracker : {};
  return {
    S, notes, learn, totals, savedAt: saved.savedAt,
    cites: cleanCites(saved.cites),
    pauseAnswers: textMap(saved.pauseAnswers), pauseDrafts: textMap(saved.pauseDrafts),
    tracker: { stats: isObj(tr.stats) ? tr.stats : {}, prevLen: isObj(tr.prevLen) ? tr.prevLen : {} },
    voiceParts: { under: whole(saved.voiceParts?.under, 36000), feel: whole(saved.voiceParts?.feel, 36000) },
    // A save made while the page was being hidden was probably the page being closed. That is not the student leaving
    // the page while writing, so it does not count toward the "left the page" signal.
    closed: saved.hidden === true,
  };
}

// Returns true when it was saved. Storage can be full, blocked, or missing (private windows): then nothing is kept, and
// the journey carries on as it always did.
export function writeProgress(storage, data, { now = Date.now(), hidden = false } = {}) {
  try { storage.setItem(PROGRESS_KEY, JSON.stringify({ v: PROGRESS_VERSION, savedAt: now, hidden, ...data })); return true; } catch { return false; }
}

export function clearProgress(storage) {
  try { storage.removeItem(PROGRESS_KEY); } catch { /* nothing to clear */ }
}

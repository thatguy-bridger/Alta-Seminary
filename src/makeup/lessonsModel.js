import { AV_KINDS } from './content.js';
import { mediaKind } from './media.js';
import { cleanPauses, splitParagraphs, PAUSE_MAX } from './pauses.js';
import { isSafeImageUrl } from './thumbnails.js';
import { parseTranscript, checkTranscript, parseTime, formatTimestamp } from './transcript.js';

// How the admin Lessons page thinks about lessons: types and collections, what to show, what needs attention,
// and what a lesson must have before students can see it. Pure functions, so they can be tested.

export const KINDS = [
  { value: 'scripture', label: 'Scripture', plural: 'Scriptures', blurb: 'Chapters and passages, read in the app.' },
  { value: 'talk', label: 'Conference talk', plural: 'Conference talks', blurb: 'The text of a talk, read in the app.' },
  { value: 'video', label: 'Video', plural: 'Videos', blurb: 'Watched, with a live transcript beside it.' },
  { value: 'audio', label: 'Audio', plural: 'Audio', blurb: 'Listened to, with a live transcript.' },
  { value: 'proclamation', label: 'Proclamation', plural: 'Proclamations', blurb: 'An in-depth study, once per student.' },
  { value: 'lesson', label: 'Self-guided lesson', plural: 'Self-guided lessons', blurb: 'Your own lesson, written here.' },
  { value: 'podcast', label: 'Podcast', plural: 'Podcasts', blurb: 'Listened to, with a live transcript.' },
];
export const kindInfo = (k) => KINDS.find((x) => x.value === k) || { value: k, label: k, plural: k, blurb: '' };
export const isTextKind = (k) => !AV_KINDS.includes(k);

/* ---------- collections: the group a lesson belongs to inside its type ---------- */
export const NO_COLLECTION = 'No collection yet';
export const collectionOf = (l) => (l.series || '').trim() || NO_COLLECTION;

const STANDARD_WORKS = ['Old Testament', 'New Testament', 'Book of Mormon', 'Doctrine and Covenants', 'Pearl of Great Price'];
const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
const conferenceRank = (name) => { const m = /^([A-Za-z]+)\s+(\d{4})/.exec(name); return m && MONTHS[m[1].toLowerCase()] ? Number(m[2]) * 12 + MONTHS[m[1].toLowerCase()] : -1; };

// The standard works in their usual order, conferences newest first, then everything else alphabetically.
export function compareCollections(a, b) {
  const ia = STANDARD_WORKS.indexOf(a), ib = STANDARD_WORKS.indexOf(b);
  if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  const ra = conferenceRank(a), rb = conferenceRank(b);
  if (ra !== rb) return rb - ra;
  if (a === NO_COLLECTION) return 1;
  if (b === NO_COLLECTION) return -1;
  return a.localeCompare(b);
}

/* ---------- what needs attention ---------- */
// Reasons a lesson cannot be shown to students yet (or is incomplete). Uses the light list, so it works from counts.
export function needsAttention(l) {
  const out = [];
  if (AV_KINDS.includes(l.kind)) {
    if (!mediaKind(l.embed_url || '')) out.push(l.embed_url ? 'Address cannot be played' : 'Needs an address');
    if (!l.transcript_lines) out.push('Needs a transcript');
    if (!l.duration_seconds) out.push('Needs a length');
  } else if (!l.body_words && !(l.kind === 'scripture' && (l.reference || '').trim())) out.push('Needs text');
  return out;
}

/* ---------- browsing ---------- */
const byOrder = (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.title).localeCompare(String(b.title));

export function typeTabs(lessons) {
  const present = KINDS.filter((k) => lessons.some((l) => l.kind === k.value));
  const known = new Set(KINDS.map((k) => k.value));
  const others = [...new Set(lessons.map((l) => l.kind).filter((k) => !known.has(k)))].map(kindInfo);
  return [{ value: '', label: 'All', plural: 'All lessons', count: lessons.length }, ...[...present, ...others].map((k) => ({ ...k, count: lessons.filter((l) => l.kind === k.value).length }))];
}

export function collectionsFor(lessons, kind) {
  const counts = new Map();
  for (const l of lessons) if (!kind || l.kind === kind) counts.set(collectionOf(l), (counts.get(collectionOf(l)) || 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => compareCollections(a.name, b.name));
}

export function filterLessons(lessons, { kind = '', collection = '', status = '', q = '' } = {}) {
  const needle = q.trim().toLowerCase();
  return lessons.filter((l) => {
    if (kind && l.kind !== kind) return false;
    if (collection && collectionOf(l) !== collection) return false;
    if (status === 'shown' && !l.active) return false;
    if (status === 'hidden' && l.active) return false;
    if (status === 'attention' && !needsAttention(l).length) return false;
    if (needle && ![l.title, l.reference, l.author, l.series, l.description, kindInfo(l.kind).label].some((f) => (f || '').toLowerCase().includes(needle))) return false;
    return true;
  });
}

// Sections for the page: one per collection, in order, each with its lessons in order. Within "All", type comes first.
export function sectionsFor(lessons) {
  const kindIndex = (k) => { const i = KINDS.findIndex((x) => x.value === k); return i === -1 ? 99 : i; };
  const map = new Map();
  for (const l of lessons) {
    const key = `${l.kind}\u0000${collectionOf(l)}`;
    if (!map.has(key)) map.set(key, { key, kind: l.kind, name: collectionOf(l), lessons: [] });
    map.get(key).lessons.push(l);
  }
  const sections = [...map.values()];
  for (const s of sections) s.lessons.sort(byOrder);
  return sections.sort((a, b) => kindIndex(a.kind) - kindIndex(b.kind) || compareCollections(a.name, b.name));
}

/* ---------- editing ---------- */
export const blankLesson = (kind = 'scripture', over = {}) => ({
  id: null, kind, title: '', description: '', reference: '', author: '', series: '', minutes: 6, one_time: false, active: false, sort_order: 0,
  body: '', embed_url: '', duration_text: '', thumbnail_url: '', guide_line: '', min_mode: 'auto', min_seconds: '', pauses: [], transcript_raw: null, transcript_lines: 0, origin_url: '', ...over,
});

// A database row into what the editor holds (text boxes hold text).
export function draftFromRow(row, existingLines = 0) {
  const text = isTextKind(row.kind);
  return {
    id: row.id, kind: row.kind, title: row.title || '', description: row.description || '', reference: row.reference || '', author: row.author || '', series: row.series || '',
    minutes: row.minutes ?? 6, one_time: !!row.one_time, active: !!row.active, sort_order: row.sort_order ?? 0, body: row.body || '', embed_url: row.embed_url || '',
    duration_text: row.duration_seconds ? formatTimestamp(row.duration_seconds) : '', thumbnail_url: row.thumbnail_url || '', guide_line: row.guide_line || '',
    min_mode: Number.isFinite(row.min_seconds) ? 'custom' : 'auto', min_seconds: Number.isFinite(row.min_seconds) ? String(row.min_seconds) : '',
    pauses: (Array.isArray(row.pauses) ? row.pauses : []).map((p) => ({ at: text ? String(p.at) : formatTimestamp(p.at), question: p.question || '' })),
    transcript_raw: null, transcript_lines: existingLines, origin_url: row.origin_url || '',
  };
}

export const parseLength = (raw) => { const t = String(raw ?? '').trim(); if (!t) return null; const v = parseTime(t); return v ?? (/^\d+(\.\d+)?$/.test(t) ? Number(t) : null); };
const parseAt = (raw, text) => (text ? (/^\d+$/.test(String(raw).trim()) ? Number(raw) : null) : parseLength(raw));

// Everything wrong or missing in a draft. `errors` stop a save; `showBlockers` only stop it being shown to students.
export function validateLesson(d) {
  const errors = {};
  const showBlockers = [];
  const text = isTextKind(d.kind);
  const av = !text;
  if (!d.title.trim()) errors.title = 'Give the lesson a title.';
  if (!(Number(d.minutes) >= 1 && Number(d.minutes) <= 240)) errors.minutes = 'Minutes should be between 1 and 240.';
  if (d.thumbnail_url.trim() && !isSafeImageUrl(d.thumbnail_url)) errors.thumbnail_url = 'Use an address that starts with https://, or upload a picture.';
  if (d.guide_line.length > 200) errors.guide_line = 'Keep the guiding line under 200 characters.';
  if (d.min_mode === 'custom' && !(/^\d+$/.test(String(d.min_seconds).trim()) && Number(d.min_seconds) <= 7200)) errors.min_seconds = 'Enter whole seconds, up to 7200.';

  const length = av ? parseLength(d.duration_text) : null;
  const segs = av && d.transcript_raw !== null ? parseTranscript(d.transcript_raw) : null;
  const lines = av ? (segs ? segs.segments.length : d.transcript_lines || 0) : 0;
  if (av) {
    if (d.embed_url.trim() && !mediaKind(d.embed_url.trim())) errors.embed_url = 'We can play YouTube links and direct audio or video files (.mp3, .m4a, .mp4, .webm). This address is neither.';
    if (d.duration_text.trim() && length === null) errors.duration_text = 'Write the length like 12:40.';
    if (segs) {
      if (segs.errors.length) errors.transcript = segs.errors[0];
      else { const chk = checkTranscript(segs.segments, length || 0); if (!chk.ok) errors.transcript = chk.problems[0]; }
    }
    if (!mediaKind(d.embed_url.trim())) showBlockers.push(d.embed_url.trim() ? 'the address cannot be played' : 'it needs a YouTube link or audio address');
    if (!lines) showBlockers.push('it needs a transcript');
    if (!length) showBlockers.push('it needs a length');
  } else if (!d.body.trim() && !(d.kind === 'scripture' && d.reference.trim())) showBlockers.push('it needs text');

  // pause questions
  const paragraphs = text ? splitParagraphs(d.body).length : 0;
  const rows = d.pauses.filter((p) => p.question.trim() || String(p.at).trim()).map((p) => ({ question: p.question.trim(), at: parseAt(p.at, text) }));
  let pauseProblem = '';
  if (rows.length > PAUSE_MAX) pauseProblem = `A lesson can have up to ${PAUSE_MAX} questions.`;
  const seen = new Set();
  for (const r of pauseProblem ? [] : rows) {
    const at = r.at === null ? null : text ? Math.floor(r.at) : Math.round(r.at);
    if (!r.question) pauseProblem = 'Every question needs its words.';
    else if (at === null) pauseProblem = text ? 'Say which paragraph each question comes after, like 2.' : 'Give each question a time, like 2:30.';
    else if (text ? (at < 1 || (paragraphs && at > paragraphs)) : (at < 1 || (length && at > length))) pauseProblem = text ? `Place each question after a paragraph that exists (1 to ${paragraphs || 'the last'}).` : 'Each question needs a time inside the lesson.';
    else if (seen.has(at)) pauseProblem = 'Two questions are in the same place. Move one.';
    if (pauseProblem) break;
    seen.add(at);
  }
  if (pauseProblem) errors.pauses = pauseProblem;
  const clean = cleanPauses(rows, { text, lengthSeconds: length || 0, paragraphs });
  return { errors, showBlockers, canShow: showBlockers.length === 0, ok: Object.keys(errors).length === 0, pauses: clean };
}

// The editor's draft into the columns to save. `transcript` is only included when it was edited.
export function rowFromDraft(d, { transcript } = {}) {
  const text = isTextKind(d.kind);
  const v = validateLesson(d);
  const length = text ? null : parseLength(d.duration_text);
  const row = {
    kind: d.kind, title: d.title.trim(), description: d.description.trim() || null, reference: d.reference.trim() || null, author: d.author.trim() || null,
    series: d.series.trim() || null, minutes: Math.round(Number(d.minutes)) || 6, one_time: !!d.one_time, active: !!d.active && v.canShow,
    body: text ? d.body.replace(/\r/g, '').trim() || null : null, embed_url: text ? null : d.embed_url.trim() || null,
    duration_seconds: length ? Math.round(length) : null, thumbnail_url: d.thumbnail_url.trim() || null, guide_line: d.guide_line.trim() || null,
    min_seconds: d.min_mode === 'custom' ? Math.round(Number(d.min_seconds)) : null, pauses: v.pauses, sort_order: d.sort_order ?? 0,
    origin_url: d.origin_url.trim() || null,
  };
  if (transcript !== undefined) row.transcript = transcript;
  return row;
}

// Has anything changed since the lesson was loaded? (Ignores the bookkeeping field.)
export const isDirty = (a, b) => JSON.stringify({ ...a, transcript_lines: 0 }) !== JSON.stringify({ ...b, transcript_lines: 0 });

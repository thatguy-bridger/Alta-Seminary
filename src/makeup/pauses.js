import { wordCount } from './journey.js';
import { AV_KINDS } from './content.js';
import { isStructured, readableUnits } from './lessonBlocks.js';

// Pause questions: a question that appears at a chosen moment of a lesson, and whose short answer goes to the teacher.
// For video and audio the moment is a time in seconds; for text it is "after paragraph N" (counting from 1).
export const PAUSE_MIN_WORDS = 3;     // a short answer, not a single word
export const PAUSE_MAX = 6;           // per lesson: a pause should be a pause, not a quiz

// The paragraphs of a lesson's text. Talks have blank lines between paragraphs; a scripture block may only have line breaks.
// A structured lesson (Come, Follow Me) counts what is read, not its headings: see lessonBlocks.js.
export function splitParagraphs(body, kind) {
  if (isStructured(kind)) return readableUnits(body);
  const t = String(body || '').replace(/\r/g, '').trim();
  if (!t) return [];
  const blocks = t.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  return blocks.length > 1 ? blocks : t.split(/\n+/).map((s) => s.trim()).filter(Boolean);
}

// Cleans what an admin typed (or the database holds) into a sorted list the journey can trust:
// no empty questions, no moment that could never come (past the end), no two at the same moment.
export function cleanPauses(pauses, { text = false, lengthSeconds = 0, paragraphs = 0 } = {}) {
  const seen = new Set();
  const out = [];
  for (const p of Array.isArray(pauses) ? pauses : []) {
    const question = String(p?.question ?? '').trim();
    const raw = Number(p?.at);
    if (!question || !Number.isFinite(raw)) continue;
    const at = text ? Math.floor(raw) : Math.round(raw);
    if (text ? (at < 1 || (paragraphs > 0 && at > paragraphs)) : (at < 1 || (lengthSeconds > 0 && at > lengthSeconds))) continue;
    if (seen.has(at)) continue;
    seen.add(at);
    out.push({ at, question });
  }
  return out.sort((a, b) => a.at - b.at).slice(0, PAUSE_MAX);
}

export const pauseKey = (sourceId, p) => `${sourceId}@${p.at}`;
export const isAnswered = (answers, key) => wordCount(answers?.[key]) >= PAUSE_MIN_WORDS;
export const allAnswered = (sourceId, pauses, answers) => pauses.every((p) => isAnswered(answers, pauseKey(sourceId, p)));

// Video or audio: the next question whose moment has been reached and is not yet answered. (Skipping ahead past one
// does not skip the question: it shows as soon as the time has passed it.)
export const nextDuePause = (sourceId, pauses, time, answers) => pauses.find((p) => p.at <= time && !isAnswered(answers, pauseKey(sourceId, p))) || null;

// What is sent with the submission: every answered question, in lesson order.
export function answersPayload(lessons, answers) {
  const out = [];
  for (const l of lessons) {
    for (const p of l.pauses || []) {
      const key = pauseKey(l.id, p);
      if (isAnswered(answers, key)) out.push({ source_id: l.id, lesson: l.title, unit: AV_KINDS.includes(l.kind) ? 'seconds' : 'paragraph', question: p.question, at: p.at, answer: String(answers[key]).trim() });
    }
  }
  return out;
}

// "after paragraph 3" for a text lesson, "at 2:41" for video and audio.
export const pauseWhere = (isText, at, formatTimestamp) => (isText ? `after paragraph ${at}` : `at ${formatTimestamp(at)}`);

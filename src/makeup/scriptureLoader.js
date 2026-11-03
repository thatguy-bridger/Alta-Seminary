// Gets a chapter's verses for the pop-up. A chapter that is already in the lesson library is used as it is (no waiting, no network);
// any other chapter comes from the scripture-text server function, which fetches it from the Church. Remembered for the visit.
import { bookNamed } from './scriptureRefs.js';

const seen = new Map();

// A scripture lesson's text is one verse per line: "22  And he said...". Gives [{ n, text }] or null.
export function chapterFromLibrary(sources, book, chapter) {
  const name = bookNamed(book)?.name;
  const lesson = (sources || []).find((s) => s.kind === 'scripture' && s.reference === `${name} ${chapter}` && s.body);
  if (!lesson) return null;
  const verses = String(lesson.body).split('\n').map((l) => /^(\d+)\s+(.+)$/.exec(l.trim())).filter(Boolean).map((m) => ({ n: Number(m[1]), text: m[2].trim() }));
  return verses.length ? verses : null;
}

export async function fetchChapter(book, chapter, { sources = [], fetcher = globalThis.fetch } = {}) {
  const name = bookNamed(book)?.name;
  if (!name) throw new Error('That is not a scripture reference.');
  const key = `${name} ${chapter}`;
  if (seen.has(key)) return seen.get(key);
  const local = chapterFromLibrary(sources, name, chapter);
  if (local) { const out = { reference: key, verses: local }; seen.set(key, out); return out; }
  const url = import.meta.env.PUBLIC_SUPABASE_URL, anon = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Scripture text is not available here.');
  const res = await fetcher(`${url}/functions/v1/scripture-text`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: anon, Authorization: `Bearer ${anon}` }, body: JSON.stringify({ book: name, chapter: Number(chapter) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !Array.isArray(data.verses)) throw new Error(data.error || 'That chapter could not be loaded.');
  seen.set(key, data);
  return data;
}

export const forgetChapters = () => seen.clear();   // for tests

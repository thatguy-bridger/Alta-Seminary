// @ts-nocheck -- runs on Supabase (Deno), not in the site build
// Gives the student page the text of any scripture chapter, so a reference in a lesson can be opened in a pop-up in any browser
// (the Church's own site cannot be called from a page). Body: { book: 'Ezekiel', chapter: 4 }. Answer: { reference, verses: [{ n, text }] }.
// It only ever fetches /scriptures/... chapters from the Church's public content service, and remembers what it fetched.
import { bookNamed, churchUri } from './scriptureRefs.js';
import { parseChapter } from './churchChapter.js';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', ...extra } });
const API = 'https://www.churchofjesuschrist.org/study/api/v3/language-pages/type/content?lang=eng&uri=';
const cache = new Map();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const { book, chapter } = await req.json().catch(() => ({}));
  const n = Number(chapter);
  const uri = churchUri(book, n);
  if (!uri) return json({ error: 'Not a scripture chapter.' }, 400);
  const name = bookNamed(book).name;
  if (cache.has(uri)) return json(cache.get(uri), 200, { 'Cache-Control': 'public, max-age=86400' });
  try {
    const res = await fetch(API + uri, { headers: { 'User-Agent': 'AltaSeminaryMakeupWork/1.0 (educational; scripture pop-up)' } });
    if (!res.ok) return json({ error: 'That chapter could not be found.' }, 404);
    const data = await res.json();
    const verses = parseChapter(data?.content?.body);
    if (!verses.length) return json({ error: 'That chapter could not be found.' }, 404);
    const out = { reference: `${name} ${n}`, verses };
    if (cache.size > 300) cache.clear();
    cache.set(uri, out);
    return json(out, 200, { 'Cache-Control': 'public, max-age=86400' });
  } catch {
    return json({ error: 'The scripture text could not be loaded right now.' }, 502);
  }
});

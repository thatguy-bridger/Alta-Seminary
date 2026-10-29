// @ts-nocheck -- runs on Supabase (Deno), not in the site build
// One-time import of a Come, Follow Me course (its weekly lessons) from the Church's public content API into makeup_sources.
//
// This is a temporary function, not part of the site. To use it (for example when the Church publishes next year's manual):
//   1. Deploy it as a Supabase edge function named "makeup-cfm-import" with THREE files side by side:
//        index.ts (this file, with TOKEN set to a long random string),
//        cfmParse.js and lessonBlocks.js (both copied from src/makeup/).
//      Keep "Verify JWT" on, so the call needs the project's anon key as well as the token.
//   2. Call it (more than one call if the course is long, using from/to, since an edge function runs for a limited time):
//        curl -X POST https://<project>.supabase.co/functions/v1/makeup-cfm-import \
//          -H "Authorization: Bearer <anon key>" -H "x-import-token: <TOKEN>" -H "Content-Type: application/json" \
//          -d '{"manual":"come-follow-me-for-home-and-church-new-testament-2027","from":1,"to":26}'
//      then again with "from":27,"to":52. Add "dry":true to see what it would do without writing, "refresh":true to overwrite
//      lessons already imported (this replaces any edits made to them in the admin).
//   3. Replace it with a stub that answers 410 Gone, so it can never be used again.
//
// The Church's lesson is kept as the correct content: see src/makeup/cfmParse.js for exactly what is kept and what is left out.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { lessonFromChurchPage, courseFromManual, weeklySlugs } from './cfmParse.js';

const TOKEN = 'PUT-A-LONG-RANDOM-TOKEN-HERE';
const API = 'https://www.churchofjesuschrist.org/study/api/v3/language-pages/type/content?lang=eng&uri=';
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; AltaSeminary-import)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getPage(path) {
  let last;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(API + path, { headers: UA });
      if (!res.ok) throw new Error(`${res.status} for ${path}`);
      return await res.json();
    } catch (e) { last = e; await sleep(1500 * (attempt + 1)); }
  }
  throw last;
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.headers.get('x-import-token') !== TOKEN) return new Response('Not found', { status: 404 });
  const { manual, from = 1, to = 99, dry = false, refresh = false } = await req.json().catch(() => ({}));
  if (!manual || !/^[a-z0-9-]+$/.test(manual)) return json({ error: 'Say which manual, for example "come-follow-me-for-home-and-church-old-testament-2026".' }, 400);

  const db = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  const manualPage = await getPage(`/manual/${manual}`);
  const course = courseFromManual(manualPage, manual);
  const slugs = weeklySlugs(manualPage, manual).filter((s) => Number(s) >= from && Number(s) <= to);
  const sortBase = 70000 + (course.year - 2026) * 1000;      // each course sorts after the one before it

  const report = { course: course.name, found: slugs.length, inserted: 0, updated: 0, skipped: 0, errors: [], lessons: [] };
  for (const slug of slugs) {
    try {
      const row = lessonFromChurchPage(await getPage(`/manual/${manual}/${slug}`), { slug, number: Number(slug), course, sortBase });
      const { words, ...columns } = row;
      report.lessons.push({ n: slug, title: row.title, start: row.week_start, end: row.week_end, words });
      if (dry) continue;
      const { data: existing } = await db.from('makeup_sources').select('id').eq('kind', 'comefollowme').eq('origin_url', row.origin_url).maybeSingle();
      if (existing && !refresh) { report.skipped++; continue; }
      const { error } = existing ? await db.from('makeup_sources').update(columns).eq('id', existing.id) : await db.from('makeup_sources').insert(columns);
      if (error) throw new Error(error.message);
      existing ? report.updated++ : report.inserted++;
    } catch (e) { report.errors.push(`${slug}: ${e.message}`); }
    await sleep(300);
  }
  return json(report);
});

// @ts-nocheck -- runs on Supabase (Deno), not in the site build
// ONE-TIME IMPORTER for the starting Makeup Work library (scriptures, conference talks, and audio talks with
// real captions). It runs inside Supabase so the text never has to pass through anyone's laptop. It only
// fetches from fixed public sources and refuses any call without the import token. Once the library is
// loaded, this function is replaced by a stub that does nothing.
//
// Sources: github.com/bcbooks/scriptures-json (scripture text), the Church's public content API (talks and
// audio addresses), and the English caption track of each talk's video (for timestamped transcripts).
// This copies Church-owned text. Only use it with the school's permission.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TOKEN = '<set at deploy time>';
const API = 'https://www.churchofjesuschrist.org/study/api/v3/language-pages/type/content?lang=eng&uri=';
const RAW = 'https://raw.githubusercontent.com/bcbooks/scriptures-json/master/';
const UA = { 'User-Agent': 'AltaSeminaryBeta/1.0 (school website; library importer)' };
const VOL_FILE = { bom: 'book-of-mormon', ot: 'old-testament', nt: 'new-testament', dc: 'doctrine-and-covenants', pgp: 'pearl-of-great-price' };

const words = (t) => (t.match(/\S+/g) || []).length;
const minutesFor = (t) => Math.max(3, Math.ceil(words(t) / 180));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { headers: UA }); if (!r.ok) throw new Error(r.status + ' ' + url); return await r.text(); }
    catch (e) { if (i === tries - 1) throw e; await sleep(1200); }
  }
}
const entities = (s) => s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&rsquo;/g, '’').replace(/&lsquo;/g, '‘').replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”').replace(/&mdash;/g, '—');
function cleanText(frag) {
  frag = frag.replace(/<sup[^>]*class="[^"]*marker[^"]*"[^>]*>[\s\S]*?<\/sup>/g, '').replace(/<a[^>]*class="[^"]*note-ref[^"]*"[^>]*>[\s\S]*?<\/a>/g, '').replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '');
  return entities(frag).replace(/\s+/g, ' ').trim();
}

// ---- scriptures ----
async function scriptureRows(S) {  // S: [vol, book, chapter, v1, v2, reference, title, series][] sent by the caller
  const vols = {};
  for (const [k, f] of Object.entries(VOL_FILE)) vols[k] = JSON.parse(await get(RAW + f + '.json'));
  const rows = [];
  S.forEach(([vol, book, ch, v1, v2, ref, title, series], i) => {
    const v = vols[vol]; let verses;
    if (vol === 'dc') verses = v.sections.find((s) => s.section === ch)?.verses;
    else verses = v.books.find((b) => b.book === book)?.chapters.find((c) => c.chapter === ch)?.verses;
    if (!verses) return;
    if (v1) verses = verses.filter((x) => x.verse >= v1 && x.verse <= (v2 || v1));
    const body = verses.map((x) => x.verse + '  ' + x.text.trim()).join('\n');
    rows.push({ kind: 'scripture', title, reference: ref, description: series, body, minutes: minutesFor(body), series, origin_url: `scriptures-json:${vol}:${ref}`, sort_order: i, active: true });
  });
  return rows;
}

// ---- conference talks ----
function talkBody(page) {
  const m = page.match(/<div class="body-block">([\s\S]*?)<\/div>\s*(?:<footer|<\/div>\s*$|$)/);
  const block = m ? m[1] : page; const parts = [];
  for (const mm of block.matchAll(/<(p|h2|h3)\b[^>]*>([\s\S]*?)<\/\1>/g)) { const t = cleanText(mm[2]); if (t) parts.push(t); }
  return parts.join('\n\n');
}
async function listTalks(y, m) {
  const d = JSON.parse(await get(API + `/general-conference/${y}/${m}`));
  const body = d.content.body; const talks = []; const seen = new Set();
  const re = new RegExp('<a[^>]*href="(/study/general-conference/' + y + '/' + m + '/[^"?]+)[^"]*"[^>]*>([\\s\\S]*?)</a>', 'g');
  for (const mm of body.matchAll(re)) {
    const slug = mm[1].split('/').pop();
    if (slug.includes('session') || !/^\d/.test(slug) || seen.has(slug)) continue;
    const parts = mm[2].split(/<\/(?:p|div|span|h\d)>/).map(cleanText).filter(Boolean);
    if (parts.length >= 2) { seen.add(slug); talks.push({ slug, speaker: parts[0], title: parts[1], summary: parts[2] || '' }); }
  }
  return talks.filter((t) => !/^(sustaining|opening remarks|closing remarks|church auditing|statistical|report of|introduction|solemn assembly)/i.test(t.title));
}
function parseTime(s) { const p = s.replace(',', '.').split(':').map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]; }
function parseVtt(text) {
  const segs = [];
  for (const block of text.replace(/\r/g, '').split(/\n\n+/)) {
    const lines = block.split('\n').filter((l) => l.trim()); const ti = lines.findIndex((l) => l.includes('-->'));
    if (ti === -1) continue;
    const [a, b] = lines[ti].split('-->').map((x) => x.trim().split(/\s+/)[0]);
    const t = cleanText(lines.slice(ti + 1).join(' '));
    if (t) segs.push({ start: Math.round(parseTime(a) * 100) / 100, end: Math.round(parseTime(b) * 100) / 100, text: t });
  }
  return segs;
}
async function captionsFor(m3u8) {
  const master = await get(m3u8);
  const sub = master.match(/TYPE=SUBTITLES[^\n]*LANGUAGE="en"[^\n]*URI="([^"]+)"/) || master.match(/TYPE=SUBTITLES[^\n]*NAME="English"[^\n]*URI="([^"]+)"/);
  if (!sub) return [];
  const urls = (await get(sub[1])).split('\n').map((l) => l.trim()).filter((l) => l.startsWith('http'));
  let segs = [];
  for (const u of urls) segs = segs.concat(parseVtt(await get(u)));
  const seen = new Set(); const out = [];
  for (const s of segs.sort((a, b) => a.start - b.start)) { const k = s.start + '|' + s.text; if (!seen.has(k)) { seen.add(k); out.push(s); } }
  return out;
}
async function talkRows(y, m, label, offset, limit) {
  const talks = await listTalks(y, m); const slice = talks.slice(offset, offset + limit); const rows = [];
  for (let i = 0; i < slice.length; i++) {
    const t = slice[i]; const idx = offset + i; await sleep(250);
    let d; try { d = JSON.parse(await get(API + `/general-conference/${y}/${m}/${t.slug}`)); } catch { continue; }
    const page = d.content.body; const body = talkBody(page);
    if (words(body) < 400) continue;
    const url = `https://www.churchofjesuschrist.org/study/general-conference/${y}/${m}/${t.slug}?lang=eng`;
    const series = `${label} general conference`; const ref = `${t.speaker}, ${series}`; const order = 1000 + idx;
    rows.push({ kind: 'talk', title: t.title, reference: ref, description: t.summary || null, body, minutes: minutesFor(body), author: t.speaker, series, origin_url: url, sort_order: order, active: true });
    const audio = (d.meta.audio || [])[0]?.mediaUrl; const vid = page.match(/<source src="(https:\/\/mediasrv[^"]+\.m3u8)"/); const dur = page.match(/data-duration="(\d+)"/);
    if (audio && vid && dur && idx % 5 === 2 && +dur[1] < 15 * 60 * 1000) {
      try {
        const caps = await captionsFor(vid[1]);
        if (caps.length > 20) { const seconds = Math.round(+dur[1] / 1000);
          rows.push({ kind: 'audio', title: t.title, reference: ref, description: (t.summary || '') + ' (audio, with captions)', embed_url: audio, minutes: Math.max(3, Math.ceil(seconds / 60)), duration_seconds: seconds, transcript: caps, author: t.speaker, series, origin_url: url + '#audio', sort_order: order + 5000, active: true }); }
      } catch { /* leave the audio out; the text talk is still added */ }
    }
  }
  return { rows, total: talks.length };
}

Deno.serve(async (req) => {
  if (req.headers.get('x-import-token') !== TOKEN) return new Response('No', { status: 401 });
  const q = await req.json().catch(() => ({}));
  const db = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  let rows = [], total = null;
  if (q.step === 'scriptures') rows = await scriptureRows(q.passages || []);
  else if (q.step === 'talks') { const r = await talkRows(q.y, q.m, q.label, q.offset || 0, q.limit || 6); rows = r.rows; total = r.total; }
  else return new Response('Unknown step', { status: 400 });
  // skip anything already imported (origin_url is the key)
  const urls = rows.map((r) => r.origin_url);
  const { data: have } = await db.from('makeup_sources').select('origin_url').in('origin_url', urls);
  const known = new Set((have || []).map((x) => x.origin_url));
  const fresh = rows.filter((r) => !known.has(r.origin_url));
  if (fresh.length) { const { error } = await db.from('makeup_sources').insert(fresh); if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 }); }
  return new Response(JSON.stringify({ built: rows.length, inserted: fresh.length, skipped: rows.length - fresh.length, total, kinds: fresh.reduce((a, r) => (a[r.kind] = (a[r.kind] || 0) + 1, a), {}) }), { headers: { 'Content-Type': 'application/json' } });
});

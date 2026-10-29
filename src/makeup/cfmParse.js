// Turns one weekly Come, Follow Me lesson, as the Church's public content API returns it, into one of our lessons. Pure code with
// no browser and no libraries, so the same file runs in the tests and in the one-time import function (see scripts/makeup-cfm-import).
//
// The Church's lesson is the correct content, so its words are kept as they are and its order is kept. What is left out is what
// is not for a student studying for themselves: "Ideas for Teaching Children" (suggestions for a parent or Primary teacher),
// the tips to teachers, the pictures, and the printable pages. Videos are kept as a note with their title and length.
//
// What comes out is the structured text described in lessonBlocks.js.
import { readableText } from './lessonBlocks.js';

/* ---------- a small HTML reader: enough for the Church's well-formed pages ---------- */
const VOID = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'source', 'track', 'wbr']);
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”' };
export const decode = (s) => String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') { const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m; }
  return NAMED[e.toLowerCase()] ?? m;
});

const TOKEN = /<!--[\s\S]*?-->|<\/([a-zA-Z][a-zA-Z0-9]*)\s*>|<([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+|<)/g;
const ATTR = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

export function parseHtml(html) {
  const root = { tag: '#root', attrs: {}, children: [] };
  const stack = [root];
  for (const m of String(html).matchAll(TOKEN)) {
    const [whole, closing, opening, attrText, selfClose, text] = m;
    if (whole.startsWith('<!--')) continue;
    const top = stack[stack.length - 1];
    if (text !== undefined) { top.children.push({ text }); continue; }
    if (closing) {
      const name = closing.toLowerCase();
      for (let i = stack.length - 1; i > 0; i--) if (stack[i].tag === name) { stack.length = i; break; }   // a stray closing tag closes nothing
      continue;
    }
    const tag = opening.toLowerCase();
    const attrs = {};
    for (const a of (attrText || '').matchAll(ATTR)) attrs[a[1].toLowerCase()] = decode(a[2] ?? a[3] ?? a[4] ?? '');
    const node = { tag, attrs, children: [] };
    top.children.push(node);
    if (!VOID.has(tag) && !selfClose) stack.push(node);
  }
  return root;
}

const classes = (n) => (n.attrs?.class || '').split(/\s+/).filter(Boolean);
const hasClass = (n, c) => classes(n).includes(c);
const normal = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

// The words inside a node, as one line.
export function textOf(node) {
  if (node.text !== undefined) return decode(node.text);
  if (node.tag === 'script' || node.tag === 'style' || hasClass(node, 'card-label')) return '';   // a chart cell repeats its column's name for phones: not part of the text
  if (node.tag === 'br') return ' ';
  return node.children.map(textOf).join('');
}
const lineOf = (node) => normal(textOf(node));

function find(node, pred) {
  for (const c of node.children || []) {
    if (c.text !== undefined) continue;
    if (pred(c)) return c;
    const deeper = find(c, pred);
    if (deeper) return deeper;
  }
  return null;
}
const findAll = (node, pred, out = []) => { for (const c of node.children || []) { if (c.text !== undefined) continue; if (pred(c)) out.push(c); findAll(c, pred, out); } return out; };

/* ---------- the lesson ---------- */
const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
const pad = (n) => String(n).padStart(2, '0');

// "January 5–11: “Title”" or "December 29–January 4: Title" -> the week's dates and the rest. The first week of a course may begin in
// December of the year before; a week that ends in an earlier month than it began ends in the next year.
export function parseWeekTitle(text, { year, number }) {
  const m = /^([A-Z][a-z]+)\s+(\d{1,2})\s*[–-]\s*(?:([A-Z][a-z]+)\s+)?(\d{1,2})\s*:?\s*(.*)$/.exec(normal(text));
  const sm = m && MONTHS[m[1].toLowerCase()];
  const em = m && (m[3] ? MONTHS[m[3].toLowerCase()] : sm);
  if (!m || !sm || !em) return null;
  const startYear = number === 1 && sm === 12 ? year - 1 : year;
  const endYear = em < sm ? startYear + 1 : startYear;
  return { week_start: `${startYear}-${pad(sm)}-${pad(Number(m[2]))}`, week_end: `${endYear}-${pad(em)}-${pad(Number(m[4]))}`, rest: m[5].trim() };
}

const SKIP_P = ['reference', 'short-reference', 'title-number', 'title', 'label', 'credit'];
const SKIP_DIV = ['resources', 'credit', 'card-label'];
const SKIP_FIGURE = ['for-teacher', 'image', 'handout'];
const isChildrenSection = (section) => { const h = find(section, (n) => n.tag === 'h2'); return !!h && /teaching children|for primary/i.test(lineOf(h)); };

function listItems(list) {
  return list.children.filter((c) => c.tag === 'li').map(lineOf).filter(Boolean);
}

// A chart: its column headings as a note, then each filled-in row as a list item.
function chart(table, out) {
  const rows = findAll(table, (n) => n.tag === 'tr');
  const cells = (row) => row.children.filter((c) => c.tag === 'td' || c.tag === 'th');
  const isHead = (row) => cells(row).length > 0 && cells(row).every((c) => c.tag === 'th');
  const names = rows.filter(isHead).slice(0, 1).flatMap((r) => cells(r).map(lineOf));
  const head = names.filter(Boolean);
  // Each filled-in cell says which column it belongs to, as the page does for a phone ("Symbol: ..."), when the columns line up.
  const body = rows.filter((r) => !isHead(r)).map((r) => {
    const cs = cells(r);
    return cs.map((c, i) => { const t = lineOf(c); return t && names.length === cs.length && names[i] ? `${names[i]}: ${t}` : t; }).filter(Boolean).join(' — ');
  }).filter(Boolean);
  if (head.length) out.push(`> Chart: ${head.join(' · ')}`);
  if (body.length) out.push(body.map((b) => `- ${b}`).join('\n'));
}

function walk(node, out) {
  for (const child of node.children) {
    if (child.text !== undefined) continue;
    const t = child.tag;
    if (t === 'p') {
      const text = lineOf(child);
      if (!text || SKIP_P.some((c) => hasClass(child, c)) || /^click to see more\.?$/i.test(text)) continue;
      if (hasClass(child, 'scripture-title')) out.push(`@ ${text}`);
      else if (/^see also\b/i.test(text)) out.push(`> ${text}`);
      else out.push(text);
    } else if (t === 'h2') { const text = lineOf(child); if (text) out.push(`# ${text}`); }
    else if (t === 'h3') { const text = lineOf(child); if (text) out.push(`## ${text}`); }
    else if (t === 'ul' || t === 'ol') { const items = listItems(child); if (items.length) out.push(items.map((i) => `- ${i}`).join('\n')); }
    else if (t === 'table') chart(child, out);
    else if (t === 'figure') {
      if (SKIP_FIGURE.some((c) => hasClass(child, c))) continue;
      if (hasClass(child, 'video')) {
        const video = find(child, (n) => n.tag === 'video');
        const caption = find(child, (n) => n.tag === 'figcaption');
        const title = normal(video?.attrs['data-video-title'] || (caption ? lineOf(caption) : ''));
        const length = normal(video?.attrs['data-duration-string'] || '');
        if (title) out.push(`> Video: ${title}${length ? ` (${length})` : ''}`);
      } else walk(child, out);
    } else if (t === 'section') { if (!isChildrenSection(child)) walk(child, out); }
    else if (t === 'div') { if (!SKIP_DIV.some((c) => hasClass(child, c))) walk(child, out); }
    else if (t === 'header' || t === 'blockquote' || t === 'aside') walk(child, out);
    // anything else (pictures, links on their own, the lesson's own h1, video tags) is not text to read
  }
}

// page: the JSON the content API returns for one lesson. course: { slug, name, year }. -> a row for makeup_sources.
export function lessonFromChurchPage(page, { slug, number, course, sortBase = 70000 }) {
  const html = page?.content?.body;
  if (!html) throw new Error(`Lesson ${slug} has no content.`);
  const tree = parseHtml(html);
  const titleNumber = find(tree, (n) => n.tag === 'p' && hasClass(n, 'title-number'));
  const h1 = find(tree, (n) => n.tag === 'h1');
  const week = titleNumber && parseWeekTitle(lineOf(titleNumber), { year: course.year, number });
  if (!week) throw new Error(`Lesson ${slug}: could not read the week's dates from "${titleNumber ? lineOf(titleNumber) : 'no title'}".`);
  const block = find(tree, (n) => n.tag === 'div' && hasClass(n, 'body-block'));
  if (!block) throw new Error(`Lesson ${slug}: no lesson text found.`);

  const out = [];
  walk(block, out);
  const body = out.join('\n\n');
  const words = readableText(body).split(/\s+/).filter(Boolean).length;
  if (words < 100) throw new Error(`Lesson ${slug}: only ${words} words found, which is too few to be right.`);

  const og = String(page?.meta?.ogTagImageUrl || '').trim();
  return {
    kind: 'comefollowme', title: week.rest || (h1 ? lineOf(h1) : `Week ${number}`), reference: h1 ? lineOf(h1) : null,
    description: "The Church's weekly Come, Follow Me lesson.",
    body, minutes: Math.max(3, Math.ceil(words / 150)), series: course.name, sort_order: sortBase + number * 10,
    origin_url: `https://www.churchofjesuschrist.org/study/manual/${course.slug}/${slug}?lang=eng`,
    thumbnail_url: /^https:\/\/\S+$/i.test(og) ? og : null,
    week_start: week.week_start, week_end: week.week_end, active: true, one_time: false, show_images: false, words,
  };
}

// The course's name and year from the manual's own title: "Come, Follow Me—For Home and Church: Old Testament 2026".
export function courseFromManual(manualPage, slug) {
  const title = String(manualPage?.meta?.title || '');
  const year = Number((/(\d{4})\s*$/.exec(title) || [])[1]);
  if (!year) throw new Error('Could not read the course year from the manual title.');
  return { slug, year, name: normal(title.replace('—For Home and Church', '')) };
}

// The numbered weekly lessons the manual's contents page links to, in order: "01" ... "52". The introductions, "Thoughts to Keep in
// Mind" essays and appendices have longer names and are not weekly lessons.
export function weeklySlugs(manualPage, slug) {
  const html = String(manualPage?.content?.body || '');
  const found = new Set();
  for (const m of html.matchAll(new RegExp(`/study/manual/${slug.replace(/[-/]/g, '\\$&')}/(\\d{2})(?=[?"#])`, 'g'))) found.add(m[1]);
  return [...found].sort();
}

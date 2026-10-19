// Finds phone numbers, emails and web addresses that were typed as plain
// text (not yet links) in a page's blocks, and can turn the chosen ones into
// real links. Pure, so the publish dialog and the tests share it.
//
// What it covers: rich-text fields (Rich Text, Image + Text body, Quote),
// where the number/email/URL can be linked in place, and Button blocks whose
// label is a number/email/URL but that have no link yet (the button's link
// is set). Plain headings/captions can't hold a link, so they're left alone.
import { BLOCK_REGISTRY } from '../blocks/registry.js';
import { looksLikeHtml, legacyToHtml } from './richTextHtml.js';

const SOURCE = '([A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,})|((?:https?:\\/\\/|www\\.)[^\\s<>"\')]+)|(\\(?\\d{3}\\)?[-.\\s]\\d{3}[-.\\s]\\d{4}\\b)';
const TRAILING = /[.,;:!?]+$/;

export function classify(text) {
  const m = new RegExp(`^(?:${SOURCE})$`, 'i').exec(text);
  if (!m) return null;
  if (m[1]) return { kind: 'email', href: `mailto:${text}` };
  if (m[2]) return { kind: 'url', href: /^www\./i.test(text) ? `https://${text}` : text };
  return { kind: 'phone', href: `tel:${text.replace(/[^\d+]/g, '')}` };
}

// Every detectable run in a plain string, trailing punctuation excluded.
function matchesIn(text) {
  const re = new RegExp(SOURCE, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(text))) {
    let full = m[0];
    const trail = TRAILING.exec(full);
    if (trail && !m[3]) full = full.slice(0, -trail[0].length);
    const c = classify(full);
    if (c) out.push({ index: m.index, text: full, ...c });
  }
  return out;
}

// Walks the text outside <a>…</a> in an HTML string. `visit(text, start)` may
// return replacement markup; returns the (possibly rewritten) html.
function mapUnlinkedText(html, visit) {
  const parts = html.split(/(<[^>]+>)/);
  let inLink = 0;
  return parts.map((part) => {
    if (part.startsWith('<')) {
      if (/^<a[\s>]/i.test(part)) inLink++;
      else if (/^<\/a>/i.test(part)) inLink = Math.max(0, inLink - 1);
      return part;
    }
    return inLink ? part : visit(part);
  }).join('');
}

export function detectInHtml(html) {
  const found = [];
  mapUnlinkedText(html, (text) => { found.push(...matchesIn(text)); return text; });
  return found;
}

// Links only the occurrences (counted in document order) that `accept(i)` allows.
export function linkifyHtml(html, accept = () => true) {
  let i = 0;
  return mapUnlinkedText(html, (text) => {
    let out = '';
    let last = 0;
    for (const m of matchesIn(text)) {
      out += text.slice(last, m.index);
      const keep = accept(i++);
      const newTab = m.kind === 'url' ? ' target="_blank" rel="noopener noreferrer"' : '';
      out += keep ? `<a href="${m.href}"${newTab}>${m.text}</a>` : m.text;
      last = m.index + m.text.length;
    }
    return out + text.slice(last);
  });
}

// Old rich-text values are plain text with [label](url) markdown. Convert to
// the editor's HTML first so there is one code path.
const toHtml = (v) => (looksLikeHtml(v) ? v : legacyToHtml(v));

// Visits every block (including slides/columns nested inside Carousel and
// Columns blocks) with the path to it in the blocks tree.
function walk(blocks, path, visit) {
  blocks.forEach((b, i) => {
    if (!b || typeof b !== 'object') return;
    const p = [...path, i];
    visit(b, p);
    for (const [key, val] of Object.entries(b.props || {})) {
      if (Array.isArray(val) && val.length && val.every((x) => x && typeof x === 'object' && 'props' in x)) {
        walk(val, [...p, 'props', key], visit);
      }
    }
  });
}

const labelFor = (b) => BLOCK_REGISTRY[b.type]?.label || b.type;

// -> [{ id, path, field, kind: 'phone'|'email'|'url', text, href, where: 'rich'|'button', occurrence, blockLabel }]
export function findUnlinked(blocks) {
  const found = [];
  walk(blocks || [], [], (b, path) => {
    const def = BLOCK_REGISTRY[b.type];
    if (!def) return;
    for (const f of def.fields) {
      if (f.kind === 'richtext' && typeof b.props?.[f.key] === 'string' && b.props[f.key].trim()) {
        detectInHtml(toHtml(b.props[f.key])).forEach((m, occurrence) => {
          found.push({ id: `${path.join('.')}:${f.key}:${occurrence}`, path, field: f.key, where: 'rich', occurrence, kind: m.kind, text: m.text, href: m.href, blockLabel: labelFor(b) });
        });
      }
    }
    if (b.type === 'button' && !b.props?.href?.trim()) {
      const label = (b.props?.label || '').trim();
      const c = classify(label);
      if (c) found.push({ id: `${path.join('.')}:href`, path, field: 'href', where: 'button', occurrence: 0, kind: c.kind, text: label, href: c.href, blockLabel: labelFor(b) });
    }
  });
  return found;
}

function setIn(root, path, fn) {
  const [head, ...rest] = path;
  const copy = Array.isArray(root) ? [...root] : { ...root };
  copy[head] = rest.length ? setIn(root[head], rest, fn) : fn(root[head]);
  return copy;
}

// Returns new blocks with the accepted suggestions (ids) applied.
export function applyLinks(blocks, suggestions, acceptedIds) {
  const accepted = suggestions.filter((s) => acceptedIds.has(s.id));
  let next = blocks;
  const richByField = new Map();
  for (const s of accepted) {
    if (s.where === 'button') {
      next = setIn(next, [...s.path, 'props', 'href'], () => s.href);
    } else {
      const key = `${s.path.join('.')}:${s.field}`;
      if (!richByField.has(key)) richByField.set(key, { s, picks: new Set() });
      richByField.get(key).picks.add(s.occurrence);
    }
  }
  for (const { s, picks } of richByField.values()) {
    next = setIn(next, [...s.path, 'props', s.field], (v) => linkifyHtml(toHtml(v), (i) => picks.has(i)));
  }
  return next;
}

export const KIND_LABEL = { phone: 'Phone number', email: 'Email address', url: 'Web address' };

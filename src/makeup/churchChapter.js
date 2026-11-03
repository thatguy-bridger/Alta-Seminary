// Turns the Church's chapter page (HTML) into plain verses: [{ n: 22, text: '...' }]. Pure and free of imports, because the
// server function that fetches chapters carries an identical copy of this file.
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…' };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; }
  return ENTITIES[e.toLowerCase()] ?? m;
});

export function parseChapter(html) {
  const verses = [];
  for (const m of String(html || '').matchAll(/<p\b[^>]*class="verse"[^>]*>([\s\S]*?)<\/p>/g)) {
    const whole = m[0];
    const ref = /data-eng-ref="\d+:(\d+)"/.exec(whole) || /id="p(\d+)"/.exec(whole);
    if (!ref) continue;
    const text = decode(m[1].replace(/<span class="verse-number">[\s\S]*?<\/span>/g, '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
    if (text) verses.push({ n: Number(ref[1]), text });
  }
  return verses;
}

// Finding scripture references in lesson text ("Ezekiel 4:22", "Alma 5:14-15", "D&C 88") so they can be opened in a pop-up,
// and the Church's address for each chapter. Pure and free of imports: the server function that fetches the text carries an
// identical copy of this file.

// [name shown, Church address, other ways it is written]
const TABLE = [
  ['Genesis', 'ot/gen', ['Gen.']], ['Exodus', 'ot/ex', ['Ex.']], ['Leviticus', 'ot/lev', ['Lev.']], ['Numbers', 'ot/num', ['Num.']], ['Deuteronomy', 'ot/deut', ['Deut.']],
  ['Joshua', 'ot/josh', ['Josh.']], ['Judges', 'ot/judg', ['Judg.']], ['Ruth', 'ot/ruth', []], ['1 Samuel', 'ot/1-sam', ['1 Sam.']], ['2 Samuel', 'ot/2-sam', ['2 Sam.']],
  ['1 Kings', 'ot/1-kgs', ['1 Kgs.']], ['2 Kings', 'ot/2-kgs', ['2 Kgs.']], ['1 Chronicles', 'ot/1-chr', ['1 Chr.']], ['2 Chronicles', 'ot/2-chr', ['2 Chr.']],
  ['Ezra', 'ot/ezra', []], ['Nehemiah', 'ot/neh', ['Neh.']], ['Esther', 'ot/esth', ['Esth.']], ['Job', 'ot/job', []], ['Psalm', 'ot/ps', ['Psalms', 'Ps.']],
  ['Proverbs', 'ot/prov', ['Prov.']], ['Ecclesiastes', 'ot/eccl', ['Eccl.']], ['Song of Solomon', 'ot/song', ['Song of Songs']], ['Isaiah', 'ot/isa', ['Isa.']],
  ['Jeremiah', 'ot/jer', ['Jer.']], ['Lamentations', 'ot/lam', ['Lam.']], ['Ezekiel', 'ot/ezek', ['Ezek.']], ['Daniel', 'ot/dan', ['Dan.']], ['Hosea', 'ot/hosea', []],
  ['Joel', 'ot/joel', []], ['Amos', 'ot/amos', []], ['Obadiah', 'ot/obad', ['Obad.']], ['Jonah', 'ot/jonah', []], ['Micah', 'ot/micah', []], ['Nahum', 'ot/nahum', []],
  ['Habakkuk', 'ot/hab', ['Hab.']], ['Zephaniah', 'ot/zeph', ['Zeph.']], ['Haggai', 'ot/hag', ['Hag.']], ['Zechariah', 'ot/zech', ['Zech.']], ['Malachi', 'ot/mal', ['Mal.']],
  ['Matthew', 'nt/matt', ['Matt.']], ['Mark', 'nt/mark', []], ['Luke', 'nt/luke', []], ['John', 'nt/john', []], ['Acts', 'nt/acts', []], ['Romans', 'nt/rom', ['Rom.']],
  ['1 Corinthians', 'nt/1-cor', ['1 Cor.']], ['2 Corinthians', 'nt/2-cor', ['2 Cor.']], ['Galatians', 'nt/gal', ['Gal.']], ['Ephesians', 'nt/eph', ['Eph.']],
  ['Philippians', 'nt/philip', ['Philip.']], ['Colossians', 'nt/col', ['Col.']], ['1 Thessalonians', 'nt/1-thes', ['1 Thes.']], ['2 Thessalonians', 'nt/2-thes', ['2 Thes.']],
  ['1 Timothy', 'nt/1-tim', ['1 Tim.']], ['2 Timothy', 'nt/2-tim', ['2 Tim.']], ['Titus', 'nt/titus', []], ['Philemon', 'nt/philem', []], ['Hebrews', 'nt/heb', ['Heb.']],
  ['James', 'nt/james', []], ['1 Peter', 'nt/1-pet', ['1 Pet.']], ['2 Peter', 'nt/2-pet', ['2 Pet.']], ['1 John', 'nt/1-jn', []], ['2 John', 'nt/2-jn', []], ['3 John', 'nt/3-jn', []],
  ['Jude', 'nt/jude', []], ['Revelation', 'nt/rev', ['Rev.']],
  ['1 Nephi', 'bofm/1-ne', ['1 Ne.']], ['2 Nephi', 'bofm/2-ne', ['2 Ne.']], ['Jacob', 'bofm/jacob', []], ['Enos', 'bofm/enos', []], ['Jarom', 'bofm/jarom', []], ['Omni', 'bofm/omni', []],
  ['Words of Mormon', 'bofm/w-of-m', ['W of M']], ['Mosiah', 'bofm/mosiah', []], ['Alma', 'bofm/alma', []], ['Helaman', 'bofm/hel', ['Hel.']], ['3 Nephi', 'bofm/3-ne', ['3 Ne.']],
  ['4 Nephi', 'bofm/4-ne', ['4 Ne.']], ['Mormon', 'bofm/morm', ['Morm.']], ['Ether', 'bofm/ether', []], ['Moroni', 'bofm/moro', ['Moro.']],
  ['D&C', 'dc-testament/dc', ['Doctrine and Covenants', 'D and C']],
  ['Moses', 'pgp/moses', []], ['Abraham', 'pgp/abr', ['Abr.']], ['Joseph Smith—Matthew', 'pgp/js-m', ['JS—M', 'JS-M']], ['Joseph Smith—History', 'pgp/js-h', ['JS—H', 'JS-H']],
];

export const BOOKS = TABLE.map(([name, path, other]) => ({ name, path, names: [name, ...other] }));
const byName = new Map();
for (const b of BOOKS) for (const n of b.names) byName.set(n.toLowerCase(), b);

export const bookNamed = (n) => byName.get(String(n || '').replace(/\s+/g, ' ').trim().toLowerCase()) || null;
export const churchUri = (bookName, chapter) => { const b = bookNamed(bookName); return b && Number.isInteger(chapter) && chapter > 0 ? `/scriptures/${b.path}/${chapter}` : null; };

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const NAMES = [...byName.keys()].map((k) => BOOKS.flatMap((b) => b.names).find((n) => n.toLowerCase() === k)).sort((a, b) => b.length - a.length).map(esc).join('|');
// book, chapter, then optionally :verse or :verse-verse (hyphen, en dash or em dash)
const REF = new RegExp(`(?<![A-Za-z0-9])(${NAMES})\\s+(\\d{1,3})(?::(\\d{1,3})(?:\\s*[-–—]\\s*(\\d{1,3}))?)?(?![A-Za-z0-9])`, 'g');

// [{ text }, { text, ref: { book, chapter, from, to } }, ...] covering the whole string, in order.
export function findRefs(text) {
  const s = String(text ?? '');
  const out = [];
  let at = 0;
  for (const m of s.matchAll(REF)) {
    const book = bookNamed(m[1]);
    const chapter = Number(m[2]);
    if (!book || chapter < 1) continue;
    const from = m[3] ? Number(m[3]) : null;
    const to = m[4] ? Math.max(Number(m[4]), from) : from;
    if (m.index > at) out.push({ text: s.slice(at, m.index) });
    out.push({ text: m[0], ref: { book: book.name, chapter, from, to } });
    at = m.index + m[0].length;
  }
  if (at < s.length) out.push({ text: s.slice(at) });
  return out.length ? out : [{ text: s }];
}

export const refLabel = (r) => `${r.book} ${r.chapter}${r.from ? `:${r.from}${r.to && r.to !== r.from ? `–${r.to}` : ''}` : ''}`;

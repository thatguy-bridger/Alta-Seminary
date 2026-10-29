// Reads an image's width and height from its first bytes (PNG, JPEG, GIF, WebP), with no image library. Pure and free of
// imports, so the one-time backfill function can carry it and a test can check it.
const ascii = (b, from, to) => String.fromCharCode(...b.slice(from, to));
const le16 = (b, i) => b[i] | (b[i + 1] << 8);
const le24 = (b, i) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const be16 = (b, i) => (b[i] << 8) | b[i + 1];
const be32 = (b, i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;

const MIME = { png: 'image/png', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
export const mimeOfType = (type) => MIME[type] || null;

// -> { type, width, height } or null when it is not an image this can read
export function imageSize(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  const done = (type, width, height) => (width > 0 && height > 0 ? { type, width, height } : null);
  if (b.length >= 24 && b[0] === 0x89 && ascii(b, 1, 4) === 'PNG') return done('png', be32(b, 16), be32(b, 20));
  if (b.length >= 10 && ascii(b, 0, 3) === 'GIF') return done('gif', le16(b, 6), le16(b, 8));
  if (b.length >= 30 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') {
    const kind = ascii(b, 12, 16);
    if (kind === 'VP8X') return done('webp', le24(b, 24) + 1, le24(b, 27) + 1);
    if (kind === 'VP8L' && b[20] === 0x2f) { const v = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24); return done('webp', (v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1); }
    if (kind === 'VP8 ' && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) return done('webp', le16(b, 26) & 0x3fff, le16(b, 28) & 0x3fff);
    return null;
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i += 1; continue; }
      const marker = b[i + 1];
      if (marker === 0xff) { i += 1; continue; }
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return done('jpeg', be16(b, i + 7), be16(b, i + 5));   // a start-of-frame marker holds the size
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { i += 2; continue; }   // markers with no length
      i += 2 + be16(b, i + 2);
    }
  }
  return null;
}

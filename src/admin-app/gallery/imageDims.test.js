import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { imageSize, mimeOfType } from '../../../scripts/gallery-backfill/imageDims.js';

const file = (path) => new Uint8Array(readFileSync(new URL(`../../../${path}`, import.meta.url)));
const bytes = (...parts) => Uint8Array.from(parts.flat());
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));
const le32 = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];

describe('reading an image\'s size from its first bytes', () => {
  // The expected sizes are what the operating system itself reports for these real files.
  it('reads the real files the site ships with: lossy WebP, WebP with extra data, and PNG', () => {
    expect(imageSize(file('public/makeup/thumbs/sermon-bloch.webp'))).toEqual({ type: 'webp', width: 640, height: 360 });
    expect(imageSize(file('public/makeup/art/begin.webp'))).toEqual({ type: 'webp', width: 900, height: 391 });
    expect(imageSize(file('public/makeup/mountains-a.webp'))).toEqual({ type: 'webp', width: 1922, height: 218 });     // VP8X
    expect(imageSize(file('public/og-default.png'))).toEqual({ type: 'png', width: 1200, height: 630 });
    expect(imageSize(file('src/assets/alta-seminary-logo.png'))).toEqual({ type: 'png', width: 1439, height: 653 });
    expect(imageSize(file('public/favicon-32x32.png'))).toEqual({ type: 'png', width: 32, height: 32 });
  });

  it('reads a lossless WebP', () => {
    // 'VP8L', then the signature byte 0x2f, then width-1 and height-1 as 14 bits each: 800 x 600 here
    const v = (800 - 1) | ((600 - 1) << 14);
    const webp = bytes(ascii('RIFF'), le32(40), ascii('WEBP'), ascii('VP8L'), le32(20), 0x2f, le32(v), new Array(20).fill(0));
    expect(imageSize(webp)).toEqual({ type: 'webp', width: 800, height: 600 });
  });

  it('reads a GIF', () => {
    expect(imageSize(bytes(ascii('GIF89a'), [64, 1], [200, 0], new Array(10).fill(0)))).toEqual({ type: 'gif', width: 320, height: 200 });
  });

  it('reads a JPEG, past the other parts that come before its size, such as a thumbnail and a comment', () => {
    const app0 = [0xff, 0xe0, 0x00, 0x10, ...ascii('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0];
    const comment = [0xff, 0xfe, 0x00, 0x06, ...ascii('hey!')];
    const sof0 = [0xff, 0xc0, 0x00, 0x11, 8, 0x01, 0x2c, 0x01, 0x90, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];   // 400 wide, 300 high
    expect(imageSize(bytes([0xff, 0xd8], app0, comment, sof0, new Array(20).fill(0)))).toEqual({ type: 'jpeg', width: 400, height: 300 });
    const progressive = [0xff, 0xc2, 0x00, 0x11, 8, 0x00, 0x64, 0x00, 0xc8, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];   // a progressive JPEG: 200 x 100
    expect(imageSize(bytes([0xff, 0xd8], progressive, new Array(20).fill(0)))).toEqual({ type: 'jpeg', width: 200, height: 100 });
  });

  it('is not fooled by the table markers that look like a frame marker', () => {
    const dht = [0xff, 0xc4, 0x00, 0x06, 1, 2, 3, 4];      // 0xc4 is a table, not a frame
    const sof0 = [0xff, 0xc0, 0x00, 0x11, 8, 0x00, 0x0a, 0x00, 0x14, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
    expect(imageSize(bytes([0xff, 0xd8], dht, sof0, new Array(20).fill(0)))).toEqual({ type: 'jpeg', width: 20, height: 10 });
  });

  it('says nothing for what is not an image it can read, or is cut short, or has no size', () => {
    expect(imageSize(null)).toBeNull();
    expect(imageSize(new Uint8Array(0))).toBeNull();
    expect(imageSize(bytes(ascii('<html><body>not an image</body></html>')))).toBeNull();
    expect(imageSize(bytes(0x89, ...ascii('PNG')))).toBeNull();                                      // cut short
    expect(imageSize(bytes([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0]))).toBeNull();                       // a JPEG with no frame
    expect(imageSize(bytes(ascii('GIF89a'), [0, 0], [0, 0], new Array(10).fill(0)))).toBeNull();     // a zero size is not a size
    expect(imageSize(bytes(ascii('RIFF'), le32(0), ascii('WEBP'), ascii('ZZZZ'), new Array(20).fill(0)))).toBeNull();
  });

  it('names the kind of file', () => {
    expect(mimeOfType('webp')).toBe('image/webp');
    expect(mimeOfType('png')).toBe('image/png');
    expect(mimeOfType('jpeg')).toBe('image/jpeg');
    expect(mimeOfType('gif')).toBe('image/gif');
    expect(mimeOfType('svg')).toBeNull();
  });
});

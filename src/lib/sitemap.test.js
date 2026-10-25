import { describe, it, expect } from 'vitest';
import { buildSitemapXml, buildLlmsTxt } from './sitemap.js';

describe('buildSitemapXml', () => {
  it('lists absolute, de-duplicated, escaped URLs', () => {
    const xml = buildSitemapXml('https://x.org/', [{ path: '/' }, { path: '/a&b' }, { path: '/a&b' }, { path: '/c', lastmod: '2026-10-01T00:00:00Z' }]);
    expect(xml).toContain('<loc>https://x.org/</loc>');
    expect(xml.match(/a&amp;b/g)).toHaveLength(1);
    expect(xml).toContain('<lastmod>2026-10-01T00:00:00.000Z</lastmod>');
    expect(xml.startsWith('<?xml')).toBe(true);
  });
});
describe('buildLlmsTxt', () => {
  it('links titled pages only', () => {
    const t = buildLlmsTxt('https://x.org', [{ path: '/a', title: 'A' }, { path: '/b' }]);
    expect(t).toContain('- [A](https://x.org/a)');
    expect(t).not.toContain('/b');
  });
});

import { describe, it, expect } from 'vitest';
import { DEFAULT_CHROME, normalizeChrome, validateChrome, footerText } from './siteChrome.js';

describe('normalizeChrome', () => {
  it('gives the defaults when nothing is stored', () => {
    expect(normalizeChrome(null)).toEqual({ ...DEFAULT_CHROME, header: { ...DEFAULT_CHROME.header } });
    expect(normalizeChrome({}).footer.links).toEqual(DEFAULT_CHROME.footer.links);
  });
  it('never lets required parts be blank', () => {
    const c = normalizeChrome({ header: { logoAlt: '  ' }, footer: { text: '', links: [{ label: '', url: '' }] } });
    expect(c.header.logoAlt).toBe('Alta Seminary');
    expect(c.footer.text).toBe(DEFAULT_CHROME.footer.text);
    expect(c.footer.links).toEqual(DEFAULT_CHROME.footer.links);
  });
  it('keeps real edits and drops half-filled links', () => {
    const c = normalizeChrome({ header: { showSearch: false }, footer: { text: 'Hi', links: [{ label: 'A', url: '/a' }, { label: 'B', url: '' }] } });
    expect(c.header.showSearch).toBe(false);
    expect(c.footer).toEqual({ text: 'Hi', links: [{ label: 'A', url: '/a' }] });
  });
});

describe('validateChrome', () => {
  const ok = normalizeChrome({});
  it('accepts the defaults', () => expect(validateChrome(ok)).toEqual({}));
  it('requires alt text, footer text and at least one link', () => {
    const e = validateChrome({ header: { ...ok.header, logoAlt: '' }, footer: { text: ' ', links: [] } });
    expect(Object.keys(e).sort()).toEqual(['footer.links', 'footer.text', 'header.logoAlt']);
  });
  it('checks each link', () => {
    const e = validateChrome({ ...ok, footer: { ...ok.footer, links: [{ label: '', url: '' }, { label: 'x', url: 'javascript:alert(1)' }, { label: 'y', url: '/fine' }] } });
    expect(Object.keys(e).sort()).toEqual(['footer.links.0.label', 'footer.links.0.url', 'footer.links.1.url']);
  });
});

it('footerText fills in the year', () => expect(footerText('© {year} A, {year}', 2026)).toBe('© 2026 A, 2026'));

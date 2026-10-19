import { describe, it, expect } from 'vitest';
import { socialInfo, DEFAULT_CHROME, normalizeChrome, validateChrome, footerText } from './siteChrome.js';

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
    expect(c.footer).toEqual({ text: 'Hi', links: [{ label: 'A', url: '/a', icon: '' }], about: '', social: [] });
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

describe('banner and extras', () => {
  const ok = normalizeChrome({});
  it('banner needs text to be on', () => {
    expect(normalizeChrome({ header: { bannerOn: true, bannerText: ' ' } }).header.bannerOn).toBe(false);
    expect(normalizeChrome({ header: { bannerOn: true, bannerText: 'Hi' } }).header.bannerOn).toBe(true);
    expect(validateChrome({ ...ok, header: { ...ok.header, bannerOn: true, bannerText: '' } })['header.bannerText']).toBeTruthy();
    expect(validateChrome({ ...ok, header: { ...ok.header, bannerText: 'x', bannerUrl: 'nope' } })['header.bannerUrl']).toBeTruthy();
  });
  it('social links are optional but must be finished', () => {
    expect(validateChrome(ok)).toEqual({});
    const e = validateChrome({ ...ok, footer: { ...ok.footer, social: [{ label: 'IG', url: '' }] } });
    expect(Object.keys(e)).toEqual(['footer.social.0.url']);
    expect(normalizeChrome({ footer: { social: [{ label: 'a', url: '' }, { label: 'b', url: 'https://b' }] } }).footer.social).toHaveLength(1);
    expect(validateChrome({ ...ok, footer: { ...ok.footer, social: [{ label: '', url: 'https://instagram.com/x' }] } })).toEqual({});
  });
});

it('footerText fills in the year', () => expect(footerText('© {year} A, {year}', 2026)).toBe('© 2026 A, 2026'));

describe('socialInfo', () => {
  it('recognizes channels and falls back to the host', () => {
    expect(socialInfo('https://www.instagram.com/alta.seminary')).toEqual({ domain: 'www.instagram.com', name: 'Instagram' });
    expect(socialInfo('https://youtu.be/abc').name).toBe('YouTube');
    expect(socialInfo('https://twitter.com/x').name).toBe('X');
    expect(socialInfo('https://www.example.org/page')).toEqual({ domain: 'www.example.org', name: 'example.org' });
  });
  it('returns null for non-web links', () => {
    expect(socialInfo('mailto:a@b.org')).toBeNull();
    expect(socialInfo('not a url')).toBeNull();
  });
});

import { FOOTER_ICONS, getFooterIcon, cleanIconChoice, pickFooterIcon } from './footerIcons.js';
describe('footer icons', () => {
  it('has a clean, unique library', () => {
    expect(FOOTER_ICONS.length).toBeGreaterThanOrEqual(25);
    expect(new Set(FOOTER_ICONS.map((i) => i.id)).size).toBe(FOOTER_ICONS.length);
    for (const i of FOOTER_ICONS) { expect(i.label).toBeTruthy(); expect(i.paths.length).toBeGreaterThan(0); }
    expect(getFooterIcon('temple')).not.toBeNull();
  });
  it('only keeps a valid choice, and survives normalizing', () => {
    expect(cleanIconChoice('temple')).toBe('temple');
    expect(cleanIconChoice('none')).toBe('none');
    expect(cleanIconChoice('hamburger')).toBe('');
    const c = normalizeChrome({ footer: { links: [{ label: 'A', url: '/a', icon: 'book' }], social: [{ label: '', url: 'https://x.com/a', icon: 'bogus' }] } });
    expect(c.footer.links[0].icon).toBe('book');
    expect(c.footer.social[0].icon).toBe('');
  });
});

describe('pickFooterIcon', () => {
  it('is automatic when unset, and obeys an explicit choice', () => {
    expect(pickFooterIcon({ label: 'Contact', url: '/contact', icon: '' }, 'link').icon.id).toBe('contact');
    expect(pickFooterIcon({ label: 'Staff', url: '/staff', icon: '' }, 'link')).toBeNull();
    expect(pickFooterIcon({ label: 'Contact', url: '/contact', icon: 'none' }, 'link')).toBeNull();
    expect(pickFooterIcon({ label: 'Staff', url: '/staff', icon: 'users' }, 'link').icon.id).toBe('users');
    expect(pickFooterIcon({ label: 'IG', url: 'https://instagram.com/a', icon: '' }, 'social', { domain: 'instagram.com' })).toEqual({ type: 'favicon', domain: 'instagram.com' });
    expect(pickFooterIcon({ label: 'IG', url: 'https://instagram.com/a', icon: 'heart' }, 'social', { domain: 'instagram.com' }).icon.id).toBe('heart');
  });
});

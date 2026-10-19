// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { renderInBrowser } from '../test/render.js';
import { ImageBlock, linkNameFromHref } from './ImageBlock.jsx';

let mounted;
afterEach(async () => { await mounted?.unmount(); document.body.innerHTML = ''; });

describe('linkNameFromHref', () => {
  it('names a link after where it goes', () => {
    expect(linkNameFromHref('/gallery')).toBe('Link to Gallery');
    expect(linkNameFromHref('/directory/faculty-directory')).toBe('Link to Faculty Directory');
    expect(linkNameFromHref('https://www.instagram.com/alta')).toBe('Link to instagram.com');
    expect(linkNameFromHref('/')).toBe('Link to the home page');
  });
});

describe('ImageBlock linked image', () => {
  it('always has an accessible name: the alt text, or else a name from the destination', async () => {
    mounted = await renderInBrowser(<ImageBlock imageUrl="x.webp" link="/gallery" alt="" />);
    expect(mounted.container.querySelector('a').getAttribute('aria-label')).toBe('Link to Gallery');
    await mounted.unmount();
    mounted = await renderInBrowser(<ImageBlock imageUrl="x.webp" link="/gallery" alt="Students" />);
    expect(mounted.container.querySelector('a').hasAttribute('aria-label')).toBe(false);
  });
});

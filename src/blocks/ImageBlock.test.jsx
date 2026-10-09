// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { renderInBrowser } from '../test/render.js';
import { ImageBlock } from './ImageBlock.jsx';

let mounted;
afterEach(async () => { await mounted?.unmount(); document.body.innerHTML = ''; });

describe('ImageBlock figure margins', () => {
  // The bug: <figure> has a 40px left/right margin from the browser's own
  // stylesheet. A style of { margin: 0, marginLeft: undefined } made React,
  // when rendering IN THE BROWSER, clear the left/right half of "margin: 0",
  // so a full-width header image came back inset by 40px on each side.
  it('has no left/right margin after a client render (full width)', async () => {
    mounted = await renderInBrowser(<ImageBlock imageUrl="https://example.com/header.webp" alt="Header" />);
    const figure = mounted.container.querySelector('figure');
    expect(figure.style.marginLeft).toBe('0px');
    expect(figure.style.marginRight).toBe('0px');
    expect(getComputedStyle(figure).marginLeft).toBe('0px');
  });

  it('keeps a "contained" image centered with auto margins', async () => {
    mounted = await renderInBrowser(<ImageBlock imageUrl="https://example.com/a.webp" alt="A" width="contained" />);
    const figure = mounted.container.querySelector('figure');
    expect(figure.style.marginLeft).toBe('auto');
    expect(figure.style.marginRight).toBe('auto');
    expect(figure.style.maxWidth).toBe('640px');
  });

  it('renders the same margins on the server as in the browser', async () => {
    const html = renderToString(<ImageBlock imageUrl="https://example.com/header.webp" alt="Header" />);
    expect(html).toMatch(/margin-left:0/);
    expect(html).toMatch(/margin-right:0/);
  });

  it('renders nothing for an image block with no image on the public site', async () => {
    mounted = await renderInBrowser(<ImageBlock imageUrl="" />);
    expect(mounted.container.querySelector('figure')).toBeNull();
  });
});

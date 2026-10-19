// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { renderInBrowser } from '../test/render.js';
import { BlockRenderer } from './BlockRenderer.jsx';

globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} };

window.HTMLMediaElement.prototype.play = () => Promise.resolve();
window.HTMLMediaElement.prototype.pause = () => {};

let mounted;
afterEach(async () => { await mounted?.unmount(); document.body.innerHTML = ''; });

const blocks = [
  { id: 'm', type: 'background-music', props: { sourceType: 'upload', fileUrl: 'https://x/a.mp3', autoplay: true } },
  { id: 'p', type: 'timed-popup', props: { message: 'Hi', delaySeconds: 0 } },
  { id: 'b', type: 'button', props: { label: 'Go', href: '/x' } },
];

describe('BlockRenderer quiet mode (admin displays of page content)', () => {
  it('drops music, popups and other chromeless blocks, keeps the content', async () => {
    mounted = await renderInBrowser(<BlockRenderer blocks={blocks} quiet />);
    expect(mounted.container.querySelector('audio')).toBeNull();
    expect(mounted.container.textContent).toContain('Go');
  });
  it('still renders them on the public site', async () => {
    mounted = await renderInBrowser(<BlockRenderer blocks={blocks} />);
    expect(mounted.container.querySelector('audio')).not.toBeNull();
  });
});

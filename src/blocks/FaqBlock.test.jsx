// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { renderInBrowser } from '../test/render.js';
import { FaqBlock } from './FaqBlock.jsx';

const items = [{ id: 'a', question: 'When?', answer: 'Monday.' }, { id: 'b', question: 'Where?', answer: 'Room 5.' }];
let mounted;
afterEach(async () => { await mounted?.unmount(); document.body.innerHTML = ''; });

describe('FaqBlock', () => {
  it('starts collapsed and opens on click, gliding in', async () => {
    mounted = await renderInBrowser(<FaqBlock items={items} />);
    const q = mounted.container.querySelector('button[aria-expanded]');
    expect(q.getAttribute('aria-expanded')).toBe('false');
    expect(mounted.container.textContent).not.toContain('Monday.');
    q.click();
    await mounted.flush?.();
    expect(mounted.container.querySelector('button[aria-expanded]').getAttribute('aria-expanded')).toBe('true');
    expect(mounted.container.textContent).toContain('Monday.');
    expect(mounted.container.querySelector('.glide-in')).not.toBeNull();
  });
  it('shows every answer, with no buttons, when expanding is switched off', async () => {
    mounted = await renderInBrowser(<FaqBlock items={items} expandable={false} />);
    expect(mounted.container.querySelector('button')).toBeNull();
    expect(mounted.container.textContent).toContain('Monday.');
    expect(mounted.container.textContent).toContain('Room 5.');
  });
});

// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { renderInBrowser } from '../test/render.js';
import { MakeupJourney } from './MakeupJourney.jsx';
import { SAMPLE_CLASSES, SAMPLE_SOURCES } from './sampleContent.js';

// jsdom has none of these; the journey uses them for the scene and the media player.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
window.matchMedia ??= globalThis.matchMedia;
globalThis.URL.createObjectURL ??= () => 'blob:sample';
window.SVGElement.prototype.getTotalLength ??= () => 100;
window.SVGElement.prototype.getPointAtLength ??= () => ({ x: 0, y: 0 });
window.HTMLMediaElement.prototype.play = () => Promise.resolve();
window.HTMLMediaElement.prototype.pause = () => {};

let mounted;
afterEach(async () => { await mounted?.unmount(); document.body.innerHTML = ''; });
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const btn = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
const setVal = (el, value) => { const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); };

describe('MakeupJourney', () => {
  it('starts at the beginning with the logo, the site fonts and the quiet moment', async () => {
    mounted = await renderInBrowser(<MakeupJourney classes={SAMPLE_CLASSES} sources={SAMPLE_SOURCES} onSubmit={async () => ({ ok: true })} />);
    expect(document.querySelector('.mw-tbar img').alt).toBe('Alta Seminary');
    expect(document.querySelector('.mw-h').textContent).toBe("Let's make up the time");
    expect(btn('Take a moment…').disabled).toBe(true);
  });

  it('the skip tools are only there when switched on', async () => {
    mounted = await renderInBrowser(<MakeupJourney classes={SAMPLE_CLASSES} sources={SAMPLE_SOURCES} onSubmit={async () => ({ ok: true })} />);
    expect(document.querySelector('.mw-skip')).toBeNull();
    await mounted.unmount();
    mounted = await renderInBrowser(<MakeupJourney classes={SAMPLE_CLASSES} sources={SAMPLE_SOURCES} onSubmit={async () => ({ ok: true })} skipTools />);
    expect(document.querySelector('.mw-skip')).not.toBeNull();
  });

  it('with the skip tools, goes through every step and submits what the student wrote', async () => {
    const onSubmit = vi.fn(async () => ({ ok: true, saved: false }));
    mounted = await renderInBrowser(<MakeupJourney classes={SAMPLE_CLASSES} sources={SAMPLE_SOURCES} onSubmit={onSubmit} skipTools testMode />);
    for (let i = 0; i < 6 && !document.body.textContent.includes('Well done'); i++) { btn('Skip step').click(); await tick(60); }
    expect(document.body.textContent).toContain('Well done');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const { rpc, row } = onSubmit.mock.calls[0][0];
    expect(rpc.p_student_name).toBe('Test Student');
    expect(rpc.p_source_ids.length).toBeGreaterThan(0);
    expect(row.truth.length).toBeGreaterThan(10);
    expect(document.body.textContent).toContain('Test run: nothing was saved.');
  });

  it('blocks paste in the answer boxes and counts the attempt', async () => {
    const onSubmit = vi.fn(async () => ({ ok: true }));
    mounted = await renderInBrowser(<MakeupJourney classes={SAMPLE_CLASSES} sources={SAMPLE_SOURCES} onSubmit={onSubmit} skipTools />);
    btn('Skip step').click(); await tick(); btn('Skip step').click(); await tick(); btn('Skip step').click(); await tick(60); // begin, choose, learn -> truth
    const ta = document.querySelector('#mw-truth');
    expect(ta).not.toBeNull();
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    ta.dispatchEvent(paste);
    expect(paste.defaultPrevented).toBe(true);
    for (let i = 0; i < 4 && !document.body.textContent.includes('Well done'); i++) { btn('Skip step').click(); await tick(60); }
    const { rpc } = onSubmit.mock.calls[0][0];
    expect(rpc.p_paste_attempts).toBe(1);
  });
});

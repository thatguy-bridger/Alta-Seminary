// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderInBrowser } from '../../test/render.js';
import { createFakeSupabase } from '../../test/fakeSupabase.js';

const h = vi.hoisted(() => ({ client: null }));
vi.mock('../../lib/supabase/browser-client', () => ({ get supabaseBrowser() { return h.client; } }));
import { MakeupWorkScreen } from './MakeupWorkScreen.jsx';

const tick = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const btn = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
const field = (label) => {
  const l = [...document.querySelectorAll('label')].find((x) => x.textContent.trim().startsWith(label));
  return l.htmlFor ? document.getElementById(l.htmlFor) : l.querySelector('input, textarea');
};
const setVal = async (el, value) => {
  const proto = { SELECT: HTMLSelectElement, TEXTAREA: HTMLTextAreaElement }[el.tagName] || HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, value);
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  await tick();
};
const chooseType = (value) => setVal([...document.querySelectorAll('select')].at(-1), value);   // the "add a source" form's type

let mounted;
beforeEach(async () => {
  h.client = createFakeSupabase({ tables: { makeup_classes: [], makeup_sources: [], makeup_submissions: [], site_settings: [{ makeup_work_enabled: false }] } });
  mounted = await renderInBrowser(<MakeupWorkScreen />); await tick(80);
});
afterEach(async () => { await mounted?.unmount(); document.body.innerHTML = ''; });

const CAPTIONS = 'WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nHello there.\n\n00:00:05.000 --> 00:00:09.000\nMore words.';

describe('adding a video in the admin', () => {
  it('asks for a YouTube link, and says what it understood about the address', async () => {
    await chooseType('video');
    const link = field('YouTube link');
    expect(link).not.toBeNull();
    await setVal(link, 'https://vimeo.com/12345');
    expect(document.body.textContent).toContain('This address is neither');
    expect(btn('Add source').disabled).toBe(true);
    await setVal(link, 'https://youtu.be/OJ2pLI0tZvY');
    expect(document.body.textContent).toContain('Plays as: YouTube video.');
    expect(document.body.textContent).not.toContain('This address is neither');
  });

  it('will not add a video with an address the player cannot play, even with captions', async () => {
    await chooseType('video');
    await setVal(field('Title'), 'A talk');
    await setVal(field('YouTube link'), 'https://example.com/watch/123');
    await setVal(field('Length'), '0:10');
    await setVal(field('Or paste the captions'), CAPTIONS);
    expect(btn('Add source').disabled).toBe(true);
  });

  it('adds a YouTube video, shown to students, once it has a title, a length and captions', async () => {
    await chooseType('video');
    await setVal(field('Title'), 'A talk');
    await setVal(field('YouTube link'), 'https://youtu.be/OJ2pLI0tZvY');
    expect(btn('Add source').disabled).toBe(true);                      // no captions yet
    await setVal(field('Length'), '0:10');
    await setVal(field('Or paste the captions'), CAPTIONS);
    expect(btn('Add source').disabled).toBe(false);
    btn('Add source').click(); await tick(80);
    const inserted = h.client.log.find((x) => x.table === 'makeup_sources' && x.op === 'insert');
    expect(inserted.payload).toMatchObject({ kind: 'video', title: 'A talk', embed_url: 'https://youtu.be/OJ2pLI0tZvY', duration_seconds: 10, active: true });
    expect(inserted.payload.transcript).toHaveLength(2);
  });

  it('does not ask for any address when adding text like a scripture', async () => {
    await setVal(field('Title'), 'Doing what the Lord asks');
    expect(document.body.textContent).not.toContain('This address is neither');
    expect(btn('Add source').disabled).toBe(false);
  });
});

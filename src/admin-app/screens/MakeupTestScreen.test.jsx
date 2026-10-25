// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderInBrowser } from '../../test/render.js';
import { createFakeSupabase } from '../../test/fakeSupabase.js';

const h = vi.hoisted(() => ({ client: null }));
vi.mock('../../lib/supabase/browser-client', () => ({ get supabaseBrowser() { return h.client; } }));
import { MakeupTestScreen } from './MakeupTestScreen.jsx';

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
window.matchMedia ??= globalThis.matchMedia;
globalThis.URL.createObjectURL ??= () => 'blob:sample';
window.SVGElement.prototype.getTotalLength ??= () => 100;
window.SVGElement.prototype.getPointAtLength ??= () => ({ x: 0, y: 0 });
window.HTMLMediaElement.prototype.play = () => Promise.resolve();
window.HTMLMediaElement.prototype.pause = () => {};

const tick = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const btn = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
const toggle = (label) => [...document.querySelectorAll('label')].find((l) => l.textContent.includes(label))?.querySelector('input');
let mounted, rpc;

function client(tables) {
  const base = createFakeSupabase({ tables });
  rpc = vi.fn(async () => ({ data: 'new-submission-id', error: null }));
  return { ...base, rpc };
}
const realTables = {
  makeup_classes: [{ id: 'c1', name: 'Period 2', code: null, active: true }],
  makeup_sources: [
    { id: 's1', kind: 'scripture', title: 'Doing what the Lord asks', reference: '1 Nephi 3:7', body: 'I will go and do the things which the Lord hath commanded.', minutes: 4, active: true },
    { id: 's2', kind: 'scripture', title: 'A draft verse', reference: 'Mosiah 4', body: 'text text text', minutes: 4, active: false },
    { id: 's3', kind: 'audio', title: 'Audio with no transcript', embed_url: 'https://x/a.mp3', duration_seconds: 60, transcript: null, minutes: 4, active: false },
  ],
};

beforeEach(() => { window.AudioContext = undefined; });
afterEach(async () => { await mounted?.unmount(); document.body.innerHTML = ''; });

describe('the admin test page', () => {
  it('uses sample content when the library is empty, and cannot save anything', async () => {
    h.client = client({ makeup_classes: [], makeup_sources: [] });
    mounted = await renderInBrowser(<MakeupTestScreen />); await tick(80);
    expect(document.body.textContent).toContain('Sample content is on, so nothing can be saved');
    expect(toggle('Really save the submission').disabled).toBe(true);
    expect(document.querySelector('.mw-h').textContent).toBe("Let's make up the time");
    expect(document.querySelector('.mw-skip')).not.toBeNull();
    for (let i = 0; i < 6 && !document.body.textContent.includes('Well done'); i++) { btn('Skip step').click(); await tick(70); }
    expect(document.body.textContent).toContain('Well done');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('can be taken as a student would: skip tools off', async () => {
    h.client = client({ makeup_classes: [], makeup_sources: [] });
    mounted = await renderInBrowser(<MakeupTestScreen />); await tick(80);
    toggle('Skip tools').click(); await tick();
    expect(document.querySelector('.mw-skip')).toBeNull();
  });

  it('uses the real classes and lessons, hides drafts on request, and never lists audio without a transcript', async () => {
    h.client = client(realTables);
    mounted = await renderInBrowser(<MakeupTestScreen />); await tick(80);
    expect(document.body.textContent).not.toContain('Sample content is on');
    expect([...document.querySelectorAll('.mw-chip')].map((c) => c.textContent)).toContain('Period 2');
    // drafts are included by default; turn that off and the draft verse goes away from the pool
    toggle('Include lessons not yet shown to students').click(); await tick(80);
    for (let i = 0; i < 2; i++) { btn('Skip step').click(); await tick(80); }
    expect(document.querySelector('.mw-h').textContent).toBe('Doing what the Lord asks'); // the only active source
  });

  it('a test does not save unless "Really save" is on', async () => {
    h.client = client(realTables);
    mounted = await renderInBrowser(<MakeupTestScreen />); await tick(80);
    toggle('Include lessons not yet shown to students').click(); await tick(80);
    for (let i = 0; i < 6 && !document.body.textContent.includes('Well done'); i++) { btn('Skip step').click(); await tick(80); }
    expect(rpc).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Test run: nothing was saved.');
  });

  it('really saves through the safe submit function when asked', async () => {
    h.client = client(realTables);
    mounted = await renderInBrowser(<MakeupTestScreen />); await tick(80);
    toggle('Really save the submission').click(); await tick();
    toggle('Include lessons not yet shown to students').click(); await tick(80);
    for (let i = 0; i < 6 && !document.body.textContent.includes('Well done'); i++) { btn('Skip step').click(); await tick(80); }
    expect(rpc).toHaveBeenCalledTimes(1);
    const [name, args] = rpc.mock.calls[0];
    expect(name).toBe('submit_makeup');
    expect(args).toMatchObject({ p_class_id: 'c1', p_student_name: 'Test Student', p_source_ids: expect.arrayContaining(['s1']) });
    expect(document.body.textContent).not.toContain('Test run: nothing was saved.');
  });

  it('shows the error from the database if saving fails', async () => {
    h.client = client(realTables); rpc.mockImplementation(async () => ({ data: null, error: { message: 'That is more than 7 makeups in a week. Finish these first, then come back.' } }));
    h.client.rpc = rpc;
    mounted = await renderInBrowser(<MakeupTestScreen />); await tick(80);
    toggle('Really save the submission').click(); await tick();
    toggle('Include lessons not yet shown to students').click(); await tick(80);
    for (let i = 0; i < 6 && !document.querySelector('[role=alert]'); i++) { btn('Skip step').click(); await tick(100); }
    expect(document.querySelector('[role=alert]').textContent).toContain('more than 7 makeups');
    expect(document.body.textContent).not.toContain('Well done');
  });
});

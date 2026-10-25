// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { renderInBrowser } from '../test/render.js';
import { createFakeSupabase } from '../test/fakeSupabase.js';

const h = vi.hoisted(() => ({ client: null }));
vi.mock('../lib/supabase/browser-client', () => ({ get supabaseBrowser() { return h.client; } }));
import { StudentPage, loadStudentData, submitMakeup, isUsableForStudents } from './StudentPage.jsx';

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
window.matchMedia ??= globalThis.matchMedia;
window.SVGElement.prototype.getTotalLength ??= () => 100;
window.SVGElement.prototype.getPointAtLength ??= () => ({ x: 0, y: 0 });

const CLASSES = [{ id: 'c1', name: 'Period 2', requires_code: false }];
const SCRIPTURE = { id: 's1', kind: 'scripture', title: 'Doing what the Lord asks', reference: '1 Nephi 3:7', body: 'I will go and do.', minutes: 4 };
const YOUTUBE = { id: 's2', kind: 'video', title: 'A talk', embed_url: 'https://www.youtube.com/watch?v=OJ2pLI0tZvY', transcript: [{ start: 1, end: 3, text: 'Hello' }], duration_seconds: 60 };

// open: what makeup_work_open() answers; tables: what the two student views return
function client({ open = true, tables = { public_makeup_classes: CLASSES, public_makeup_sources: [SCRIPTURE] }, rpc } = {}) {
  const base = createFakeSupabase({ tables });
  const calls = [];
  const rpcFn = rpc || (async (name) => (name === 'makeup_work_open' ? { data: open, error: null } : { data: 'new-id', error: null }));
  return { ...base, calls, rpc: vi.fn(async (name, args) => { calls.push(name); return rpcFn(name, args); }), functions: { invoke: vi.fn(async () => ({ data: { status: 'sent' }, error: null })) } };
}
let mounted;
afterEach(async () => { await mounted?.unmount(); document.body.innerHTML = ''; });
const tick = (ms = 60) => new Promise((r) => setTimeout(r, ms));

describe('what the student page decides to show', () => {
  it('is closed while the switch is off, and does not even ask for the lessons', async () => {
    const c = client({ open: false });
    expect(await loadStudentData(c)).toEqual({ state: 'closed' });
    expect(c.log).toEqual([]);
  });

  it('is "not ready" until there is at least one class and one lesson', async () => {
    expect((await loadStudentData(client({ tables: { public_makeup_classes: [], public_makeup_sources: [SCRIPTURE] } }))).state).toBe('empty');
    expect((await loadStudentData(client({ tables: { public_makeup_classes: CLASSES, public_makeup_sources: [] } }))).state).toBe('empty');
  });

  it('shows an error state, not a broken page, when the database cannot be reached', async () => {
    expect((await loadStudentData(client({ rpc: async () => ({ data: null, error: { message: 'offline' } }) }))).state).toBe('error');
    expect((await loadStudentData(client({ rpc: async () => { throw new Error('network'); } }))).state).toBe('error');
    expect((await loadStudentData({ ...client(), from: () => ({ select: async () => ({ data: null, error: { message: 'x' } }) }) })).state).toBe('error');
  });

  it('leaves out video and audio a student could not use (no transcript, or an address the player cannot play)', () => {
    expect(isUsableForStudents(SCRIPTURE)).toBe(true);
    expect(isUsableForStudents(YOUTUBE)).toBe(true);
    expect(isUsableForStudents({ ...YOUTUBE, transcript: [] })).toBe(false);
    expect(isUsableForStudents({ ...YOUTUBE, embed_url: 'https://vimeo.com/1' })).toBe(false);
    expect(isUsableForStudents({ ...SCRIPTURE, body: '' })).toBe(false);
  });

  it('loads the classes and only the usable lessons when open', async () => {
    const c = client({ tables: { public_makeup_classes: CLASSES, public_makeup_sources: [SCRIPTURE, YOUTUBE, { ...YOUTUBE, id: 's3', transcript: null }] } });
    const out = await loadStudentData(c);
    expect(out.state).toBe('ready');
    expect(out.sources.map((s) => s.id)).toEqual(['s1', 's2']);
  });
});

describe('submitting', () => {
  const rpcArgs = { p_class_id: 'c1', p_student_name: 'Maya' };

  it('saves through the safe submit function, then tells the teacher with only the submission id', async () => {
    const c = client();
    const out = await submitMakeup(c, rpcArgs);
    expect(out).toEqual({ ok: true, saved: true, id: 'new-id' });
    expect(c.rpc).toHaveBeenCalledWith('submit_makeup', rpcArgs);
    expect(c.functions.invoke).toHaveBeenCalledWith('makeup-notify', { body: { submission_id: 'new-id' } });
  });

  it('shows the database\'s own plain message when it refuses (wrong code, weekly limit)', async () => {
    const c = client({ rpc: async () => ({ data: null, error: { message: 'That class code is not right. Ask your teacher.' } }) });
    expect(await submitMakeup(c, rpcArgs)).toEqual({ ok: false, error: 'That class code is not right. Ask your teacher.' });
    expect(c.functions.invoke).not.toHaveBeenCalled();           // nothing saved, so nothing to email
  });

  it('is still a success if telling the teacher fails (it is saved; an admin can resend)', async () => {
    const c = client();
    c.functions.invoke = vi.fn(async () => { throw new Error('function down'); });
    expect((await submitMakeup(c, rpcArgs)).ok).toBe(true);
    c.functions.invoke = vi.fn(() => { throw new Error('threw synchronously'); });
    await expect(submitMakeup(c, rpcArgs)).resolves.toMatchObject({ ok: true });
  });
});

describe('the student page', () => {
  it('says it is closed, with a way back, while the switch is off', async () => {
    h.client = client({ open: false });
    mounted = await renderInBrowser(<StudentPage />); await tick();
    expect(document.querySelector('h1').textContent).toBe('Makeup Work is not open right now.');
    expect(document.querySelector('a').getAttribute('href')).toMatch(/\/makeup-work$/);
    expect(document.querySelector('.mw-skip')).toBeNull();
  });

  it('starts the journey when open, full screen, and students never get the skip tools', async () => {
    h.client = client();
    mounted = await renderInBrowser(<StudentPage />); await tick();
    expect(document.querySelector('.mw-h').textContent).toBe("Let's make up the time");
    expect(document.querySelector('.mw-stage').className).toContain('full');
    expect(document.querySelector('.mw-skip')).toBeNull();
    expect(document.body.textContent).not.toContain('Test run');
    expect([...document.querySelectorAll('.mw-chip')].map((b) => b.textContent)).toContain('Period 2');
  });
});

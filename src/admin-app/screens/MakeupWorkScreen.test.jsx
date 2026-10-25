// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderInBrowser } from '../../test/render.js';
import { createLessonsDb } from '../../test/fakeLessonsDb.js';

const h = vi.hoisted(() => ({ client: null }));
vi.mock('../../lib/supabase/browser-client', () => ({ get supabaseBrowser() { return h.client; } }));
import { MakeupWorkScreen } from './MakeupWorkScreen.jsx';

const tick = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const act = (fn) => React.act(async () => { await fn(); });
const btn = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
const field = (label, within = document) => { const l = [...within.querySelectorAll('label')].find((x) => x.textContent.trim().startsWith(label)); return document.getElementById(l.htmlFor); };
const setVal = async (el, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value); await act(async () => { el.dispatchEvent(new Event('input', { bubbles: true })); }); };
const cardOf = (title) => [...document.querySelectorAll('.card')].find((c) => c.textContent.startsWith(title));

let mounted, db;
async function render({ classes = [{ id: 'c1', name: 'Alta Seminary', teacher_email: null, teacher_name: null, code: null, active: true, sort_order: 0 }], sources = [] } = {}) {
  db = createLessonsDb({ sources, other: { makeup_classes: classes, makeup_submissions: [], site_settings: [{ id: true, makeup_work_enabled: false }] } });
  h.client = { ...db, functions: { invoke: vi.fn() } };
  mounted = await renderInBrowser(<MakeupWorkScreen />); await act(() => tick(60));
}
const writes = (table, op) => db.log.filter((x) => x.table === table && x.op === op);
beforeEach(() => { window.confirm = vi.fn(() => true); });
afterEach(async () => { await mounted?.unmount(); document.body.innerHTML = ''; vi.restoreAllMocks(); });

const LESSONS = [
  { id: 'a', kind: 'scripture', title: 'A', body: 'words here', active: true },
  { id: 'b', kind: 'scripture', title: 'B', body: 'words here', active: false },
  { id: 'c', kind: 'talk', title: 'C', body: 'words here', active: true },
];

describe('the lessons summary', () => {
  it('counts the lessons and links to the Lessons page', async () => {
    await render({ sources: LESSONS });
    const card = cardOf('Lessons');
    expect(card.textContent).toContain('3 lessons, 2 shown to students');
    expect(card.textContent).toContain('2 scriptures');
    expect(card.textContent).toContain('1 conference talk');
    expect([...card.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(['/admin/makeup-work/lessons', '/admin/makeup-work/lessons?new=1']);
  });

  it('feeds the readiness checklist at the top', async () => {
    await render({ sources: LESSONS });
    expect(document.body.textContent).toContain('2 lessons shown to students');
    expect(document.body.textContent).toContain('1 active class');
  });
});

describe('classes', () => {
  it('says plainly when a class has no teacher email yet', async () => {
    await render();
    expect(document.body.textContent).toContain('No teacher email yet, so no one is emailed for this class');
  });

  it('adds a class, with or without a teacher email', async () => {
    await render();
    const card = cardOf('Classes');
    await setVal(field('Class name', card), 'Period 2');
    await act(() => btn('Add class').click()); await act(() => tick(40));
    expect(writes('makeup_classes', 'insert')[0].payload).toMatchObject({ name: 'Period 2', teacher_email: null, teacher_name: null, code: null });
    await setVal(field('Class name', card), 'Period 3');
    await setVal(field('Teacher email', card), 'teacher@example.org');
    await act(() => btn('Add class').click()); await act(() => tick(40));
    expect(writes('makeup_classes', 'insert')[1].payload).toMatchObject({ name: 'Period 3', teacher_email: 'teacher@example.org' });
  });

  it('will not add a class with a name missing or an email that is not one', async () => {
    await render();
    const card = cardOf('Classes');
    expect(btn('Add class').disabled).toBe(true);
    await setVal(field('Class name', card), 'Period 4');
    await setVal(field('Teacher email', card), 'not an email');
    expect(btn('Add class').disabled).toBe(true);
    await setVal(field('Teacher email', card), '');
    expect(btn('Add class').disabled).toBe(false);
  });

  it('edits a class in place, so the ready-made one can be given its teacher\'s email', async () => {
    await render();
    await act(() => btn('Edit').click());
    const form = cardOf('Classes');
    const inEdit = [...form.querySelectorAll('label')].filter((l) => l.textContent.trim().startsWith('Class name'))[0];
    await setVal(document.getElementById(inEdit.htmlFor), 'Early morning');
    const email = [...form.querySelectorAll('label')].filter((l) => l.textContent.trim().startsWith('Teacher email'))[0];
    await setVal(document.getElementById(email.htmlFor), 'bro.smith@example.org');
    const name = [...form.querySelectorAll('label')].filter((l) => l.textContent.trim().startsWith('Teacher name'))[0];
    await setVal(document.getElementById(name.htmlFor), 'Brother Smith');
    await act(() => btn('Save class').click()); await act(() => tick(40));
    expect(writes('makeup_classes', 'update')[0].payload).toEqual({ name: 'Early morning', teacher_name: 'Brother Smith', teacher_email: 'bro.smith@example.org', code: null });
    expect(db.tables.makeup_classes[0].teacher_email).toBe('bro.smith@example.org');
    expect(document.body.textContent).toContain('Brother Smith · bro.smith@example.org');
  });

  it('will not save an edit with a bad email, and can be cancelled', async () => {
    await render();
    await act(() => btn('Edit').click());
    const email = [...cardOf('Classes').querySelectorAll('label')].filter((l) => l.textContent.trim().startsWith('Teacher email'))[0];
    await setVal(document.getElementById(email.htmlFor), 'nope');
    expect(btn('Save class').disabled).toBe(true);
    expect(document.body.textContent).toContain('does not look like an email');
    await act(() => btn('Cancel').click());
    expect(btn('Save class')).toBeUndefined();
  });

  it('asks before removing a class', async () => {
    await render();
    window.confirm = vi.fn(() => false);
    await act(() => btn('Remove').click());
    expect(db.tables.makeup_classes).toHaveLength(1);
    window.confirm = vi.fn(() => true);
    await act(() => btn('Remove').click()); await act(() => tick(40));
    expect(db.tables.makeup_classes).toHaveLength(0);
  });
});

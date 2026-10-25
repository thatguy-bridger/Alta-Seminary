// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderInBrowser } from '../../test/render.js';
import { createFakeSupabase } from '../../test/fakeSupabase.js';

const h = vi.hoisted(() => ({ client: null }));
vi.mock('../../lib/supabase/browser-client', () => ({ get supabaseBrowser() { return h.client; } }));
import { MakeupSubmissions } from './MakeupSubmissions.jsx';

const sub = (over = {}) => ({
  id: 'a', student_name: 'Maya', class_name: 'Period 2', created_at: '2026-10-25T15:00:00Z', days_total: 1, source_titles: ['Come Home'], mode: 'text',
  truth: 'If we come home, then He meets us.', truth_ref: 'Come Home · 3:12', understanding: 'It helps.', response: 'Peace, because I felt it.',
  commit_kind: 'serve', commitment: 'Serve my brother', blessing: 'be kinder', active_seconds: 600, paste_attempts: 0, sudden_jumps: 0, typed_chars: 300, page_leaves: 0,
  watched_seconds: 0, source_seconds: 0, notified_at: null, email_error: null, review_status: 'new', review_note: null, ...over,
});
const SUBS = [
  sub({ id: 'a', student_name: 'Maya', email_error: 'Email is not set up yet.' }),
  sub({ id: 'b', student_name: 'Noah', class_name: 'Period 3', review_status: 'accepted', notified_at: '2026-10-25T15:05:00Z' }),
  sub({ id: 'c', student_name: 'Eli', review_status: 'redo', review_note: 'Add an example' }),
];

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const setVal = async (el, value) => {
  const proto = { SELECT: HTMLSelectElement, TEXTAREA: HTMLTextAreaElement }[el.tagName] || HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, value);
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  await tick();
};
const select = (label) => document.getElementById([...document.querySelectorAll('label')].find((l) => l.textContent.trim() === label).htmlFor);
const row = (name) => [...document.querySelectorAll('details')].find((d) => d.querySelector('summary').textContent.includes(name));
const rowBtn = (name, text) => [...row(name).querySelectorAll('button')].find((b) => b.textContent.trim() === text);
const names = () => [...document.querySelectorAll('details summary strong')].map((e) => e.textContent);

let mounted, reload, flash, fn;
async function render(subs = SUBS) {
  fn = { data: { status: 'sent' }, error: null };
  h.client = { ...createFakeSupabase(), functions: { invoke: vi.fn(async () => fn) } };
  reload = vi.fn(async () => {}); flash = vi.fn();
  mounted = await renderInBrowser(<MakeupSubmissions subs={subs} reload={reload} flash={flash} />); await tick();
}
const writes = (op) => h.client.log.filter((x) => x.table === 'makeup_submissions' && x.op === op);
beforeEach(() => { window.print = vi.fn(); });
afterEach(async () => { await mounted?.unmount(); document.body.innerHTML = ''; vi.restoreAllMocks(); });

describe('submissions in the admin', () => {
  it('counts what is new and lists everything, with its review and email state', async () => {
    await render();
    expect(document.body.textContent).toContain('Submissions (3, 1 new)');
    expect(names()).toEqual(['Maya', 'Noah', 'Eli']);
    expect(row('Maya').querySelector('summary').textContent).toContain('Not emailed');
    expect(row('Noah').querySelector('summary').textContent).toContain('Accepted');
    expect(row('Noah').querySelector('summary').textContent).not.toContain('Not emailed');
    expect(row('Eli').querySelector('summary').textContent).toContain('Needs redo');
  });

  it('filters by class and by review', async () => {
    await render();
    await setVal(select('Class'), 'Period 3');
    expect(names()).toEqual(['Noah']);
    await setVal(select('Class'), '');
    await setVal(select('Review'), 'redo');
    expect(names()).toEqual(['Eli']);
    await setVal(select('Review'), 'accepted'); await setVal(select('Class'), 'Period 2');
    expect(document.body.textContent).toContain('Nothing matches those filters');
  });

  it('accepts a submission, with a note if there is one, and reloads', async () => {
    await render();
    await setVal(row('Maya').querySelector('textarea'), 'Lovely work');
    rowBtn('Maya', 'Accept').click(); await tick();
    expect(writes('update')[0].payload).toMatchObject({ review_status: 'accepted', review_note: 'Lovely work' });
    expect(writes('update')[0].payload.reviewed_at).toMatch(/^2\d{3}-/);
    expect(reload).toHaveBeenCalled();
    expect(flash).toHaveBeenCalledWith('Accepted.');
  });

  it('will not mark something as needing a redo without a note saying what to fix', async () => {
    await render();
    expect(rowBtn('Maya', 'Needs redo').disabled).toBe(true);
    await setVal(row('Maya').querySelector('textarea'), 'ok');
    expect(rowBtn('Maya', 'Needs redo').disabled).toBe(true);
    await setVal(row('Maya').querySelector('textarea'), 'Add a real example');
    rowBtn('Maya', 'Needs redo').click(); await tick();
    expect(writes('update')[0].payload).toMatchObject({ review_status: 'redo', review_note: 'Add a real example' });
  });

  it('can put a reviewed submission back to new, clearing the review date', async () => {
    await render();
    rowBtn('Eli', 'Mark as new').click(); await tick();
    expect(writes('update')[0].payload).toMatchObject({ review_status: 'new', reviewed_at: null });
  });

  it('emails the teacher again on request, using only the submission id, and says how it went', async () => {
    await render();
    rowBtn('Maya', 'Send now').click(); await tick();
    expect(h.client.functions.invoke).toHaveBeenCalledWith('makeup-notify', { body: { submission_id: 'a' } });
    expect(flash).toHaveBeenCalledWith('Sent.');
    expect(reload).toHaveBeenCalled();
    expect(rowBtn('Noah', 'Send again')).toBeDefined();           // one that was already emailed offers to send again
    fn = { data: { status: 'not-configured', error: 'Email is not set up yet.' }, error: null };
    rowBtn('Maya', 'Send now').click(); await tick();
    expect(flash).toHaveBeenLastCalledWith(expect.stringContaining('not set up'));
  });

  it('asks before deleting, and deletes only when confirmed', async () => {
    await render();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    rowBtn('Maya', 'Delete').click(); await tick();
    expect(confirm.mock.calls[0][0]).toContain("Maya's submission");
    expect(writes('delete')).toHaveLength(0);
    rowBtn('Maya', 'Delete').click(); await tick();
    expect(writes('delete')).toHaveLength(1);
    expect(flash).toHaveBeenCalledWith('Deleted.');
  });

  it('prints only what the filters show, as a record', async () => {
    await render();
    await setVal(select('Class'), 'Period 3');
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Print these').click();
    expect(window.print).toHaveBeenCalledTimes(1);
    const record = document.querySelector('#makeup-print');
    expect(record.textContent).toContain('Alta Seminary makeup work: Period 3');
    expect(record.textContent).toContain('Noah');
    expect(record.textContent).not.toContain('Maya');
  });

  it('shows the answers a student gave to questions while studying, in the list and the printed record', async () => {
    await render([sub({ id: 'q', student_name: 'Ana', pause_answers: [{ lesson: 'Come Home', unit: 'seconds', at: '95', question: 'What stood out?', answer: 'The part about coming back' }] })]);
    expect(row('Ana').textContent).toContain('Questions while studying');
    expect(row('Ana').textContent).toContain('What stood out?');
    expect(row('Ana').textContent).toContain('The part about coming back');
    expect(document.querySelector('#makeup-print').textContent).toContain('While studying (Come Home, at 1:35)');
  });

  it('says so when there is nothing yet', async () => {
    await render([]);
    expect(document.body.textContent).toContain('Nothing yet.');
    expect([...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Print these').disabled).toBe(true);
  });
});

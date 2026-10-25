// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderInBrowser } from '../../../test/render.js';
import { createLessonsDb } from '../../../test/fakeLessonsDb.js';

const h = vi.hoisted(() => ({ client: null }));
vi.mock('../../../lib/supabase/browser-client', () => ({ get supabaseBrowser() { return h.client; } }));
import { LessonEditor } from './LessonEditor.jsx';

const SEGS = [{ start: 1, end: 5, text: 'Hello there.' }, { start: 6, end: 12, text: 'More words follow here.' }, { start: 20, end: 30, text: 'The thing that matters.' }];
const BODY = 'First paragraph about faith.\n\nSecond paragraph about action.\n\nThird paragraph about hope.';
const VERSE = { id: 'L1', kind: 'scripture', title: 'Alma 5', series: 'Book of Mormon', reference: 'Alma 5:14', body: BODY, minutes: 8, active: true, sort_order: 10, pauses: [], thumbnail_url: null, guide_line: null, min_seconds: null, one_time: false };
const VIDEO = { id: 'V1', kind: 'video', title: 'A talk', series: 'April 2026 general conference', author: 'Elder Test', embed_url: 'https://www.youtube.com/watch?v=OJ2pLI0tZvY', duration_seconds: 600, transcript: SEGS, minutes: 12, active: true, sort_order: 6001, pauses: [{ at: 30, question: 'What stood out?' }], thumbnail_url: null, guide_line: 'Notice the story.', min_seconds: 120, one_time: false };

let mounted, db, props;
const tick = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const act = (fn) => React.act(async () => { await fn(); });
const btn = (t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === t);
const setVal = async (el, value) => { const proto = { SELECT: HTMLSelectElement, TEXTAREA: HTMLTextAreaElement }[el.tagName] || HTMLInputElement; Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, value); await act(async () => { el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); }); };
const field = (label) => { const l = [...document.querySelectorAll('label')].find((x) => x.textContent.trim().startsWith(label)); if (!l) throw new Error(`no field "${label}"`); return l.htmlFor ? document.getElementById(l.htmlFor) : l.querySelector('input, textarea, select'); };
const row = (id) => db.tables.makeup_sources.find((r) => r.id === id);
const writes = (op) => db.log.filter((x) => x.table === 'makeup_sources' && x.op === op);

async function render(sources, p = {}) {
  db = createLessonsDb({ sources });
  h.client = db;
  props = { id: p.id === undefined ? sources[0]?.id : p.id, initialKind: p.initialKind, onClose: vi.fn(), onOpen: vi.fn(), onSaved: vi.fn(), flash: vi.fn() };
  mounted = await renderInBrowser(<LessonEditor {...props} />); await act(() => tick(60));
}
beforeEach(() => { window.confirm = vi.fn(() => true); window.open = vi.fn(() => ({ location: { href: '' }, close: vi.fn() })); });
afterEach(async () => { await mounted?.unmount(); document.body.innerHTML = ''; vi.restoreAllMocks(); });

describe('opening a lesson', () => {
  it('loads everything about it', async () => {
    await render([VIDEO]);
    expect(field('Title').value).toBe('A talk');
    expect(field('Collection').value).toBe('April 2026 general conference');
    expect(field('YouTube link').value).toContain('OJ2pLI0tZvY');
    expect(field('Length (m:ss)').value).toBe('10:00');
    expect(field('Guiding line').value).toBe('Notice the story.');
    expect(document.body.textContent).toContain('A transcript with 3 lines, 0:01 to 0:30');
    expect(document.querySelector('.ls-pause textarea').value).toBe('What stood out?');
    expect(document.querySelector('.ls-pause input').value).toBe('0:30');
  });

  it('shows how students will see it, and updates as you type', async () => {
    await render([VERSE]);
    expect([...document.querySelectorAll('.card')].find((c) => c.textContent.startsWith('How students see it')).textContent).toContain('Alma 5');
    await setVal(field('Title'), 'Alma 5 and the mighty change');
    await setVal(field('Guiding line'), 'Look for what changes.');
    const preview = [...document.querySelectorAll('.card')].find((c) => c.textContent.startsWith('How students see it'));
    expect(preview.textContent).toContain('Alma 5 and the mighty change');
    expect(preview.textContent).toContain('Look for what changes.');
  });

  it('says plainly when the lesson is gone', async () => {
    await render([VERSE], { id: 'nope' });
    expect(document.querySelector('[role=alert]').textContent).toContain('could not be found');
  });
});

describe('saving changes', () => {
  it('saves nothing until something changes, then saves only what the lesson holds', async () => {
    await render([VERSE]);
    expect(btn('Save changes').disabled).toBe(true);
    await setVal(field('Title'), 'Alma 5, the whole chapter');
    expect(document.body.textContent).toContain('Unsaved changes');
    await act(() => btn('Save changes').click()); await act(() => tick(40));
    expect(writes('update')).toHaveLength(1);
    expect(row('L1')).toMatchObject({ title: 'Alma 5, the whole chapter', reference: 'Alma 5:14', body: BODY, kind: 'scripture', active: true, pauses: [], min_seconds: null });
    expect('transcript' in writes('update')[0].payload).toBe(false);
    expect(document.body.textContent).toContain('Saved.');
    expect(props.onSaved).toHaveBeenCalled();
    expect(btn('Save changes').disabled).toBe(true);
  });

  it('will not save a lesson with problems, and says what to fix', async () => {
    await render([VERSE]);
    await setVal(field('Title'), '   ');
    await setVal(field('Minutes it takes'), '0');
    await act(() => btn('Save changes').click());
    expect(writes('update')).toHaveLength(0);
    expect(document.body.textContent).toContain('Give the lesson a title.');
    expect(document.body.textContent).toContain('Minutes should be between 1 and 240.');
    expect(document.querySelector('.ls-bar [role=alert]').textContent).toContain('need fixing');
  });

  it('shows an error from the database, and keeps what was typed', async () => {
    await render([VERSE]);
    const real = db.from;
    db.from = (t) => { const b = real(t); if (t === 'makeup_sources') { b.then = (ok) => Promise.resolve({ data: null, error: { message: 'permission denied' } }).then(ok); b.maybeSingle = async () => ({ data: null, error: { message: 'permission denied' } }); } return b; };
    await setVal(field('Title'), 'Changed');
    await act(() => btn('Save changes').click());
    expect(document.querySelector('.ls-bar [role=alert]').textContent).toContain('permission denied');
    expect(field('Title').value).toBe('Changed');
  });

  it('asks before leaving with unsaved changes, and not otherwise', async () => {
    await render([VERSE]);
    await act(() => btn('Back to lessons').click());
    expect(window.confirm).not.toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalledTimes(1);
    await setVal(field('Title'), 'Changed');
    window.confirm = vi.fn(() => false);
    await act(() => btn('Discard and go back').click());
    expect(window.confirm).toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalledTimes(1);                 // stayed
    window.confirm = vi.fn(() => true);
    await act(() => btn('Discard and go back').click());
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });
});

describe('a new lesson', () => {
  it('starts hidden, is added at the end of its collection, and then opens for further editing', async () => {
    await render([], { id: null, initialKind: 'scripture' });
    expect(document.querySelector('h2').textContent).toBe('New lesson');
    await setVal(field('Title'), '1 Nephi 3');
    await setVal(field('Collection'), 'Book of Mormon');
    await setVal(field('Reference'), '1 Nephi 3:7');
    await act(() => btn('Save lesson').click()); await act(() => tick(40));
    expect(writes('insert')).toHaveLength(1);
    expect(db.tables.makeup_sources[0]).toMatchObject({ title: '1 Nephi 3', series: 'Book of Mormon', reference: '1 Nephi 3:7', active: false, sort_order: 9000, kind: 'scripture', body: null });
    expect(props.onOpen).toHaveBeenCalledWith(db.tables.makeup_sources[0].id);
  });

  it('can be shown once it has what students need', async () => {
    await render([], { id: null });
    await setVal(field('Title'), 'A reading');
    const shown = () => document.querySelector('input[aria-label="Shown to students"], label[aria-label="Shown to students"] input');
    expect(shown().disabled).toBe(true);
    expect(document.body.textContent).toContain('Cannot be shown to students yet: it needs text');
    await setVal(field('Text'), 'Words for students to read.');
    expect(shown().disabled).toBe(false);
    await act(() => shown().click());
    await act(() => btn('Save lesson').click());
    expect(db.tables.makeup_sources[0].active).toBe(true);
  });
});

describe('video and audio', () => {
  it('holds a lesson back until it can be played and read along', async () => {
    await render([], { id: null, initialKind: 'video' });
    await setVal(field('Title'), 'New video');
    expect(document.body.textContent).toContain('it needs a YouTube link or audio address, it needs a transcript, it needs a length');
    await setVal(field('YouTube link'), 'https://vimeo.com/123');
    expect(document.body.textContent).toContain('This address is neither');
    await setVal(field('YouTube link'), 'https://youtu.be/OJ2pLI0tZvY');
    expect(document.body.textContent).toContain('Plays as: YouTube video.');
    await setVal(field('Length (m:ss)'), '1:00');
    await setVal(document.querySelector('textarea[placeholder^="WEBVTT"]'), 'WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nHello there.\n\n00:00:05.000 --> 00:00:09.000\nMore words.');
    expect(document.body.textContent).toContain('2 lines read');
    expect(document.body.textContent).not.toContain('Cannot be shown');
    await act(() => btn('Save lesson').click()); await act(() => tick(40));
    const saved = db.tables.makeup_sources[0];
    expect(saved).toMatchObject({ kind: 'video', embed_url: 'https://youtu.be/OJ2pLI0tZvY', duration_seconds: 60, body: null });
    expect(saved.transcript).toEqual([{ start: 1, end: 4, text: 'Hello there.' }, { start: 5, end: 9, text: 'More words.' }]);
  });

  it('shows an existing transcript, opens it as text for editing, and saves the change', async () => {
    await render([VIDEO]);
    await act(() => btn('Edit the transcript as text').click());
    const box = document.querySelector('textarea[placeholder^="WEBVTT"]');
    expect(box.value).toContain('00:00:06.000 --> 00:00:12.000\nMore words follow here.');
    await setVal(box, box.value.replace('More words follow here.', 'Corrected words go here.'));
    await act(() => btn('Save changes').click()); await act(() => tick(40));
    expect(row('V1').transcript.map((s) => s.text)).toEqual(['Hello there.', 'Corrected words go here.', 'The thing that matters.']);
    expect(row('V1').transcript[1]).toMatchObject({ start: 6, end: 12 });
  });

  it('can go back from editing the transcript without changing it', async () => {
    await render([VIDEO]);
    await act(() => btn('Edit the transcript as text').click());
    await act(() => btn('Cancel, keep the current transcript').click());
    expect(document.body.textContent).toContain('A transcript with 3 lines');
    expect(btn('Save changes').disabled).toBe(true);
  });

  it('refuses a transcript that runs past the end, or has no times', async () => {
    await render([VIDEO]);
    await act(() => btn('Edit the transcript as text').click());
    const box = document.querySelector('textarea[placeholder^="WEBVTT"]');
    await setVal(box, 'just words, no times');
    await act(() => btn('Save changes').click());
    expect(writes('update')).toHaveLength(0);
    await setVal(box, 'WEBVTT\n\n00:20:00.000 --> 00:20:05.000\nWay past the 10 minute end');
    expect(document.body.textContent).toContain('past the end');
  });

  it('keeps a lesson hidden on save if what it needs was removed', async () => {
    await render([VIDEO]);
    await setVal(field('YouTube link'), '');
    expect(document.body.textContent).toContain('This lesson will be hidden when you save');
    await act(() => btn('Save changes').click()); await act(() => tick(40));
    expect(row('V1')).toMatchObject({ active: false, embed_url: null });
    expect(props.flash).toHaveBeenCalledWith(expect.stringContaining('hidden from students'));
  });
});

describe('the picture', () => {
  it('starts automatic, can be set to a painting or a link, and back to automatic', async () => {
    await render([VERSE]);
    expect(document.body.textContent).toContain('Painting:');
    await act(() => document.querySelector('.ls-pick[title^="Sermon on the Mount"]').click());
    expect(document.querySelector('.ls-pic .frame img').getAttribute('src')).toBe('/makeup/thumbs/sermon-bloch.webp');
    await act(() => btn('Save changes').click()); await act(() => tick(40));
    expect(row('L1').thumbnail_url).toBe('/makeup/thumbs/sermon-bloch.webp');
    await setVal(field('Or paste a picture address'), 'https://example.org/mine.jpg');
    expect(document.querySelector('.ls-pic .frame img').getAttribute('src')).toBe('https://example.org/mine.jpg');
    expect(document.body.textContent).toContain('Your picture');
    await act(() => btn('Use the automatic picture').click());
    await act(() => btn('Save changes').click()); await act(() => tick(40));
    expect(row('L1').thumbnail_url).toBeNull();
  });

  it('refuses an unsafe picture address', async () => {
    await render([VERSE]);
    await setVal(field('Or paste a picture address'), 'javascript:alert(1)');
    expect(document.body.textContent).toContain('Use an address that starts with https://');
    await act(() => btn('Save changes').click());
    expect(writes('update')).toHaveLength(0);
  });

  it('uses a YouTube video\'s own picture until you choose another', async () => {
    await render([VIDEO]);
    expect(document.querySelector('.ls-pic .frame img').getAttribute('src')).toBe('https://i.ytimg.com/vi/OJ2pLI0tZvY/hqdefault.jpg');
    expect(document.body.textContent).toContain('YouTube picture (automatic)');
  });
});

describe('the experience', () => {
  it('saves a guiding line, and clears it when emptied', async () => {
    await render([VERSE]);
    await setVal(field('Guiding line'), 'Look for what changes.');
    await act(() => btn('Save changes').click()); await act(() => tick(40));
    expect(row('L1').guide_line).toBe('Look for what changes.');
    await setVal(field('Guiding line'), '');
    await act(() => btn('Save changes').click()); await act(() => tick(40));
    expect(row('L1').guide_line).toBeNull();
  });

  it('can set how long students stay, or go back to automatic', async () => {
    await render([VERSE]);
    const mode = document.querySelector('select[aria-label="How long students stay"]');
    expect(mode.value).toBe('auto');
    await setVal(mode, 'custom');
    await setVal(document.querySelector('input[aria-label="Seconds"]'), '45');
    await act(() => btn('Save changes').click()); await act(() => tick(40));
    expect(row('L1').min_seconds).toBe(45);
    await setVal(mode, 'auto');
    await act(() => btn('Save changes').click()); await act(() => tick(40));
    expect(row('L1').min_seconds).toBeNull();
  });

  it('wants whole seconds', async () => {
    await render([VERSE]);
    await setVal(document.querySelector('select[aria-label="How long students stay"]'), 'custom');
    await setVal(document.querySelector('input[aria-label="Seconds"]'), 'soon');
    expect(document.body.textContent).toContain('Enter whole seconds');
  });

  it('adds a question to a reading, after a paragraph chosen from the text', async () => {
    await render([VERSE]);
    await act(() => btn('Add a question').click());
    const pick = document.querySelector('.ls-pause select');
    expect([...pick.options].map((o) => o.textContent.slice(0, 22))).toEqual(['1. First paragraph abo', '2. Second paragraph ab', '3. Third paragraph abo']);
    await setVal(pick, '2');
    await setVal(document.querySelector('.ls-pause textarea'), 'What does action look like?');
    await act(() => btn('Save changes').click()); await act(() => tick(40));
    expect(row('L1').pauses).toEqual([{ at: 2, question: 'What does action look like?' }]);
  });

  it('adds a question to a video at a time, and shows what is being said there', async () => {
    await render([VIDEO]);
    await act(() => btn('Add a question').click());
    const rows = document.querySelectorAll('.ls-pause');
    await setVal(rows[1].querySelector('input'), '0:21');
    expect(rows[1].textContent).toContain('Around: “The thing that matters.”');
    await setVal(rows[1].querySelector('textarea'), 'What matters most here?');
    await act(() => btn('Save changes').click()); await act(() => tick(40));
    expect(row('V1').pauses).toEqual([{ at: 30, question: 'What stood out?' }, { at: 21, question: 'What matters most here?' }].sort((a, b) => a.at - b.at));
  });

  it('explains a question placed badly, and lets you remove one', async () => {
    await render([VIDEO]);
    await setVal(document.querySelector('.ls-pause input'), '15:00');
    expect(document.body.textContent).toContain('Each question needs a time inside the lesson');
    await act(() => btn('Save changes').click());
    expect(writes('update')).toHaveLength(0);
    await act(() => btn('Remove').click());
    expect(document.body.textContent).toContain('No questions yet.');
    await act(() => btn('Save changes').click()); await act(() => tick(40));
    expect(row('V1').pauses).toEqual([]);
  });

  it('limits a lesson to six questions', async () => {
    await render([VERSE]);
    for (let i = 0; i < 6; i++) await act(() => btn('Add a question').click());
    expect(btn('Add a question').disabled).toBe(true);
  });
});

describe('copy, delete and preview', () => {
  it('makes a hidden copy and opens it', async () => {
    await render([VIDEO]);
    await act(() => btn('Make a copy').click()); await act(() => tick(40));
    const copy = db.tables.makeup_sources[1];
    expect(copy).toMatchObject({ title: 'A talk (copy)', active: false, origin_url: null, kind: 'video' });
    expect(copy.transcript).toHaveLength(3);                       // the whole lesson comes with it
    expect(copy.id).not.toBe('V1');
    expect(props.onOpen).toHaveBeenCalledWith(copy.id);
  });

  it('deletes only after asking', async () => {
    await render([VERSE]);
    window.confirm = vi.fn(() => false);
    await act(() => btn('Delete this lesson').click());
    expect(db.tables.makeup_sources).toHaveLength(1);
    window.confirm = vi.fn(() => true);
    await act(() => btn('Delete this lesson').click()); await act(() => tick(40));
    expect(db.tables.makeup_sources).toHaveLength(0);
    expect(props.onClose).toHaveBeenCalled();
  });

  it('opens the lesson as a student sees it, saving first if there are changes', async () => {
    await render([VERSE]);
    const win = { location: { href: '' }, close: vi.fn() };
    window.open = vi.fn(() => win);
    expect(btn('Preview as a student')).toBeDefined();
    await act(() => btn('Preview as a student').click()); await act(() => tick(40));
    expect(win.location.href).toContain('/admin/makeup-work/test?lesson=L1');
    expect(writes('update')).toHaveLength(0);                       // nothing changed, so nothing to save
    await setVal(field('Title'), 'Changed title');
    const win2 = { location: { href: '' }, close: vi.fn() };
    window.open = vi.fn(() => win2);
    await act(() => btn('Save and preview as a student').click()); await act(() => tick(60));
    expect(row('L1').title).toBe('Changed title');
    expect(win2.location.href).toContain('?lesson=L1');
  });

  it('does not open a preview when saving fails', async () => {
    await render([VERSE]);
    await setVal(field('Title'), '');
    const win = { location: { href: '' }, close: vi.fn() };
    window.open = vi.fn(() => win);
    await act(() => btn('Save and preview as a student').click()); await act(() => tick(40));
    expect(win.close).toHaveBeenCalled();
    expect(win.location.href).toBe('');
  });
});

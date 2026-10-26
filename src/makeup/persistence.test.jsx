// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderInBrowser } from '../test/render.js';
import { MakeupJourney } from './MakeupJourney.jsx';
import { SAMPLE_CLASSES } from './sampleContent.js';
import { PROGRESS_KEY, writeProgress, readProgress } from './progress.js';
import { initialState } from './journey.js';
import { paletteAt, duotoneFor, stageBottomColor } from './scene.js';

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
window.matchMedia ??= globalThis.matchMedia;
globalThis.URL.createObjectURL ??= () => 'blob:sample';
window.SVGElement.prototype.getTotalLength ??= () => 100;
window.SVGElement.prototype.getPointAtLength ??= () => ({ x: 0, y: 0 });
window.HTMLMediaElement.prototype.play = () => Promise.resolve();
window.HTMLMediaElement.prototype.pause = () => {};

const LESSONS = [
  { id: 'L1', kind: 'scripture', title: 'A verse', reference: '1 Nephi 3:7', body: 'First paragraph about faith.\n\nSecond paragraph about action.', minutes: 4, min_seconds: 30 },
  { id: 'A1', kind: 'audio', title: 'A talk', author: 'Elder Test', embed_url: 'https://example.org/talk.mp3', duration_seconds: 60, minutes: 5,
    transcript: [{ start: 0, end: 20, text: 'First part.' }, { start: 20, end: 60, text: 'Second part.' }] },
];
const CLASS = SAMPLE_CLASSES[1];

let mounted;
beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute('style'); document.body.removeAttribute('style'); });
afterEach(async () => { await mounted?.unmount(); document.body.innerHTML = ''; });
const tick = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const act = (fn) => React.act(async () => { await fn(); });
const btn = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
const setVal = async (el, value) => { const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value); await act(async () => { el.dispatchEvent(new Event('input', { bubbles: true })); }); };
const saved = () => JSON.parse(localStorage.getItem(PROGRESS_KEY) || 'null');

async function open(props = {}) {
  const onSubmit = vi.fn(async () => ({ ok: true, saved: false }));
  mounted = await renderInBrowser(<MakeupJourney full persist skipTools classes={SAMPLE_CLASSES} sources={LESSONS} onSubmit={onSubmit} {...props} />);
  await act(() => tick(30));
  return onSubmit;
}
const close = async () => { await mounted.unmount(); mounted = null; document.body.innerHTML = ''; };
// a place put straight into storage, for the cases that would take a long time to reach by hand
const seed = (data = {}, S = {}) => writeProgress(localStorage, {
  S: { ...initialState(), step: 2, name: 'Maya', cls: CLASS.id, days: 1, settled: true, sourceIds: ['L1'], picks: ['read'], ...S }, ...data,
});
const REAL = { now: Date.now(), classes: SAMPLE_CLASSES, sources: LESSONS };

describe('closing the page and coming back', () => {
  it('puts back what was typed on the first screen, and says welcome back', async () => {
    await open();
    await setVal(document.querySelector('#mw-name'), 'Maya');
    await act(() => [...document.querySelectorAll('.mw-chip')].find((b) => b.textContent === 'Period 2').click());
    await act(() => [...document.querySelectorAll('.mw-chip')].find((b) => b.textContent === '2').click());
    await close();
    expect(saved().S).toMatchObject({ name: 'Maya', cls: CLASS.id, days: 2 });                // written as the page closed

    await open();
    expect(document.querySelector('#mw-name').value).toBe('Maya');
    expect([...document.querySelectorAll('.mw-chip')].find((b) => b.textContent === 'Period 2').getAttribute('aria-pressed')).toBe('true');
    expect([...document.querySelectorAll('.mw-chip')].find((b) => b.textContent === '2').getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('.mw-toast').textContent).toBe('Welcome back, Maya. Your place was saved.');
  });

  it('keeps every answer on every step, and the place in the journey', async () => {
    await open();
    for (let i = 0; i < 3; i++) { await act(() => btn('Skip step').click()); await act(() => tick(50)); }     // begin, choose, learn
    expect(document.querySelector('#mw-truth')).not.toBeNull();
    await setVal(document.querySelector('#mw-truth'), 'If we act, He helps');
    await setVal(document.querySelector('#mw-where'), 'Verse 7');
    await close();

    await open();
    expect(document.querySelector('#mw-truth').value).toBe('If we act, He helps');
    expect(document.querySelector('#mw-where').value).toBe('Verse 7');
    expect(document.querySelector('.mw-eyebrow').textContent).toBe('Find a truth');
  });

  it('is saved while the student carries on, not only when the page closes (a phone can just be swiped away)', async () => {
    await open();
    await setVal(document.querySelector('#mw-name'), 'Ana');
    await act(() => tick(1700));                                                               // the page saves every moment or so
    expect(saved().S.name).toBe('Ana');
  });

  it('does not save a page that was only opened', async () => {
    await open();
    await act(() => tick(1700));
    await close();
    expect(localStorage.getItem(PROGRESS_KEY)).toBeNull();
  });

  it('does not save, and does not restore, in a preview or a test run (no persist)', async () => {
    seed({}, { name: 'Someone else' });
    await open({ persist: false });
    expect(document.querySelector('.mw-eyebrow').textContent).not.toBe('Find a truth');
    expect(document.querySelector('#mw-name')?.value || '').toBe('');
    await setVal(document.querySelector('#mw-name'), 'Preview');
    await act(() => tick(1700));
    expect(saved().S.name).toBe('Someone else');                                               // untouched
    expect(document.querySelector('.mw-saved')).toBeNull();
  });

  it('starts fresh when the saved place is too old', async () => {
    writeProgress(localStorage, { S: { ...initialState(), step: 2, name: 'Old', cls: CLASS.id, days: 1, settled: true, sourceIds: ['L1'] } }, { now: Date.now() - 20 * 86400_000 });
    await open();
    expect(document.querySelector('#mw-name').value).toBe('');
    expect(document.querySelector('.mw-toast').textContent).toBe('');
  });

  it('once the work is sent there is nothing left to come back to', async () => {
    const onSubmit = await open();
    for (let i = 0; i < 5; i++) { await act(() => btn('Skip step').click()); await act(() => tick(60)); }     // begin, choose, learn, truth, understand
    await act(() => tick(1700));
    expect(saved().S.step).toBe(5);                                                            // it is being kept on the last step...
    await act(() => btn('Skip step').click()); await act(() => tick(60));                     // ...and then sent
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain('Well done');
    expect(localStorage.getItem(PROGRESS_KEY)).toBeNull();
    await act(() => tick(1700));
    expect(localStorage.getItem(PROGRESS_KEY)).toBeNull();                                     // and the page does not write it back
    await close();
    await open();
    expect(document.querySelector('#mw-name').value).toBe('');
  });

  it('keeps the place if it could not be sent (offline), so nothing is lost', async () => {
    const onSubmit = vi.fn(async () => ({ ok: false, error: 'No connection.' }));
    await open({ onSubmit });
    for (let i = 0; i < 6; i++) { await act(() => btn('Skip step').click()); await act(() => tick(60)); }
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain('No connection.');
    await act(() => tick(1700));
    expect(saved().S.step).toBe(5);
    expect(saved().S.commit.length).toBeGreaterThan(5);
  });

  it('survives storage that is blocked: the journey works as it always did', async () => {
    const real = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } });
    try {
      await open();
      await setVal(document.querySelector('#mw-name'), 'Maya');
      expect(document.querySelector('#mw-name').value).toBe('Maya');
      expect(document.querySelector('.mw-saved')).toBeNull();                                  // it does not claim to be saving
    } finally { Object.defineProperty(window, 'localStorage', real); }
  });
});

describe('the numbers behind the teacher\'s signal come back too', () => {
  const finish = async (onSubmit) => { await act(() => btn('Skip step').click()); await act(() => tick(60)); return onSubmit.mock.calls[0][0].row; };   // from the last step, one tap sends

  it('does not read words typed before as a sudden jump, or count them as typed twice', async () => {
    await open();
    for (let i = 0; i < 3; i++) { await act(() => btn('Skip step').click()); await act(() => tick(50)); }
    await setVal(document.querySelector('#mw-truth'), 'If we act, He helps');                  // 19 characters, typed
    await close();

    const onSubmit = await open();
    await setVal(document.querySelector('#mw-truth'), 'If we act, He helps us');               // three more
    for (let i = 0; i < 3; i++) { await act(() => btn('Skip step').click()); await act(() => tick(60)); }
    const row = onSubmit.mock.calls[0][0].row;
    expect(row.sudden_jumps).toBe(0);                                                          // not "22 characters appeared at once"
    expect(row.typed_chars).toBe(22);                                                          // 19 + 3, not 19 + 22
    expect(row.paste_attempts).toBe(0);
  });

  it('keeps counts from before: pastes, jumps, active time', async () => {
    seed({ tracker: { stats: { pastes: 2, jumps: 1, activeMs: 41000, typedChars: 120, leaves: 1 }, prevLen: {} } }, { step: 5, learned: true, truth: 'If we act then He will help', where: 'Verse 7', understanding: 'x y z a b c d e f', text: 'x y z a b c d e f', inv: 'serve', commit: 'help my brother', bless: 'be kinder' });
    const onSubmit = await open();
    const row = await finish(onSubmit);
    expect(row.paste_attempts).toBe(2);
    expect(row.sudden_jumps).toBe(1);
    expect(row.typed_chars).toBe(120);
    expect(row.active_seconds).toBeGreaterThanOrEqual(41);
  });

  it('does not count closing the page as leaving it while writing', async () => {
    seed({ hidden: true, tracker: { stats: { leaves: 3 }, prevLen: {} } }, { step: 5, learned: true, truth: 'If we act then He will help', where: 'Verse 7', understanding: 'x y z a b c d e f', text: 'x y z a b c d e f', inv: 'serve', commit: 'help my brother', bless: 'be kinder' });
    const onSubmit = await open();
    const row = await finish(onSubmit);
    expect(row.page_leaves).toBe(2);                                                           // three, less the closing that was the save
  });

  it('counts a real tab switch as leaving (the save was not made while hidden)', async () => {
    seed({ hidden: false, tracker: { stats: { leaves: 3 }, prevLen: {} } }, { step: 5, learned: true, truth: 'If we act then He will help', where: 'Verse 7', understanding: 'x y z a b c d e f', text: 'x y z a b c d e f', inv: 'serve', commit: 'help my brother', bless: 'be kinder' });
    const onSubmit = await open();
    const row = await finish(onSubmit);
    expect(row.page_leaves).toBe(3);
  });

  it('keeps the totals of lessons already finished', async () => {
    seed({ lessons: { '0:L1': { played: 45, duration: 60, readSeconds: 12, mutedPlayed: 7, seen: [[0, 44]], reached: 45, done: true } } }, { step: 5, learned: true, truth: 'If we act then He will help', where: 'Verse 7', understanding: 'x y z a b c d e f', text: 'x y z a b c d e f', inv: 'serve', commit: 'help my brother', bless: 'be kinder' });
    const onSubmit = await open();
    const row = await finish(onSubmit);
    expect(row.watched_seconds).toBe(45);
    expect(row.source_seconds).toBe(60);
    expect(row.muted_seconds).toBe(7);
  });
});

describe('a lesson partway through', () => {
  it('a reading keeps the time already spent on it', async () => {
    seed({ lessons: { '0:L1': { played: 0, duration: 0, readSeconds: 100, mutedPlayed: 0, time: 0, seen: [], quiet: [] } } }, { step: 2, learned: false });
    await open();
    await act(() => tick(1200));
    expect(document.body.textContent).toContain('Thank you for staying with it');             // 100 of the 30 seconds asked for
    expect(btn('Continue')).toBeTruthy();
  });

  it('closing straight after coming back does not lose the place', async () => {
    seed({ lessons: { '0:L1': { played: 0, duration: 0, readSeconds: 100, mutedPlayed: 0, time: 0, seen: [], quiet: [] } } }, { step: 2, learned: false });
    await open();
    await close();                                                                             // not even a second later
    expect(saved().lessons['0:L1'].readSeconds).toBe(100);
  });

  it('a reading that was not finished still has to be, and keeps counting from where it was', async () => {
    seed({ lessons: { '0:L1': { played: 0, duration: 0, readSeconds: 10, mutedPlayed: 0, time: 0, seen: [], quiet: [] } } }, { step: 2, learned: false });
    await open();
    expect(document.body.textContent).toContain('Read slowly');
    expect(parseFloat(document.querySelector('.mw-meter b').style.width)).toBeCloseTo(33.3, 0);                // 10 of 30 seconds
  });

  it('a lesson they were not on does not lend its time to this one', async () => {
    seed({ lessons: { '0:SOMETHING-ELSE': { played: 0, duration: 0, readSeconds: 100, mutedPlayed: 0, time: 0, seen: [], quiet: [] } } }, { step: 2, learned: false });
    await open();
    expect(document.body.textContent).toContain('Read slowly');
    expect(document.querySelector('.mw-meter b').style.width).toBe('0%');
  });

  it('a video or audio goes back to where it was stopped, and keeps the seconds already played', async () => {
    seed({ lessons: { '0:A1': { played: 50, duration: 60, readSeconds: 0, mutedPlayed: 0, time: 50.4, seen: [[0, 49]], quiet: [] } } }, { step: 2, learned: false, sourceIds: ['A1'], picks: ['listen'] });
    await open();
    const el = document.querySelector('audio');
    Object.defineProperty(el, 'duration', { configurable: true, value: 60 });
    let set = 0; Object.defineProperty(el, 'currentTime', { configurable: true, get: () => set, set: (v) => { set = v; } });
    await act(async () => { el.dispatchEvent(new Event('loadedmetadata')); });
    await act(() => tick(300));
    expect(set).toBe(50.4);                                                                    // waiting where they stopped, not playing by itself
    expect(btn('Continue')).toBeTruthy();                                                      // 50 of 60 seconds is enough: nothing is lost
  });

  it('a lesson played a little is still only a little played, so it has to be played on', async () => {
    seed({ lessons: { '0:A1': { played: 12, duration: 60, readSeconds: 0, mutedPlayed: 0, time: 12, seen: [[0, 11]], quiet: [] } } }, { step: 2, learned: false, sourceIds: ['A1'], picks: ['listen'] });
    await open();
    await act(() => tick(300));
    expect(btn('Continue')).toBeUndefined();
  });

  it('records the place in the lesson when saving', async () => {
    seed({ lessons: { '0:A1': { played: 30, duration: 60, readSeconds: 0, mutedPlayed: 0, time: 31, seen: [[0, 29]], quiet: [] } } }, { step: 2, learned: false, sourceIds: ['A1'], picks: ['listen'] });
    await open();
    await act(() => tick(1700));
    const back = readProgress(localStorage, REAL);
    expect(back.lessons['0:A1']).toMatchObject({ played: 30, seen: [[0, 29]] });
    expect(back.lessons['0:A1'].time).toBeCloseTo(31, 0);
  });

  it('an unfinished answer to a pause question comes back too', async () => {
    const withQuestion = { ...LESSONS[0], pauses: [{ at: 1, question: 'What stood out to you?' }] };
    seed({ lessons: { '0:L1': { played: 0, duration: 0, readSeconds: 3, mutedPlayed: 0, time: 0, seen: [], quiet: [] } } }, { step: 2, learned: false });
    await open({ sources: [withQuestion] });
    const box = document.querySelector('.mw-pause textarea');
    await setVal(box, 'Faith means acting');
    await act(() => tick(1700));
    await close();
    await open({ sources: [withQuestion] });
    expect(document.querySelector('.mw-pause textarea').value).toBe('Faith means acting');
  });
});

describe('starting over', () => {
  it('asks twice, then clears the place, the answers, the notes and the numbers', async () => {
    seed({ notes: 'my notes', tracker: { stats: { pastes: 3 }, prevLen: {} } }, { step: 3, learned: true, truth: 'Something I found out' });
    await open();
    expect(document.querySelector('#mw-truth').value).toBe('Something I found out');
    await act(() => btn('Start over').click());
    expect(btn('Tap again to erase it all and start over')).toBeTruthy();                      // not yet
    expect(saved()).not.toBeNull();
    await act(() => btn('Tap again to erase it all and start over').click());
    expect(localStorage.getItem(PROGRESS_KEY)).toBeNull();
    expect(document.querySelector('#mw-name').value).toBe('');
    await act(() => document.querySelector('.mw-notesbtn').click());
    expect(document.querySelector('.mw-notes-box').value).toBe('');
    await act(() => tick(1700));
    expect(localStorage.getItem(PROGRESS_KEY)).toBeNull();                                     // and does not come back by itself
  });

  it('changes its mind if the second tap does not come', async () => {
    seed({}, { step: 3, learned: true });
    await open();
    await act(() => btn('Start over').click());
    await act(() => tick(4200));
    expect(btn('Start over')).toBeTruthy();
    expect(saved()).not.toBeNull();
  });

  it('is not offered when there is nothing to start over from', async () => {
    await open();
    expect(btn('Start over')).toBeUndefined();
    await setVal(document.querySelector('#mw-name'), 'M');
    expect(btn('Start over')).toBeTruthy();
  });
});

describe('notes', () => {
  const notesBtn = () => document.querySelector('.mw-notesbtn');
  const box = () => document.querySelector('.mw-notes-box');

  it('has a button in the header on every step, and a panel that opens and closes', async () => {
    await open({ persist: false });
    for (const step of ['begin', 'choose', 'learn', 'truth', 'understand', 'commit']) {
      expect(notesBtn(), step).not.toBeNull();
      expect(document.querySelector('.mw-tbar').contains(notesBtn())).toBe(true);
      await act(() => notesBtn().click());
      expect(document.querySelector('#mw-notes[role="dialog"]'), step).not.toBeNull();
      expect(notesBtn().getAttribute('aria-expanded')).toBe('true');
      await act(() => document.querySelector('.mw-notes-x').click());
      expect(document.querySelector('#mw-notes')).toBeNull();
      if (step !== 'commit') await act(() => btn('Skip step').click());
      await act(() => tick(50));
    }
  });

  it('keeps what was written through every step, and shows there are notes', async () => {
    await open({ persist: false });
    expect(document.querySelector('.mw-dot')).toBeNull();
    await act(() => notesBtn().click());
    await setVal(box(), 'Remember: ask Brother Lee about verse 7');
    await act(() => document.querySelector('.mw-notes-x').click());
    expect(document.querySelector('.mw-dot')).not.toBeNull();
    for (let i = 0; i < 5; i++) {
      await act(() => btn('Skip step').click()); await act(() => tick(50));
      await act(() => notesBtn().click());
      expect(box().value, `after step ${i + 1}`).toBe('Remember: ask Brother Lee about verse 7');
      await act(() => document.querySelector('.mw-notes-x').click());
    }
  });

  it('keeps writing where it stopped, and counts the words', async () => {
    await open({ persist: false });
    await act(() => notesBtn().click());
    await setVal(box(), 'one two three');
    expect(document.querySelector('.mw-notes-foot').textContent).toContain('3 words');
    await setVal(box(), 'one');
    expect(document.querySelector('.mw-notes-foot').textContent).toContain('1 word ');
  });

  it('lets the video carry on underneath: it opens over the lesson, it does not replace it', async () => {
    seed({}, { step: 2, learned: false, sourceIds: ['A1'], picks: ['listen'] });
    await open();
    await act(() => notesBtn().click());
    expect(document.querySelector('audio')).not.toBeNull();
    expect(document.querySelector('.mw-card')).not.toBeNull();
  });

  it('closes with Escape, and focuses the box when it opens', async () => {
    await open({ persist: false });
    await act(() => notesBtn().click());
    expect(document.activeElement).toBe(box());
    await act(async () => { box().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(document.querySelector('#mw-notes')).toBeNull();
  });

  it('stays after the page is closed and opened again, at any step', async () => {
    await open();
    await act(() => btn('Skip step').click()); await act(() => tick(50));
    await act(() => notesBtn().click());
    await setVal(box(), 'a thought to keep');
    await close();
    await open();
    expect(document.querySelector('.mw-dot')).not.toBeNull();
    await act(() => notesBtn().click());
    expect(box().value).toBe('a thought to keep');
    expect(document.querySelector('.mw-notes-foot').textContent).toContain('Saved on this device');
  });

  it('is saved even if notes are all there is', async () => {
    await open();
    await act(() => notesBtn().click());
    await setVal(box(), 'first thought');
    await close();
    expect(saved().notes).toBe('first thought');
  });

  it('does not claim to be saved when it is not (a preview)', async () => {
    await open({ persist: false });
    await act(() => notesBtn().click());
    expect(document.querySelector('.mw-notes-foot').textContent).not.toContain('Saved on this device');
  });

  it('is private: never in what is sent to the teacher, and not watched like an answer (pasting is fine)', async () => {
    const onSubmit = await open();
    await act(() => notesBtn().click());
    await setVal(box(), 'SECRET-NOTE-TEXT');
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    await act(async () => { box().dispatchEvent(paste); });
    expect(paste.defaultPrevented).toBe(false);                                                // pasting into notes is allowed
    await act(() => document.querySelector('.mw-notes-x').click());
    for (let i = 0; i < 6; i++) { await act(() => btn('Skip step').click()); await act(() => tick(60)); }
    const sent = onSubmit.mock.calls[0][0];
    expect(JSON.stringify(sent)).not.toContain('SECRET-NOTE-TEXT');
    expect(sent.row.paste_attempts).toBe(0);                                                   // and it was not counted as a paste attempt
    expect(sent.row.typed_chars).toBe(0);                                                      // nor as typing in an answer
  });

  it('can be copied to take away, on the last screen too', async () => {
    const writes = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t) => { writes.push(t); } } });
    await open();
    await act(() => notesBtn().click());
    await setVal(box(), 'for later');
    await act(() => btn('Copy').click());
    expect(writes).toEqual(['for later']);
    await act(() => document.querySelector('.mw-notes-x').click());
    for (let i = 0; i < 6; i++) { await act(() => btn('Skip step').click()); await act(() => tick(60)); }
    await act(() => btn('Copy my notes').click());
    expect(writes).toEqual(['for later', 'for later']);
  });

  it('has nothing to copy when empty', async () => {
    await open({ persist: false });
    await act(() => notesBtn().click());
    expect(btn('Copy').disabled).toBe(true);
  });
});

describe('no black bar under the stage on a phone', () => {
  const rgb = (hex) => { const n = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); return `rgb(${n[0]}, ${n[1]}, ${n[2]})`; };

  it('paints the page the color the stage ends in, and gives the page its own back afterwards', async () => {
    document.body.style.backgroundColor = 'rgb(1, 2, 3)';
    await open({ persist: false });
    const first = document.body.style.backgroundColor;
    expect(first).toBe(rgb(stageBottomColor(duotoneFor(paletteAt(0).colors, 0)[2])));
    expect(document.documentElement.style.backgroundColor).toBe(first);                        // the page behind the browser's toolbar too
    expect(document.body.style.transition).toBe('none');                                       // follows the stage frame by frame

    await act(() => btn('Skip step').click()); await act(() => tick(1500));                   // the sky moves on
    expect(document.body.style.backgroundColor).not.toBe(first);
    expect(document.body.style.backgroundColor).toBe(rgb(stageBottomColor(duotoneFor(paletteAt(1).colors, 1)[2])));

    await close();
    expect(document.body.style.backgroundColor).toBe('rgb(1, 2, 3)');
    expect(document.body.style.transition).toBe('');
    expect(document.documentElement.style.backgroundColor).toBe('');
  });

  it('leaves the page alone when the journey is in a frame (an admin preview)', async () => {
    document.body.style.backgroundColor = 'rgb(1, 2, 3)';
    await open({ full: false, persist: false, phone: true });
    await act(() => btn('Skip step').click()); await act(() => tick(1500));
    expect(document.body.style.backgroundColor).toBe('rgb(1, 2, 3)');
    expect(document.documentElement.style.backgroundColor).toBe('');
  });
});

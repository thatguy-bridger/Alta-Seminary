// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderInBrowser } from '../test/render.js';
import { MakeupJourney } from './MakeupJourney.jsx';
import { SAMPLE_CLASSES } from './sampleContent.js';
import { writeProgress, PROGRESS_KEY } from './progress.js';
import { initialState } from './journey.js';

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
window.matchMedia ??= globalThis.matchMedia;
globalThis.URL.createObjectURL ??= () => 'blob:sample';
window.SVGElement.prototype.getTotalLength ??= () => 100;
window.SVGElement.prototype.getPointAtLength ??= () => ({ x: 0, y: 0 });
window.HTMLMediaElement.prototype.play = () => Promise.resolve();
window.HTMLMediaElement.prototype.pause = () => {};

const BODY = 'First paragraph about faith.\n\nSecond paragraph about action.';
const verse = (id, over = {}) => ({ id, kind: 'scripture', title: `Verse ${id}`, reference: '1 Nephi 3:7', body: BODY, minutes: 4, min_seconds: 30, ...over });
const talk = (over = {}) => ({ id: 'A1', kind: 'audio', title: 'A talk', author: 'Elder Test', embed_url: 'https://example.org/talk.mp3', duration_seconds: 12, minutes: 1,
  transcript: [{ start: 0, end: 6, text: 'First.' }, { start: 6, end: 12, text: 'Second.' }], ...over });
const CLASS = SAMPLE_CLASSES[1];
const DONE = { played: 0, duration: 0, readSeconds: 100, mutedPlayed: 0, time: 0, reached: 0, seen: [], quiet: [], done: true };
const FILLED = { truth: 'If we act then He will help us', where: 'Verse 7', understanding: 'x y z a b c d e f', text: 'x y z a b c d e f', inv: 'serve', commit: 'help my brother', bless: 'be kinder' };

let mounted;
beforeEach(() => { localStorage.clear(); });
afterEach(async () => { await mounted?.unmount(); document.body.innerHTML = ''; vi.restoreAllMocks(); });
const tick = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const act = (fn) => React.act(async () => { await fn(); });
const btn = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
const back = () => document.querySelector('.mw-pill.back');
const fwd = () => document.querySelector('.mw-pill.fwd');
const eyebrow = () => document.querySelector('.mw-card .mw-eyebrow')?.textContent || '';
const heading = () => document.querySelector('.mw-card .mw-h')?.textContent || '';
const setVal = async (el, value) => { const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value); await act(async () => { el.dispatchEvent(new Event('input', { bubbles: true })); }); };
const ready = () => fwd().getAttribute('aria-disabled') === 'false';

// a place put straight into storage, so each test begins exactly where it needs to
const seed = (S = {}, more = {}) => writeProgress(localStorage, { S: { ...initialState(), name: 'Maya', cls: CLASS.id, days: 1, settled: true, ...S }, ...more });
async function open(sources, props = {}) {
  const onSubmit = vi.fn(async () => ({ ok: true, saved: false }));
  mounted = await renderInBrowser(<MakeupJourney full persist skipTools classes={SAMPLE_CLASSES} sources={sources} onSubmit={onSubmit} {...props} />);
  await act(() => tick(30));
  return onSubmit;
}
const READINGS = [verse('L1'), verse('L2'), verse('L3'), verse('L4'), verse('L5'), verse('L6')];

describe('the two pills by the ridge', () => {
  it('are on every step but the last, with no back at the beginning and no forward on the final step', async () => {
    const stops = [[0, 'Alta Seminary makeup work', false, true], [1, 'Choose how to learn', true, true], [2, 'Read', true, true], [3, 'Find a truth', true, true], [4, 'Understand it', true, true], [5, null, true, false]];
    for (const [step, , hasBack, hasFwd] of stops) {
      localStorage.clear();
      seed({ step, sourceIds: ['L1'], picks: ['read'], learned: step > 2, ...FILLED }, { lessons: { '0:L1': DONE } });
      await open(READINGS);
      expect(document.querySelector('.mw-nav'), `step ${step}`).not.toBeNull();
      expect(!!back(), `back at step ${step}`).toBe(hasBack);
      expect(!!fwd(), `forward at step ${step}`).toBe(hasFwd);
      await mounted.unmount(); mounted = null; document.body.innerHTML = '';
    }
  });

  it('are gone on the finished screen', async () => {
    seed({ step: 5, sourceIds: ['L1'], picks: ['read'], learned: true, ...FILLED }, { lessons: { '0:L1': DONE } });
    await open(READINGS);
    await act(() => btn('Skip step').click()); await act(() => tick(60));
    expect(document.body.textContent).toContain('Well done');
    expect(document.querySelector('.mw-nav')).toBeNull();
  });

  it('say what they do to someone who cannot see them', async () => {
    seed({ step: 3, sourceIds: ['L1'], picks: ['read'], learned: true });
    await open(READINGS);
    expect(back().getAttribute('aria-label')).toBe('Go back one step');
    expect(fwd().getAttribute('aria-label')).toContain('Write what you found');
    expect(document.querySelector('.mw-nav').getAttribute('role')).toBe('group');
  });
});

describe('going forward', () => {
  it('waits at the beginning until the name, class, days and the quiet moment are done, then goes on', async () => {
    mounted = await renderInBrowser(<MakeupJourney full persist classes={SAMPLE_CLASSES} sources={READINGS} onSubmit={async () => ({ ok: true })} />);
    await act(() => tick(30));
    expect(ready()).toBe(false);
    await setVal(document.querySelector('#mw-name'), 'Maya');
    await act(() => [...document.querySelectorAll('.mw-chip')].find((b) => b.textContent === 'Period 2').click());
    await act(() => [...document.querySelectorAll('.mw-chip')].find((b) => b.textContent === '1').click());
    expect(ready()).toBe(false);                                                               // the quiet moment is not over
    await act(() => tick(3300));
    expect(ready()).toBe(true);
    await act(() => fwd().click());
    expect(eyebrow()).toBe('Choose how to learn');
  });

  it('says why when it is tapped before the screen is finished, and stays where it is', async () => {
    seed({ step: 3, sourceIds: ['L1'], picks: ['read'], learned: true });
    await open(READINGS);
    expect(ready()).toBe(false);
    await act(() => fwd().click());
    expect(eyebrow()).toBe('Find a truth');
    expect(document.querySelector('.mw-toast').textContent).toBe('Write what you found, and where, first.');
    expect(document.querySelector('.mw-toast').className).toContain('show');
  });

  it('is ready on the truth screen only once what was asked is written', async () => {
    seed({ step: 3, sourceIds: ['L1'], picks: ['read'], learned: true });
    await open(READINGS);
    await setVal(document.querySelector('#mw-truth'), 'If we act then He will help us');
    expect(ready()).toBe(false);                                                               // where they found it is missing
    await setVal(document.querySelector('#mw-where'), 'Verse 7');
    expect(ready()).toBe(true);
    await act(() => fwd().click());
    expect(eyebrow()).not.toBe('Find a truth');
  });

  it('is ready on the understanding screen only when both answers are long enough', async () => {
    seed({ step: 4, sourceIds: ['L1'], picks: ['read'], learned: true, truth: FILLED.truth, where: FILLED.where, styleOffset: 0 });
    await open(READINGS);
    expect(ready()).toBe(false);
    const boxes = document.querySelectorAll('.mw-card textarea');
    await setVal(boxes[0], 'It could help someone my age be braver');
    await setVal(boxes[1], 'It matters to me because I really feel it');
    expect(ready()).toBe(true);
  });

  it('waits at the choice for the right number of picks', async () => {
    seed({ step: 1, days: 2 });
    await open(READINGS.concat([talk()]));
    expect(ready()).toBe(false);
    const cards = [...document.querySelectorAll('.mw-opt')];
    await act(() => cards[0].click());
    expect(ready()).toBe(false);                                                               // one of two
    await act(() => cards[1].click());
    expect(ready()).toBe(true);
    await act(() => fwd().click());
    expect(eyebrow()).toMatch(/1 of 2/);
  });

  it('waits at a lesson until it is finished, and then goes on from it', async () => {
    seed({ step: 2, sourceIds: ['L1'], picks: ['read'], learned: false });
    await open(READINGS);
    expect(ready()).toBe(false);
    await act(() => fwd().click());
    expect(document.querySelector('.mw-toast').textContent).toBe('Finish this lesson first. The bar shows what is left.');
    expect(eyebrow()).toBe('Read');

    await mounted.unmount(); mounted = null; document.body.innerHTML = '';
    seed({ step: 2, sourceIds: ['L1'], picks: ['read'], learned: false }, { lessons: { '0:L1': DONE } });
    await open(READINGS);
    await act(() => tick(1200));
    expect(ready()).toBe(true);
    await act(() => fwd().click());
    expect(eyebrow()).toBe('Find a truth');
  });

  it('is the same as Continue, step for step', async () => {
    seed({ step: 3, sourceIds: ['L1'], picks: ['read'], learned: true, ...FILLED });
    await open(READINGS);
    await act(() => fwd().click());
    expect(eyebrow()).not.toBe('Find a truth');
    await act(() => back().click());
    expect(eyebrow()).toBe('Find a truth');
    await act(() => btn('Continue').click());
    expect(eyebrow()).not.toBe('Find a truth');
  });
});

describe('going back', () => {
  it('goes one step at a time, from the last step to the first', async () => {
    seed({ step: 5, sourceIds: ['L1'], picks: ['read'], learned: true, ...FILLED }, { lessons: { '0:L1': DONE } });
    await open(READINGS);
    const seen = [];
    for (let i = 0; i < 5; i++) { seen.push(eyebrow() || heading()); await act(() => back().click()); await act(() => tick(40)); }
    seen.push(eyebrow());
    expect(seen.slice(1)).toEqual(['Understand and feel', 'Find a truth', 'Read', 'Choose how to learn', 'Alta Seminary makeup work']);
    expect(back()).toBeNull();                                                                 // nothing before the beginning
  });

  it('keeps everything written, whichever way they go', async () => {
    seed({ step: 3, sourceIds: ['L1'], picks: ['read'], learned: true }, { lessons: { '0:L1': DONE } });
    await open(READINGS);
    await setVal(document.querySelector('#mw-truth'), 'If we act then He will help us');
    await setVal(document.querySelector('#mw-where'), 'Verse 7');
    await act(() => back().click()); await act(() => tick(1200));                              // the lesson
    await act(() => back().click());                                                           // choosing
    await act(() => back().click());                                                           // the beginning
    expect(document.querySelector('#mw-name').value).toBe('Maya');                             // what was typed first is still there
    await act(() => fwd().click());                                                            // choosing: the picks are kept
    expect(ready()).toBe(true);
    await act(() => fwd().click());                                                            // the lesson, which is still finished
    await act(() => tick(1200));
    await act(() => fwd().click());
    expect(document.querySelector('#mw-truth').value).toBe('If we act then He will help us');
    expect(document.querySelector('#mw-where').value).toBe('Verse 7');
  });

  it('lands on the last lesson of the journey, as they left it', async () => {
    seed({ step: 3, days: 2, sourceIds: ['L1', 'L2'], picks: ['read', 'read'], learned: true }, { lessons: { '0:L1': DONE, '1:L2': DONE } });
    await open(READINGS);
    await act(() => back().click()); await act(() => tick(1200));
    expect(heading()).toBe('Verse L2');
    expect(eyebrow()).toBe('Read · 2 of 2');
    expect(btn('Continue')).toBeTruthy();                                                      // still finished
    expect(back().getAttribute('aria-label')).toBe('Go back to the last lesson');
  });

  it('moves between the lessons of a journey: back to the last one, and forward only once each is finished', async () => {
    seed({ step: 2, days: 2, learnIndex: 1, sourceIds: ['L1', 'L2'], picks: ['read', 'read'], learned: false }, { lessons: { '0:L1': DONE } });
    await open(READINGS);
    expect(heading()).toBe('Verse L2');
    expect(ready()).toBe(false);                                                               // the second one is not finished
    await act(() => back().click()); await act(() => tick(1200));
    expect(heading()).toBe('Verse L1');
    expect(ready()).toBe(true);                                                                // the first one is
    await act(() => fwd().click());
    expect(heading()).toBe('Verse L2');
    expect(ready()).toBe(false);
  });

  it('does not move while the work is being sent', async () => {
    let finish;
    const onSubmit = vi.fn(() => new Promise((r) => { finish = () => r({ ok: true }); }));
    seed({ step: 5, sourceIds: ['L1'], picks: ['read'], learned: true, ...FILLED }, { lessons: { '0:L1': DONE } });
    await open(READINGS, { onSubmit });
    await act(() => btn('Finish').click());
    expect(btn('Sending…')).toBeTruthy();
    expect(back()).toBeNull();
    await act(async () => { finish(); await tick(30); });
    expect(document.body.textContent).toContain('Well done');
  });
});

describe('choosing again after going back', () => {
  it('keeps the same lesson, and what was done in it, when the same way is chosen again', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);                                            // a fresh pick would be the last reading, L6
    seed({ step: 2, sourceIds: ['L1'], picks: ['read'], learned: true }, { lessons: { '0:L1': DONE } });
    await open(READINGS);
    await act(() => back().click());
    expect(eyebrow()).toBe('Choose how to learn');
    await act(() => [...document.querySelectorAll('.mw-opt')].find((b) => b.textContent.startsWith('Read')).click());
    await act(() => tick(400));
    expect(heading()).toBe('Verse L1');                                                        // not Verse L6
    await act(() => tick(1200));
    expect(btn('Continue')).toBeTruthy();                                                      // and it is still finished
  });

  it('keeps the same lessons from the forward pill too', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    seed({ step: 2, days: 2, learnIndex: 1, sourceIds: ['L1', 'L2'], picks: ['read', 'read'], learned: true }, { lessons: { '0:L1': DONE, '1:L2': DONE } });
    await open(READINGS);
    await act(() => back().click()); await act(() => tick(1200));                              // back to the first lesson
    expect(heading()).toBe('Verse L1');
    await act(() => back().click());                                                           // back to choosing
    expect(eyebrow()).toBe('Choose how to learn');
    expect(ready()).toBe(true);
    await act(() => fwd().click());
    expect(heading()).toBe('Verse L1');
  });

  it('starts a new lesson, not yet finished, when a different way is chosen', async () => {
    seed({ step: 2, sourceIds: ['L1'], picks: ['read'], learned: true }, { lessons: { '0:L1': DONE } });
    await open(READINGS.concat([talk()]));
    await act(() => back().click());
    await act(() => [...document.querySelectorAll('.mw-opt')].find((b) => b.textContent.startsWith('Listen')).click());
    await act(() => tick(400));
    expect(heading()).toBe('A talk');
    expect(btn('Continue')).toBeUndefined();
    expect(ready()).toBe(false);
  });

  it('starts the choice again if the number of days changes', async () => {
    seed({ step: 0, days: 1, sourceIds: ['L1'], picks: ['read'], learned: true }, { lessons: { '0:L1': DONE } });
    await open(READINGS);
    await act(() => [...document.querySelectorAll('.mw-chip')].find((b) => b.textContent === '2').click());
    await act(() => fwd().click());
    expect(eyebrow()).toBe('Choose how to learn');
    expect(heading()).toBe('Pick 2 ways to learn');
    expect(document.querySelectorAll('.mw-bd')).toHaveLength(0);                               // none picked yet
    expect(ready()).toBe(false);
  });

  it('keeps the choice if the days change to a number that needs the same lessons', async () => {
    seed({ step: 0, days: 1, sourceIds: ['L1'], picks: ['read'], learned: false });
    await open(READINGS);
    await act(() => [...document.querySelectorAll('.mw-chip')].find((b) => b.textContent === '1').click());   // the same
    await act(() => fwd().click());
    expect(ready()).toBe(true);                                                                // the pick is still there
  });

  it('does not move on twice if the choice is tapped twice in the same moment', async () => {
    seed({ step: 1, days: 1 });
    await open(READINGS);
    const card = [...document.querySelectorAll('.mw-opt')].find((b) => b.textContent.startsWith('Read'));
    await act(async () => { card.click(); card.click(); });
    await act(() => tick(500));
    expect(eyebrow()).toBe('Read');                                                            // the lesson, not the step after it
  });
});

describe('a reading left and come back to', () => {
  it('keeps the time already spent on it, instead of starting the clock again', async () => {
    seed({ step: 2, sourceIds: ['L1'], picks: ['read'], learned: false }, { lessons: { '0:L1': { ...DONE, readSeconds: 10, done: false } } });
    await open(READINGS);
    await act(() => tick(2300));                                                               // about two more seconds of reading
    const width = () => parseFloat(document.querySelector('.mw-meter b').style.width);
    const before = width();
    expect(before).toBeGreaterThan(36);                                                        // 12 or 13 of the 30 seconds asked for
    await act(() => back().click());                                                           // away to choosing
    await act(() => fwd().click());                                                            // and back into the same lesson
    await act(() => tick(60));
    expect(width()).toBeGreaterThanOrEqual(before - 0.5);                                      // where it was, not back at 33% or 0%
    expect(heading()).toBe('Verse L1');
  });
});

describe('totals when going back and forth', () => {
  it('are counted once, however many times a lesson is left and come back to', async () => {
    const lesson = { played: 50, duration: 60, readSeconds: 0, mutedPlayed: 6, time: 50, reached: 50, seen: [[0, 49]], quiet: [[0, 5]], done: true };
    seed({ step: 3, sourceIds: ['A1'], picks: ['listen'], learned: true }, { lessons: { '0:A1': lesson } });
    const onSubmit = await open([talk({ duration_seconds: 60, transcript: [{ start: 0, end: 30, text: 'A.' }, { start: 30, end: 60, text: 'B.' }] })]);
    for (let i = 0; i < 3; i++) {
      await act(() => back().click()); await act(() => tick(400));                              // into the lesson
      expect(btn('Continue')).toBeTruthy();                                                    // finished, as it was
      await act(() => fwd().click()); await act(() => tick(60));                               // and out again
    }
    for (let i = 0; i < 3; i++) { await act(() => btn('Skip step').click()); await act(() => tick(60)); }   // understand, commit, send
    const { row, rpc } = onSubmit.mock.calls[0][0];
    expect(row.watched_seconds).toBe(50);                                                      // not 200
    expect(row.source_seconds).toBe(60);
    expect(row.muted_seconds).toBe(6);
    expect(rpc.p_watched_seconds).toBe(50);
  });
});

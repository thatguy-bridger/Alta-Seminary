// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderInBrowser } from '../test/render.js';
import { MakeupJourney } from './MakeupJourney.jsx';
import { SAMPLE_CLASSES } from './sampleContent.js';
import { writeProgress, readProgress, PROGRESS_KEY } from './progress.js';
import { initialState, wordCount } from './journey.js';
import { readableText } from './lessonBlocks.js';

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
window.matchMedia ??= globalThis.matchMedia;
globalThis.URL.createObjectURL ??= () => 'blob:sample';
window.SVGElement.prototype.getTotalLength ??= () => 100;
window.SVGElement.prototype.getPointAtLength ??= () => ({ x: 0, y: 0 });
window.HTMLMediaElement.prototype.play = () => Promise.resolve();
window.HTMLMediaElement.prototype.pause = () => {};

const BODY = [
  'An opening paragraph before any heading.',
  '# Ideas for Learning at Home and at Church',
  '@ Moses 1',
  '## I have a divine destiny.',
  'The first idea, a paragraph with enough words in it to be a paragraph.',
  'The second idea, another paragraph with enough words in it as well.',
  '- a first list item\n- a second list item',
  '> See also Hymns, no. 301.',
  'The last paragraph of the lesson, said plainly.',
].join('\n\n');
const cfm = (id, n, start, end, over = {}) => ({ id, kind: 'comefollowme', title: `“Week ${n}”`, reference: `Ref ${n}`, body: BODY, minutes: 6, series: 'Come, Follow Me: Test 2026', week_start: start, week_end: end, ...over });
const W1 = cfm('w1', 1, '2026-01-05', '2026-01-11');
const W2 = cfm('w2', 2, '2026-01-12', '2026-01-18');
const W3 = cfm('w3', 3, '2026-01-19', '2026-01-25');
const W4 = cfm('w4', 4, '2026-01-26', '2026-02-01');                                         // has not begun on the 21st
const VERSE = { id: 'v1', kind: 'scripture', title: 'A verse', reference: '1 Nephi 3:7', body: 'First paragraph about faith.\n\nSecond paragraph about action.', minutes: 4, min_seconds: 30 };
const TODAY = '2026-01-21';                                                                  // inside week 3
const CLASS = SAMPLE_CLASSES[1];
const DONE = { played: 0, duration: 0, readSeconds: 9999, mutedPlayed: 0, time: 0, reached: 0, seen: [], quiet: [], done: true };

let mounted;
beforeEach(() => { localStorage.clear(); });
afterEach(async () => { await mounted?.unmount(); document.body.innerHTML = ''; vi.restoreAllMocks(); });
const tick = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const act = (fn) => React.act(async () => { await fn(); });
const btn = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
const card = (label) => [...document.querySelectorAll('.mw-opt')].find((b) => b.textContent.startsWith(label));
const eyebrow = () => document.querySelector('.mw-card .mw-eyebrow')?.textContent || '';
const heading = () => document.querySelector('.mw-card .mw-h')?.textContent || '';
const setVal = async (el, value) => { const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value); await act(async () => { el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); }); };
const weekSelect = () => document.querySelector('.mw-week select');
const weekLabels = () => [...document.querySelectorAll('.mw-week option')].map((o) => o.textContent);

const seed = (S = {}, more = {}) => writeProgress(localStorage, { S: { ...initialState(), name: 'Maya', cls: CLASS.id, days: 1, settled: true, ...S }, ...more });
async function open(sources, props = {}) {
  const onSubmit = vi.fn(async () => ({ ok: true, saved: false }));
  mounted = await renderInBrowser(<MakeupJourney full persist classes={SAMPLE_CLASSES} sources={sources} onSubmit={onSubmit} today={TODAY} {...props} />);
  await act(() => tick(30));
  return onSubmit;
}
const LIB = [W1, W2, W3, W4, VERSE];
// Closing the page saves the student's place one last time, which is more dependable to test than waiting for the periodic save.
const closePage = async () => { await mounted.unmount(); mounted = null; document.body.innerHTML = ''; };

describe('choosing Come, Follow Me', () => {
  it('is one more way to learn, with its own card', async () => {
    seed({ step: 1 });
    await open(LIB);
    expect([...document.querySelectorAll('.mw-opt')].map((b) => b.querySelector('b').textContent)).toEqual(['Read', 'Come, Follow Me']);
    expect(card('Come, Follow Me').textContent).toContain('This week');
  });

  it('is not offered when the library has no Come, Follow Me lesson', async () => {
    seed({ step: 1 });
    await open([VERSE]);
    expect(card('Come, Follow Me')).toBeUndefined();
    expect(weekSelect()).toBeNull();
  });

  it('asks which week, with this week chosen, newest first, and no week that has not begun', async () => {
    seed({ step: 1 });
    await open(LIB);
    expect(weekLabels()).toEqual(['January 19–25 (this week) · Ref 3', 'January 12–18 · Ref 2', 'January 5–11 · Ref 1']);
    expect(weekSelect().value).toBe('w3');
  });

  it('gives this week\'s lesson when the card is tapped', async () => {
    seed({ step: 1 });
    await open(LIB);
    await act(() => card('Come, Follow Me').click());
    await act(() => tick(400));
    expect(heading()).toBe('“Week 3”');
    expect(eyebrow()).toBe('Come, Follow Me');
    expect(document.querySelector('.mw-lhead-text .mw-fine').textContent).toBe('January 19–25 · Ref 3');
  });

  it('gives the week they chose instead, when they missed an earlier one', async () => {
    seed({ step: 1 });
    await open(LIB);
    await setVal(weekSelect(), 'w1');
    await act(() => card('Come, Follow Me').click());
    await act(() => tick(400));
    expect(heading()).toBe('“Week 1”');
    expect(document.querySelector('.mw-lhead-text .mw-fine').textContent).toBe('January 5–11 · Ref 1');
  });

  it('gives this week and then the weeks before it, one for each day they missed', async () => {
    seed({ step: 1, days: 3 });
    await open(LIB);
    const c = card('Come, Follow Me');
    await act(() => c.click()); await act(() => c.click()); await act(() => c.click());
    await act(() => btn('Continue').click()); await act(() => tick(60));
    expect(eyebrow()).toBe('Come, Follow Me · 1 of 3');
    expect(heading()).toBe('“Week 3”');
    await closePage();
    expect(readProgress(localStorage, { classes: SAMPLE_CLASSES, sources: LIB }).S.sourceIds).toEqual(['w3', 'w2', 'w1']);   // newest first
  });

  it('mixes with other ways: Come, Follow Me gives its weeks while the others are chosen as before', async () => {
    seed({ step: 1, days: 2 });
    await open(LIB);
    await act(() => card('Read').click());
    await act(() => card('Come, Follow Me').click());
    await act(() => btn('Continue').click()); await act(() => tick(60));
    expect(heading()).toBe('A verse');
    expect(eyebrow()).toBe('Read · 1 of 2');
    await closePage();
    expect(readProgress(localStorage, { classes: SAMPLE_CLASSES, sources: LIB }).S.sourceIds).toEqual(['v1', 'w3']);
  });

  it('is only offered the weeks that have begun on the day the student is there', async () => {
    seed({ step: 1 });
    await open(LIB, { today: '2026-01-27' });
    expect(weekLabels()[0]).toBe('January 26–February 1 (this week) · Ref 4');
    expect(weekLabels()).toHaveLength(4);
  });
});

describe('going back and choosing again', () => {
  it('keeps the same week, and what was done in it, when Come, Follow Me is chosen again', async () => {
    seed({ step: 2, sourceIds: ['w3'], picks: ['cfm'], cfmWeek: 'w3', learned: true }, { lessons: { '0:w3': DONE } });
    await open(LIB);
    await act(() => document.querySelector('.mw-pill.back').click());
    expect(eyebrow()).toBe('Choose how to learn');
    expect(weekSelect().value).toBe('w3');
    await act(() => card('Come, Follow Me').click());
    await act(() => tick(400));
    expect(heading()).toBe('“Week 3”');
    await act(() => tick(1200));
    expect(btn('Continue')).toBeTruthy();                                                    // still finished
  });

  it('starts a different week afresh when another week is chosen', async () => {
    seed({ step: 2, sourceIds: ['w3'], picks: ['cfm'], cfmWeek: 'w3', learned: true }, { lessons: { '0:w3': DONE } });
    await open(LIB);
    await act(() => document.querySelector('.mw-pill.back').click());
    await setVal(weekSelect(), 'w2');
    await act(() => card('Come, Follow Me').click());
    await act(() => tick(400));
    expect(heading()).toBe('“Week 2”');
    expect(btn('Continue')).toBeUndefined();                                                 // not read yet
  });

  it('does not move to another week by itself if they come back the next day', async () => {
    seed({ step: 2, sourceIds: ['w3'], picks: ['cfm'], cfmWeek: 'w3', learned: true }, { lessons: { '0:w3': DONE } });
    await open(LIB, { today: '2026-01-27' });                                                // week 4 has begun, but they chose week 3
    await act(() => document.querySelector('.mw-pill.back').click());
    expect(weekSelect().value).toBe('w3');
    await act(() => document.querySelector('.mw-pill.fwd').click());
    expect(heading()).toBe('“Week 3”');
  });

  it('remembers the week they chose when the page is closed and opened again', async () => {
    seed({ step: 1, cfmWeek: 'w1' });
    await open(LIB);
    expect(weekSelect().value).toBe('w1');
    await act(() => card('Come, Follow Me').click());
    await act(() => tick(400));
    await closePage();
    expect(readProgress(localStorage, { classes: SAMPLE_CLASSES, sources: LIB }).S).toMatchObject({ cfmWeek: 'w1', sourceIds: ['w1'] });
  });

  it('goes back to this week if the week they had chosen has been removed', async () => {
    seed({ step: 1, cfmWeek: 'gone' });
    await open(LIB);
    expect(weekSelect().value).toBe('w3');
  });
});

describe('reading a lesson with headings, lists and notes', () => {
  const read = async (over = {}, lessons = {}) => { seed({ step: 2, sourceIds: ['w3'], picks: ['cfm'], cfmWeek: 'w3' }, { lessons }); await open([{ ...W3, ...over }, W2, W1]); };
  const box = () => document.querySelector('.mw-reader.struct');

  it('is laid out as it is written: a section, a label over a heading, paragraphs, a list, a note', async () => {
    await read();
    expect(box().querySelector('h3.mw-sec').textContent).toBe('Ideas for Learning at Home and at Church');
    expect(box().querySelector('.ref').textContent).toBe('Moses 1');
    expect(box().querySelector('h4.mw-subhead').textContent).toBe('I have a divine destiny.');
    expect([...box().querySelectorAll('ul.mw-list li')].map((l) => l.textContent)).toEqual(['a first list item', 'a second list item']);
    expect(box().querySelector('p.mw-note').textContent).toBe('See also Hymns, no. 301.');
    expect(box().textContent).not.toMatch(/[#@>]\s/);                                         // none of the marks show
    expect(box().textContent).not.toContain('- a first');
  });

  it('keeps the order of the lesson', async () => {
    await read();
    expect([...box().children].map((c) => c.tagName + (c.className ? '.' + c.className.split(' ')[0] : ''))).toEqual(['P', 'H3.mw-sec', 'DIV.ref', 'H4.mw-subhead', 'P', 'P', 'UL.mw-list', 'P.mw-note', 'P']);
  });

  it('stops a student copying it, like every other lesson', async () => {
    await read();
    const copy = new Event('copy', { bubbles: true, cancelable: true });
    await act(async () => { box().dispatchEvent(copy); });
    expect(copy.defaultPrevented).toBe(true);
  });

  it('does not box a long lesson into a scrolling window of its own', async () => {
    await read();
    expect(box().className).toContain('struct');
  });

  it('puts a question after the paragraph it was set for, counting what is read and not the headings', async () => {
    await read({ pauses: [{ at: 3, question: 'What do you notice?' }] });                    // the third thing read: after the second idea
    const groups = [...document.querySelectorAll('.mw-reader.struct')];
    expect(groups).toHaveLength(2);
    expect(groups[0].textContent).toContain('The second idea');
    expect(groups[0].textContent).not.toContain('a first list item');
    expect(groups[0].nextElementSibling.className).toContain('mw-pause');
    expect(groups[0].nextElementSibling.textContent).toContain('What do you notice?');
    expect(groups[0].nextElementSibling.textContent).toContain('after paragraph 3');
    expect(groups[1].textContent).toContain('a first list item');
  });

  it('keeps a heading together with what follows it, not left alone above a question', async () => {
    await read({ pauses: [{ at: 1, question: 'Early question?' }] });                        // after the opening paragraph, before the section heading
    const groups = [...document.querySelectorAll('.mw-reader.struct')];
    expect(groups[0].textContent).toContain('An opening paragraph');
    expect(groups[0].textContent).not.toContain('Ideas for Learning');
    expect(groups[1].querySelector('h3.mw-sec')).not.toBeNull();
  });

  it('holds Continue until the question is answered, as in any lesson', async () => {
    await read({ pauses: [{ at: 3, question: 'What do you notice?' }] }, { '0:w3': { ...DONE, done: false } });
    await act(() => tick(1200));
    expect(document.body.textContent).toContain('Answer the question above to continue');
    expect(btn('Continue')).toBeUndefined();
    await setVal(document.querySelector('.mw-pause textarea'), 'I notice the idea of identity');
    await act(() => btn('Save my answer').click());
    await act(() => tick(1200));
    expect(btn('Continue')).toBeTruthy();
  });

  it('copes with a lesson that is only a heading', async () => {
    await read({ body: '# Only a heading' });
    expect(box().textContent).toContain('Only a heading');
  });
});

describe('how long to stay', () => {
  const words = (body, kind) => wordCount(kind === 'comefollowme' ? readableText(body) : body);
  const LONG = `${BODY}\n\n${'A sentence that adds some words to the lesson. '.repeat(60)}`;     // about 500 words: 150 seconds to read, 90 to stay for a chapter

  it('is all of the time it takes to read, for a Come, Follow Me lesson (a chapter asks for 60% of it)', async () => {
    const w = words(LONG, 'comefollowme');
    const full = Math.max(20, Math.ceil((w / 200) * 60));
    const sixty = Math.max(20, Math.ceil((w / 200) * 60 * 0.6));
    expect(full).toBeGreaterThan(sixty);
    // read for the 60% time: a chapter would be done, the in-depth lesson is not
    seed({ step: 2, sourceIds: ['w3'], picks: ['cfm'], cfmWeek: 'w3' }, { lessons: { '0:w3': { ...DONE, readSeconds: sixty + 1, done: false } } });
    await open([{ ...W3, body: LONG }, VERSE]);
    await act(() => tick(1200));
    expect(btn('Continue')).toBeUndefined();
    const filled = parseFloat(document.querySelector('.mw-meter b').style.width);
    expect(filled).toBeGreaterThan(40);
    expect(filled).toBeLessThan(100);
  });

  it('is done when the lesson\'s own required time has passed, an admin\'s choice winning over the rule', async () => {
    seed({ step: 2, sourceIds: ['w3'], picks: ['cfm'], cfmWeek: 'w3' }, { lessons: { '0:w3': { ...DONE, readSeconds: 59, done: false } } });
    await open([{ ...W3, min_seconds: 60 }]);
    await act(() => tick(2300));
    expect(btn('Continue')).toBeTruthy();
  });

  it('leaves plain lessons exactly as they were', async () => {
    const PLAIN = readableText(LONG);                                                        // the same words with none of the marks
    const sixty = Math.max(20, Math.ceil((words(PLAIN, 'talk') / 200) * 60 * 0.6));
    seed({ step: 2, sourceIds: ['t1'], picks: ['read'] }, { lessons: { '0:t1': { ...DONE, readSeconds: sixty + 1, done: false } } });
    await open([{ id: 't1', kind: 'scripture', title: 'Same words, plain', body: PLAIN, minutes: 4 }]);
    await act(() => tick(1200));
    expect(btn('Continue')).toBeTruthy();
  });

  it('does not turn a plain lesson\'s dashes and hashes into headings and lists', async () => {
    seed({ step: 2, sourceIds: ['t1'], picks: ['read'] });
    await open([{ id: 't1', kind: 'talk', title: 'A talk', body: '# not a heading\n\n- not a list\n\n> not a note', minutes: 4 }]);
    expect(document.querySelector('.mw-reader h3')).toBeNull();
    expect(document.querySelector('.mw-reader ul')).toBeNull();
    expect(document.querySelector('.mw-reader.struct')).toBeNull();
    expect(document.querySelector('.mw-reader p').textContent).toContain('# not a heading');
  });
});

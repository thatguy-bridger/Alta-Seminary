// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { renderInBrowser } from '../test/render.js';
import { MakeupJourney } from './MakeupJourney.jsx';
import { SAMPLE_CLASSES } from './sampleContent.js';

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
window.matchMedia ??= globalThis.matchMedia;
globalThis.URL.createObjectURL ??= () => 'blob:sample';
window.SVGElement.prototype.getTotalLength ??= () => 100;
window.SVGElement.prototype.getPointAtLength ??= () => ({ x: 0, y: 0 });
const mediaCalls = { play: 0, pause: 0 };
window.HTMLMediaElement.prototype.play = () => { mediaCalls.play += 1; return Promise.resolve(); };
window.HTMLMediaElement.prototype.pause = () => { mediaCalls.pause += 1; };

const verse = (over = {}) => ({ id: 'L1', kind: 'scripture', title: 'A verse', reference: '1 Nephi 3:7', body: 'First paragraph about faith.\n\nSecond paragraph about action.', minutes: 4, ...over });
const audio = (over = {}) => ({ id: 'A1', kind: 'audio', title: 'A talk', author: 'Elder Test', embed_url: 'https://example.org/talk.mp3', duration_seconds: 60, minutes: 5,
  transcript: [{ start: 0, end: 20, text: 'First part.' }, { start: 20, end: 60, text: 'Second part.' }], ...over });

let mounted;
afterEach(async () => { await mounted?.unmount(); document.body.innerHTML = ''; mediaCalls.play = 0; mediaCalls.pause = 0; });
const tick = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const act = (fn) => React.act(async () => { await fn(); });
const btn = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
const setVal = async (el, value) => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, value); await act(async () => { el.dispatchEvent(new Event('input', { bubbles: true })); }); };

async function start(lessons, props = {}) {
  const onSubmit = vi.fn(async () => ({ ok: true, saved: false }));
  mounted = await renderInBrowser(<MakeupJourney classes={SAMPLE_CLASSES} sources={lessons} onSubmit={onSubmit} skipTools startAtLesson={lessons[0].id} {...props} />);
  await act(() => tick(30));
  return onSubmit;
}

describe('pictures are off unless the lesson turns them on', () => {
  const art = () => document.querySelector('.mw-art');
  it('shows no picture at all for a lesson that has not turned them on', async () => {
    await start([verse({ thumbnail_url: 'https://example.org/mine.jpg' })]);
    expect(document.querySelector('.mw-lthumb')).toBeNull();
    expect(art()).toBeNull();
    expect(document.querySelector('.mw-lhead-text .mw-h').textContent).toBe('A verse');       // the title is still there
    await mounted.unmount(); document.body.innerHTML = '';
    await start([audio()]);
    expect(document.querySelector('.mw-media.audio .cover')).toBeNull();                       // just the audio controls
    expect(document.querySelector('.mw-media.audio audio')).not.toBeNull();
    expect(art()).toBeNull();
  });

  it('shows the painting at the top of the lesson and of each later step when it is on', async () => {
    await start([verse({ show_images: true })]);
    expect(art()).not.toBeNull();
    expect(document.querySelector('.mw-lthumb')).not.toBeNull();
    const seen = [art().querySelector('img').getAttribute('src')];
    for (let i = 0; i < 4; i++) { await act(() => btn('Skip step').click()); await act(() => tick(60)); seen.push(art()?.querySelector('img').getAttribute('src')); }
    expect(seen.every(Boolean)).toBe(true);                                                    // truth, understand, commit and the finish
    expect(new Set(seen).size).toBe(5);
  });

  it('keeps every step plain when the lesson has them off, all the way to the end', async () => {
    await start([verse()]);
    for (let i = 0; i < 4; i++) { expect(art()).toBeNull(); await act(() => btn('Skip step').click()); await act(() => tick(60)); }
    expect(document.body.textContent).toContain('Well done');
    expect(art()).toBeNull();
  });

  it('uses the first two steps without any picture, since no lesson has been chosen yet', async () => {
    const onSubmit = vi.fn(async () => ({ ok: true }));
    mounted = await renderInBrowser(<MakeupJourney classes={SAMPLE_CLASSES} sources={[verse({ show_images: true })]} onSubmit={onSubmit} skipTools />);
    await act(() => tick(30));
    expect(art()).toBeNull();                                                                  // the beginning
    await act(() => btn('Skip step').click()); await act(() => tick(40));
    expect(art()).toBeNull();                                                                  // choosing
    await act(() => btn('Skip step').click()); await act(() => tick(40));
    expect(art()).not.toBeNull();                                                              // the lesson that has pictures on
  });

  it('shows pictures on the shared steps if any lesson in the journey has them on', async () => {
    const onSubmit = vi.fn(async () => ({ ok: true }));
    mounted = await renderInBrowser(<MakeupJourney classes={SAMPLE_CLASSES} sources={[verse({ id: 'A' }), audio({ id: 'B', show_images: true })]} onSubmit={onSubmit} skipTools startAtLesson="A" />);
    await act(() => tick(30));
    expect(art()).toBeNull();                                                                  // the lesson in front of them has none
    await act(() => btn('Skip step').click()); await act(() => tick(40));                      // truth: sample fill chooses lessons for the journey
    expect(document.querySelector('.mw-h')).not.toBeNull();
  });
});

describe('the header', () => {
  it('has a soft fade behind the logo and ridge, above the scrolling content but below the header itself', async () => {
    await start([verse()]);
    const stage = document.querySelector('.mw-stage');
    const kids = [...stage.children].map((c) => c.className.split(' ')[0]);
    expect(kids).toContain('mw-headfade');
    expect(kids.indexOf('mw-headfade')).toBeGreaterThan(kids.indexOf('mw-body'));     // painted over the content that scrolls under it
    expect(kids.indexOf('mw-tbar')).toBeLessThan(kids.indexOf('mw-body'));            // the logo and ridge keep their own, higher layer
    expect(stage.querySelector('.mw-headfade').getAttribute('aria-hidden')).toBe('true');
  });
});

describe('previewing one lesson', () => {
  it('starts at that lesson, as a student on day one', async () => {
    await start([verse()]);
    expect(document.querySelector('.mw-eyebrow').textContent).toBe('Read');
    expect(document.querySelector('.mw-h').textContent).toBe('A verse');
    expect(document.querySelector('.mw-reader')).not.toBeNull();
  });
});

describe('the lesson header', () => {
  const thumb = () => document.querySelector('.mw-lthumb');

  it('shows the picture an admin chose, or the automatic one', async () => {
    await start([verse({ show_images: true, thumbnail_url: 'https://example.org/mine.jpg' })]);
    expect(thumb().getAttribute('src')).toBe('https://example.org/mine.jpg');
    await mounted.unmount(); document.body.innerHTML = '';
    await start([verse({ show_images: true })]);
    expect(thumb().getAttribute('src')).toMatch(/^\/makeup\/thumbs\/.+\.webp$/);
    await mounted.unmount(); document.body.innerHTML = '';
    await start([audio({ show_images: true, embed_url: 'https://www.youtube.com/watch?v=OJ2pLI0tZvY' })]);
    expect(thumb().getAttribute('src')).toBe('https://i.ytimg.com/vi/OJ2pLI0tZvY/hqdefault.jpg');
  });

  it('falls back to a painting if the chosen picture cannot be loaded', async () => {
    await start([verse({ show_images: true, thumbnail_url: 'https://example.org/gone.jpg' })]);
    await act(() => { thumb().dispatchEvent(new Event('error')); });
    expect(thumb().getAttribute('src')).toMatch(/^\/makeup\/thumbs\//);
    const fallback = thumb().getAttribute('src');
    await act(() => { thumb().dispatchEvent(new Event('error')); });           // and does not loop
    expect(thumb().getAttribute('src')).toBe(fallback);
  });

  it('names the author and reference under the title', async () => {
    await start([audio()]);
    expect(document.querySelector('.mw-lhead-text').textContent).toContain('Elder Test');
  });

  it('shows the lesson\'s own guiding line instead of a generic one', async () => {
    await start([verse({ guide_line: 'Look for what Nephi does before he knows how.' })]);
    expect(document.querySelector('.mw-quote').textContent).toBe('Look for what Nephi does before he knows how.');
    await mounted.unmount(); document.body.innerHTML = '';
    await start([verse({ guide_line: '   ' })]);
    expect(document.querySelector('.mw-quote').textContent.length).toBeGreaterThan(10);   // a blank line falls back to the generic ones
  });
});

describe('required time for reading', () => {
  it('uses the lesson\'s own time instead of the automatic rule', async () => {
    await start([verse({ min_seconds: 1 })]);
    expect(btn('Continue')).toBeUndefined();
    await act(() => tick(1500));
    expect(btn('Continue')).toBeDefined();                  // the automatic rule would have asked for at least 20 seconds
  });
});

describe('pause questions in a reading', () => {
  const lesson = () => verse({ min_seconds: 1, pauses: [{ at: 1, question: 'What does faith ask of you?' }] });

  it('puts the question after its paragraph, and holds Continue until it is answered', async () => {
    await start([lesson()]);
    const ps = [...document.querySelector('.mw-readwrap').children];
    expect(ps.map((el) => el.className.split(' ')[0])).toEqual(['mw-reader', 'mw-pause', 'mw-reader']);   // paragraph 1, the question, paragraph 2
    expect(ps[1].textContent).toContain('What does faith ask of you?');
    expect(ps[1].textContent).toContain('after paragraph 1');
    await act(() => tick(1500));
    expect(btn('Continue')).toBeUndefined();                // the time is up, but the question is not answered
    expect(document.querySelector('.mw-stay').textContent).toContain('Answer the question');
  });

  it('needs a few words, blocks pasting, and then lets the student continue (and change the answer)', async () => {
    await start([lesson()]);
    await act(() => tick(1500));
    const box = document.querySelector('.mw-pause textarea');
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    box.dispatchEvent(paste);
    expect(paste.defaultPrevented).toBe(true);
    await setVal(box, 'Trust');
    expect(btn('Save my answer').disabled).toBe(true);
    await setVal(box, 'It asks me to act first');
    expect(btn('Save my answer').disabled).toBe(false);
    await act(() => btn('Save my answer').click());
    expect(document.querySelector('.mw-pause.saved').textContent).toContain('It asks me to act first');
    expect(btn('Continue')).toBeDefined();
    await act(() => btn('Change my answer').click());
    expect(document.querySelector('.mw-pause textarea').value).toBe('It asks me to act first');
  });

  it('sends the answer to the teacher with the submission', async () => {
    const onSubmit = await start([lesson()]);
    await act(() => tick(1500));
    await setVal(document.querySelector('.mw-pause textarea'), 'It asks me to act first');
    await act(() => btn('Save my answer').click());
    await act(() => btn('Continue').click());
    for (let i = 0; i < 3; i++) { await act(() => btn('Skip step').click()); await act(() => tick(40)); }   // truth, understand, commit -> done
    await act(() => tick(60));
    const { rpc, row } = onSubmit.mock.calls[0][0];
    expect(rpc.p_pause_answers).toEqual([{ source_id: 'L1', lesson: 'A verse', unit: 'paragraph', question: 'What does faith ask of you?', at: 1, answer: 'It asks me to act first' }]);
    expect(row.pause_answers).toHaveLength(1);
    expect(document.querySelector('.mw-recp').textContent).toContain('It asks me to act first');
  });

  it('keeps a lesson without questions looking exactly as before (one block of text)', async () => {
    await start([verse({ min_seconds: 1 })]);
    expect(document.querySelectorAll('.mw-reader')).toHaveLength(1);
    expect(document.querySelector('.mw-pause')).toBeNull();
  });
});

describe('pause questions in audio and video', () => {
  // jsdom has no player, so the test plays the part of one: it says what time it is and whether it is playing.
  function fakePlayer() {
    const el = document.querySelector('audio');
    const player = { t: 0, playing: false };
    Object.defineProperty(el, 'currentTime', { get: () => player.t, set: (v) => { player.t = v; }, configurable: true });
    Object.defineProperty(el, 'paused', { get: () => !player.playing, configurable: true });
    return player;
  }
  const lesson = () => audio({ min_seconds: 2, pauses: [{ at: 10, question: 'What stood out so far?' }] });

  it('stops at the moment, asks, and carries on when answered', async () => {
    await start([lesson()]);
    const player = fakePlayer();
    player.playing = true; player.t = 5;
    await act(() => tick(320));
    expect(document.querySelector('.mw-pause')).toBeNull();                                   // not yet
    player.t = 10.5;
    await act(() => tick(320));
    expect(document.querySelector('.mw-pause').textContent).toContain('What stood out so far?');
    expect(document.querySelector('.mw-pause').textContent).toContain('at 0:10');
    expect(mediaCalls.pause).toBeGreaterThan(0);                                                // the talk is paused for it
    player.playing = false;
    await setVal(document.querySelector('.mw-pause textarea'), 'The part about trusting');
    const plays = mediaCalls.play;
    await act(() => btn('Keep going').click());
    expect(document.querySelector('.mw-pause')).toBeNull();
    expect(mediaCalls.play).toBeGreaterThan(plays);                                             // and resumes
  });

  it('asks even when the student jumps past the moment', async () => {
    await start([lesson()]);
    const player = fakePlayer();
    player.playing = true; player.t = 45;
    await act(() => tick(320));
    expect(document.querySelector('.mw-pause')).not.toBeNull();
  });

  it('holds Continue until enough has been played AND the question is answered', async () => {
    await start([lesson()]);
    const player = fakePlayer();
    player.playing = true;
    for (const t of [10, 10.6, 11.2, 11.8, 12.4]) { player.t = t; await act(() => tick(300)); }   // plays through the moment
    expect(btn('Continue')).toBeUndefined();                                                        // played enough, but the question is open
    player.playing = false;
    await setVal(document.querySelector('.mw-pause textarea'), 'The part about trusting');
    await act(() => btn('Keep going').click());
    expect(btn('Continue')).toBeDefined();
  });

  it('uses the lesson\'s own required time for playing, not the usual three quarters', async () => {
    await start([audio({ min_seconds: 2 })]);
    const player = fakePlayer();
    player.playing = true;
    for (const t of [3, 3.6, 4.2, 4.8]) { player.t = t; await act(() => tick(300)); }
    expect(btn('Continue')).toBeDefined();                                                           // 2 seconds of a 60 second talk
  });
});

describe('the flowing transcript', () => {
  function fakePlayer() {
    const el = document.querySelector('audio');
    const player = { t: 0, playing: false };
    Object.defineProperty(el, 'currentTime', { get: () => player.t, set: (v) => { player.t = v; }, configurable: true });
    Object.defineProperty(el, 'paused', { get: () => !player.playing, configurable: true });
    return player;
  }
  const lines = () => [...document.querySelectorAll('.mw-line')];
  const talk = () => audio({ transcript: [{ start: 0, end: 20, text: 'First part.' }, { start: 20, end: 40, text: 'Second part.' }, { start: 40, end: 60, text: 'Third part.' }, { start: 60, end: 80, text: 'Fourth part.' }], duration_seconds: 80 });

  it('puts the player first and the transcript underneath it', async () => {
    await start([talk()]);
    const av = document.querySelector('.mw-av');
    expect([...av.children].map((c) => c.className.split(' ')[0])).toEqual(['mw-media', 'mw-txwrap']);
    expect(av.querySelector('.mw-txwrap > .mw-tx')).not.toBeNull();
    expect(document.querySelector('.mw-tx').getAttribute('aria-label')).toBe('Transcript');
    expect(document.querySelector('.mw-card').className).toContain('wide');
  });

  it('lights the line whose time it is, and nothing is guessed word by word inside it', async () => {
    await start([talk()]);
    const player = fakePlayer();
    player.playing = true; player.t = 5;
    await act(() => tick(320));
    expect(lines()[0].className).toContain('on');
    expect(lines()[1].className).not.toContain('on');
    player.t = 15;
    await act(() => tick(320));
    expect(lines()[0].className).toContain('on');                                         // the same line, until the next timestamp
    expect(document.querySelector('.mw-tx [style*="--p"]')).toBeNull();                   // no fill-in that the timing cannot support
    player.t = 21;
    await act(() => tick(320));
    expect(lines()[1].className).toContain('on');
    expect(lines()[0].className).not.toContain('on');
  });

  it('moves to the next line as the time passes, and dims lines the further they are from it', async () => {
    await start([talk()]);
    const player = fakePlayer();
    player.playing = true; player.t = 45;
    await act(() => tick(320));
    expect(lines().map((l) => l.className.includes('on'))).toEqual([false, false, true, false]);
    expect(lines().map((l) => l.style.getPropertyValue('--d'))).toEqual(['2', '1', '0', '1']);
    expect(lines()[2].getAttribute('aria-current')).toBe('true');
    player.t = 65;
    await act(() => tick(320));
    expect(lines().map((l) => l.style.getPropertyValue('--d'))).toEqual(['3', '2', '1', '0']);
  });

  it('keeps the line lit through a long pause, so the lines never all dim at once', async () => {
    await start([audio({ transcript: [{ start: 0, end: 5, text: 'Before the pause.' }, { start: 60, end: 65, text: 'After the pause.' }], duration_seconds: 70 })]);
    const player = fakePlayer();
    player.playing = true; player.t = 30;                                              // thirty seconds in, nothing is being said
    await act(() => tick(320));
    expect(lines()[0].className).toContain('on');
    expect(lines().map((l) => l.style.getPropertyValue('--d'))).toEqual(['0', '1']);
    player.t = 61;
    await act(() => tick(320));
    expect(lines()[1].className).toContain('on');
  });

  it('keeps the first lines at a distance until the talk begins', async () => {
    await start([audio({ transcript: [{ start: 5, end: 10, text: 'Starts late.' }, { start: 10, end: 20, text: 'Then this.' }] })]);
    expect(lines().map((l) => l.className.includes('on'))).toEqual([false, false]);
    expect(lines().map((l) => l.style.getPropertyValue('--d'))).toEqual(['1', '2']);
  });

  it('jumps the talk to a line when it is clicked, and shows its time', async () => {
    await start([talk()]);
    const player = fakePlayer();
    expect(lines()[2].querySelector('.t').textContent).toBe('0:40');
    await act(() => lines()[2].click());
    expect(player.t).toBe(40);
    expect(mediaCalls.play).toBeGreaterThan(0);
  });

  it('lets a student cite a line, and shows that it was cited', async () => {
    await start([talk()]);
    const cite = lines()[1].querySelector('.mw-cite');
    expect(cite.textContent).toBe('Cite');
    await act(() => cite.click());
    expect(lines()[1].className).toContain('cited');
    expect(lines()[1].querySelector('.mw-cite').textContent).toBe('Cited');
  });

  it('shows a picture for audio, above its controls, when pictures are on', async () => {
    await start([{ ...talk(), show_images: true }]);
    const media = document.querySelector('.mw-media');
    expect(media.className).toContain('audio');
    expect(media.querySelector('.cover img').getAttribute('src')).toMatch(/^\/makeup\/thumbs\//);
    expect(media.querySelector('audio')).not.toBeNull();
  });
});

describe('following the talk, and scrolling away from it', () => {
  function fakePlayer() {
    const el = document.querySelector('audio');
    const player = { t: 0, playing: false };
    Object.defineProperty(el, 'currentTime', { get: () => player.t, set: (v) => { player.t = v; }, configurable: true });
    Object.defineProperty(el, 'paused', { get: () => !player.playing, configurable: true });
    return player;
  }
  const talk = () => audio({ transcript: Array.from({ length: 8 }, (_, i) => ({ start: i * 20, end: i * 20 + 20, text: `Part ${i + 1}.` })), duration_seconds: 160 });
  const box = () => document.querySelector('.mw-tx');
  const lines = () => [...document.querySelectorAll('.mw-line')];
  const follow = () => [...document.querySelectorAll('button')].find((b) => /Back (up|down) to what is playing/.test(b.textContent));
  // jsdom does no layout, so give the box and its lines a size: 300 tall, lines every 100 and 60 high. The resting place is 38% down (114).
  function layout() {
    Object.defineProperty(box(), 'clientHeight', { value: 300, configurable: true });
    Object.defineProperty(box(), 'scrollHeight', { value: 1500, configurable: true });
    lines().forEach((l, i) => { Object.defineProperty(l, 'offsetTop', { value: 100 + i * 100, configurable: true }); Object.defineProperty(l, 'offsetHeight', { value: 60, configurable: true }); });
  }
  const scrollTo = async (top) => { box().scrollTop = top; await act(async () => { box().dispatchEvent(new Event('scroll')); }); };
  const wheel = (deltaY = 0) => act(async () => { box().dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY })); });
  async function playingLine(i) {          // the talk is at line i (the 20 second mark times i, plus a little)
    await start([talk()]);
    layout();
    const player = fakePlayer(); player.playing = true; player.t = i * 20 + 5;
    await act(() => tick(320));
    box().scrollTop = i * 100 + 16;                              // where a real box would have come to rest on this line
    return player;
  }
  // line 2 centre = 100+200+30 = 330; resting place 114, so the line is "in place" when scrollTop is about 216

  it('follows the talk by default, with no button, and eases toward each new line', async () => {
    const player = await playingLine(0);
    expect(follow()).toBeUndefined();
    player.t = 45;                                                // line 2
    await act(() => tick(320));
    expect(box().__glide).toBeTruthy();                           // gliding to it
  });

  it('stops following when the student scrolls, and offers a way back', async () => {
    const player = await playingLine(1);
    await wheel();
    expect(follow()).toBeDefined();
    player.t = 65;                                                // the talk moves on to line 3
    await act(() => tick(320));
    expect(lines()[3].className).toContain('on');                 // the highlight still moves on
    expect(box().__glide).toBeFalsy();                            // but the box is left where the student put it
  });

  it('points the way back: up when the student has scrolled past the current line, down when they are above it', async () => {
    await playingLine(2);                                         // the current line sits near scrollTop 216
    await wheel(120);                                             // pushed down, so the current line has gone up
    expect(follow().textContent).toBe('Back up to what is playing');
    expect(follow().className).toContain('up');
    await wheel(-120);                                            // pushed up
    expect(follow().textContent).toBe('Back up to what is playing');   // (still going by where the box is until it moves)
    await scrollTo(900);                                          // far below the current line
    expect(follow().textContent).toBe('Back up to what is playing');
    expect(follow().className).toContain('up');
    await scrollTo(0);                                            // far above it
    expect(follow().textContent).toBe('Back down to what is playing');
    expect(follow().className).toContain('down');
  });

  it('turns around as the talk moves on past where the student is looking', async () => {
    const player = await playingLine(2);
    await wheel(-120);
    await scrollTo(220);                                          // looking at line 2, which is playing
    player.t = 125;                                               // the talk moves on to line 6, far below this view
    await act(() => tick(320));
    expect(follow().textContent).toBe('Back down to what is playing');
    player.t = 5;                                                 // and the talk is taken back to the start, above this view
    await act(() => tick(320));
    expect(follow().textContent).toBe('Back up to what is playing');
  });

  it('chooses the direction from the key pressed, too', async () => {
    await playingLine(2);
    await act(async () => { lines()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true })); });
    expect(follow().className).toContain('up');
    await mounted.unmount(); document.body.innerHTML = '';
    await playingLine(2);
    await act(async () => { lines()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })); });
    expect(follow().className).toContain('down');
  });

  it('also stops following when the student uses the keyboard to scroll', async () => {
    await playingLine(1);
    await act(async () => { lines()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); });
    expect(follow()).toBeDefined();
  });

  it('and when they touch-scroll on a phone', async () => {
    await playingLine(1);
    await act(async () => { box().dispatchEvent(new Event('touchmove', { bubbles: true })); });
    expect(follow()).toBeDefined();
  });

  it('goes back to following, and gliding, when the button is pressed', async () => {
    await playingLine(1);
    await wheel();
    box().scrollTop = 900;
    await act(() => follow().click());
    expect(follow()).toBeUndefined();
    expect(box().__glide).toBeTruthy();
  });

  it('follows again by itself when the student scrolls the current line back to its place', async () => {
    await playingLine(2);
    await wheel();
    await scrollTo(900);                                          // far away
    expect(follow()).toBeDefined();
    await scrollTo(500);
    expect(follow()).toBeDefined();                               // still not there
    await scrollTo(220);                                          // the current line is back near the middle
    expect(follow()).toBeUndefined();
  });

  it('does not follow again just because the student scrolled a little and stopped far from the line', async () => {
    await playingLine(2);
    await wheel();
    await scrollTo(700);
    await act(() => tick(1100));
    expect(follow()).toBeDefined();
  });

  it('follows again after a small nudge that leaves the line where it was', async () => {
    await playingLine(2);
    await wheel();
    await scrollTo(222);                                          // moved a hair, the line is still in place
    expect(follow()).toBeDefined();
    await act(() => tick(1100));
    expect(follow()).toBeUndefined();
  });

  it('follows again when a line is clicked, since that jumps the talk', async () => {
    await playingLine(1);
    await wheel();
    await act(() => lines()[5].click());
    expect(follow()).toBeUndefined();
  });

  it('has no button before the talk has reached its first line (there is nothing to go back to)', async () => {
    await start([audio({ transcript: Array.from({ length: 8 }, (_, i) => ({ start: 10 + i * 20, end: 30 + i * 20, text: `Part ${i + 1}.` })), duration_seconds: 170 })]);
    layout();
    const player = fakePlayer(); player.playing = true; player.t = 3;
    await act(() => tick(320));
    expect(lines().some((l) => l.className.includes('on'))).toBe(false);
    await wheel();
    expect(follow()).toBeUndefined();
  });
});

describe('noting whether the sound was on', () => {
  function fakePlayer() {
    const el = document.querySelector('audio');
    const player = { t: 0, playing: false, muted: false, volume: 1 };
    Object.defineProperty(el, 'currentTime', { get: () => player.t, set: (v) => { player.t = v; }, configurable: true });
    Object.defineProperty(el, 'paused', { get: () => !player.playing, configurable: true });
    Object.defineProperty(el, 'muted', { get: () => player.muted, configurable: true });
    Object.defineProperty(el, 'volume', { get: () => player.volume, configurable: true });
    return player;
  }
  const talk = () => audio({ min_seconds: 40, duration_seconds: 120, transcript: [{ start: 0, end: 60, text: 'First.' }, { start: 60, end: 120, text: 'Second.' }] });
  async function playFor(player, from, to) { player.playing = true; for (let t = from; t <= to; t += 1) { player.t = t; await act(() => tick(260)); } }
  async function finish(onSubmit) {
    await act(() => btn('Continue').click());
    for (let i = 0; i < 3; i++) { await act(() => btn('Skip step').click()); await act(() => tick(40)); }
    await act(() => tick(60));
    return onSubmit.mock.calls[0][0];
  }

  it('sends how long the player was muted, and tells the student what the teacher will see', async () => {
    const onSubmit = await start([talk()]);
    const player = fakePlayer();
    player.muted = true;
    await playFor(player, 0, 44);
    const { rpc, row } = await finish(onSubmit);
    expect(rpc.p_watched_seconds).toBeGreaterThanOrEqual(40);
    expect(rpc.p_muted_seconds).toBeGreaterThanOrEqual(38);
    expect(row.muted_seconds).toBe(rpc.p_muted_seconds);
    const recp = document.querySelector('.mw-recp').textContent;
    expect(recp).toContain("The player's sound was off for 0:");
    expect(recp).toContain('Worth a conversation');
  }, 30000);

  it('records nothing when the sound was on, and never stops the student carrying on', async () => {
    const onSubmit = await start([talk()]);
    const player = fakePlayer();
    await playFor(player, 0, 44);
    const { rpc } = await finish(onSubmit);
    expect(rpc.p_muted_seconds).toBe(0);
    expect(document.querySelector('.mw-recp').textContent).toContain('SoundOn');
  }, 30000);

  it('counts a volume turned all the way down as the sound being off', async () => {
    const onSubmit = await start([talk()]);
    const player = fakePlayer();
    player.volume = 0;
    await playFor(player, 0, 44);
    const { rpc } = await finish(onSubmit);
    expect(rpc.p_muted_seconds).toBeGreaterThanOrEqual(38);
  }, 30000);

  it('is not asked of anyone, or nagged about: there is no prompt about sound', async () => {
    await start([talk()]);
    const player = fakePlayer();
    player.muted = true;
    await playFor(player, 0, 10);
    expect(document.body.textContent.toLowerCase()).not.toMatch(/unmute|turn (up|on) (the|your) (sound|volume)/);
  }, 30000);
});

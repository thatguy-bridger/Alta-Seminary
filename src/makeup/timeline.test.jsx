// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderInBrowser } from '../test/render.js';
import { MakeupJourney } from './MakeupJourney.jsx';
import { SAMPLE_CLASSES } from './sampleContent.js';
import { writeProgress } from './progress.js';
import { initialState } from './journey.js';

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
window.matchMedia ??= globalThis.matchMedia;
globalThis.URL.createObjectURL ??= () => 'blob:sample';
window.SVGElement.prototype.getTotalLength ??= () => 100;
window.SVGElement.prototype.getPointAtLength ??= () => ({ x: 0, y: 0 });
window.HTMLMediaElement.prototype.play = () => Promise.resolve();
window.HTMLMediaElement.prototype.pause = () => {};

const TRANSCRIPT = [{ start: 0, end: 6, text: 'First.' }, { start: 6, end: 12, text: 'Second.' }];
const audio = (over = {}) => ({ id: 'A1', kind: 'audio', title: 'A talk', author: 'Elder Test', embed_url: 'https://example.org/talk.mp3', duration_seconds: 12, minutes: 1, transcript: TRANSCRIPT, ...over });
const youtube = () => audio({ id: 'Y1', kind: 'video', title: 'A video', embed_url: 'https://www.youtube.com/watch?v=OJ2pLI0tZvY' });
const reading = { id: 'L1', kind: 'scripture', title: 'A verse', reference: '1 Nephi 3:7', body: 'First.\n\nSecond.', minutes: 4, min_seconds: 30 };
const CLASS = SAMPLE_CLASSES[1];
const DONE = { played: 0, duration: 0, readSeconds: 100, mutedPlayed: 0, time: 0, reached: 0, seen: [], quiet: [], done: true };

let mounted;
beforeEach(() => { localStorage.clear(); });
afterEach(async () => { await mounted?.unmount(); document.body.innerHTML = ''; delete window.YT; vi.restoreAllMocks(); });
const tick = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const act = (fn) => React.act(async () => { await fn(); });
const btn = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
const kinds = () => [...document.querySelectorAll('.mw-tl [data-kind]')].map((e) => e.dataset.kind);
const label = () => document.querySelector('.mw-tl')?.getAttribute('aria-label');

const seed = (S = {}, more = {}) => writeProgress(localStorage, { S: { ...initialState(), step: 2, name: 'Maya', cls: CLASS.id, days: 1, settled: true, sourceIds: ['A1'], picks: ['listen'], ...S }, ...more });
async function open(sources, props = {}) {
  const onSubmit = vi.fn(async () => ({ ok: true, saved: false }));
  mounted = await renderInBrowser(<MakeupJourney full persist skipTools classes={SAMPLE_CLASSES} sources={sources} onSubmit={onSubmit} {...props} />);
  await act(() => tick(30));
  return onSubmit;
}

// An <audio> whose time and play state the test decides.
function fakePlayer() {
  const el = document.querySelector('audio');
  const player = { t: 0, playing: false, muted: false, volume: 1 };
  Object.defineProperty(el, 'currentTime', { get: () => player.t, set: (v) => { player.t = v; }, configurable: true });
  Object.defineProperty(el, 'paused', { get: () => !player.playing, configurable: true });
  Object.defineProperty(el, 'muted', { get: () => player.muted, configurable: true });
  Object.defineProperty(el, 'volume', { get: () => player.volume, configurable: true });
  return player;
}
// Plays one second at a time from `from` to `to`; the player is read every quarter second, so each step is seen. The first second is
// held for two reads, as real playback would.
async function play(player, from, to) {
  player.playing = true; player.t = from; await act(() => tick(540));
  for (let t = from + 1; t <= to; t += 1) { player.t = t; await act(() => tick(270)); }
}
const pause = (player) => { player.playing = false; return act(() => tick(300)); };

describe('the timeline under a recording', () => {
  it('is one bar for the whole recording, with nothing played yet, and a key to the colors', async () => {
    seed();
    await open([audio()]);
    expect(document.querySelector('.mw-tl')).not.toBeNull();
    expect(kinds()).toEqual(['ahead']);
    expect(label()).toBe('Played 0:00 of 0:12.');
    expect(document.querySelector('.mw-tl-key').textContent).toBe('Played Skipped Still to come');
    expect(document.querySelector('.mw-tl-lost')).toBeNull();                                  // nothing to say about skipping yet
  });

  it('turns green as it is played, and nothing is red when it is played straight through', async () => {
    seed();
    await open([audio()]);
    const player = fakePlayer();
    await play(player, 0, 6);
    expect(kinds()).toEqual(['played', 'ahead']);
    expect(label()).toBe('Played 0:07 of 0:12.');
    expect(document.querySelector('.mw-tl-lost')).toBeNull();
  });

  it('goes red over a part that was jumped over, even a small one, and says so in words', async () => {
    seed();
    await open([audio()]);
    const player = fakePlayer();
    await play(player, 0, 5);
    await play(player, 8, 11);                                                                 // jumped from 5 to 8: seconds 6 and 7 were never played
    expect(kinds()).toEqual(['played', 'skipped', 'played']);                                  // second 11 is the last one: nothing is left to come
    expect(label()).toBe('Played 0:10 of 0:12. Skipped 0:02 in 1 part: 0:06 to 0:08.');
    expect(document.querySelector('.mw-tl-lost').textContent).toBe(' · 0:02 skipped. Tap the red to play it and count it.');
    const widths = [...document.querySelectorAll('.mw-tl [data-kind]')].map((e) => e.style.flex);
    expect(widths.some((w) => /16\.6/.test(w))).toBe(true);                                   // the red part is 2 of the 12 seconds
  });

  it('turns red part green again once it is played', async () => {
    seed();
    await open([audio()]);
    const player = fakePlayer();
    await play(player, 0, 5);
    await play(player, 8, 11);
    expect(kinds()).toContain('skipped');
    await play(player, 6, 8);                                                                  // go back and play what was skipped
    expect(kinds()).toEqual(['played']);
    expect(label()).toBe('Played 0:12 of 0:12.');
    expect(document.querySelector('.mw-tl-lost')).toBeNull();
  });

  it('goes red from the start if the student jumps straight in', async () => {
    seed();
    await open([audio()]);
    const player = fakePlayer();
    await play(player, 4, 8);
    expect(kinds().slice(0, 2)).toEqual(['skipped', 'played']);
    expect(label()).toContain('Skipped 0:04 in 1 part: 0:00 to 0:04.');
  });

  it('shows a jump to the end as everything before it skipped, even though nothing was played there', async () => {
    seed();
    await open([audio()]);
    const player = fakePlayer();
    await play(player, 0, 2);
    player.t = 11; await pause(player);                                                        // dragged to the end and left there
    expect(kinds()).toEqual(['played', 'skipped', 'ahead']);                                   // the last second was never reached
    expect(label()).toContain('Skipped 0:08 in 1 part: 0:03 to 0:11.');
  });

  it('keeps a marker where the playhead is', async () => {
    seed();
    await open([audio()]);
    const player = fakePlayer();
    await play(player, 0, 6);
    await pause(player);
    expect(parseFloat(document.querySelector('.mw-tl-head').style.left)).toBeCloseTo(50, 0);
  });

  it('has no bar when the length is not known, and plays on as before', async () => {
    seed();
    await open([audio({ duration_seconds: null })]);
    expect(document.querySelector('.mw-tl')).toBeNull();
    expect(document.querySelector('audio')).not.toBeNull();
  });

  it('keeps what was played, and what was skipped, after leaving the lesson and coming back', async () => {
    seed({ picks: ['listen'] });
    await open([audio()]);
    const player = fakePlayer();
    await play(player, 0, 5);
    await play(player, 8, 11);
    const before = kinds();
    await pause(player);
    await act(() => document.querySelector('.mw-pill.back').click());                          // to choosing
    await act(() => tick(60));
    await act(() => document.querySelector('.mw-pill.fwd').click());                           // and into the same lesson again
    await act(() => tick(60));
    expect(kinds()).toEqual(before);
    expect(label()).toBe('Played 0:10 of 0:12. Skipped 0:02 in 1 part: 0:06 to 0:08.');
  });

  it('keeps it through closing the page too', async () => {
    seed();
    await open([audio()]);
    const player = fakePlayer();
    await play(player, 0, 5);
    await play(player, 8, 11);
    await pause(player);
    await mounted.unmount(); mounted = null; document.body.innerHTML = '';
    await open([audio()]);
    expect(kinds()).toEqual(['played', 'skipped', 'played']);
  });
});

describe('tapping the red', () => {
  // Lines begin at 0:00, 0:04 and 0:09. After playing 0 to 5 and then 8 to 11, seconds 6 and 7 are red, in the middle of the second line.
  const lines = () => audio({ transcript: [{ start: 0, end: 4, text: 'First.' }, { start: 4, end: 9, text: 'Second.' }, { start: 9, end: 12, text: 'Third.' }] });
  const hit = () => document.querySelector('.mw-tl-hit');
  async function skipSomething() {
    seed();
    await open([lines()]);
    const player = fakePlayer();
    await play(player, 0, 5);
    await play(player, 8, 11);
    await pause(player);
    return player;
  }

  it('offers each red part as something to tap, named by where it will start', async () => {
    await skipSomething();
    expect(document.querySelectorAll('.mw-tl-hit')).toHaveLength(1);
    expect(hit().getAttribute('aria-label')).toBe('Play the skipped part from 0:04');          // the start of the line, not 0:06
    expect(hit().tagName).toBe('BUTTON');
  });

  it('starts at the beginning of the transcript line where the red begins, not the exact second skipped', async () => {
    const player = await skipSomething();
    await act(() => hit().click());
    expect(player.t).toBe(4);                                                                  // the red began at 6, inside the line that starts at 4
  });

  it('does what a tap on that line of the transcript does: it follows the talk again', async () => {
    const player = await skipSomething();
    await act(() => hit().click());
    expect(player.t).toBe(4);
    expect(document.querySelector('.mw-follow')).toBeNull();                                   // not left looking at some other part
  });

  it('clears the red once that part has been played through', async () => {
    const player = await skipSomething();
    await act(() => hit().click());
    await play(player, 4, 8);                                                                  // from the start of the line, on past the red
    expect(kinds()).toEqual(['played']);
    expect(document.querySelector('.mw-tl-hit')).toBeNull();                                   // nothing left to tap
    expect(document.querySelector('.mw-tl-lost')).toBeNull();
  });

  it('has one target for each red part, each going to its own place', async () => {
    seed();
    await open([lines()]);
    const player = fakePlayer();
    await play(player, 0, 1);
    await play(player, 4, 5);                                                                  // red: 2 to 3, inside the first line
    await play(player, 9, 11);                                                                 // red: 6 to 8, inside the second line
    await pause(player);
    const targets = [...document.querySelectorAll('.mw-tl-hit')].map((b) => b.getAttribute('aria-label'));
    expect(targets).toEqual(['Play the skipped part from 0:00', 'Play the skipped part from 0:04']);
    await act(() => document.querySelectorAll('.mw-tl-hit')[1].click());
    expect(player.t).toBe(4);
    await act(() => document.querySelectorAll('.mw-tl-hit')[0].click());
    expect(player.t).toBe(0);
  });

  it('is big enough to hit even for a very small red part, without changing how the bar looks', async () => {
    await skipSomething();
    expect(hit().style.width).toMatch(/^max\(.*, 22px\)$/);
    expect(hit().style.background).toBe('transparent');
  });

  it('is something to look at only for the teacher: no targets without a way to jump', async () => {
    const { Timeline } = await import('./Timeline.jsx');
    const box = await renderInBrowser(<Timeline duration={12} seen={[[0, 5], [8, 11]]} reached={11} played={10} />);
    expect(box.container.querySelector('.mw-tl')).not.toBeNull();
    expect(box.container.querySelector('.mw-tl-hit')).toBeNull();
    await box.unmount();
  });
});

describe('the same bar for a YouTube video', () => {
  let players;
  function installFakeYouTube() {
    players = [];
    class Player {
      constructor(el, opts) { Object.assign(this, { el, opts, t: 0, state: -1, duration: 12 }); players.push(this); queueMicrotask(() => opts.events.onReady({ target: this })); }
      getCurrentTime() { return this.t; } getPlayerState() { return this.state; } getDuration() { return this.duration; }
      playVideo() { this.state = 1; } pauseVideo() { this.state = 2; } seekTo(t) { this.t = t; }
      isMuted() { return false; } getVolume() { return 100; } destroy() {}
    }
    window.YT = { Player };
  }
  async function playYT(p, from, to) {
    p.state = 1; p.t = from; await act(() => tick(540));
    for (let t = from + 1; t <= to; t += 1) { p.t = t; await act(() => tick(270)); }
  }

  it('goes red over what was jumped over, whatever the player is', async () => {
    installFakeYouTube();
    seed({ sourceIds: ['Y1'], picks: ['watch'] });
    await open([youtube()]);
    await act(() => tick(60));
    expect(players).toHaveLength(1);
    expect(kinds()).toEqual(['ahead']);
    await playYT(players[0], 0, 5);
    await playYT(players[0], 8, 11);
    expect(kinds()).toEqual(['played', 'skipped', 'played']);
    expect(label()).toBe('Played 0:10 of 0:12. Skipped 0:02 in 1 part: 0:06 to 0:08.');
  });

  it('opens at the saved place and keeps what was played, when the video is opened again', async () => {
    installFakeYouTube();
    seed({ sourceIds: ['Y1'], picks: ['watch'] }, { lessons: { '0:Y1': { played: 10, duration: 12, readSeconds: 0, mutedPlayed: 0, time: 11, reached: 11, seen: [[0, 5], [8, 11]], quiet: [], done: true } } });
    await open([youtube()]);
    await act(() => tick(60));
    expect(players[0].opts.playerVars.start).toBe(11);                                         // waits where they stopped
    expect(kinds()).toEqual(['played', 'skipped', 'played']);
  });
});

describe('what the teacher is given', () => {
  async function finish(onSubmit) {
    await act(() => btn('Continue').click()); await act(() => tick(60));
    for (let i = 0; i < 3; i++) { await act(() => btn('Skip step').click()); await act(() => tick(60)); }
    return onSubmit.mock.calls[0][0];
  }

  it('is, for each recording or video, exactly which parts were played and which were skipped', async () => {
    seed({ days: 2, learnIndex: 1, sourceIds: ['L1', 'A1'], picks: ['read', 'listen'] }, { lessons: { '0:L1': DONE } });
    const onSubmit = await open([reading, audio()]);
    const player = fakePlayer();
    await play(player, 0, 5);
    await play(player, 8, 11);
    await pause(player);
    const { rpc, row } = await finish(onSubmit);
    const expected = [{ source_id: 'A1', title: 'A talk', kind: 'audio', duration: 12, played: 10, reached: 11, seen: [[0, 5], [8, 11]], skipped: [[6, 8]] }];
    expect(rpc.p_media_detail).toEqual(expected);                                              // what is saved
    expect(row.media_detail).toEqual(expected);                                                // and what the preview and email use
  });

  it('has nothing for a reading, and nothing for a recording that was never opened', async () => {
    seed({ step: 5, sourceIds: ['L1'], picks: ['read'], learned: true, truth: 'If we act then He will help us', where: 'Verse 7', understanding: 'x y z a b c d e f', text: 'x y z a b c d e f', inv: 'serve', commit: 'help my brother', bless: 'be kinder' }, { lessons: { '0:L1': DONE } });
    const onSubmit = await open([reading, audio()]);
    await act(() => btn('Skip step').click()); await act(() => tick(60));
    expect(onSubmit.mock.calls[0][0].rpc.p_media_detail).toEqual([]);
  });

  it('shows no skipped parts for a recording that was played straight through', async () => {
    seed();
    const onSubmit = await open([audio()]);
    const player = fakePlayer();
    await play(player, 0, 11);
    await pause(player);
    const { row } = await finish(onSubmit);
    expect(row.media_detail[0]).toMatchObject({ played: 12, skipped: [], seen: [[0, 11]] });
  });
});

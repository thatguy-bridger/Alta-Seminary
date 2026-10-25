// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderInBrowser } from '../test/render.js';
import { useSpeech, speechSupported } from './useSpeech.js';
import { MakeupJourney } from './MakeupJourney.jsx';
import { SAMPLE_CLASSES, SAMPLE_SOURCES } from './sampleContent.js';

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
window.matchMedia ??= globalThis.matchMedia;
globalThis.URL.createObjectURL ??= () => 'blob:sample';
window.SVGElement.prototype.getTotalLength ??= () => 100;
window.SVGElement.prototype.getPointAtLength ??= () => ({ x: 0, y: 0 });
window.HTMLMediaElement.prototype.play = () => Promise.resolve();
window.HTMLMediaElement.prototype.pause = () => {};

// A stand-in for the browser's speech recognition. The test plays the part of the person talking.
let sessions;
class FakeRecognition {
  constructor() { this.started = false; this.aborted = false; sessions.push(this); }
  start() { this.started = true; }
  stop() { this.started = false; }
  abort() { this.aborted = true; this.started = false; }
  say(text, interim = '') {
    const results = [{ isFinal: true, 0: { transcript: text } }];
    if (interim) results.push({ isFinal: false, 0: { transcript: interim } });
    this.onresult({ resultIndex: 0, results });
  }
  end() { this.started = false; this.onend(); }          // the browser ending a session by itself
  fail(code) { this.onerror({ error: code }); }
}
const install = () => { sessions = []; window.SpeechRecognition = FakeRecognition; };
const uninstall = () => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; };
const last = () => sessions[sessions.length - 1];

let mounted;
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-25T12:00:00Z')); });
afterEach(async () => { await mounted?.unmount(); mounted = null; vi.useRealTimers(); uninstall(); document.body.innerHTML = ''; });
const later = (ms) => vi.setSystemTime(Date.now() + ms);
const act = (fn) => React.act(async () => { await fn(); });
const tick = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const buttons = (text) => [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === text);
const btn = (text) => buttons(text)[0];

let probe, finals;
function Probe() { probe = useSpeech({ onFinal: (t) => finals.push(t) }); return null; }

describe('useSpeech', () => {
  it('reports that speech is not available when the browser has no speech recognition', async () => {
    mounted = await renderInBrowser(<Probe />); finals = [];
    expect(speechSupported()).toBe(false);
    expect(probe.supported).toBe(false);
    await act(() => probe.start());
    expect(probe.listening).toBe(false);
  });

  it('listens, passes on finished phrases, and shows the phrase still being heard', async () => {
    install(); finals = [];
    mounted = await renderInBrowser(<Probe />);
    await act(() => probe.start());
    expect(probe.listening).toBe(true);
    expect(last().started).toBe(true);
    expect([last().continuous, last().interimResults]).toEqual([true, true]);
    await act(() => last().say('  It could help them  ', 'feel peace'));
    expect(finals).toEqual(['It could help them']);
    expect(probe.interim).toBe('feel peace');
    await act(() => last().say('feel peace.'));
    expect(finals).toEqual(['It could help them', 'feel peace.']);
    expect(probe.interim).toBe('');
  });

  it('stops, and says how many seconds it was listening', async () => {
    install(); finals = [];
    mounted = await renderInBrowser(<Probe />);
    await act(() => probe.start());
    later(7400);
    let seconds;
    await act(() => { seconds = probe.stop(); });
    expect(seconds).toBe(7);
    expect(probe.listening).toBe(false);
    expect(last().started).toBe(false);
  });

  it('carries on when the browser ends a session by itself (it does after a pause), but not after we stop', async () => {
    install(); finals = [];
    mounted = await renderInBrowser(<Probe />);
    await act(() => probe.start());
    await act(() => last().end());
    expect(sessions).toHaveLength(2);
    expect(last().started).toBe(true);
    expect(probe.listening).toBe(true);
    await act(() => { probe.stop(); });
    await act(() => last().end());
    expect(sessions).toHaveLength(2);
    expect(probe.listening).toBe(false);
  });

  it('explains a blocked microphone in plain words, and stops trying', async () => {
    install(); finals = [];
    mounted = await renderInBrowser(<Probe />);
    await act(() => probe.start());
    await act(() => last().fail('not-allowed'));
    expect(probe.error).toMatch(/microphone is blocked/i);
    expect(probe.listening).toBe(false);
    await act(() => last().end());
    expect(sessions).toHaveLength(1);
  });

  it('does not treat silence as an error', async () => {
    install(); finals = [];
    mounted = await renderInBrowser(<Probe />);
    await act(() => probe.start());
    await act(() => last().fail('no-speech'));
    expect(probe.error).toBe('');
    expect(probe.listening).toBe(true);
  });

  it('lets go of the microphone when the page is left', async () => {
    install(); finals = [];
    mounted = await renderInBrowser(<Probe />);
    await act(() => probe.start());
    const s = last();
    await mounted.unmount(); mounted = null;
    expect(s.aborted).toBe(true);
  });
});

describe('answering out loud in the journey', () => {
  const run = async (props = {}) => {
    const onSubmit = vi.fn(async () => ({ ok: true, saved: false }));
    mounted = await renderInBrowser(<MakeupJourney classes={SAMPLE_CLASSES} sources={SAMPLE_SOURCES} onSubmit={onSubmit} skipTools {...props} />);
    for (let i = 0; i < 4; i++) { btn('Skip step').click(); await act(() => tick(20)); }    // begin, choose, learn, truth -> understand
    expect(document.querySelector('.mw-h').textContent).toBe('Why does this truth matter?');
    return onSubmit;
  };

  it('offers "Say it" only when the browser can do speech', async () => {
    await run();
    expect(btn('Say it')).toBeUndefined();
    await mounted.unmount(); document.body.innerHTML = '';
    install();
    await run();
    expect(btn('Say it')).toBeDefined();
    expect(btn('Write it').getAttribute('aria-pressed')).toBe('true');
  });

  it('turns spoken answers into text, needs enough speaking, and submits it as a spoken answer', async () => {
    install();
    const onSubmit = await run();
    await act(() => btn('Say it').click());
    expect(document.querySelector('textarea')).toBeNull();                       // nothing to type or paste into
    const box = document.querySelector('#mw-vunder');
    expect(box.tagName).toBe('DIV');
    expect(box.getAttribute('aria-readonly')).toBe('true');
    expect(btn('Continue').disabled).toBe(true);

    // first answer, about 8 seconds
    await act(() => buttons('Speak')[0].click());
    await act(() => last().say('It could help them feel peace', 'when things are hard'));
    expect(box.textContent).toContain('It could help them feel peace');
    expect(box.textContent).toContain('when things are hard');                  // the phrase still being heard shows too
    later(8000);
    await act(() => btn('Done').click());
    expect(document.body.textContent).toContain('Spoke for 0:08');
    expect(btn('Continue').disabled).toBe(true);                                // the second answer is still missing

    // second answer, another 8 seconds (two ways to learn: 15 seconds needed in all)
    await act(() => buttons('Speak')[0].click());                               // the first box now says "Add more"
    await act(() => last().say('I felt calm and close to Him'));
    later(8000);
    await act(() => btn('Done').click());
    expect(btn('Continue').disabled).toBe(false);
    expect(document.body.textContent).toContain('never a recording');          // what is kept is said plainly

    await act(() => btn('Continue').click());
    await act(() => btn('Skip step').click());                                  // fills the invitation and submits
    await act(() => tick(60));
    const { rpc, row } = onSubmit.mock.calls[0][0];
    expect(rpc).toMatchObject({ p_mode: 'voice', p_voice_seconds: 16, p_understanding: 'It could help them feel peace', p_typed_chars: 0 });
    expect(rpc.p_response).toContain('I felt calm and close to Him');
    expect(row.mode).toBe('voice');
    expect(document.body.textContent).toContain('(spoken, 0:16)');
  });

  it('"Start again" clears an answer and the time spoken for it', async () => {
    install();
    await run();
    await act(() => btn('Say it').click());
    await act(() => buttons('Speak')[0].click());
    await act(() => last().say('It could help them feel peace'));
    later(8000);
    await act(() => btn('Done').click());
    expect(document.querySelector('#mw-vunder').textContent).toContain('feel peace');
    await act(() => btn('Start again').click());
    expect(document.querySelector('#mw-vunder').textContent).toContain('Tap Speak');
    expect(document.body.textContent).not.toContain('Spoke for');
  });

  it('switching back to writing clears what was spoken, so nothing is mixed', async () => {
    install();
    const onSubmit = await run();
    await act(() => btn('Say it').click());
    await act(() => buttons('Speak')[0].click());
    await act(() => last().say('It could help them feel peace'));
    later(9000);
    await act(() => btn('Done').click());
    await act(() => btn('Write it').click());
    expect(document.querySelector('#mw-under').value).toBe('');
    await act(() => btn('Fill in').click());
    await act(() => btn('Skip step').click());                                  // understand -> commit
    await act(() => btn('Skip step').click());                                  // submit
    await act(() => tick(60));
    expect(onSubmit.mock.calls[0][0].rpc).toMatchObject({ p_mode: 'text', p_voice_seconds: 0 });
  });
});

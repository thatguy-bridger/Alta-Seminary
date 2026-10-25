// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderInBrowser } from '../test/render.js';
import { buildGraph, createSoundscape, loadPrefs, savePrefs, defaultPrefs, EFFECTS, LEVELS } from './sound.js';
import { MakeupJourney } from './MakeupJourney.jsx';
import { SAMPLE_CLASSES, SAMPLE_SOURCES } from './sampleContent.js';

// A stand-in for the browser's audio engine that records what the code asks of it.
function fakeParam(v = 0) { return { value: v, calls: [], setValueAtTime(x, t) { this.calls.push(['set', x, t]); }, linearRampToValueAtTime(x, t) { this.calls.push(['lin', x, t]); }, exponentialRampToValueAtTime(x, t) { this.calls.push(['exp', x, t]); }, setTargetAtTime(x, t, k) { this.calls.push(['target', x, t, k]); this.value = x; }, cancelScheduledValues() {} }; }
function fakeNode(extra = {}) { return { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), ...extra }; }
function makeCtx() {
  const made = { osc: [], gain: [], src: [] };
  const ctx = {
    currentTime: 0, sampleRate: 8000, state: 'suspended', destination: fakeNode(),
    createGain() { const n = fakeNode({ gain: fakeParam(1) }); made.gain.push(n); return n; },
    createOscillator() { const n = fakeNode({ frequency: fakeParam(440), detune: fakeParam(0), type: 'sine' }); made.osc.push(n); return n; },
    createBiquadFilter() { return fakeNode({ frequency: fakeParam(1000), detune: fakeParam(0), Q: fakeParam(1), type: 'lowpass' }); },
    createDynamicsCompressor() { return fakeNode({ threshold: fakeParam(), knee: fakeParam(), ratio: fakeParam(), attack: fakeParam(), release: fakeParam() }); },
    createConvolver() { return fakeNode({ buffer: null }); },
    createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; },
    createBufferSource() { const n = fakeNode({ buffer: null }); made.src.push(n); return n; },
    resume: vi.fn(async function () { ctx.state = 'running'; }), suspend: vi.fn(async function () { ctx.state = 'suspended'; }), close: vi.fn(async function () { ctx.state = 'closed'; }),
  };
  return { ctx, made };
}

describe('the soundscape graph', () => {
  it('builds, and the pad only starts when music is turned on (once)', () => {
    const { ctx, made } = makeCtx(); const g = buildGraph(ctx);
    expect(made.osc.every((o) => o.start.mock.calls.length === 0)).toBe(true);
    g.setMusic(true); g.setMusic(false); g.setMusic(true);
    expect(made.osc.filter((o) => o.start.mock.calls.length === 1).length).toBe(made.osc.length); // each oscillator started exactly once
  });
  it('music and effects are silent until switched on', () => {
    const { ctx, made } = makeCtx(); const g = buildGraph(ctx);
    expect(g.nodes.padBus.gain.value).toBe(0); expect(g.nodes.fxBus.gain.value).toBe(0);
    const before = made.osc.length; g.play('chime'); expect(made.osc.length).toBe(before);   // effects off: nothing plays
    g.setEffects(true); g.play('chime'); expect(made.osc.length).toBeGreaterThan(before);
  });
  it('turning music on fades it in, off fades it out, and ducking lowers it', () => {
    const { ctx } = makeCtx(); const g = buildGraph(ctx);
    g.setMusic(true); expect(g.nodes.padBus.gain.value).toBe(LEVELS.pad);
    g.duck(true); expect(g.nodes.padBus.gain.value).toBe(LEVELS.padDucked);
    g.duck(false); expect(g.nodes.padBus.gain.value).toBe(LEVELS.pad);
    g.setMusic(false); expect(g.nodes.padBus.gain.value).toBe(0);
  });
  it('the filter opens as the sky brightens', () => {
    const { ctx } = makeCtx(); const g = buildGraph(ctx);
    g.setPhase(0); const dark = g.nodes.lp.frequency.value; g.setPhase(6); const bright = g.nodes.lp.frequency.value;
    expect(bright).toBeGreaterThan(dark * 4);
  });
  it('volume is clamped', () => {
    const { ctx } = makeCtx(); const g = buildGraph(ctx);
    g.setVolume(5); expect(g.state.volume).toBe(1); g.setVolume(-1); expect(g.state.volume).toBe(0);
  });
  it('every named effect can be played without error', () => {
    const { ctx } = makeCtx(); const g = buildGraph(ctx); g.setEffects(true);
    for (const n of EFFECTS) expect(() => g.play(n), n).not.toThrow();
  });
});

describe('createSoundscape and remembered preferences', () => {
  beforeEach(() => localStorage.clear());
  it('is off by default and remembers a choice', () => {
    expect(loadPrefs()).toEqual(defaultPrefs); expect(defaultPrefs.on).toBe(false);
    savePrefs({ ...defaultPrefs, on: true, volume: 0.3 }); expect(loadPrefs()).toMatchObject({ on: true, volume: 0.3 });
  });
  it('survives a broken saved value', () => { localStorage.setItem('alta-makeup-sound', '{not json'); expect(loadPrefs()).toEqual(defaultPrefs); });
  it('starts (resuming a suspended context), applies preferences, and disposes', async () => {
    const { ctx } = makeCtx(); const s = createSoundscape(function () { return ctx; });
    expect(s.supported).toBe(true);
    expect(await s.start({ ...defaultPrefs, on: true })).toBe(true);
    expect(ctx.resume).toHaveBeenCalled(); expect(s.running).toBe(true);
    await s.dispose(); expect(ctx.close).toHaveBeenCalled();
  });
  it('reports unsupported browsers instead of failing', async () => {
    const s = createSoundscape(null); expect(s.supported).toBe(false); expect(await s.start(defaultPrefs)).toBe(false); expect(() => s.play('tick')).not.toThrow();
  });
});

// jsdom has none of these browser features; the journey uses them for the scene and player.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
window.matchMedia ??= globalThis.matchMedia;
globalThis.URL.createObjectURL ??= () => 'blob:sample';
window.SVGElement.prototype.getTotalLength ??= () => 100;
window.SVGElement.prototype.getPointAtLength ??= () => ({ x: 0, y: 0 });
window.HTMLMediaElement.prototype.play = () => Promise.resolve();
window.HTMLMediaElement.prototype.pause = () => {};

describe('sound inside the journey', () => {
  let mounted; let created;
  const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
  const btn = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
  beforeEach(() => { localStorage.clear(); created = []; window.AudioContext = function () { const { ctx, made } = makeCtx(); created.push({ ctx, made }); return ctx; }; });
  afterEach(async () => { await mounted?.unmount(); document.body.innerHTML = ''; delete window.AudioContext; });

  it('is silent until the student turns it on, then starts from that tap', async () => {
    mounted = await renderInBrowser(<MakeupJourney classes={SAMPLE_CLASSES} sources={SAMPLE_SOURCES} onSubmit={async () => ({ ok: true })} />);
    expect(created.length).toBe(0);
    document.querySelector('.mw-sbtn[aria-pressed="false"]').click(); await tick(50);
    expect(created.length).toBe(1);
    expect(created[0].ctx.resume).toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('alta-makeup-sound')).on).toBe(true);
  });

  it('plays a soft sound for a choice, and stays quiet when sound is off', async () => {
    mounted = await renderInBrowser(<MakeupJourney classes={SAMPLE_CLASSES} sources={SAMPLE_SOURCES} onSubmit={async () => ({ ok: true })} skipTools />);
    btn('Skip step').click(); await tick(80);          // sound off: reaches "choose" with no audio engine at all
    expect(created.length).toBe(0);
    document.querySelector('.mw-sbtn').click(); await tick(60);
    const { made } = created[0]; const before = made.osc.length;
    document.querySelector('.mw-opt').click(); await tick(60); // pick a way to learn: a tick
    expect(made.osc.length).toBeGreaterThan(before);
  });

  it('the options panel switches music and soft sounds, and sets the volume', async () => {
    mounted = await renderInBrowser(<MakeupJourney classes={SAMPLE_CLASSES} sources={SAMPLE_SOURCES} onSubmit={async () => ({ ok: true })} />);
    document.querySelector('.mw-sbtn').click(); await tick(50);
    document.querySelector('.mw-sbtn.small').click(); await tick();
    const boxes = document.querySelectorAll('.mw-spanel input[type=checkbox]');
    expect(boxes.length).toBe(2);
    boxes[0].click(); await tick();
    expect(JSON.parse(localStorage.getItem('alta-makeup-sound')).music).toBe(false);
    const range = document.querySelector('.mw-spanel input[type=range]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(range, '0.25'); range.dispatchEvent(new Event('input', { bubbles: true })); await tick();
    expect(JSON.parse(localStorage.getItem('alta-makeup-sound')).volume).toBe(0.25);
  });

  it('stops the audio when the journey closes', async () => {
    mounted = await renderInBrowser(<MakeupJourney classes={SAMPLE_CLASSES} sources={SAMPLE_SOURCES} onSubmit={async () => ({ ok: true })} />);
    document.querySelector('.mw-sbtn').click(); await tick(50);
    await mounted.unmount(); mounted = null; await tick(30);
    expect(created[0].ctx.close).toHaveBeenCalled();
  });

  it('a browser with no audio support shows no sound control and nothing breaks', async () => {
    delete window.AudioContext;
    mounted = await renderInBrowser(<MakeupJourney classes={SAMPLE_CLASSES} sources={SAMPLE_SOURCES} onSubmit={async () => ({ ok: true })} />);
    expect(document.querySelector('.mw-sbtn')).toBeNull();
    expect(document.querySelector('.mw-h').textContent).toContain('Let');
  });
});

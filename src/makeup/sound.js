// The sound of the Makeup Work journey. Everything is synthesized with the Web Audio API, so there are
// no audio files to host or license, and the music can follow the sky: it begins as a low, dark drone
// before dawn and slowly opens and brightens, chord by chord, until morning.
//
//   pad      six quiet voices in D (sine and triangle) through a low-pass filter that opens as the sky does,
//            a slow breathing in volume, and a long reverb tail
//   effects  a soft tick for choices, a two-note chime for moving on, a small bell for a cited moment, a
//            low thud for blocked pasting, a whisper of air between steps, and a bell arpeggio at the end
//
// Defaults are quiet and OFF: a student has to turn sound on, and it is remembered afterward.
// buildGraph() takes any AudioContext (live or offline), which is how the levels are measured in tests.

const CHORDS = [ // six voices per step: [freqs], [gains], filter cutoff. 0 = silent voice. Low voices thin out and high ones come in as day breaks.
  { f: [73.42, 110.0, 164.81, 220.0, 0, 0], g: [0.95, 0.7, 0.5, 0.25, 0, 0], cutoff: 380 },                 // 0 predawn: D2 A2 E3 A3
  { f: [73.42, 110.0, 185.0, 220.0, 329.63, 0], g: [0.9, 0.65, 0.45, 0.3, 0.14, 0], cutoff: 520 },           // 1 blue hour: adds F#, E
  { f: [73.42, 110.0, 185.0, 277.18, 329.63, 0], g: [0.8, 0.55, 0.45, 0.35, 0.25, 0], cutoff: 800 },         // 2 first light: Dmaj7
  { f: [98.0, 146.83, 246.94, 370.0, 440.0, 0], g: [0.7, 0.5, 0.45, 0.4, 0.34, 0], cutoff: 1300 },           // 3 dawn: G 6/9
  { f: [73.42, 110.0, 185.0, 293.66, 440.0, 493.88], g: [0.6, 0.45, 0.4, 0.4, 0.4, 0.3], cutoff: 2000 },      // 4 sunrise: D add9
  { f: [73.42, 110.0, 185.0, 369.99, 440.0, 659.25], g: [0.5, 0.4, 0.38, 0.42, 0.45, 0.4], cutoff: 2800 },    // 5 golden
  { f: [73.42, 146.83, 220.0, 369.99, 587.33, 880.0], g: [0.42, 0.36, 0.4, 0.44, 0.48, 0.42], cutoff: 3600 }, // 6 morning: D6/9, open and high
];

export const LEVELS = { pad: 0.2, padDucked: 0.05, fx: 0.9, reverbWet: 0.45 };
export const EFFECTS = ['tick', 'untick', 'chime', 'cite', 'thud', 'swell', 'ding', 'finish'];

const lerp = (a, b, t) => a + (b - a) * t;
const volumeCurve = (v) => Math.min(1, Math.max(0, v)) ** 2; // quiet end gets finer control

function impulseResponse(ctx, seconds = 3.2) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let seed = 1234 + c * 77; // deterministic, so the room sounds the same every time
    for (let i = 0; i < len; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      d[i] = ((seed / 4294967296) * 2 - 1) * (1 - i / len) ** 2.6;
    }
  }
  return buf;
}

function noiseBuffer(ctx, seconds = 1.5) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let seed = 99;
  for (let i = 0; i < len; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; d[i] = (seed / 4294967296) * 2 - 1; }
  return buf;
}

// Attack then exponential fall. Always starts and ends at (almost) silence, so there are no clicks.
function env(g, t, peak, attack, decay) {
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

export function buildGraph(ctx) {
  const master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20; comp.knee.value = 24; comp.ratio.value = 3; comp.attack.value = 0.02; comp.release.value = 0.4;
  comp.connect(master); master.connect(ctx.destination);

  const verb = ctx.createConvolver(); verb.buffer = impulseResponse(ctx);
  const verbIn = ctx.createGain(); verbIn.gain.value = 1;
  const verbOut = ctx.createGain(); verbOut.gain.value = LEVELS.reverbWet;
  verbIn.connect(verb); verb.connect(verbOut); verbOut.connect(comp);

  // pad
  const padBus = ctx.createGain(); padBus.gain.value = 0;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.6; lp.frequency.value = CHORDS[0].cutoff;
  const padMix = ctx.createGain(); padMix.gain.value = 0.5;
  padMix.connect(lp); lp.connect(padBus); padBus.connect(comp); padBus.connect(verbIn);
  const voices = CHORDS[0].f.map((f, i) => {
    const o = ctx.createOscillator(); o.type = i % 2 ? 'triangle' : 'sine'; o.frequency.value = f || 220; o.detune.value = (i - 2.5) * 3;
    const g = ctx.createGain(); g.gain.value = 0; o.connect(g); g.connect(padMix); return { o, g };
  });
  // slow breathing: the pad swells and settles about once every 12 seconds
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.085;
  const lfoDepth = ctx.createGain(); lfoDepth.gain.value = 0.06;
  lfo.connect(lfoDepth); lfoDepth.connect(padMix.gain);
  const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.05;
  const lfo2Depth = ctx.createGain(); lfo2Depth.gain.value = 140;
  lfo2.connect(lfo2Depth); lfo2Depth.connect(lp.detune);
  let started = false;
  const startPad = (at) => { if (started) return; started = true; voices.forEach(({ o }) => o.start(at)); lfo.start(at); lfo2.start(at); };

  // effects
  const fxBus = ctx.createGain(); fxBus.gain.value = 0;
  fxBus.connect(comp); fxBus.connect(verbIn);
  const noise = noiseBuffer(ctx);

  const state = { music: false, fx: false, volume: 0.6, ducked: false, phase: 0 };
  const applyMaster = (at) => master.gain.setTargetAtTime(volumeCurve(state.volume), at, 0.05);
  const applyPad = (at) => padBus.gain.setTargetAtTime(state.music ? (state.ducked ? LEVELS.padDucked : LEVELS.pad) : 0, at, state.music ? 1.2 : 0.35);
  const applyFx = (at) => fxBus.gain.setTargetAtTime(state.fx ? LEVELS.fx : 0, at, 0.05);
  applyMaster(ctx.currentTime);

  const tone = (type, freq, at, peak, attack, decay, dest = fxBus, freqEnd) => {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, at);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, at + attack + decay);
    const g = ctx.createGain(); env(g, at, peak, attack, decay);
    o.connect(g); g.connect(dest); o.start(at); o.stop(at + attack + decay + 0.05);
    o.onended = () => { try { o.disconnect(); g.disconnect(); } catch { /* already gone */ } };
  };
  const bell = (freq, at, peak, decay) => { // a soft bell: a pure tone plus two quieter inharmonic partials
    tone('sine', freq, at, peak, 0.004, decay);
    tone('sine', freq * 2.76, at, peak * 0.28, 0.003, decay * 0.5);
    tone('sine', freq * 5.4, at, peak * 0.1, 0.003, decay * 0.25);
  };

  const effects = {
    tick: (at) => tone('triangle', 760, at, 0.26, 0.002, 0.07),
    untick: (at) => tone('triangle', 440, at, 0.2, 0.002, 0.08),
    chime: (at) => { tone('sine', 587.33, at, 0.24, 0.004, 0.6); tone('sine', 880.0, at + 0.09, 0.22, 0.004, 0.8); },
    cite: (at) => { bell(1318.5, at, 0.2, 0.5); },
    thud: (at) => {
      const lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 420; lpf.connect(fxBus);
      tone('sine', 125, at, 0.34, 0.003, 0.17, lpf, 62);
    },
    swell: (at) => { // a breath of air between steps
      const src = ctx.createBufferSource(); src.buffer = noise;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
      bp.frequency.setValueAtTime(280, at); bp.frequency.exponentialRampToValueAtTime(1100, at + 0.9);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.7, at + 0.35); g.gain.exponentialRampToValueAtTime(0.0001, at + 1.0);
      src.connect(bp); bp.connect(g); g.connect(fxBus); src.start(at); src.stop(at + 1.05);
    },
    ding: (at) => { bell(1046.5, at, 0.22, 1.5); },
    finish: (at) => { [587.33, 739.99, 880.0, 987.77, 1174.66].forEach((f, i) => bell(f, at + i * 0.16, 0.17, 1.7)); },
  };

  return {
    startPad,
    state,
    setMusic(on, at = ctx.currentTime) { state.music = on; if (on) startPad(at); applyPad(at); },
    setEffects(on, at = ctx.currentTime) { state.fx = on; applyFx(at); },
    setVolume(v, at = ctx.currentTime) { state.volume = Math.min(1, Math.max(0, v)); applyMaster(at); },
    duck(on, at = ctx.currentTime) { state.ducked = on; applyPad(at); },
    // u = how far along the night-to-morning path (the journey's step, possibly fractional)
    setPhase(u, at = ctx.currentTime) {
      const x = Math.min(CHORDS.length - 1, Math.max(0, u)), i0 = Math.min(CHORDS.length - 2, Math.floor(x)), f = x - i0;
      const near = CHORDS[Math.round(x)], a = CHORDS[i0], b = CHORDS[i0 + 1];
      state.phase = x;
      voices.forEach(({ o, g }, v) => {
        if (near.f[v]) o.frequency.setTargetAtTime(near.f[v], at, 2.2);
        g.gain.setTargetAtTime(lerp(a.g[v], b.g[v], f), at, 1.6);
      });
      lp.frequency.setTargetAtTime(lerp(a.cutoff, b.cutoff, f), at, 1.8);
    },
    play(name, at = ctx.currentTime) { if (state.fx && effects[name]) effects[name](at + 0.005); },
    playAlways(name, at = ctx.currentTime) { if (effects[name]) effects[name](at + 0.005); }, // for measurement
    nodes: { master, comp, padBus, fxBus, lp },
  };
}

// ---- the live soundscape ----
const KEY = 'alta-makeup-sound';
export const defaultPrefs = { on: false, music: true, fx: true, volume: 0.6 };
export function loadPrefs() {
  try { return { ...defaultPrefs, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...defaultPrefs }; }
}
export function savePrefs(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* not remembered in a private window */ } }

// Must be started from a click or tap (browsers keep audio silent until then).
export function createSoundscape(Ctor = (typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null)) {
  let ctx = null, graph = null;
  return {
    get supported() { return !!Ctor; },
    get running() { return !!ctx && ctx.state === 'running'; },
    async start(prefs) {
      if (!Ctor) return false;
      if (!ctx) { ctx = new Ctor(); graph = buildGraph(ctx); }
      if (ctx.state === 'suspended') { try { await ctx.resume(); } catch { return false; } }
      graph.setVolume(prefs.volume); graph.setMusic(prefs.music); graph.setEffects(prefs.fx);
      return true;
    },
    apply(prefs) { if (graph) { graph.setVolume(prefs.volume); graph.setMusic(prefs.music); graph.setEffects(prefs.fx); } },
    phase(u) { graph && graph.setPhase(u); },
    duck(on) { graph && graph.duck(on); },
    play(name) { graph && graph.play(name); },
    async stop() { if (graph) { graph.setMusic(false); graph.setEffects(false); } if (ctx && ctx.state === 'running') { try { await ctx.suspend(); } catch { /* ignore */ } } },
    async dispose() { try { graph && graph.setMusic(false); ctx && (await ctx.close()); } catch { /* already closed */ } ctx = null; graph = null; },
  };
}

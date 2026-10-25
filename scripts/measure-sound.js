// Measures the Makeup Work soundscape in a real browser (offline rendering, no speakers needed).
// Run: start the dev server, open any page, and paste this into the console. It prints levels and
// checks them against the limits below. Re-run it after any change to src/makeup/sound.js.
(async () => {
  const mod = await import('/src/makeup/sound.js');
  const SR = 44100, db = (x) => 20 * Math.log10(Math.max(x, 1e-9));
  const render = (sec, setup) => { const c = new OfflineAudioContext(2, SR * sec, SR); setup(mod.buildGraph(c), c); return c.startRendering(); };
  const win = (b, a, z) => { const d = b.getChannelData(0); let pk = 0, sum = 0; const s = Math.floor(a * SR), e = Math.min(d.length, Math.floor(z * SR)); for (let i = s; i < e; i++) { pk = Math.max(pk, Math.abs(d[i])); sum += d[i] * d[i]; } return { peak: pk, rms: Math.sqrt(sum / (e - s)) }; };
  const step = (b, a, z) => { const d = b.getChannelData(0); let m = 0; for (let i = Math.floor(a * SR) + 1; i < Math.floor(z * SR); i++) m = Math.max(m, Math.abs(d[i] - d[i - 1])); return m; };
  const centroid = (b, t) => { const d = b.getChannelData(0), N = 16384, s = Math.floor(t * SR); let num = 0, den = 0; for (let k = 0; k < 160; k++) { const f = 40 * 2 ** (k / 16); if (f > 12000) break; let re = 0, im = 0; const w = 2 * Math.PI * f / SR; for (let i = 0; i < N; i += 2) { const x = d[s + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)); re += x * Math.cos(w * i); im -= x * Math.sin(w * i); } const m = Math.hypot(re, im); num += f * m; den += m; } return num / den; };
  const results = []; const check = (name, ok, detail) => results.push({ name, ok, detail });

  const amb = await render(40, (g) => { g.setVolume(0.6, 0); g.setMusic(true, 0); g.setPhase(0, 0); g.setPhase(3, 12); g.setPhase(6, 24); });
  const c0 = centroid(amb, 8), c3 = centroid(amb, 20), c6 = centroid(amb, 34);
  const r = [[3, 8], [14, 20], [28, 38]].map(([a, z]) => win(amb, a, z));
  check('music is quiet (rms between -40 and -22 dBFS at volume 0.6)', r.every((w) => db(w.rms) > -40 && db(w.rms) < -22), r.map((w) => db(w.rms).toFixed(1)).join(' / '));
  check('music never loud (peak under -10 dBFS)', r.every((w) => db(w.peak) < -10), r.map((w) => db(w.peak).toFixed(1)).join(' / '));
  check('music has no clicks (max sample step < 0.01)', step(amb, 2, 38) < 0.01, step(amb, 2, 38).toFixed(4));
  check('music brightens from night to morning (spectral centroid rises 25%+ twice)', c3 > c0 * 1.25 && c6 > c3 * 1.25, `${Math.round(c0)} -> ${Math.round(c3)} -> ${Math.round(c6)} Hz`);

  const musicRms = db(r[1].rms);
  for (const n of mod.EFFECTS) {
    const b = await render(3.5, (g) => { g.setVolume(0.6, 0); g.setEffects(true, 0); g.playAlways(n, 0.2); });
    const w = win(b, 0.15, 3.4), d = b.getChannelData(0);
    check(`${n}: audible but gentle (peak between -32 and -12 dBFS)`, db(w.peak) > -32 && db(w.peak) < -12, `${db(w.peak).toFixed(1)} dBFS`);
    check(`${n}: starts and ends silent (no click)`, Math.abs(d[Math.floor(0.15 * SR)]) < 0.001 && Math.abs(d[d.length - 1]) < 0.001, '');
  }
  const worst = await render(8, (g) => { g.setVolume(1, 0); g.setMusic(true, 0); g.setEffects(true, 0); g.setPhase(6, 0); g.playAlways('finish', 3); g.playAlways('chime', 3.1); g.playAlways('thud', 3.2); });
  check('worst case (everything at once, full volume) stays under -2 dBFS', db(win(worst, 0, 8).peak) < -2, db(win(worst, 0, 8).peak).toFixed(1) + ' dBFS');
  const dk = await render(14, (g) => { g.setVolume(0.6, 0); g.setMusic(true, 0); g.setPhase(2, 0); g.duck(true, 6); g.duck(false, 10); });
  check('ducking lowers the music at least 8 dB while a talk plays, then restores it', db(win(dk, 4, 5.8).rms) - db(win(dk, 8.5, 9.8).rms) > 8 && Math.abs(db(win(dk, 13, 14).rms) - db(win(dk, 4, 5.8).rms)) < 1.5, '');
  const off = await render(6, (g) => { g.setMusic(true, 0); g.setPhase(3, 0); g.setMusic(false, 2); });
  check('turning music off fades to silence', db(win(off, 4, 6).rms) < -60, db(win(off, 4, 6).rms).toFixed(1) + ' dBFS');
  console.table(results.map((x) => ({ check: x.name, pass: x.ok ? 'yes' : 'NO', detail: x.detail })));
  return { failed: results.filter((x) => !x.ok).map((x) => x.name), total: results.length };
})();

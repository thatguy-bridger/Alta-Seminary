import React from 'react';
import { createSoundscape, loadPrefs, savePrefs } from './sound.js';

// Connects the soundscape to the journey: off until the student turns it on (remembered afterward), the music
// follows the step, effects are one call away, and everything stops when the journey closes.
export function useSoundscape(stepRaw) {
  const scape = React.useRef(null);
  const phaseRef = React.useRef(stepRaw);
  const [prefs, setPrefs] = React.useState(loadPrefs);
  const [running, setRunning] = React.useState(false);
  phaseRef.current = stepRaw;

  const ensure = React.useCallback(async (p) => {
    if (!scape.current) scape.current = createSoundscape();
    const ok = await scape.current.start(p);
    setRunning(ok);
    if (ok) scape.current.phase(phaseRef.current);
    return ok;
  }, []);

  const update = React.useCallback((patch) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      savePrefs(next);
      if (next.on) ensure(next); else if (scape.current) { scape.current.stop(); setRunning(false); }
      return next;
    });
  }, [ensure]);

  // Browsers only allow audio after a tap: if sound was left on last time, the first tap on the journey wakes it.
  const wake = React.useCallback(() => { if (prefs.on && !running) ensure(prefs); }, [prefs, running, ensure]);

  React.useEffect(() => { if (running && scape.current) scape.current.phase(stepRaw); }, [stepRaw, running]);
  React.useEffect(() => { if (running && scape.current) scape.current.apply(prefs); }, [prefs, running]);
  React.useEffect(() => () => { const s = scape.current; scape.current = null; if (s) s.dispose(); }, []);

  const play = React.useCallback((name) => { if (scape.current) scape.current.play(name); }, []);
  const duck = React.useCallback((on) => { if (scape.current) scape.current.duck(on); }, []);
  const supported = typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext);
  return { prefs, update, wake, play, duck, running, supported };
}

import React from 'react';

// Speaking an answer, turned into words by the browser's own speech recognition (Chrome, Edge and Safari have it).
// Only the words and how long the student spoke are kept: no audio is recorded or stored by us.
// Note for the school: some browsers (Chrome) send the audio to their maker's servers to do the recognition.
const ctor = () => (typeof window === 'undefined' ? null : window.SpeechRecognition || window.webkitSpeechRecognition || null);
export const speechSupported = () => !!ctor();

const PROBLEMS = {
  'not-allowed': 'The microphone is blocked. Allow it in your browser, or write your answers instead.',
  'service-not-allowed': 'This browser will not turn speech into words here. Write your answers instead.',
  'audio-capture': 'No microphone was found. Check it, or write your answers instead.',
  network: 'Speech needs an internet connection. Try again, or write your answers instead.',
  other: 'Something went wrong with the microphone. Try again, or write your answers instead.',
};

export function useSpeech({ onFinal, lang = 'en-US' }) {
  const [state, setState] = React.useState({ listening: false, interim: '', error: '' });
  const rec = React.useRef(null);
  const wanted = React.useRef(false);          // true from start() until stop(); the browser can end a session on its own, so we restart
  const startedAt = React.useRef(0);
  const finalRef = React.useRef(onFinal);
  finalRef.current = onFinal;

  const spawn = React.useCallback(() => {
    const R = ctor();
    const r = new R();
    r.lang = lang; r.continuous = true; r.interimResults = true;
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) { const t = (res[0].transcript || '').trim(); if (t) finalRef.current(t); } else interim += res[0].transcript;
      }
      setState((s) => ({ ...s, interim: interim.trim() }));
    };
    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;       // silence or a restart: not a problem
      wanted.current = false;
      setState({ listening: false, interim: '', error: PROBLEMS[e.error] || PROBLEMS.other });
    };
    r.onend = () => {
      if (wanted.current) { try { spawn(); } catch { wanted.current = false; setState((s) => ({ ...s, listening: false })); } } else setState((s) => ({ ...s, listening: false, interim: '' }));
    };
    rec.current = r;
    r.start();
  }, [lang]);

  const start = React.useCallback(() => {
    if (!ctor() || wanted.current) return;
    wanted.current = true; startedAt.current = Date.now();
    setState({ listening: true, interim: '', error: '' });
    try { spawn(); } catch { wanted.current = false; setState({ listening: false, interim: '', error: PROBLEMS.other }); }
  }, [spawn]);

  // Returns how many seconds were spent listening this time.
  const stop = React.useCallback(() => {
    if (!wanted.current) return 0;
    wanted.current = false;
    try { rec.current && rec.current.stop(); } catch { /* already stopped */ }
    setState((s) => ({ ...s, listening: false, interim: '' }));
    return Math.round((Date.now() - startedAt.current) / 1000);
  }, []);

  React.useEffect(() => () => { wanted.current = false; try { rec.current && rec.current.abort(); } catch { /* gone */ } }, []);

  return { supported: speechSupported(), ...state, start, stop };
}

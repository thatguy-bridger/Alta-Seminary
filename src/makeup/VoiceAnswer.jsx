import React from 'react';
import { useSpeech } from './useSpeech.js';
import { formatDuration } from './effort.js';

// One answer, spoken. The words appear as the browser hears them. The box cannot be typed in or pasted into:
// to fix a mistake, the student speaks it again ("Start again").
export function VoiceAnswer({ id, label, value, onAppend, onClear, seconds, onSeconds, onListening, children }) {
  const { listening, interim, error, start, stop } = useSpeech({ onFinal: onAppend });
  React.useEffect(() => { onListening && onListening(listening); }, [listening]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = () => { const s = stop(); if (s) onSeconds(seconds + s); };
  const again = () => { onClear(); onSeconds(0); };

  return (
    <div className="mw-field">
      <label id={`${id}-l`}>{label}</label>
      {children}
      <div id={id} className={`mw-say${listening ? ' live' : ''}`} role="textbox" aria-readonly="true" aria-labelledby={`${id}-l`} aria-live="polite" tabIndex={0}>
        {value || interim
          ? <>{value}{interim ? <span className="mw-interim">{value ? ' ' : ''}{interim}</span> : null}</>
          : <span className="mw-ph">Tap Speak, then say your answer out loud.</span>}
      </div>
      <div className="mw-row" style={{ alignItems: 'center' }}>
        {listening
          ? <button type="button" className="mw-cta" onClick={finish}><span className="mw-recdot" aria-hidden="true" />Done</button>
          : <button type="button" className="mw-cta" onClick={start}>{value ? 'Add more' : 'Speak'}</button>}
        {value && !listening && <button type="button" className="mw-ghost" onClick={again}>Start again</button>}
        {seconds > 0 && <span className="mw-fine">Spoke for {formatDuration(seconds)}</span>}
      </div>
      {error && <p className="mw-err" role="alert">{error}</p>}
    </div>
  );
}

import React from 'react';
import { findRefs, refLabel } from './scriptureRefs.js';

// Scripture references in a lesson ("Ezekiel 4:22") become buttons that open the verse in a pop-up over the lesson, closed the same
// way the notes are. Outside a ScriptureContext (a preview, a test) text is shown as it is.
export const ScriptureContext = React.createContext(null);

export function Linked({ text }) {
  const open = React.useContext(ScriptureContext);
  const str = String(text ?? '');
  if (!open) return str;
  const parts = findRefs(str);
  if (!parts.some((p) => p.ref)) return str;
  return parts.map((p, i) => (p.ref
    ? <button key={i} type="button" className="mw-ref" aria-label={`Open ${refLabel(p.ref)}`} onClick={(e) => { e.stopPropagation(); open(p.ref, e.currentTarget); }}>{p.text}</button>
    : <React.Fragment key={i}>{p.text}</React.Fragment>));
}

// The pop-up: the chapter, with the verse(s) asked for marked and brought into view.
export function ScriptureModal({ refObj, load, onClose }) {
  const [state, setState] = React.useState({ status: 'loading', data: null, error: '' });
  const closeBtn = React.useRef(null);
  const box = React.useRef(null);
  const key = refObj ? refLabel(refObj) : '';
  React.useEffect(() => {
    if (!refObj) return undefined;
    let live = true;
    setState({ status: 'loading', data: null, error: '' });
    Promise.resolve().then(() => load(refObj.book, refObj.chapter))
      .then((data) => { if (live) setState({ status: 'ready', data, error: '' }); })
      .catch((e) => { if (live) setState({ status: 'error', data: null, error: e?.message || 'That could not be loaded.' }); });
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { if (refObj && closeBtn.current) closeBtn.current.focus({ preventScroll: true }); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {   // bring the asked-for verse into view once the chapter is there
    if (state.status !== 'ready' || !refObj?.from || !box.current) return;
    const el = box.current.querySelector('.mw-sv.on');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
  }, [state.status, key]);
  if (!refObj) return null;
  const { from, to } = refObj;
  const verses = state.data?.verses || [];
  const last = verses.length ? verses[verses.length - 1].n : 0;
  const missing = state.status === 'ready' && from && from > last;
  return (
    <div className="mw-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="mw-scrip" role="dialog" aria-label={key} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}>
        <div className="mw-notes-head">
          <h3>{key}</h3>
          <button ref={closeBtn} type="button" className="mw-notes-x" aria-label="Close" onClick={onClose}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
        </div>
        <div className="mw-scrip-body" ref={box}>
          {state.status === 'loading' && <p className="mw-fine" role="status">Opening…</p>}
          {state.status === 'error' && <p className="mw-err" role="alert">{state.error}</p>}
          {missing && <p className="mw-fine" role="status">{state.data.reference} has {last} verse{last === 1 ? '' : 's'}, so verse {from} is not there. Here is the chapter.</p>}
          {state.status === 'ready' && verses.map((v) => (
            <p key={v.n} className={`mw-sv${from && v.n >= from && v.n <= to ? ' on' : ''}`}><b>{v.n}</b> {v.text}</p>
          ))}
        </div>
      </section>
    </div>
  );
}

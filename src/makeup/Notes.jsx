import React from 'react';
import { wordCount } from './journey.js';

// A notebook that stays with the student through every step. The button lives in the header on every screen; the panel opens
// over whatever they are doing (a video keeps playing underneath), and what they write is kept with the rest of their
// progress. Notes are theirs: they are never sent to the teacher, and they are not an answer, so this is a plain box
// (pasting into it is fine) and is not watched by the effort signal.

// The first time a student presses Begin on a device, the notes button is pointed out (a soft pulse and one line), once.
// The memory is separate from the saved place, so finishing or starting over does not bring it back.
const HINT_KEY = 'alta-makeup-notes-hint';
export function takeNotesHint(store) {
  if (!store) return false;                                    // no storage: cannot remember, so never nag
  try { if (store.getItem(HINT_KEY)) return false; store.setItem(HINT_KEY, '1'); return true; } catch { return false; }
}

export function NotesButton({ open, hasNotes, hint = false, onToggle }) {
  return (
    <span className="mw-notewrap">
      <button type="button" className={`mw-tbtn mw-notesbtn${hint ? ' mw-hint' : ''}`} aria-expanded={open} aria-controls="mw-notes" aria-label={hasNotes ? 'My notes (you have notes)' : 'My notes'} onClick={onToggle}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h11l3 3v13H5z" /><path d="M8 11h8M8 15h6" /></svg>
        {hasNotes && <i className="mw-dot" aria-hidden="true" />}
      </button>
      {hint && !open && <span className="mw-hint-tip" role="status">Take notes here. They stay with you on every step.</span>}
    </span>
  );
}

export function NotesPanel({ open, value, onChange, onClose, onCopied, saved = false }) {
  const box = React.useRef(null);
  const wasOpen = React.useRef(false);
  React.useEffect(() => {
    if (open && !wasOpen.current) box.current && box.current.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);
  if (!open) return null;
  const words = wordCount(value);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); onCopied && onCopied('Copied your notes.'); } catch { onCopied && onCopied('Copying is not available here. Select the text to copy it.'); }
  };
  return (
    <section id="mw-notes" className="mw-notes" role="dialog" aria-label="My notes" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}>
      <div className="mw-notes-head">
        <h3>My notes</h3>
        <button type="button" className="mw-notes-x" aria-label="Close my notes" onClick={onClose}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
      <textarea ref={box} className="mw-notes-box" aria-label="My notes" placeholder="Write down anything you want to remember. Your notes stay with you on every step." value={value} maxLength={30000}
        onChange={(e) => onChange(e.target.value)} />
      <div className="mw-notes-foot">
        <span className="mw-fine" aria-live="polite">{words ? `${words} word${words === 1 ? '' : 's'} · ` : ''}Only you can see these.{saved ? ' Saved on this device.' : ''}</span>
        <button type="button" className="mw-ghost" disabled={!value.trim()} onClick={copy}>Copy</button>
      </div>
    </section>
  );
}

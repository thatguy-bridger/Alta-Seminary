import React from 'react';
import { RULES } from './journey.js';

// Watches one writing box and keeps the numbers analyzeEffort() needs. It
// records COUNTS and TIMES, never what was typed key by key. Spread
// `tracker.props` onto the <textarea>; call `tracker.snapshot()` on submit.
export function useEffortTracker({ onBlocked } = {}) {
  const stats = React.useRef({ pastes: 0, jumps: 0, activeMs: 0, typedChars: 0, leaves: 0 });
  const last = React.useRef(0);
  const prevLen = React.useRef({}); // per field, so two boxes do not confuse each other

  // Only count time while the student is actually writing: gaps over 4s are pauses.
  const touch = React.useCallback(() => {
    const now = Date.now();
    if (last.current && now - last.current < 4000) stats.current.activeMs += now - last.current;
    last.current = now;
  }, []);

  React.useEffect(() => {
    const onHide = () => { if (document.hidden) stats.current.leaves += 1; };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  const block = (kind) => (e) => {
    e.preventDefault();
    if (kind !== 'menu') stats.current.pastes += 1;
    if (onBlocked) onBlocked(kind);
  };

  // Spread onto a <textarea> or <input>; `key` names the field.
  const fieldProps = (key) => ({
    onPaste: block('paste'),
    onDrop: block('drop'),
    onContextMenu: block('menu'),
    onKeyDown: touch,
    onChange: (e) => {
      const len = e.target.value.length;
      const grew = len - (prevLen.current[key] || 0);
      if (grew > RULES.jumpChars) stats.current.jumps += 1;
      if (grew > 0) stats.current.typedChars += grew;
      prevLen.current[key] = len;
      touch();
    },
  });

  return {
    fieldProps,
    props: fieldProps('default'),
    snapshot: () => ({ ...stats.current }),
    addActive: (ms) => { stats.current.activeMs += ms; },
  };
}

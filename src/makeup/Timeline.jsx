import React from 'react';
import { timelineParts, skippedRanges, summarize, COLORS } from './playback.js';

// A recording or video as one bar: green where it was played, red where it was skipped, grey where the student has not got
// to yet, and a thin marker where the playhead is. Inline styles on purpose, so the same bar reads the same on the student's
// page and in the teacher's admin. Its label says it all in words, for anyone who cannot see the colors.
export const TIMELINE_COLORS = COLORS;

// `onJump(part)` makes each red part tappable (the student's page); without it the bar is only to look at (the teacher's). A tiny red
// part would be too small to hit, so each has a larger invisible target, centred on it, and the bar itself is never distorted.
export function Timeline({ duration, seen, reached, played = 0, time, height = 10, onJump, jumpLabel }) {
  const parts = timelineParts(seen, reached, duration);
  if (!parts.length) return null;
  const total = parts[parts.length - 1].to;
  const label = summarize({ duration: total, played, skipped: skippedRanges(seen, reached, total) });
  return (
    <div className="mw-tl-box" style={{ position: 'relative' }}>
      <div className="mw-tl" role="img" aria-label={label} style={{ position: 'relative', display: 'flex', height, borderRadius: height / 2, overflow: 'hidden', background: TIMELINE_COLORS.ahead, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
        {parts.map((p) => <span key={`${p.kind}-${p.from}`} data-kind={p.kind} style={{ flex: `0 0 ${((p.to - p.from) / total) * 100}%`, background: TIMELINE_COLORS[p.kind] }} />)}
        {Number.isFinite(time) && time >= 0 && <i className="mw-tl-head" style={{ position: 'absolute', top: 0, bottom: 0, left: `${Math.min(100, (time / total) * 100)}%`, width: 2, marginLeft: -1, background: '#fff', opacity: 0.92 }} />}
      </div>
      {onJump && parts.filter((p) => p.kind === 'skipped').map((p) => (
        <button key={`hit-${p.from}`} type="button" className="mw-tl-hit" data-from={p.from} aria-label={jumpLabel ? jumpLabel(p) : 'Play the skipped part'} title={jumpLabel ? jumpLabel(p) : 'Play the skipped part'}
          onClick={() => onJump(p)}
          style={{ position: 'absolute', top: -9, height: height + 18, left: `${(((p.from + p.to) / 2) / total) * 100}%`, width: `max(${((p.to - p.from) / total) * 100}%, 22px)`, transform: 'translateX(-50%)', background: 'transparent', border: 0, padding: 0, cursor: 'pointer' }} />
      ))}
    </div>
  );
}

// What the colors mean, for the student.
export function TimelineKey() {
  const dot = (k) => <i aria-hidden="true" style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 5, background: TIMELINE_COLORS[k], marginRight: 5, verticalAlign: -1 }} />;
  return <span className="mw-tl-key">{dot('played')}Played {dot('skipped')}Skipped {dot('ahead')}Still to come</span>;
}

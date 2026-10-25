import React from 'react';
import { Button } from '../../../design-system/components/forms/Button.jsx';
import { PAUSE_MAX } from '../../../makeup/pauses.js';
import { parseLength } from '../../../makeup/lessonsModel.js';
import { activeIndex } from '../../../makeup/transcript.js';

const excerpt = (t, n = 56) => (t.length > n ? `${t.slice(0, n).trim()}…` : t);

// Questions that appear at a chosen moment of a lesson. For reading, "after paragraph N"; for video and audio, a time.
// The student answers in a few words and the answer goes to the teacher.
export function PauseEditor({ isText, pauses, onChange, paragraphs = [], segments = [], error }) {
  const update = (i, patch) => onChange(pauses.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  const add = () => onChange([...pauses, { at: isText ? String(Math.min(paragraphs.length || 1, pauses.length + 1)) : '', question: '' }]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <p className="ls-help">
        A question pops up at the moment you choose. {isText ? 'The student reads on after answering.' : 'The video or audio pauses, and carries on after the student answers.'} Their answer is included in the email to the teacher. Up to {PAUSE_MAX} per lesson.
      </p>
      {pauses.length === 0 && <p className="ls-help">No questions yet.</p>}
      {pauses.map((p, i) => {
        const t = isText ? null : parseLength(p.at);
        const idx = !isText && t !== null && segments.length ? activeIndex(segments, t) : -1;
        return (
          <div className="ls-pause" key={i}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {isText ? (
                <label className="ls-lbl">Show after paragraph
                  {paragraphs.length ? (
                    <select className="select" value={p.at} onChange={(e) => update(i, { at: e.target.value })}>
                      {p.at && !paragraphs[Number(p.at) - 1] && <option value={p.at}>{p.at} (does not exist)</option>}
                      {paragraphs.map((para, k) => <option key={k} value={String(k + 1)}>{k + 1}. {excerpt(para)}</option>)}
                    </select>
                  ) : <input className="input" inputMode="numeric" value={p.at} onChange={(e) => update(i, { at: e.target.value })} placeholder="2" />}
                </label>
              ) : (
                <>
                  <label className="ls-lbl">At this time
                    <input className="input" value={p.at} onChange={(e) => update(i, { at: e.target.value })} placeholder="2:30" />
                  </label>
                  {idx >= 0 && <p className="ls-help">Around: “{excerpt(segments[idx].text, 70)}”</p>}
                </>
              )}
            </div>
            <label className="ls-lbl">The question
              <textarea className="input" rows={2} value={p.question} onChange={(e) => update(i, { question: e.target.value })} placeholder="What does this ask of you?" />
            </label>
            <Button variant="ghost" size="sm" onClick={() => onChange(pauses.filter((_, k) => k !== i))}>Remove</Button>
          </div>
        );
      })}
      {error && <p className="ls-err" role="alert">{error}</p>}
      <div><Button variant="outline" size="sm" disabled={pauses.length >= PAUSE_MAX} onClick={add}>Add a question</Button></div>
    </div>
  );
}

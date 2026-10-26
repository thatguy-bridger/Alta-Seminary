import React from 'react';
import { supabaseBrowser } from '../../lib/supabase/browser-client';
import { Card } from '../../design-system/components/core/Card.jsx';
import { Button } from '../../design-system/components/forms/Button.jsx';
import { Select } from '../../design-system/components/forms/Select.jsx';
import { formatDuration } from '../../makeup/effort.js';
import { REVIEW, reviewOf, filterSubmissions, effortOf, learnedBy, emailState, emailMessage, submissionsCsv, pauseLines, playbackOf } from '../../makeup/review.js';
import { Timeline, TimelineKey } from '../../makeup/Timeline.jsx';

const small = { fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)', margin: 0 };
const badge = (tone) => ({ display: 'inline-block', padding: '1px 8px', borderRadius: 999, fontSize: 'var(--fs-caption)', border: `1px solid ${tone}`, color: tone });
const TONE = { new: 'var(--text-muted)', accepted: 'var(--color-success)', redo: 'var(--color-warning)' };

// One submission, written out for the printed record.
function PrintRecord({ s }) {
  const e = effortOf(s);
  return (
    <section style={{ breakInside: 'avoid', borderBottom: '1px solid #999', padding: '12px 0', fontFamily: 'Georgia, serif', color: '#000' }}>
      <h3 style={{ margin: 0 }}>{s.student_name} · {s.class_name}</h3>
      <p style={{ margin: '2px 0 8px', fontSize: 13 }}>{new Date(s.created_at).toLocaleDateString()} · covers {s.days_total} day{s.days_total > 1 ? 's' : ''} · {learnedBy(s)} · {formatDuration(s.active_seconds || 0)} active · {REVIEW[reviewOf(s)]}</p>
      {s.truth && <p style={{ margin: '4px 0' }}><b>Truth{s.truth_ref ? ` (${s.truth_ref})` : ''}:</b> {s.truth}</p>}
      {pauseLines(s).map((a, i) => <p key={i} style={{ margin: '4px 0' }}><b>While studying{a.lesson ? ` (${a.lesson}, ${a.where})` : ''}:</b> {a.question} {a.answer}</p>)}
      {playbackOf(s).map((p, i) => <p key={`p${i}`} style={{ margin: '4px 0' }}><b>Played{p.kind ? ` (${p.kind})` : ''}:</b> {p.title}. {p.summary}</p>)}
      {s.understanding && <p style={{ margin: '4px 0' }}><b>Could help someone their age:</b> {s.understanding}</p>}
      <p style={{ margin: '4px 0' }}><b>Why it matters to them{s.mode === 'voice' ? ' (spoken)' : ''}:</b> {s.response}</p>
      <p style={{ margin: '4px 0' }}><b>Will do{s.commit_kind ? ` (${s.commit_kind})` : ''}:</b> {s.commitment}{s.blessing ? ` It will bless their life: ${s.blessing}` : ''}</p>
      <p style={{ margin: '4px 0', fontSize: 13 }}>{e.label}: {e.reasons.join(' ')}</p>
      {s.review_note && <p style={{ margin: '4px 0', fontSize: 13 }}><b>Note:</b> {s.review_note}</p>}
    </section>
  );
}

// What came in: filter by class and review status, read each one, accept it or ask for it to be redone, see whether the
// teacher was emailed (and email again), print a record, download a spreadsheet, delete one.
export function MakeupSubmissions({ subs, reload, flash }) {
  const [cls, setCls] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [notes, setNotes] = React.useState({});     // note being typed, by submission id
  const shown = filterSubmissions(subs, { cls, status });
  const classNames = [...new Set(subs.map((s) => s.class_name))].sort();
  const newCount = subs.filter((s) => reviewOf(s) === 'new').length;
  const noteFor = (s) => notes[s.id] ?? s.review_note ?? '';

  async function review(s, next) {
    const note = noteFor(s).trim();
    const { error } = await supabaseBrowser.from('makeup_submissions').update({ review_status: next, review_note: note || null, reviewed_at: next === 'new' ? null : new Date().toISOString() }).eq('id', s.id);
    if (error) flash(`Couldn't save: ${error.message}`); else { flash(next === 'redo' ? 'Marked as needing a redo.' : next === 'accepted' ? 'Accepted.' : 'Marked as new.'); await reload(); }
  }
  async function sendNow(s) {
    const { data, error } = await supabaseBrowser.functions.invoke('makeup-notify', { body: { submission_id: s.id } });
    flash(emailMessage(data?.status || (error ? 'error' : ''), data?.error || error?.message));
    await reload();
  }
  async function remove(s) {
    if (!window.confirm(`Delete ${s.student_name}'s submission for ${s.class_name}? This cannot be undone.`)) return;
    const { error } = await supabaseBrowser.from('makeup_submissions').delete().eq('id', s.id);
    if (error) flash(`Couldn't delete: ${error.message}`); else { flash('Deleted.'); await reload(); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([submissionsCsv(shown)], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'makeup-work.csv'; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <Card title={`Submissions (${subs.length}${newCount ? `, ${newCount} new` : ''})`}>
      <style>{'#makeup-print{display:none}@media print{body *{visibility:hidden!important}#makeup-print,#makeup-print *{visibility:visible!important}#makeup-print{display:block!important;position:absolute;left:0;top:0;width:100%}}'}</style>
      <p style={small}>Mark each one Accepted, or Needs redo with a note about what to fix. The note is for your records; students have no account here, so tell them in person. Submissions are kept for 90 days.</p>
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end', margin: 'var(--space-3) 0' }}>
        <div style={{ flex: '1 1 160px' }}><Select label="Class" value={cls} onChange={(e) => setCls(e.target.value)} options={[{ value: '', label: 'All classes' }, ...classNames.map((c) => ({ value: c, label: c }))]} /></div>
        <div style={{ flex: '1 1 160px' }}><Select label="Review" value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: '', label: 'All' }, ...Object.entries(REVIEW).map(([value, label]) => ({ value, label }))]} /></div>
        <Button variant="outline" size="sm" onClick={download} disabled={!shown.length}>Download as spreadsheet (CSV)</Button>
        <Button variant="outline" size="sm" onClick={() => window.print()} disabled={!shown.length}>Print these</Button>
      </div>
      {subs.length === 0 && <p style={small}>Nothing yet.</p>}
      {subs.length > 0 && shown.length === 0 && <p style={small}>Nothing matches those filters.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {shown.map((s) => {
          const e = effortOf(s);
          const mail = emailState(s);
          const r = reviewOf(s);
          return (
            <details key={s.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)' }}>
              <summary style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
                <strong>{s.student_name}</strong><span>· {s.class_name} · {new Date(s.created_at).toLocaleDateString()}</span>
                <span style={{ color: e.ok ? 'var(--color-success)' : 'var(--color-warning)' }}>{e.label}</span>
                <span style={badge(TONE[r])}>{REVIEW[r]}</span>
                {!s.notified_at && <span style={badge('var(--color-warning)')}>Not emailed</span>}
              </summary>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', paddingTop: 'var(--space-2)' }}>
                <div style={small}>Covers {s.days_total} day{s.days_total > 1 ? 's' : ''} · {learnedBy(s).replace(/; /g, ', ')} · {formatDuration(s.active_seconds || 0)} active{s.mode === 'voice' ? ` · spoken (${formatDuration(s.voice_seconds || 0)})` : ''}</div>
                {s.truth && <div><em>Truth{s.truth_ref ? ` (${s.truth_ref})` : ''}:</em> {s.truth}</div>}
                {pauseLines(s).length > 0 && <div><em>Questions while studying:</em>{pauseLines(s).map((a, i) => <div key={i} style={{ marginLeft: 'var(--space-3)' }}><span style={small}>{a.question}{a.lesson ? ` (${a.lesson}, ${a.where})` : ''}</span><br />{a.answer}</div>)}</div>}
                {playbackOf(s).length > 0 && (
                  <div className="mk-played"><em>What they played:</em>
                    {playbackOf(s).map((p, i) => (
                      <div key={i} style={{ marginLeft: 'var(--space-3)', marginTop: 6, maxWidth: 560 }}>
                        <span style={small}>{p.title}{p.kind ? ` (${p.kind})` : ''}: {p.summary}</span>
                        <div style={{ marginTop: 4 }}><Timeline duration={p.duration} seen={p.seen} reached={p.reached} played={p.played} /></div>
                      </div>
                    ))}
                    <div style={{ ...small, marginLeft: 'var(--space-3)', marginTop: 4 }}><TimelineKey /></div>
                  </div>
                )}
                {s.understanding && <div style={{ whiteSpace: 'pre-wrap' }}><em>Could help someone their age:</em> {s.understanding}</div>}
                <div style={{ whiteSpace: 'pre-wrap' }}><em>Why it matters to them:</em> {s.response}</div>
                <div><em>Will do{s.commit_kind ? ` (${s.commit_kind})` : ''}:</em> {s.commitment}{s.blessing ? ` — it will bless their life: ${s.blessing}` : ''}</div>
                <div style={small}>{e.reasons.join(' · ')}</div>
                <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ ...small, color: mail.sent ? 'var(--color-success)' : 'var(--color-warning)' }}>{mail.text}</span>
                  <Button variant="outline" size="sm" onClick={() => sendNow(s)}>{mail.sent ? 'Send again' : 'Send now'}</Button>
                </div>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, ...small }}>
                  Note (for your records)
                  <textarea className="input" rows={2} value={noteFor(s)} onChange={(ev) => setNotes({ ...notes, [s.id]: ev.target.value })} placeholder="For a redo: what to fix." />
                </label>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <Button variant="secondary" size="sm" disabled={r === 'accepted' && noteFor(s).trim() === (s.review_note || '')} onClick={() => review(s, 'accepted')}>{r === 'accepted' ? 'Save note' : 'Accept'}</Button>
                  <Button variant="outline" size="sm" disabled={noteFor(s).trim().length < 3} onClick={() => review(s, 'redo')}>Needs redo</Button>
                  {r !== 'new' && <Button variant="ghost" size="sm" onClick={() => review(s, 'new')}>Mark as new</Button>}
                  <Button variant="ghost" size="sm" onClick={() => remove(s)}>Delete</Button>
                </div>
              </div>
            </details>
          );
        })}
      </div>
      <div id="makeup-print" aria-hidden="true">
        <h2 style={{ fontFamily: 'Georgia, serif', margin: '0 0 8px' }}>Alta Seminary makeup work{cls ? `: ${cls}` : ''}</h2>
        {shown.map((s) => <PrintRecord key={s.id} s={s} />)}
      </div>
    </Card>
  );
}

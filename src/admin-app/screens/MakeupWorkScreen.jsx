import React from 'react';
import { supabaseBrowser } from '../../lib/supabase/browser-client';
import { Card } from '../../design-system/components/core/Card.jsx';
import { Button } from '../../design-system/components/forms/Button.jsx';
import { Input } from '../../design-system/components/forms/Input.jsx';
import { Select } from '../../design-system/components/forms/Select.jsx';
import { Switch } from '../../design-system/components/forms/Switch.jsx';
import { InfoButton } from '../guide/InfoButton.jsx';
import { analyzeEffort, formatDuration } from '../../makeup/effort.js';

const KINDS = [
  { value: 'scripture', label: 'Scripture' }, { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' }, { value: 'talk', label: 'Conference talk / article' },
  { value: 'lesson', label: 'Self-guided lesson' }, { value: 'podcast', label: 'Podcast' },
  { value: 'proclamation', label: 'In-depth study (e.g. a Proclamation)' },
];
const row = { display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end' };
const grow = (n) => ({ flex: `${n} 1 180px`, minWidth: 0 });

// Admin side of Makeup Work: who gets the emails (classes), what students can
// learn from (sources), and what has come in. Independent of how the student
// journey looks.
export function MakeupWorkScreen() {
  const [classes, setClasses] = React.useState(null);
  const [sources, setSources] = React.useState(null);
  const [subs, setSubs] = React.useState(null);
  const [enabled, setEnabled] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const [newClass, setNewClass] = React.useState({ name: '', teacher_name: '', teacher_email: '', code: '' });
  const [newSource, setNewSource] = React.useState({ kind: 'scripture', title: '', reference: '', embed_url: '', minutes: 6, one_time: false });

  const load = React.useCallback(async () => {
    const [c, s, u, st] = await Promise.all([
      supabaseBrowser.from('makeup_classes').select('*').order('sort_order').order('name'),
      supabaseBrowser.from('makeup_sources').select('*').order('sort_order').order('title'),
      supabaseBrowser.from('makeup_submissions').select('*').order('created_at', { ascending: false }).limit(100),
      supabaseBrowser.from('site_settings').select('makeup_work_enabled').eq('id', true).maybeSingle(),
    ]);
    setClasses(c.data || []); setSources(s.data || []); setSubs(u.data || []); setEnabled(!!st.data?.makeup_work_enabled);
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };
  async function run(promise, ok) { const { error } = await promise; if (error) flash(`Couldn't save: ${error.message}`); else { flash(ok); await load(); } }

  const addClass = () => run(supabaseBrowser.from('makeup_classes').insert({ ...newClass, code: newClass.code || null, teacher_name: newClass.teacher_name || null }).then((r) => { if (!r.error) setNewClass({ name: '', teacher_name: '', teacher_email: '', code: '' }); return r; }), 'Class added.');
  const addSource = () => run(supabaseBrowser.from('makeup_sources').insert({ ...newSource, reference: newSource.reference || null, embed_url: newSource.embed_url || null }).then((r) => { if (!r.error) setNewSource({ kind: 'scripture', title: '', reference: '', embed_url: '', minutes: 6, one_time: false }); return r; }), 'Source added.');

  function exportCsv() {
    const head = ['When', 'Student', 'Class', 'Days covered', 'Learned by', 'Truth', 'Where', 'Understanding', 'Why it matters', 'Commitment', 'Blessing', 'Active time', 'Signal'];
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = (subs || []).map((s) => {
      const e = analyzeEffort({ mode: s.mode, text: s.response, voiceSeconds: s.voice_seconds, stats: { pastes: s.paste_attempts, jumps: s.sudden_jumps, activeMs: s.active_seconds * 1000, typedChars: s.typed_chars, leaves: s.page_leaves } });
      return [new Date(s.created_at).toLocaleString(), s.student_name, s.class_name, s.days_total, (s.source_titles?.length ? s.source_titles.join('; ') : s.source_title), s.truth, s.truth_ref, s.understanding, s.mode === 'voice' ? '(voice)' : s.response, s.commitment, s.blessing, formatDuration(s.active_seconds), e.label].map(q).join(',');
    });
    const url = URL.createObjectURL(new Blob([[head.map(q).join(','), ...lines].join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'makeup-work.csv'; a.click(); URL.revokeObjectURL(url);
  }

  if (!classes || !sources || !subs) return <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>;
  const small = { fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)', margin: 0 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <Card title={<>Makeup Work <InfoButton feature="makeup" /></>}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontFamily: 'var(--font-sans)' }}>
          <Switch checked={enabled} onChange={async (e) => { setEnabled(e.target.checked); await supabaseBrowser.from('site_settings').update({ makeup_work_enabled: e.target.checked }).eq('id', true); }} />
          Makeup Work is open to students
        </label>
        {msg && <p role="status" style={{ ...small, marginTop: 'var(--space-3)' }}>{msg}</p>}
      </Card>

      <Card title="Classes and who gets the email">
        <p style={small}>Each submission is emailed to the class's teacher. A class code is optional; if you set one, students must enter it to submit.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', margin: 'var(--space-3) 0' }}>
          {classes.length === 0 && <p style={small}>No classes yet. Add one below.</p>}
          {classes.map((c) => (
            <div key={c.id} style={{ ...row, alignItems: 'center', padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div style={grow(2)}><strong>{c.name}</strong><div style={small}>{c.teacher_name ? `${c.teacher_name} · ` : ''}{c.teacher_email}{c.code ? ` · code: ${c.code}` : ''}</div></div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--fs-small)' }}>
                <Switch checked={c.active} onChange={(e) => run(supabaseBrowser.from('makeup_classes').update({ active: e.target.checked }).eq('id', c.id), 'Updated.')} /> Active
              </label>
              <Button variant="ghost" size="sm" onClick={() => run(supabaseBrowser.from('makeup_classes').delete().eq('id', c.id), 'Class removed.')}>Remove</Button>
            </div>
          ))}
        </div>
        <div style={row}>
          <div style={grow(1)}><Input label="Class name" value={newClass.name} onChange={(e) => setNewClass({ ...newClass, name: e.target.value })} placeholder="Period 2" /></div>
          <div style={grow(1)}><Input label="Teacher name" value={newClass.teacher_name} onChange={(e) => setNewClass({ ...newClass, teacher_name: e.target.value })} /></div>
          <div style={grow(2)}><Input label="Teacher email" value={newClass.teacher_email} onChange={(e) => setNewClass({ ...newClass, teacher_email: e.target.value })} /></div>
          <div style={grow(1)}><Input label="Class code (optional)" value={newClass.code} onChange={(e) => setNewClass({ ...newClass, code: e.target.value })} /></div>
          <Button variant="secondary" disabled={!newClass.name.trim() || !/.+@.+\..+/.test(newClass.teacher_email)} onClick={addClass}>Add class</Button>
        </div>
      </Card>

      <Card title="Sources students can learn from">
        <p style={small}>Scripture and talks can carry text for the built-in reader; videos and audio use an embed address.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', margin: 'var(--space-3) 0' }}>
          {sources.length === 0 && <p style={small}>No sources yet. Add one below.</p>}
          {sources.map((s) => (
            <div key={s.id} style={{ ...row, alignItems: 'center', padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div style={grow(2)}><strong>{s.title}</strong><div style={small}>{KINDS.find((k) => k.value === s.kind)?.label} · {s.minutes} min{s.reference ? ` · ${s.reference}` : ''}{s.one_time ? ' · once per student' : ''}</div></div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--fs-small)' }}>
                <Switch checked={s.active} onChange={(e) => run(supabaseBrowser.from('makeup_sources').update({ active: e.target.checked }).eq('id', s.id), 'Updated.')} /> Shown
              </label>
              <Button variant="ghost" size="sm" onClick={() => run(supabaseBrowser.from('makeup_sources').delete().eq('id', s.id), 'Source removed.')}>Remove</Button>
            </div>
          ))}
        </div>
        <div style={row}>
          <div style={grow(1)}><Select label="Type" value={newSource.kind} onChange={(e) => setNewSource({ ...newSource, kind: e.target.value })} options={KINDS} /></div>
          <div style={grow(2)}><Input label="Title" value={newSource.title} onChange={(e) => setNewSource({ ...newSource, title: e.target.value })} /></div>
          <div style={grow(1)}><Input label="Reference (optional)" value={newSource.reference} onChange={(e) => setNewSource({ ...newSource, reference: e.target.value })} placeholder="1 Nephi 3:7" /></div>
          <div style={grow(2)}><Input label="Embed address (video/audio)" value={newSource.embed_url} onChange={(e) => setNewSource({ ...newSource, embed_url: e.target.value })} placeholder="https://…" /></div>
          <div style={{ flex: '0 1 90px' }}><Input label="Minutes" type="number" value={newSource.minutes} onChange={(e) => setNewSource({ ...newSource, minutes: Number(e.target.value) || 6 })} /></div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--fs-small)' }}><Switch checked={newSource.one_time} onChange={(e) => setNewSource({ ...newSource, one_time: e.target.checked })} /> Once per student</label>
          <Button variant="secondary" disabled={!newSource.title.trim()} onClick={addSource}>Add source</Button>
        </div>
      </Card>

      <Card title={`Recent submissions (${subs.length})`}>
        <div style={{ marginBottom: 'var(--space-3)' }}><Button variant="outline" size="sm" onClick={exportCsv} disabled={!subs.length}>Download as spreadsheet (CSV)</Button></div>
        {subs.length === 0 && <p style={small}>Nothing yet. Submissions are kept for 90 days.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {subs.map((s) => {
            const e = analyzeEffort({ mode: s.mode, text: s.response, voiceSeconds: s.voice_seconds, stats: { pastes: s.paste_attempts, jumps: s.sudden_jumps, activeMs: s.active_seconds * 1000, typedChars: s.typed_chars, leaves: s.page_leaves } });
            return (
              <details key={s.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)' }}>
                <summary style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  <strong>{s.student_name}</strong> · {s.class_name} · {new Date(s.created_at).toLocaleDateString()} · <span style={{ color: e.ok ? 'var(--color-success)' : 'var(--color-warning)' }}>{e.label}</span>
                </summary>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', paddingTop: 'var(--space-2)' }}>
                  <div style={small}>Covers {s.days_total} day{s.days_total > 1 ? 's' : ''} · {(s.source_titles?.length ? s.source_titles.join(', ') : s.source_title) || 'a lesson'} · {formatDuration(s.active_seconds)} active{s.notified_at ? '' : ' · not emailed'}</div>
                  {s.truth && <div><em>Truth{s.truth_ref ? ` (${s.truth_ref})` : ''}:</em> {s.truth}</div>}
                  {s.understanding && <div style={{ whiteSpace: 'pre-wrap' }}><em>Could help someone their age:</em> {s.understanding}</div>}
                  <div style={{ whiteSpace: 'pre-wrap' }}><em>Why it matters to them:</em> {s.mode === 'voice' ? `(Spoken response, ${formatDuration(s.voice_seconds)})` : s.response}</div>
                  <div><em>Will do{s.commit_kind ? ` (${s.commit_kind})` : ''}:</em> {s.commitment}{s.blessing ? ` — it will bless their life: ${s.blessing}` : ''}</div>
                  <div style={small}>{e.reasons.join(' · ')}</div>
                </div>
              </details>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

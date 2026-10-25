import React from 'react';
import { supabaseBrowser } from '../../lib/supabase/browser-client';
import { Card } from '../../design-system/components/core/Card.jsx';
import { Button } from '../../design-system/components/forms/Button.jsx';
import { Input } from '../../design-system/components/forms/Input.jsx';
import { Switch } from '../../design-system/components/forms/Switch.jsx';
import { withBase } from '../../lib/url.js';
import { typeTabs } from '../../makeup/lessonsModel.js';
import { MakeupOpenCard } from './MakeupOpenCard.jsx';
import { MakeupSubmissions } from './MakeupSubmissions.jsx';

const row = { display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end' };
const grow = (n) => ({ flex: `${n} 1 180px`, minWidth: 0 });
const small = { fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)', margin: 0 };
const EMAIL = /^\S+@\S+\.\S+$/;

// One class: who it is, who is emailed, and an Edit button (the class that comes ready-made has no teacher address yet).
function ClassRow({ c, run }) {
  const [draft, setDraft] = React.useState(null);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const ok = draft && draft.name.trim() && (!draft.teacher_email.trim() || EMAIL.test(draft.teacher_email.trim()));
  const save = () => run(supabaseBrowser.from('makeup_classes').update({ name: draft.name.trim(), teacher_name: draft.teacher_name.trim() || null, teacher_email: draft.teacher_email.trim() || null, code: draft.code.trim() || null }).eq('id', c.id).then((r) => { if (!r.error) setDraft(null); return r; }), 'Class saved.');
  return (
    <div style={{ padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
      <div style={{ ...row, alignItems: 'center' }}>
        <div style={grow(2)}>
          <strong>{c.name}</strong>
          <div style={small}>{c.teacher_name ? `${c.teacher_name} · ` : ''}{c.teacher_email || 'No teacher email yet, so no one is emailed for this class'}{c.code ? ` · code: ${c.code}` : ''}</div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--fs-small)' }}>
          <Switch checked={c.active} label={`${c.name} is active`} onChange={(e) => run(supabaseBrowser.from('makeup_classes').update({ active: e.target.checked }).eq('id', c.id), 'Updated.')} /> Active
        </label>
        <Button variant="outline" size="sm" onClick={() => setDraft(draft ? null : { name: c.name, teacher_name: c.teacher_name || '', teacher_email: c.teacher_email || '', code: c.code || '' })}>{draft ? 'Cancel' : 'Edit'}</Button>
        <Button variant="ghost" size="sm" onClick={() => { if (window.confirm(`Remove the class "${c.name}"? Students will no longer see it. Submissions already sent stay in the list.`)) run(supabaseBrowser.from('makeup_classes').delete().eq('id', c.id), 'Class removed.'); }}>Remove</Button>
      </div>
      {draft && (
        <div style={{ ...row, marginTop: 'var(--space-3)' }}>
          <div style={grow(1)}><Input label="Class name" value={draft.name} onChange={(e) => set({ name: e.target.value })} /></div>
          <div style={grow(1)}><Input label="Teacher name" value={draft.teacher_name} onChange={(e) => set({ teacher_name: e.target.value })} /></div>
          <div style={grow(2)}><Input label="Teacher email" value={draft.teacher_email} onChange={(e) => set({ teacher_email: e.target.value })} error={draft.teacher_email.trim() && !EMAIL.test(draft.teacher_email.trim()) ? 'That does not look like an email address.' : undefined} /></div>
          <div style={grow(1)}><Input label="Class code (optional)" value={draft.code} onChange={(e) => set({ code: e.target.value })} /></div>
          <Button variant="secondary" disabled={!ok} onClick={save}>Save class</Button>
        </div>
      )}
    </div>
  );
}

// Admin side of Makeup Work: opening it to students, the classes (who is emailed), a summary of the lessons with a way
// into the Lessons page, and what has come in.
export function MakeupWorkScreen() {
  const [classes, setClasses] = React.useState(null);
  const [lessons, setLessons] = React.useState(null);
  const [subs, setSubs] = React.useState(null);
  const [enabled, setEnabled] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const [newClass, setNewClass] = React.useState({ name: '', teacher_name: '', teacher_email: '', code: '' });

  const load = React.useCallback(async () => {
    const [c, l, u, st] = await Promise.all([
      supabaseBrowser.from('makeup_classes').select('*').order('sort_order').order('name'),
      supabaseBrowser.from('admin_makeup_lessons').select('id, kind, active, transcript_lines, body_words, embed_url, duration_seconds, reference').limit(2000),
      supabaseBrowser.from('makeup_submissions').select('*').order('created_at', { ascending: false }).limit(100),
      supabaseBrowser.from('site_settings').select('makeup_work_enabled').eq('id', true).maybeSingle(),
    ]);
    setClasses(c.data || []); setLessons(l.data || []); setSubs(u.data || []); setEnabled(!!st.data?.makeup_work_enabled);
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };
  async function run(promise, ok) { const { error } = await promise; if (error) flash(`Couldn't save: ${error.message}`); else { flash(ok); await load(); } }
  const addClass = () => run(supabaseBrowser.from('makeup_classes').insert({ name: newClass.name.trim(), code: newClass.code.trim() || null, teacher_name: newClass.teacher_name.trim() || null, teacher_email: newClass.teacher_email.trim() || null })
    .then((r) => { if (!r.error) setNewClass({ name: '', teacher_name: '', teacher_email: '', code: '' }); return r; }), 'Class added.');

  if (!classes || !lessons || !subs) return <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>;
  const tabs = typeTabs(lessons).filter((t) => t.value);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <MakeupOpenCard enabled={enabled} setEnabled={setEnabled} activeClasses={classes.filter((c) => c.active).length} shownLessons={lessons.filter((x) => x.active).length} flash={flash} msg={msg} />

      <Card title="Classes and who gets the email">
        <p style={small}>Each submission is emailed to the class's teacher. A class code is optional; if you set one, students must enter it to submit. A class with no teacher email still works; its submissions just are not emailed.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', margin: 'var(--space-3) 0' }}>
          {classes.length === 0 && <p style={small}>No classes yet. Add one below.</p>}
          {classes.map((c) => <ClassRow key={c.id} c={c} run={run} />)}
        </div>
        <div style={row}>
          <div style={grow(1)}><Input label="Class name" value={newClass.name} onChange={(e) => setNewClass({ ...newClass, name: e.target.value })} placeholder="Period 2" /></div>
          <div style={grow(1)}><Input label="Teacher name" value={newClass.teacher_name} onChange={(e) => setNewClass({ ...newClass, teacher_name: e.target.value })} /></div>
          <div style={grow(2)}><Input label="Teacher email" value={newClass.teacher_email} onChange={(e) => setNewClass({ ...newClass, teacher_email: e.target.value })} /></div>
          <div style={grow(1)}><Input label="Class code (optional)" value={newClass.code} onChange={(e) => setNewClass({ ...newClass, code: e.target.value })} /></div>
          <Button variant="secondary" disabled={!newClass.name.trim() || (!!newClass.teacher_email.trim() && !EMAIL.test(newClass.teacher_email.trim()))} onClick={addClass}>Add class</Button>
        </div>
      </Card>

      <Card title="Lessons">
        <p style={small}>What students learn from: scriptures, conference talks, videos, audio and the Proclamations. Every lesson has its own picture, and can be changed from beginning to end: its text or video, transcript, guiding line, how long students stay, and questions that pause them.</p>
        <ul style={{ ...small, listStyle: 'none', padding: 0, margin: 'var(--space-3) 0', display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <li><strong style={{ color: 'var(--text-primary)' }}>{lessons.length}</strong> lessons, <strong style={{ color: 'var(--text-primary)' }}>{lessons.filter((l) => l.active).length}</strong> shown to students</li>
          {tabs.map((t) => <li key={t.value}>{t.count} {t.count === 1 ? t.label.toLowerCase() : t.plural.toLowerCase()}</li>)}
        </ul>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <a className="btn btn-primary" href={withBase('/admin/makeup-work/lessons')} style={{ textDecoration: 'none' }}>Manage lessons →</a>
          <a className="btn btn-outline" href={withBase('/admin/makeup-work/lessons?new=1')} style={{ textDecoration: 'none' }}>+ New lesson</a>
        </div>
      </Card>

      <MakeupSubmissions subs={subs} reload={load} flash={flash} />
    </div>
  );
}

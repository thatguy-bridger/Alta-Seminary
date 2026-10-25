import React from 'react';
import { supabaseBrowser } from '../../lib/supabase/browser-client';
import { Card } from '../../design-system/components/core/Card.jsx';
import { Button } from '../../design-system/components/forms/Button.jsx';
import { Input } from '../../design-system/components/forms/Input.jsx';
import { Select } from '../../design-system/components/forms/Select.jsx';
import { Switch } from '../../design-system/components/forms/Switch.jsx';
import { formatDuration } from '../../makeup/effort.js';
import { parseTranscript, parseTime, checkTranscript, formatTimestamp } from '../../makeup/transcript.js';
import { mediaKind, mediaLabel } from '../../makeup/media.js';
import { MakeupOpenCard } from './MakeupOpenCard.jsx';
import { MakeupSubmissions } from './MakeupSubmissions.jsx';

const KINDS = [
  { value: 'scripture', label: 'Scripture' }, { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' }, { value: 'talk', label: 'Conference talk / article' },
  { value: 'lesson', label: 'Self-guided lesson' }, { value: 'podcast', label: 'Podcast' },
  { value: 'proclamation', label: 'In-depth study (e.g. a Proclamation)' },
];
const NEEDS_TRANSCRIPT = ['video', 'audio', 'podcast'];
const row = { display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end' };
const grow = (n) => ({ flex: `${n} 1 180px`, minWidth: 0 });

// Paste or upload a caption file (.vtt or .srt). Shows what was understood before anything is saved,
// because a transcript is also the captions for students who cannot hear the audio.
function TranscriptEditor({ raw, setRaw, durationText, setDurationText }) {
  const parsed = React.useMemo(() => parseTranscript(raw), [raw]);
  const duration = parseTime(durationText) ?? (Number(durationText) > 0 ? Number(durationText) : null);
  const check = raw.trim() ? checkTranscript(parsed.segments, duration || 0) : null;
  const small = { fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)', margin: 0 };
  async function onFile(e) { const f = e.target.files?.[0]; if (f) setRaw(await f.text()); e.target.value = ''; }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', width: '100%' }}>
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '0 1 130px' }}><Input label="Length (m:ss)" value={durationText} onChange={(e) => setDurationText(e.target.value)} placeholder="4:10" /></div>
        <label style={{ ...small, display: 'flex', flexDirection: 'column', gap: 4 }}>
          Upload captions (.vtt or .srt)
          <input type="file" accept=".vtt,.srt,text/vtt" onChange={onFile} />
        </label>
      </div>
      <label style={{ ...small, display: 'flex', flexDirection: 'column', gap: 4 }}>
        Or paste the captions
        <textarea className="input" rows={5} value={raw} onChange={(e) => setRaw(e.target.value)} placeholder={'WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nFirst line of the talk…'} style={{ fontFamily: 'var(--font-mono, monospace)' }} />
      </label>
      {raw.trim() && (
        <div role="status" style={{ ...small, color: parsed.errors.length || (check && !check.ok) ? 'var(--color-error)' : 'var(--color-success)' }}>
          {parsed.segments.length} line{parsed.segments.length === 1 ? '' : 's'} read{parsed.segments.length ? `, ${formatTimestamp(parsed.segments[0].start)} to ${formatTimestamp(parsed.segments[parsed.segments.length - 1].end)}` : ''}.
          {[...parsed.errors, ...(check?.problems || [])].map((m) => <div key={m}>{m}</div>)}
          {(check?.warnings || []).map((m) => <div key={m} style={{ color: 'var(--color-warning)' }}>{m}</div>)}
        </div>
      )}
    </div>
  );
}

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
  const [newRaw, setNewRaw] = React.useState('');
  const [newDur, setNewDur] = React.useState('');
  const [editing, setEditing] = React.useState(null); // { id, raw, dur }
  const [srcQuery, setSrcQuery] = React.useState('');
  const [srcKind, setSrcKind] = React.useState('');
  const [srcShown, setSrcShown] = React.useState(30);

  const load = React.useCallback(async () => {
    const [c, s, u, st] = await Promise.all([
      supabaseBrowser.from('makeup_classes').select('*').order('sort_order').order('name'),
      supabaseBrowser.from('makeup_sources').select('id, kind, title, minutes, reference, active, one_time, duration_seconds, author, series, sort_order').order('sort_order').order('title').limit(2000),
      supabaseBrowser.from('makeup_submissions').select('*').order('created_at', { ascending: false }).limit(100),
      supabaseBrowser.from('site_settings').select('makeup_work_enabled').eq('id', true).maybeSingle(),
    ]);
    const av = await supabaseBrowser.from('makeup_sources').select('id, transcript').in('kind', ['video', 'audio', 'podcast']);
    const lines = new Map((av.data || []).map((x) => [x.id, x.transcript?.length || 0]));
    setClasses(c.data || []); setSources((s.data || []).map((x) => ({ ...x, transcript_lines: lines.get(x.id) ?? null }))); setSubs(u.data || []); setEnabled(!!st.data?.makeup_work_enabled);
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };
  async function run(promise, ok) { const { error } = await promise; if (error) flash(`Couldn't save: ${error.message}`); else { flash(ok); await load(); } }

  const addClass = () => run(supabaseBrowser.from('makeup_classes').insert({ ...newClass, code: newClass.code || null, teacher_name: newClass.teacher_name || null }).then((r) => { if (!r.error) setNewClass({ name: '', teacher_name: '', teacher_email: '', code: '' }); return r; }), 'Class added.');
  const newParsed = React.useMemo(() => parseTranscript(newRaw), [newRaw]);
  const newDuration = parseTime(newDur) ?? (Number(newDur) > 0 ? Number(newDur) : null);
  const newNeeds = NEEDS_TRANSCRIPT.includes(newSource.kind);
  const newCheck = checkTranscript(newParsed.segments, newDuration || 0);
  const newAddrKind = mediaKind(newSource.embed_url.trim());   // 'youtube' | 'audio' | 'video' | null
  const addrBad = newNeeds && newSource.embed_url.trim() && !newAddrKind;
  const addrHelp = !newNeeds ? undefined : newAddrKind ? `Plays as: ${mediaLabel[newAddrKind]}.`
    : newSource.kind === 'video' ? 'Paste the YouTube link. YouTube does not share its captions with us, so paste the transcript below.' : 'The address of an audio file (.mp3 or .m4a).';
  const newOk = newSource.title.trim() && (!newNeeds || (newAddrKind && newCheck.ok && !newParsed.errors.length));
  const addSource = () => run(supabaseBrowser.from('makeup_sources').insert({
    ...newSource, reference: newSource.reference || null, embed_url: newSource.embed_url || null,
    duration_seconds: newDuration ? Math.round(newDuration) : null, transcript: newParsed.segments.length ? newParsed.segments : null,
    active: !newNeeds || newCheck.ok,
  }).then((r) => { if (!r.error) { setNewSource({ kind: 'scripture', title: '', reference: '', embed_url: '', minutes: 6, one_time: false }); setNewRaw(''); setNewDur(''); } return r; }), 'Source added.');
  const editParsed = React.useMemo(() => parseTranscript(editing?.raw || ''), [editing?.raw]);
  const saveTranscript = () => {
    const dur = parseTime(editing.dur) ?? (Number(editing.dur) > 0 ? Number(editing.dur) : null);
    const chk = checkTranscript(editParsed.segments, dur || 0);
    if (!chk.ok || editParsed.errors.length) { flash(`Can't save: ${[...editParsed.errors, ...chk.problems][0]}`); return; }
    run(supabaseBrowser.from('makeup_sources').update({ transcript: editParsed.segments, duration_seconds: Math.round(dur) }).eq('id', editing.id).then((r) => { if (!r.error) setEditing(null); return r; }), 'Transcript saved.');
  };

  if (!classes || !sources || !subs) return <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>;
  const q = srcQuery.trim().toLowerCase();
  const filteredSources = sources.filter((x) => (!srcKind || x.kind === srcKind) && (!q || [x.title, x.reference, x.author, x.series].some((f) => (f || '').toLowerCase().includes(q))));
  const kindCounts = KINDS.map((k) => `${sources.filter((x) => x.kind === k.value).length} ${k.label.toLowerCase()}`).filter((t) => !t.startsWith('0 ')).join(' · ');
  const small = { fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)', margin: 0 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <MakeupOpenCard enabled={enabled} setEnabled={setEnabled} activeClasses={classes.filter((c) => c.active).length} shownLessons={sources.filter((x) => x.active).length} flash={flash} msg={msg} />

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
        <p style={small}>Scripture and talks can carry text for the built-in reader. Videos use a YouTube link (the Church's own channel works well); audio uses an audio file address. Either <strong>must have a transcript with timestamps</strong>: students read along, jump to a line, and cite the moment they found a truth. It is also the captions for anyone who cannot hear it.</p>
        {sources.length > 0 && (
          <div style={{ ...row, margin: 'var(--space-3) 0 0' }}>
            <div style={grow(2)}><Input label="Search the library" value={srcQuery} onChange={(e) => { setSrcQuery(e.target.value); setSrcShown(30); }} placeholder="Title, scripture, speaker…" /></div>
            <div style={grow(1)}><Select label="Type" value={srcKind} onChange={(e) => { setSrcKind(e.target.value); setSrcShown(30); }} options={[{ value: '', label: 'All types' }, ...KINDS]} /></div>
          </div>
        )}
        <p style={{ ...small, margin: 'var(--space-2) 0' }}>{sources.length} in the library{kindCounts ? ` (${kindCounts})` : ''}. Showing {Math.min(srcShown, filteredSources.length)} of {filteredSources.length}.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', margin: 'var(--space-3) 0' }}>
          {sources.length === 0 && <p style={small}>No sources yet. Add one below.</p>}
          {filteredSources.slice(0, srcShown).map((s) => (
            <div key={s.id} style={{ ...row, alignItems: 'center', padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div style={grow(2)}><strong>{s.title}</strong><div style={small}>{KINDS.find((k) => k.value === s.kind)?.label} · {s.minutes} min{s.reference ? ` · ${s.reference}` : ''}{s.series && s.series !== s.reference ? ` · ${s.series}` : ''}{s.one_time ? ' · once per student' : ''}</div></div>
              {NEEDS_TRANSCRIPT.includes(s.kind) && (
                <span style={small}>{s.transcript_lines ? `Transcript: ${s.transcript_lines} lines · ${formatTimestamp(s.duration_seconds || 0)}` : 'No transcript, so students cannot see it'}</span>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--fs-small)' }}>
                <Switch checked={s.active} disabled={NEEDS_TRANSCRIPT.includes(s.kind) && !s.transcript_lines} onChange={(e) => run(supabaseBrowser.from('makeup_sources').update({ active: e.target.checked }).eq('id', s.id), 'Updated.')} /> Shown
              </label>
              {NEEDS_TRANSCRIPT.includes(s.kind) && <Button variant="outline" size="sm" onClick={() => setEditing(editing?.id === s.id ? null : { id: s.id, raw: '', dur: s.duration_seconds ? formatTimestamp(s.duration_seconds) : '' })}>{s.transcript_lines ? 'Replace transcript' : 'Add transcript'}</Button>}
              <Button variant="ghost" size="sm" onClick={() => run(supabaseBrowser.from('makeup_sources').delete().eq('id', s.id), 'Source removed.')}>Remove</Button>
              {editing?.id === s.id && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <TranscriptEditor raw={editing.raw} setRaw={(raw) => setEditing({ ...editing, raw })} durationText={editing.dur} setDurationText={(dur) => setEditing({ ...editing, dur })} />
                  <div><Button variant="secondary" size="sm" onClick={saveTranscript}>Save transcript</Button></div>
                </div>
              )}
            </div>
          ))}
        </div>
        {filteredSources.length > srcShown && <div style={{ marginBottom: 'var(--space-3)' }}><Button variant="outline" size="sm" onClick={() => setSrcShown((n) => n + 40)}>Show more</Button></div>}
        <div style={row}>
          <div style={grow(1)}><Select label="Type" value={newSource.kind} onChange={(e) => setNewSource({ ...newSource, kind: e.target.value })} options={KINDS} /></div>
          <div style={grow(2)}><Input label="Title" value={newSource.title} onChange={(e) => setNewSource({ ...newSource, title: e.target.value })} /></div>
          <div style={grow(1)}><Input label="Reference (optional)" value={newSource.reference} onChange={(e) => setNewSource({ ...newSource, reference: e.target.value })} placeholder="1 Nephi 3:7" /></div>
          <div style={grow(2)}><Input label={newSource.kind === 'video' ? 'YouTube link' : newNeeds ? 'Audio address' : 'Video or audio address (not needed for text)'} value={newSource.embed_url} onChange={(e) => setNewSource({ ...newSource, embed_url: e.target.value })}
            placeholder={newSource.kind === 'video' ? 'https://www.youtube.com/watch?v=…' : 'https://…'} helpText={addrHelp}
            error={addrBad ? 'We can play YouTube links and direct audio or video files (.mp3, .m4a, .mp4, .webm). This address is neither.' : undefined} /></div>
          <div style={{ flex: '0 1 90px' }}><Input label="Minutes" type="number" value={newSource.minutes} onChange={(e) => setNewSource({ ...newSource, minutes: Number(e.target.value) || 6 })} /></div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--fs-small)' }}><Switch checked={newSource.one_time} onChange={(e) => setNewSource({ ...newSource, one_time: e.target.checked })} /> Once per student</label>
          {newNeeds && <TranscriptEditor raw={newRaw} setRaw={setNewRaw} durationText={newDur} setDurationText={setNewDur} />}
          <Button variant="secondary" disabled={!newOk} onClick={addSource}>Add source</Button>
        </div>
      </Card>

      <MakeupSubmissions subs={subs} reload={load} flash={flash} />
    </div>
  );
}

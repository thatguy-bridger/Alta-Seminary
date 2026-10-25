import React from 'react';
import { supabaseBrowser } from '../../lib/supabase/browser-client';
import { Card } from '../../design-system/components/core/Card.jsx';
import { Switch } from '../../design-system/components/forms/Switch.jsx';
import { Button } from '../../design-system/components/forms/Button.jsx';
import { withBase } from '../../lib/url.js';
import { MakeupJourney } from '../../makeup/MakeupJourney.jsx';
import { SAMPLE_CLASSES, SAMPLE_SOURCES } from '../../makeup/sampleContent.js';
import { AV_KINDS } from '../../makeup/content.js';

// The student journey, exactly as students will see it, for admins to try.
// Beta: this is the ONLY place it exists. Nothing on the public site links here.
export function MakeupTestScreen() {
  const [real, setReal] = React.useState(null);        // { classes, sources } from the database
  const [useSample, setUseSample] = React.useState(null); // null = decide once data has loaded
  const [drafts, setDrafts] = React.useState(true);
  const [skip, setSkip] = React.useState(true);
  const [phone, setPhone] = React.useState(false);
  const [save, setSave] = React.useState(false);
  const [run, setRun] = React.useState(0);
  // /admin/makeup-work/test?lesson=ID previews that one lesson, starting at it, as it is saved right now.
  const lessonId = React.useMemo(() => (typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('lesson') || ''), []);

  React.useEffect(() => {
    Promise.all([
      supabaseBrowser.from('makeup_classes').select('id, name, code, active').eq('active', true).order('sort_order').order('name'),
      supabaseBrowser.from('makeup_sources').select('*').order('sort_order').order('title'),
    ]).then(([c, s]) => {
      const classes = (c.data || []).map((x) => ({ id: x.id, name: x.name, requires_code: !!x.code }));
      const sources = s.data || [];
      setReal({ classes, sources });
      setUseSample((u) => (u === null ? !(classes.length && sources.some((x) => x.active)) : u));
    });
  }, []);

  if (!real || useSample === null) return <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>;

  const preview = lessonId ? real.sources.find((x) => x.id === lessonId) || null : null;
  const classes = preview ? (real.classes.length ? real.classes : SAMPLE_CLASSES) : useSample ? SAMPLE_CLASSES : real.classes;
  const sources = preview ? [preview] : useSample ? SAMPLE_SOURCES : real.sources.filter((x) => (drafts || x.active) && (!AV_KINDS.includes(x.kind) || x.transcript?.length));
  const usingSample = useSample || !!preview;   // a lesson preview never saves anything
  const label = { display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)' };

  async function onSubmit({ rpc }) {
    // A test never writes anything unless "Really save" is on AND real classes are in use.
    if (!save || usingSample) return { ok: true, saved: false };
    const { data, error } = await supabaseBrowser.rpc('submit_makeup', rpc);
    if (error) return { ok: false, error: error.message };
    return { ok: true, saved: true, id: data };
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <p style={{ margin: 0 }}><a href={withBase('/admin/makeup-work')}>← Back to Makeup Work setup</a></p>
      {lessonId && !preview && <p role="alert" style={{ margin: 0, color: 'var(--color-warning)' }}>That lesson could not be found. It may have been deleted. <a href={withBase('/admin/makeup-work/lessons')}>Back to lessons</a></p>}
      {preview && (
        <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)' }}>
          Previewing <strong>{preview.title}</strong> exactly as it is saved, starting at the lesson. {' '}
          <a href={withBase(`/admin/makeup-work/lessons?edit=${preview.id}`)}>Edit this lesson</a> · <a href={withBase('/admin/makeup-work/test')}>Try the whole experience</a>
        </p>
      )}
      <Card title="Try the student experience">
        <p style={{ margin: '0 0 var(--space-3)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', color: 'var(--text-muted)' }}>
          This is exactly what a student sees. It is a beta: students cannot reach it yet. Turn on the skip tools to jump through steps, or turn them off to take it as a student would.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={label}><Switch checked={skip} onChange={(e) => setSkip(e.target.checked)} /> Skip tools</label>
          <label style={label}><Switch checked={phone} onChange={(e) => setPhone(e.target.checked)} /> Phone width</label>
          {!preview && <label style={label}><Switch checked={useSample} onChange={(e) => { setUseSample(e.target.checked); setRun((r) => r + 1); }} /> Use sample classes and lessons</label>}
          {!usingSample && <label style={label}><Switch checked={drafts} onChange={(e) => { setDrafts(e.target.checked); setRun((r) => r + 1); }} /> Include lessons not yet shown to students</label>}
          <label style={label}><Switch checked={save} disabled={usingSample} onChange={(e) => setSave(e.target.checked)} /> Really save the submission</label>
          <Button variant="outline" size="sm" onClick={() => setRun((r) => r + 1)}>Restart</Button>
        </div>
        {save && !usingSample && <p style={{ margin: 'var(--space-3) 0 0', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--color-warning)' }}>Saving is on: finishing will add a real submission to the list (and it counts toward the 7-a-week limit for that name). Delete it afterward in Recent submissions.</p>}
        {usingSample && <p style={{ margin: 'var(--space-3) 0 0', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>{preview ? 'A lesson preview never saves anything.' : 'Sample content is on, so nothing can be saved. Add classes and lessons in the setup page to try the real ones.'}</p>}
      </Card>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: phone ? 390 : undefined }}>
          <MakeupJourney key={run} classes={classes} sources={sources} onSubmit={onSubmit} skipTools={skip} phone={phone} testMode startAtLesson={preview ? preview.id : ''} />
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { supabaseBrowser } from '../../../lib/supabase/browser-client';
import { Card } from '../../../design-system/components/core/Card.jsx';
import { Button } from '../../../design-system/components/forms/Button.jsx';
import { Input } from '../../../design-system/components/forms/Input.jsx';
import { Select } from '../../../design-system/components/forms/Select.jsx';
import { Switch } from '../../../design-system/components/forms/Switch.jsx';
import { withBase } from '../../../lib/url.js';
import { GROUPS, groupOf } from '../../../makeup/content.js';
import { mediaKind, mediaLabel } from '../../../makeup/media.js';
import { splitParagraphs } from '../../../makeup/pauses.js';
import { isStructured, readableText } from '../../../makeup/lessonBlocks.js';
import { thumbnailFor, paintingFor } from '../../../makeup/thumbnails.js';
import { byline } from '../../../makeup/byline.js';
import { parseTranscript, formatTimestamp } from '../../../makeup/transcript.js';
import { KINDS, kindInfo, isTextKind, blankLesson, draftFromRow, validateLesson, rowFromDraft, isDirty, parseLength } from '../../../makeup/lessonsModel.js';
import { PauseEditor } from './PauseEditor.jsx';
import { TranscriptBox } from './TranscriptBox.jsx';
import { PicturePicker } from './PicturePicker.jsx';
import { registerLessonPicture } from '../../gallery/lessonPicture.js';

const NEW_LESSON_ORDER = 9000;       // new lessons go to the end of their collection

// One lesson, from beginning to end: what it is, its picture, what students study, and the experience around it
// (a guiding line, how long they stay, questions that pause them). Nothing is saved until Save is pressed.
export function LessonEditor({ id, initialKind = 'scripture', onClose, onOpen, onSaved, flash }) {
  const [draft, setDraft] = React.useState(() => (id ? null : blankLesson(initialKind)));
  const [orig, setOrig] = React.useState(() => (id ? null : blankLesson(initialKind)));
  const [segments, setSegments] = React.useState([]);          // the transcript as saved
  const [collections, setCollections] = React.useState([]);
  const [problem, setProblem] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [justSaved, setJustSaved] = React.useState(false);
  const [tried, setTried] = React.useState(false);             // show every problem once Save has been pressed

  React.useEffect(() => {
    if (!id) return;
    let live = true;
    (async () => {
      const { data, error } = await supabaseBrowser.from('makeup_sources').select('*').eq('id', id).maybeSingle();
      if (!live) return;
      if (error || !data) { setProblem(error?.message || 'That lesson could not be found. It may have been deleted.'); return; }
      const d = draftFromRow(data, data.transcript?.length || 0);
      setDraft(d); setOrig(d); setSegments(Array.isArray(data.transcript) ? data.transcript : []);
    })();
    return () => { live = false; };
  }, [id]);
  React.useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser.from('admin_makeup_lessons').select('series');
      setCollections([...new Set((data || []).map((r) => r.series).filter(Boolean))].sort());
    })();
  }, []);

  if (problem && !draft) return <div><p role="alert" style={{ color: 'var(--color-error)' }}>{problem}</p><Button variant="outline" onClick={onClose}>Back to lessons</Button></div>;
  if (!draft) return <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>;

  const text = isTextKind(draft.kind);
  const v = validateLesson(draft);
  const dirty = isDirty(draft, orig);
  const set = (patch) => { setDraft((d) => ({ ...d, ...patch })); setJustSaved(false); };
  const err = (field) => (tried || dirty ? v.errors[field] : undefined);
  const paragraphs = text ? splitParagraphs(draft.body, draft.kind) : [];
  const words = text ? ((isStructured(draft.kind) ? readableText(draft.body) : draft.body).trim().match(/\S+/g) || []).length : 0;
  const lengthSeconds = text ? 0 : parseLength(draft.duration_text) || 0;
  const liveSegments = !text && draft.transcript_raw !== null ? parseTranscript(draft.transcript_raw).segments : segments;
  const autoSeconds = text ? Math.max(20, Math.ceil((words / 200) * 60 * (isStructured(draft.kind) ? 1 : 0.6))) : Math.round(lengthSeconds * 0.75);
  const genericLine = GROUPS[groupOf(draft.kind)]?.listen?.[0] || '';
  const t = thumbnailFor(draft);

  async function save() {
    setTried(true);
    if (!v.ok) { setProblem('Some things need fixing first. They are marked below.'); return null; }
    setProblem(''); setSaving(true);
    const edited = !text && draft.transcript_raw !== null;
    const row = rowFromDraft(draft, edited ? { transcript: parseTranscript(draft.transcript_raw).segments } : {});
    const q = id ? supabaseBrowser.from('makeup_sources').update(row).eq('id', id) : supabaseBrowser.from('makeup_sources').insert({ ...row, sort_order: NEW_LESSON_ORDER });
    const { data, error } = await q.select().maybeSingle();
    setSaving(false);
    if (error || !data) { setProblem(`Couldn't save: ${error?.message || 'no answer from the database'}`); return null; }
    const d = draftFromRow(data, data.transcript?.length || 0);
    setDraft(d); setOrig(d); setSegments(Array.isArray(data.transcript) ? data.transcript : []);
    setJustSaved(true); setTried(false);
    if (draft.active && !row.active) flash('Saved, but hidden from students until it is complete.');
    registerLessonPicture(supabaseBrowser, data);       // a picture that lives on another website is remembered in the image library (not waited for)
    onSaved && onSaved();
    if (!id) onOpen(data.id);
    return data.id;
  }
  async function preview() {
    const w = window.open('about:blank', '_blank');
    const lessonId = dirty || !id ? await save() : id;
    if (!lessonId) { if (w) w.close(); return; }
    const url = withBase(`/admin/makeup-work/test?lesson=${lessonId}`);
    if (w) w.location.href = url; else flash('Allow pop-ups for this site to open the preview.');
  }
  async function duplicate() {
    const { data: full } = await supabaseBrowser.from('makeup_sources').select('*').eq('id', id).maybeSingle();
    if (!full) { setProblem('Could not read the lesson to copy it.'); return; }
    const { id: _id, created_at: _c, ...rest } = full;
    const { data, error } = await supabaseBrowser.from('makeup_sources').insert({ ...rest, title: `${full.title} (copy)`, active: false, origin_url: null, sort_order: (full.sort_order || 0) + 1 }).select().maybeSingle();
    if (error || !data) { setProblem(`Couldn't copy: ${error?.message || 'no answer'}`); return; }
    flash('Copied. This copy is hidden from students until you show it.'); onSaved && onSaved(); onOpen(data.id);
  }
  async function remove() {
    if (!window.confirm(`Delete "${orig.title}"? Students will no longer see it. This cannot be undone.`)) return;
    const { error } = await supabaseBrowser.from('makeup_sources').delete().eq('id', id);
    if (error) { setProblem(`Couldn't delete: ${error.message}`); return; }
    flash('Deleted.'); onClose();
  }
  function leave() { if (dirty && !window.confirm('You have changes that are not saved. Leave without saving them?')) return; onClose(); }

  return (
    <div className="ls-editor">
      <div>
        <p style={{ margin: 0 }}><a href={withBase('/admin/makeup-work/lessons')} onClick={(e) => { e.preventDefault(); leave(); }}>← All lessons</a></p>
        <h2 style={{ margin: '4px 0 0', fontFamily: 'var(--font-display)' }}>{id ? orig.title || 'Edit lesson' : 'New lesson'}</h2>
      </div>

      <Card title="How students see it">
        <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', flexWrap: 'wrap' }}>
          {draft.show_images && <img src={t.src} alt="" style={{ width: 160, aspectRatio: '16/9', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}
            onError={(e) => { if (!e.currentTarget.dataset.fell) { e.currentTarget.dataset.fell = '1'; e.currentTarget.src = paintingFor(draft.id || draft.title).src; } }} />}
          <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 'var(--fs-caption)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--color-primary, #a32030)', fontWeight: 700 }}>{GROUPS[groupOf(draft.kind)]?.label || kindInfo(draft.kind).label}</span>
            <strong style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem' }}>{draft.title || 'Untitled lesson'}</strong>
            {byline(draft) && <span className="ls-help">{byline(draft)}</span>}
            <span style={{ borderLeft: '3px solid var(--color-primary, #a32030)', paddingLeft: 10, color: 'var(--text-secondary)', fontSize: 'var(--fs-small)' }}>{draft.guide_line.trim() || genericLine}</span>
          </div>
        </div>
      </Card>

      <Card title="Basics">
        <div className="ls-fieldgrid">
          <Select label="Type" value={draft.kind} onChange={(e) => set({ kind: e.target.value })} options={KINDS.map((k) => ({ value: k.value, label: k.label }))} />
          <div className="wide"><Input label="Title" value={draft.title} onChange={(e) => set({ title: e.target.value })} error={err('title')} /></div>
          <label className="ls-lbl">Collection
            <input className="input" list="ls-collections" value={draft.series} onChange={(e) => set({ series: e.target.value })} placeholder="Book of Mormon, April 2026 general conference…" />
            <datalist id="ls-collections">{collections.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <Input label="Author or speaker" value={draft.author} onChange={(e) => set({ author: e.target.value })} />
          <Input label="Reference" value={draft.reference} onChange={(e) => set({ reference: e.target.value })} placeholder="1 Nephi 3:7" />
          <Input label="Minutes it takes" type="number" value={draft.minutes} onChange={(e) => set({ minutes: e.target.value })} error={err('minutes')} />
          {draft.kind === 'comefollowme' && (
            <>
              <Input label="Week begins" type="date" value={draft.week_start} onChange={(e) => set({ week_start: e.target.value })} error={err('week')} />
              <Input label="Week ends" type="date" value={draft.week_end} onChange={(e) => set({ week_end: e.target.value })} />
              <p className="ls-help wide">The student page shows the week that today falls in, and lets a student choose an earlier week they missed. Weeks that have not begun are never offered.</p>
            </>
          )}
          <label className="ls-lbl wide">Short description
            <textarea className="input" rows={2} value={draft.description} onChange={(e) => set({ description: e.target.value })} placeholder="One or two sentences about this lesson." />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap', marginTop: 'var(--space-4)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--fs-small)' }}>
            <Switch checked={draft.one_time} onChange={(e) => set({ one_time: e.target.checked })} label="Once per student" /> Once per student
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--fs-small)' }}>
            <Switch checked={draft.active && v.canShow} disabled={!v.canShow && !draft.active} onChange={(e) => set({ active: e.target.checked })} label="Shown to students" /> Shown to students
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--fs-small)' }}>
            <Switch checked={draft.show_images} onChange={(e) => set({ show_images: e.target.checked })} label="Show pictures to students" /> Show pictures to students
          </label>
        </div>
        <p className="ls-help" style={{ marginTop: 6 }}>Pictures are off unless you turn them on. When on, this lesson's page shows its picture and a painting of the Savior at the top of each step; when off, the lesson stays plain and quiet.</p>
        {!v.canShow && <p className="ls-help" style={{ marginTop: 6 }}>Cannot be shown to students yet: {v.showBlockers.join(', ')}.</p>}
        {draft.active && !v.canShow && <p className="ls-err" role="status">This lesson will be hidden when you save, until that is fixed.</p>}
      </Card>

      <Card title="Picture">
        <PicturePicker lesson={draft} onChange={(url) => set({ thumbnail_url: url })} error={err('thumbnail_url')} />
      </Card>

      <Card title={text ? 'The text students read' : kindInfo(draft.kind).value === 'video' ? 'The video students watch' : 'The audio students hear'}>
        {text ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <label className="ls-lbl">Text
              <textarea className="input ls-body-text" rows={16} value={draft.body} onChange={(e) => set({ body: e.target.value })} placeholder={isStructured(draft.kind) ? 'The lesson text. See the box below for how to write headings, lists and notes.' : 'Paste or write the lesson text. Leave a blank line between paragraphs.'} />
            </label>
            <p className="ls-help">{words} words · {paragraphs.length} paragraph{paragraphs.length === 1 ? '' : 's'} · about {Math.max(1, Math.round(words / 200))} min to read. {draft.kind === 'scripture' && !draft.body.trim() ? 'With no text, students are told to open their scriptures to the reference.' : ''}</p>
            {isStructured(draft.kind) && (
              <details className="ls-help ls-markup">
                <summary>How to write headings, lists and notes</summary>
                <p>Leave a blank line between blocks. The first characters of a block say what it is:</p>
                <ul>
                  <li><code># A section</code> a big heading</li>
                  <li><code>@ Moses 1</code> a small label above the heading that follows it</li>
                  <li><code>## A heading</code> a heading</li>
                  <li><code>- one item</code> a list: start every line of the block with a dash and a space</li>
                  <li><code>&gt; See also …</code> a note, such as a "see also" or a video to find in the Gospel Library</li>
                  <li>anything else is a paragraph</li>
                </ul>
                <p>A question that pauses the student goes "after paragraph N". Paragraphs, lists and notes are counted; headings and labels are not, because they belong to what follows them.</p>
              </details>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div className="ls-fieldgrid">
              <div className="wide">
                <Input label={draft.kind === 'video' ? 'YouTube link' : 'Audio or video address'} value={draft.embed_url} onChange={(e) => set({ embed_url: e.target.value })}
                  placeholder={draft.kind === 'video' ? 'https://www.youtube.com/watch?v=…' : 'https://…/talk.mp3'} error={err('embed_url')}
                  helpText={mediaKind(draft.embed_url.trim()) ? `Plays as: ${mediaLabel[mediaKind(draft.embed_url.trim())]}.` : draft.kind === 'video' ? 'Paste the YouTube link. YouTube does not share its captions with us, so add the transcript below.' : 'The address of an audio file (.mp3 or .m4a), or a YouTube link.'} />
              </div>
              <Input label="Length (m:ss)" value={draft.duration_text} onChange={(e) => set({ duration_text: e.target.value })} placeholder="12:40" error={err('duration_text')} />
            </div>
            <TranscriptBox segments={segments} lines={draft.transcript_lines} raw={draft.transcript_raw} setRaw={(raw) => set({ transcript_raw: raw })} error={err('transcript')} />
          </div>
        )}
      </Card>

      <Card title="The experience">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input label="Guiding line" value={draft.guide_line} onChange={(e) => set({ guide_line: e.target.value })} placeholder={genericLine} error={err('guide_line')}
            helpText="The short line under the title that tells the student what to look for. Leave it empty to use the standard lines." />
          <div>
            <span className="ls-lbl">How long students stay</span>
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
              <Select label="" aria-label="How long students stay" value={draft.min_mode} onChange={(e) => set({ min_mode: e.target.value, min_seconds: e.target.value === 'custom' && !draft.min_seconds ? String(autoSeconds || 60) : draft.min_seconds })}
                options={[{ value: 'auto', label: `Automatic${autoSeconds ? ` (about ${formatTimestamp(autoSeconds)})` : ''}` }, { value: 'custom', label: 'Set my own' }]} />
              {draft.min_mode === 'custom' && (
                <label className="ls-lbl" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <input className="input" style={{ width: 110 }} inputMode="numeric" aria-label="Seconds" value={draft.min_seconds} onChange={(e) => set({ min_seconds: e.target.value })} /> seconds
                </label>
              )}
            </div>
            <p className="ls-help" style={{ marginTop: 4 }}>{text ? 'Continue unlocks after the student has had this long with the text.' : 'Continue unlocks after the student has played this many seconds (skipping ahead does not count). Automatic is three quarters of the length.'}</p>
            {err('min_seconds') && <p className="ls-err" role="alert">{err('min_seconds')}</p>}
          </div>
          <div>
            <span className="ls-lbl" style={{ marginBottom: 6 }}>Questions that pause the student</span>
            <PauseEditor isText={text} pauses={draft.pauses} onChange={(pauses) => set({ pauses })} paragraphs={paragraphs} segments={liveSegments} error={err('pauses')} />
          </div>
        </div>
      </Card>

      {id && (
        <Card title="More">
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <Button variant="outline" size="sm" onClick={duplicate}>Make a copy</Button>
            <Button variant="ghost" size="sm" onClick={remove}>Delete this lesson</Button>
          </div>
        </Card>
      )}

      <div className="ls-bar" role="region" aria-label="Save">
        <Button variant="primary" disabled={saving || (!dirty && !!id)} onClick={save}>{saving ? 'Saving…' : id ? 'Save changes' : 'Save lesson'}</Button>
        <Button variant="outline" disabled={saving} onClick={preview}>{dirty || !id ? 'Save and preview as a student' : 'Preview as a student'}</Button>
        <Button variant="ghost" onClick={leave}>{dirty ? 'Discard and go back' : 'Back to lessons'}</Button>
        <span className="grow" />
        {problem && <span className="ls-err" role="alert">{problem}</span>}
        {!problem && dirty && <span className="ls-dirty" role="status">Unsaved changes</span>}
        {!problem && !dirty && justSaved && <span className="ls-saved" role="status">Saved.</span>}
      </div>
    </div>
  );
}

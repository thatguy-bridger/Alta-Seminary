import React from 'react';
import { supabaseBrowser } from '../../lib/supabase/browser-client';
import { Dialog } from '../../design-system/components/core/Dialog.jsx';
import { Badge } from '../../design-system/components/core/Badge.jsx';
import { Button } from '../../design-system/components/forms/Button.jsx';
import { Input } from '../../design-system/components/forms/Input.jsx';
import { Textarea } from '../../design-system/components/forms/Textarea.jsx';
import { useConfirm } from '../ConfirmProvider.jsx';
import { prepareImageFile } from '../imageUpload.js';
import {
  ORIGIN_LABEL, draftFromImage, rowFromDraft, sameDraft, validateDraft, imageName, factsLine, usageLabel, groupUsage, loadUsage, saveDescription,
  deleteImage, canReplaceFile, replaceImageFile, parseTags,
} from './imageLibrary.js';

const small = { fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)', margin: 0 };

// One image: what is known about it (editable), where it is used, and the two things that can hurt a page, replacing and removing it.
export function ImageDetail({ item, suggestions = [], onClose, onChanged, onRemoved, db = supabaseBrowser }) {
  const confirm = useConfirm();
  const [draft, setDraft] = React.useState(() => draftFromImage(item));
  const [saved, setSaved] = React.useState(() => draftFromImage(item));
  const [usage, setUsage] = React.useState(null);
  const [message, setMessage] = React.useState({ text: '', bad: false });
  const [busy, setBusy] = React.useState('');
  const [bust, setBust] = React.useState('');                 // makes the preview reload after the picture is replaced
  const fileRef = React.useRef(null);

  React.useEffect(() => {
    let alive = true;
    loadUsage(db, item.id).then(({ rows, error }) => { if (!alive) return; if (error) setMessage({ text: `Couldn't check where it is used: ${error}`, bad: true }); setUsage(error ? null : rows); });
    return () => { alive = false; };
  }, [item.id, db]);

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const v = validateDraft(draft);
  const dirty = !sameDraft(draft, saved);
  const used = usage ? usage.length : null;
  const groups = usage ? groupUsage(usage) : [];
  const said = (text, bad = false) => setMessage({ text, bad });

  async function save() {
    if (!v.ok || !dirty) return;
    setBusy('save'); said('');
    const { error } = await saveDescription(db, item.id, draft);
    setBusy('');
    if (error) { said(`Couldn't save: ${error}`, true); return; }
    setSaved(draft);
    onChanged({ ...item, ...rowFromDraft(draft) });
    said('Saved.');
  }

  async function replace(file) {
    if (!file) return;
    let prepared;
    try { prepared = await prepareImageFile(file); } catch (e) { said(e.message || 'That file could not be read.', true); return; }
    if (used > 0) {
      const where = groups.flatMap((g) => g.places.map((p) => p.label)).slice(0, 6).join(', ');
      const ok = await confirm(`This picture is used in ${used} place${used === 1 ? '' : 's'} (${where}${used > 6 ? ', and more' : ''}). The new picture will replace it in all of them right away. A browser that has already loaded the old one may keep showing it for up to an hour.`,
        { title: 'Replace this picture everywhere?', confirmLabel: 'Replace it', danger: true });
      if (!ok) return;
    }
    setBusy('replace'); said('');
    const result = await replaceImageFile(db, item, prepared.blob, { width: prepared.width, height: prepared.height });
    setBusy('');
    if (!result.ok) { said(`Couldn't replace it: ${result.error}`, true); return; }
    setBust(String(Date.now()));
    onChanged({ ...item, ...rowFromDraft(saved), ...result.facts });
    said(result.warning ? `Replaced, but its size was not recorded: ${result.warning}` : 'Replaced. The new picture is in place everywhere this one was used.');
  }

  async function remove() {
    if (used > 0) return;
    const linked = item.origin === 'linked';
    const ok = await confirm(linked ? `Remove “${imageName(item)}” from the library? Nothing changes on the other website.` : `Delete “${imageName(item)}”? The picture file is deleted and cannot be brought back.`,
      { title: linked ? 'Remove this link?' : 'Delete this picture?', confirmLabel: linked ? 'Remove' : 'Delete', danger: true });
    if (!ok) return;
    setBusy('delete'); said('');
    const result = await deleteImage(db, item);
    setBusy('');
    if (!result.ok) { said(`Couldn't remove it: ${result.error}`, true); return; }
    onRemoved(item.id);
  }

  async function copyAddress() {
    try { await navigator.clipboard.writeText(item.url); said('Address copied.'); } catch { said('Copying is not available here. Select the address to copy it.', true); }
  }

  const typed = new Set(parseTags(draft.tagsText));
  const chips = suggestions.filter((t) => !typed.has(t)).slice(0, 8);

  return (
    <Dialog open title={imageName(item)} onClose={onClose} wide>
      <div className="gl-detail" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <img src={`${item.url}${bust ? `?v=${bust}` : ''}`} alt={saved.alt_text} style={{ maxWidth: 260, maxHeight: 220, objectFit: 'contain', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)' }} />
          <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge tone="neutral">{ORIGIN_LABEL[item.origin] || item.origin}</Badge>
              {used !== null && <Badge tone={used > 0 ? 'success' : 'warning'}>{usageLabel(used)}</Badge>}
            </div>
            {factsLine(item) && <p style={small}>{factsLine(item)}</p>}
            {item.created_at && <p style={small}>Added {new Date(item.created_at).toLocaleDateString()}</p>}
            {item.origin === 'site' && item.source_url && <p style={small}>Its original file on the site: {item.source_url}</p>}
            {item.origin === 'linked' && <p style={small}>Linked from another website, not copied.{item.source_url ? <> Source: <a href={item.source_url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-link)' }}>{item.source_url}</a></> : null}</p>}
            <label style={{ ...small, display: 'flex', flexDirection: 'column', gap: 2 }}>Address
              <span style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <input className="input" readOnly value={item.url} style={{ flex: 1, fontSize: 'var(--fs-caption)' }} onFocus={(e) => e.target.select()} />
                <Button variant="outline" size="sm" onClick={copyAddress}>Copy</Button>
              </span>
            </label>
          </div>
        </div>

        <Input label="Title" value={draft.title} onChange={(e) => set({ title: e.target.value })} error={v.errors.title} helpText="What this picture is, in a few words. Searchable." />
        <Input label="Alt text" value={draft.alt_text} onChange={(e) => set({ alt_text: e.target.value })} error={v.errors.alt_text} helpText="Describe the picture for someone who cannot see it. Leave it empty if it is only decoration. Searchable." />
        <Textarea label="Description" rows={2} value={draft.description} onChange={(e) => set({ description: e.target.value })} error={v.errors.description} helpText="Anything else worth knowing: when, where, who is in it. Searchable." />
        <Input label="Tags" value={draft.tagsText} onChange={(e) => set({ tagsText: e.target.value })} error={v.errors.tagsText} helpText="Words to find it by, separated by commas. Searchable." />
        {chips.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }} aria-label="Tags used elsewhere">
            <span style={small}>Used elsewhere:</span>
            {chips.map((t) => <button key={t} type="button" className="btn btn-outline btn-sm" onClick={() => set({ tagsText: [...typed, t].join(', ') })}>{t}</button>)}
          </div>
        )}
        <Input label="Credit" value={draft.credit} onChange={(e) => set({ credit: e.target.value })} error={v.errors.credit} helpText="Who made it or where it came from, for example a photographer or an artist." />
        <Input label="Permission or licence" value={draft.license} onChange={(e) => set({ license: e.target.value })} error={v.errors.license} helpText="For example: public domain, used with permission, taken by us." />

        <div className="gl-usage">
          <h4 style={{ margin: '0 0 4px', fontFamily: 'var(--font-display)' }}>Where it is used</h4>
          {usage === null ? <p style={small}>Checking…</p> : groups.length === 0 ? <p style={small}>Nothing uses this picture yet.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {groups.map((g) => (
                <div key={g.area}>
                  <strong style={{ fontSize: 'var(--fs-small)' }}>{g.label}</strong>
                  <ul style={{ margin: '2px 0 0', paddingLeft: 'var(--space-5)' }}>
                    {g.places.map((p) => <li key={p.key} style={{ fontSize: 'var(--fs-small)' }}><a href={p.href} style={{ color: 'var(--text-link)' }}>{p.label}</a> <span style={small}>({p.detail})</span></li>)}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <p role="status" aria-live="polite" style={{ margin: 0, minHeight: '1.2em', fontSize: 'var(--fs-small)', color: message.bad ? 'var(--color-error)' : 'var(--color-success)' }}>{message.text}</p>

        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant="primary" disabled={!dirty || !v.ok || busy !== ''} onClick={save}>{busy === 'save' ? 'Saving…' : 'Save'}</Button>
          {canReplaceFile(item) && (
            <>
              <Button variant="outline" disabled={busy !== ''} onClick={() => fileRef.current?.click()}>{busy === 'replace' ? 'Replacing…' : 'Replace the picture'}</Button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} aria-label="Choose the new picture" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; replace(f); }} />
            </>
          )}
          <Button variant="outline" disabled={busy !== '' || used === null || used > 0} onClick={remove}>{item.origin === 'linked' ? 'Remove this link' : 'Delete'}</Button>
          <span style={{ flex: 1 }} />
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
        {used > 0 && <p style={small}>To delete this picture, first stop using it in the places above. It is kept safe while anything uses it.</p>}
      </div>
    </Dialog>
  );
}

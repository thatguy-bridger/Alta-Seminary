import React from 'react';
import { supabaseBrowser } from '../../lib/supabase/browser-client';
import { Card } from '../../design-system/components/core/Card.jsx';
import { Badge } from '../../design-system/components/core/Badge.jsx';
import { Button } from '../../design-system/components/forms/Button.jsx';
import { Input } from '../../design-system/components/forms/Input.jsx';
import { Textarea } from '../../design-system/components/forms/Textarea.jsx';
import { Select } from '../../design-system/components/forms/Select.jsx';
import { Dialog } from '../../design-system/components/core/Dialog.jsx';
import { ImageUploadField } from '../ImageUploadField.jsx';
import { EyeIcon, EyeOffIcon, TrashIcon } from '../icons.jsx';
import { slugify, uniqueSlug } from '../slug.js';
import { useConfirm, useAlert } from '../ConfirmProvider.jsx';

const emptyEntry = (kind) => ({
  directory_kind: kind, name: '', photo_url: '', bio: '', extra_fields: {}, status: 'draft',
});

export function DirectoryScreen() {
  const confirm = useConfirm();
  const alertUser = useAlert();
  const [directories, setDirectories] = React.useState(null);
  const [activeDirId, setActiveDirId] = React.useState(null);
  const [addDirOpen, setAddDirOpen] = React.useState(false);
  const [entries, setEntries] = React.useState(null);
  const [fieldDefs, setFieldDefs] = React.useState([]);
  const [editing, setEditing] = React.useState(null);
  const [saving, setSaving] = React.useState(false);

  const activeDir = directories?.find((d) => d.id === activeDirId) || null;
  const kind = activeDir?.slug;

  async function loadDirectories(selectId) {
    const { data } = await supabaseBrowser.from('directories').select('*').order('sort_order');
    setDirectories(data || []);
    if (selectId) setActiveDirId(selectId);
    else if (!activeDirId && data?.length) setActiveDirId(data[0].id);
  }

  React.useEffect(() => { loadDirectories(); }, []);

  async function handleCreateDirectory(name) {
    const slug = await uniqueSlug('directories', slugify(name));
    const { data } = await supabaseBrowser
      .from('directories')
      .insert({ name, slug, sort_order: directories.length })
      .select()
      .single();
    setAddDirOpen(false);
    await loadDirectories(data?.id);
  }

  async function handleDeleteDirectory(dir) {
    const { count } = await supabaseBrowser
      .from('directory_entries')
      .select('id', { count: 'exact', head: true })
      .eq('directory_kind', dir.slug);
    if (count > 0) {
      await alertUser(`"${dir.name}" still has ${count} entr${count === 1 ? 'y' : 'ies'}. Delete or move those first.`, { title: 'Directory not empty' });
      return;
    }
    if (!(await confirm(`Delete the "${dir.name}" directory? This can't be undone.`, { title: 'Delete directory?', confirmLabel: 'Delete', danger: true }))) return;
    await supabaseBrowser.from('directories').delete().eq('id', dir.id);
    const remaining = directories.filter((d) => d.id !== dir.id);
    if (activeDirId === dir.id) setActiveDirId(remaining[0]?.id ?? null);
    loadDirectories();
  }

  async function load() {
    if (!kind) return;
    const [{ data: rows }, { data: defs }] = await Promise.all([
      supabaseBrowser.from('directory_entries').select('*').eq('directory_kind', kind).order('sort_order'),
      supabaseBrowser.from('directory_field_definitions').select('*').or(`directory_kind.eq.${kind},directory_kind.is.null`).order('sort_order'),
    ]);
    setEntries(rows || []);
    setFieldDefs(defs || []);
  }

  React.useEffect(() => { setEntries(null); load(); }, [kind]);

  async function move(row, direction) {
    const idx = entries.findIndex((e) => e.id === row.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= entries.length) return;
    const other = entries[swapIdx];
    await Promise.all([
      supabaseBrowser.from('directory_entries').update({ sort_order: other.sort_order }).eq('id', row.id),
      supabaseBrowser.from('directory_entries').update({ sort_order: row.sort_order }).eq('id', other.id),
    ]);
    load();
  }

  async function toggleStatus(row) {
    await supabaseBrowser.from('directory_entries').update({ status: row.status === 'published' ? 'draft' : 'published' }).eq('id', row.id);
    load();
  }

  async function handleDelete(row) {
    if (!(await confirm(`Delete "${row.name}"? This can't be undone.`, { title: 'Delete entry?', confirmLabel: 'Delete', danger: true }))) return;
    await supabaseBrowser.from('directory_entries').delete().eq('id', row.id);
    load();
  }

  async function handleSave(draft) {
    setSaving(true);
    if (draft.id) {
      const { id, ...patch } = draft;
      await supabaseBrowser.from('directory_entries').update(patch).eq('id', id);
    } else {
      const sortOrder = entries.length;
      await supabaseBrowser.from('directory_entries').insert({ ...draft, sort_order: sortOrder });
    }
    setSaving(false);
    setEditing(null);
    load();
  }

  return (
    <Card title="Directories">
      <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-small)', marginTop: 0 }}>
        Manage as many directories as you need -- Seminary Council, Missionaries, and Staff to start, plus any others you create. Add a "Directory Teaser" block to any page to display one publicly.
      </p>

      {directories === null ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          {directories.map((dir) => (
            <div key={dir.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
              <button
                onClick={() => setActiveDirId(dir.id)}
                className={'tab' + (dir.id === activeDirId ? ' active' : '')}
              >
                {dir.name}
              </button>
              <button onClick={() => handleDeleteDirectory(dir)} title={`Delete "${dir.name}" directory`} style={{ ...iconButtonStyle, color: 'var(--text-muted)' }}>
                <TrashIcon />
              </button>
            </div>
          ))}
          <button className="tab" onClick={() => setAddDirOpen(true)} style={{ color: 'var(--brand-secondary)' }}>+ New directory</button>
        </div>
      )}

      {activeDir && (
        <div style={{ margin: '0 0 var(--space-4)' }}>
          <Button variant="outline" onClick={() => setEditing(emptyEntry(kind))}>+ New {activeDir.singular_label || activeDir.name} Member</Button>
        </div>
      )}
      {entries === null ? (
        <p style={{ color: 'var(--text-secondary)' }}>{activeDir ? 'Loading…' : 'Create a directory to get started.'}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {entries.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-small)' }}>No {(activeDir?.name || '').toLowerCase()} entries yet.</p>
          )}
          {entries.map((row) => (
            <div
              key={row.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <button onClick={() => move(row, -1)} title="Move up" style={arrowStyle}>▲</button>
                <button onClick={() => move(row, 1)} title="Move down" style={arrowStyle}>▼</button>
              </div>
              {row.photo_url ? (
                <img src={row.photo_url} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--surface-muted)' }} />
              )}
              <div style={{ flex: 1 }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 'var(--fw-bold)', color: row.name ? 'var(--text-primary)' : 'var(--text-muted)' }}>{row.name || '(untitled entry)'}</span>
              </div>
              <Badge tone={row.status === 'published' ? 'success' : 'neutral'}>{row.status}</Badge>
              <Button variant="primary" size="sm" onClick={() => setEditing(row)}>Edit</Button>
              <button onClick={() => toggleStatus(row)} title={row.status === 'published' ? 'Published — click to unpublish' : 'Draft — click to publish'} style={iconButtonStyle}>
                {row.status === 'published' ? <EyeIcon /> : <EyeOffIcon />}
              </button>
              <button onClick={() => handleDelete(row)} title="Delete" style={{ ...iconButtonStyle, color: 'var(--color-error)' }}>
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EntryDialog
          entry={editing}
          fieldDefs={fieldDefs}
          saving={saving}
          onCancel={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

      {addDirOpen && (
        <NewDirectoryDialog onCancel={() => setAddDirOpen(false)} onCreate={handleCreateDirectory} />
      )}
    </Card>
  );
}

function NewDirectoryDialog({ onCancel, onCreate }) {
  const [name, setName] = React.useState('');
  const [creating, setCreating] = React.useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    await onCreate(name.trim());
    setCreating(false);
  }

  return (
    <Dialog open title="New directory" onClose={onCancel}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minWidth: 320 }}>
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Youth Leaders" />
        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" disabled={creating || !name.trim()}>{creating ? 'Creating…' : 'Create'}</Button>
        </div>
      </form>
    </Dialog>
  );
}

function EntryDialog({ entry, fieldDefs, saving, onCancel, onSave }) {
  const confirm = useConfirm();
  const [draft, setDraft] = React.useState(entry);
  const [addingKey, setAddingKey] = React.useState('');

  const usedKeys = new Set(Object.keys(draft.extra_fields || {}));
  const availableDefs = fieldDefs.filter((d) => !usedKeys.has(d.field_key));

  function patch(p) { setDraft((d) => ({ ...d, ...p })); }
  function patchExtra(key, value) { setDraft((d) => ({ ...d, extra_fields: { ...d.extra_fields, [key]: value } })); }
  function removeExtra(key) {
    setDraft((d) => {
      const next = { ...d.extra_fields };
      delete next[key];
      return { ...d, extra_fields: next };
    });
  }
  function addField() {
    if (!addingKey) return;
    patchExtra(addingKey, '');
    setAddingKey('');
  }

  // Photo/name/bio are strongly suggested, not hard-required -- an admin can
  // save a partial entry (e.g. just a photo) to come back to later. To avoid
  // an accidental one-click save of a near-empty entry, saving with any of
  // these missing requires a second confirming click, same pattern as the
  // delete confirmations elsewhere in this screen.
  const missing = [
    !draft.photo_url && 'a photo',
    !draft.name.trim() && 'a name',
    !draft.bio.trim() && 'a bio',
  ].filter(Boolean);

  async function handleSaveClick() {
    if (missing.length > 0 && !(await confirm(`This entry is missing ${missing.join(', ')}. Save it anyway?`, { title: 'Missing information', confirmLabel: 'Save anyway' }))) return;
    onSave(draft);
  }

  return (
    <Dialog open title={entry.id ? `Edit ${draft.name || 'entry'}` : 'New entry'} onClose={onCancel}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minWidth: 380, maxWidth: 480 }}>
        <ImageUploadField label="Photo (recommended)" value={draft.photo_url} onChange={(url) => patch({ photo_url: url })} pathPrefix={`directory/${draft.directory_kind}`} />
        <Input label="Name (recommended)" value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
        <Textarea label="Bio (recommended)" value={draft.bio} onChange={(e) => patch({ bio: e.target.value })} rows={4} />
        <Select
          label="Status"
          value={draft.status}
          options={[{ value: 'draft', label: 'Draft (hidden from public)' }, { value: 'published', label: 'Published' }]}
          onChange={(e) => patch({ status: e.target.value })}
        />

        {Object.entries(draft.extra_fields || {}).map(([key, value]) => {
          const def = fieldDefs.find((d) => d.field_key === key);
          return (
            <div key={key} style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <Input label={def?.label || key} value={value} onChange={(e) => patchExtra(key, e.target.value)} />
              </div>
              <button onClick={() => removeExtra(key)} title="Remove this field" style={{ ...iconButtonStyle, color: 'var(--color-error)', marginBottom: 8 }}>
                <TrashIcon />
              </button>
            </div>
          );
        })}

        {availableDefs.length > 0 && (
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <Select
                label="Add an optional field"
                value={addingKey}
                options={[{ value: '', label: 'Choose a field…' }, ...availableDefs.map((d) => ({ value: d.field_key, label: d.label }))]}
                onChange={(e) => setAddingKey(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" disabled={!addingKey} onClick={addField}>Add</Button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" disabled={saving} onClick={handleSaveClick}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    </Dialog>
  );
}

const arrowStyle = { border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10, lineHeight: '12px', padding: 0 };
const iconButtonStyle = { border: 'none', background: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' };

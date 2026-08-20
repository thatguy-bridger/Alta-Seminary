import React from 'react';
import { supabaseBrowser } from '../../lib/supabase/browser-client';
import { Card } from '../../design-system/components/core/Card.jsx';
import { Badge } from '../../design-system/components/core/Badge.jsx';
import { Button } from '../../design-system/components/forms/Button.jsx';
import { Input } from '../../design-system/components/forms/Input.jsx';
import { Textarea } from '../../design-system/components/forms/Textarea.jsx';
import { Select } from '../../design-system/components/forms/Select.jsx';
import { Switch } from '../../design-system/components/forms/Switch.jsx';
import { Dialog } from '../../design-system/components/core/Dialog.jsx';
import { EyeIcon, EyeOffIcon, TrashIcon } from '../icons.jsx';
import { useConfirm } from '../ConfirmProvider.jsx';
import { useBulkListShortcuts } from '../useBulkListShortcuts.js';
import { useModKeyLabel } from '../useModKeyLabel.js';

const emptyEvent = () => ({
  title: '', description: '', location: '', start_at: '', end_at: '', all_day: false, status: 'draft',
});

// Datetime-local inputs need "YYYY-MM-DDTHH:mm" with no timezone suffix;
// Postgres timestamptz values round-trip as ISO strings with one, so this
// pair of helpers strips/restores that for the form fields specifically.
function toLocalInputValue(isoString, allDay) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return allDay ? date : `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(value, allDay) {
  if (!value) return null;
  const iso = allDay ? new Date(`${value}T00:00`).toISOString() : new Date(value).toISOString();
  return iso;
}

export function EventsScreen() {
  const confirm = useConfirm();
  const modKeyLabel = useModKeyLabel();
  const [events, setEvents] = React.useState(null);
  const [editing, setEditing] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [selected, setSelected] = React.useState(() => new Set());

  async function load() {
    const { data } = await supabaseBrowser.from('calendar_events').select('*').order('start_at', { ascending: false });
    setEvents(data || []);
  }

  React.useEffect(() => { load(); }, []);

  const filtered = React.useMemo(() => {
    if (!events) return events;
    const q = query.trim().toLowerCase();
    return q ? events.filter((e) => e.title.toLowerCase().includes(q) || (e.location || '').toLowerCase().includes(q)) : events;
  }, [events, query]);

  function toggleSelected(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    setSelected((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((e) => e.id))));
  }

  useBulkListShortcuts({
    selected, setSelected,
    allIds: filtered ? filtered.map((e) => e.id) : [],
    onDeleteSelected: handleBulkDelete,
  });

  async function toggleStatus(row) {
    await supabaseBrowser.from('calendar_events').update({ status: row.status === 'published' ? 'draft' : 'published' }).eq('id', row.id);
    load();
  }

  async function handleDelete(row) {
    if (!(await confirm(`Delete "${row.title}"? This can't be undone.`, { title: 'Delete event?', confirmLabel: 'Delete', danger: true }))) return;
    await supabaseBrowser.from('calendar_events').delete().eq('id', row.id);
    load();
  }

  async function handleBulkDelete() {
    if (!(await confirm(`Delete ${selected.size} event${selected.size > 1 ? 's' : ''}? This can't be undone.`, { title: 'Delete events?', confirmLabel: 'Delete', danger: true }))) return;
    await supabaseBrowser.from('calendar_events').delete().in('id', [...selected]);
    setSelected(new Set());
    load();
  }
  async function handleBulkStatus(status) {
    await supabaseBrowser.from('calendar_events').update({ status }).in('id', [...selected]);
    setSelected(new Set());
    load();
  }

  async function handleSave(draft) {
    setSaving(true);
    const patch = {
      title: draft.title.trim(),
      description: draft.description || null,
      location: draft.location || null,
      start_at: fromLocalInputValue(draft.start_at, draft.all_day),
      end_at: fromLocalInputValue(draft.end_at, draft.all_day),
      all_day: draft.all_day,
      status: draft.status,
    };
    if (draft.id) {
      await supabaseBrowser.from('calendar_events').update(patch).eq('id', draft.id);
    } else {
      await supabaseBrowser.from('calendar_events').insert(patch);
    }
    setSaving(false);
    setEditing(null);
    load();
  }

  if (events === null) {
    return <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>;
  }

  return (
    <Card title="Events">
      <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-small)', marginTop: 0 }}>
        Events shown on the public Events page. Add an "Events Teaser" block to any page to display upcoming events there too.
      </p>
      <div style={{ marginBottom: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
        <Button variant="outline" onClick={() => setEditing(emptyEvent())}>+ New Event</Button>
        <div style={{ flex: 1, minWidth: 200 }}>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by title or location…" aria-label="Filter events" />
        </div>
      </div>

      {selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)' }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', fontWeight: 'var(--fw-bold)' }}>{selected.size} selected</span>
          <Button variant="ghost" size="sm" onClick={() => handleBulkStatus('published')}>Publish</Button>
          <Button variant="ghost" size="sm" onClick={() => handleBulkStatus('draft')}>Unpublish</Button>
          <Button variant="ghost" size="sm" onClick={handleBulkDelete}>Delete</Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {filtered.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-small)' }}>
            {events.length === 0 ? 'No events yet.' : 'No events match that filter.'}
          </p>
        )}
        {filtered.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', padding: '0 var(--space-3)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={selected.size === filtered.length} onChange={toggleSelectAll} />
              Select all
            </label>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>
              <kbd>{modKeyLabel}A</kbd> select all · <kbd>Delete</kbd> remove selected · <kbd>Esc</kbd> clear
            </span>
          </div>
        )}
        {filtered.map((row) => (
          <div
            key={row.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
              padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
            }}
          >
            <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleSelected(row.id)} aria-label={`Select ${row.title}`} />
            <div style={{ flex: 1 }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>{row.title}</span>
              <span style={{ marginLeft: 'var(--space-3)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>
                {new Date(row.start_at).toLocaleString(undefined, row.all_day ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                {row.location ? ` · ${row.location}` : ''}
              </span>
            </div>
            <Badge tone={row.status === 'published' ? 'success' : 'neutral'}>{row.status}</Badge>
            <Button variant="primary" size="sm" onClick={() => setEditing({
              ...row,
              start_at: toLocalInputValue(row.start_at, row.all_day),
              end_at: toLocalInputValue(row.end_at, row.all_day),
              description: row.description || '',
              location: row.location || '',
            })}>Edit</Button>
            <button onClick={() => toggleStatus(row)} title={row.status === 'published' ? 'Published — click to unpublish' : 'Draft — click to publish'} style={iconButtonStyle}>
              {row.status === 'published' ? <EyeIcon /> : <EyeOffIcon />}
            </button>
            <button onClick={() => handleDelete(row)} title="Delete" style={{ ...iconButtonStyle, color: 'var(--color-error)' }}>
              <TrashIcon />
            </button>
          </div>
        ))}
      </div>

      {editing && (
        <EventDialog
          event={editing}
          saving={saving}
          onCancel={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </Card>
  );
}

function EventDialog({ event, saving, onCancel, onSave }) {
  const [draft, setDraft] = React.useState(event);
  function patch(p) { setDraft((d) => ({ ...d, ...p })); }

  function toggleAllDay(checked) {
    // Re-derive the input values for the new field type (date vs datetime-local)
    // from whatever's currently in the (still-string) fields, so switching
    // doesn't silently blank out a time the admin already picked.
    patch({
      all_day: checked,
      start_at: draft.start_at ? draft.start_at.slice(0, 10) : '',
      end_at: draft.end_at ? draft.end_at.slice(0, 10) : '',
    });
  }

  const canSave = draft.title.trim() && draft.start_at;

  return (
    <Dialog open title={event.id ? `Edit ${draft.title || 'event'}` : 'New event'} onClose={onCancel}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minWidth: 380, maxWidth: 480 }}>
        <Input label="Title" value={draft.title} onChange={(e) => patch({ title: e.target.value })} placeholder="e.g. Fall Fireside" />
        <Textarea label="Description (optional)" value={draft.description} onChange={(e) => patch({ description: e.target.value })} rows={3} />
        <Input label="Location (optional)" value={draft.location} onChange={(e) => patch({ location: e.target.value })} placeholder="e.g. Seminary Building, Room 4" />
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', color: 'var(--text-primary)' }}>
          <Switch checked={draft.all_day} onChange={(e) => toggleAllDay(e.target.checked)} />
          All-day event
        </label>
        <Input label="Starts" type={draft.all_day ? 'date' : 'datetime-local'} value={draft.start_at} onChange={(e) => patch({ start_at: e.target.value })} />
        <Input label="Ends (optional)" type={draft.all_day ? 'date' : 'datetime-local'} value={draft.end_at} onChange={(e) => patch({ end_at: e.target.value })} />
        <Select
          label="Status"
          value={draft.status}
          options={[{ value: 'draft', label: 'Draft (hidden from public)' }, { value: 'published', label: 'Published' }]}
          onChange={(e) => patch({ status: e.target.value })}
        />
        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" disabled={saving || !canSave} onClick={() => onSave(draft)}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    </Dialog>
  );
}

const iconButtonStyle = { border: 'none', background: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' };

import React from 'react';
import { Input } from '../design-system/components/forms/Input.jsx';
import { Textarea } from '../design-system/components/forms/Textarea.jsx';
import { Select } from '../design-system/components/forms/Select.jsx';
import { Switch } from '../design-system/components/forms/Switch.jsx';
import { Button } from '../design-system/components/forms/Button.jsx';
import { Dialog } from '../design-system/components/core/Dialog.jsx';

export const emptyEvent = () => ({
  title: '', description: '', location: '', start_at: '', end_at: '', all_day: false, status: 'draft',
});

// Datetime-local inputs need "YYYY-MM-DDTHH:mm" with no timezone suffix;
// Postgres timestamptz values round-trip as ISO strings with one, so this
// pair of helpers strips/restores that for the form fields specifically.
export function toLocalInputValue(isoString, allDay) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return allDay ? date : `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInputValue(value, allDay) {
  if (!value) return null;
  return allDay ? new Date(`${value}T00:00`).toISOString() : new Date(value).toISOString();
}

// Turns a calendar_events row into the string-valued shape EventDialog edits.
export function eventToDraft(row) {
  return {
    ...row,
    start_at: toLocalInputValue(row.start_at, row.all_day),
    end_at: toLocalInputValue(row.end_at, row.all_day),
    description: row.description || '',
    location: row.location || '',
  };
}

// The inverse -- what actually gets written to calendar_events on save.
export function draftToEventPatch(draft) {
  return {
    title: draft.title.trim(),
    description: draft.description || null,
    location: draft.location || null,
    start_at: fromLocalInputValue(draft.start_at, draft.all_day),
    end_at: fromLocalInputValue(draft.end_at, draft.all_day),
    all_day: draft.all_day,
    status: draft.status,
  };
}

export function EventDialog({ event, saving, onCancel, onSave }) {
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

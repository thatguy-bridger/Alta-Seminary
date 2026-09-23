import React from 'react';
import { Dialog } from '../design-system/components/core/Dialog.jsx';
import { Input } from '../design-system/components/forms/Input.jsx';
import { Button } from '../design-system/components/forms/Button.jsx';
import { Switch } from '../design-system/components/forms/Switch.jsx';
import { crossCreateLabel } from './crossCreate.js';

// Only ever opened when buildCrossCreateDraft() found something a new
// event/announcement/album genuinely needs that it couldn't confidently
// fill in from the source item (currently: an event's start date/time --
// see crossCreate.js's parseDateTimeFromText). Shows the fields it DID
// manage to fill in too, editable, so the admin can fix a wrong guess
// before creating anything, not just fill in the gap.
export function CrossCreateMissingFieldsDialog({ targetKind, initialDraft, saving, onCancel, onConfirm }) {
  const [draft, setDraft] = React.useState(initialDraft);
  function patch(p) { setDraft((d) => ({ ...d, ...p })); }

  const canSave = targetKind !== 'event' || (draft.title?.trim() && draft.start_at);

  return (
    <Dialog open title={`New ${crossCreateLabel(targetKind)} — a couple more details`} onClose={onCancel}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minWidth: 340, maxWidth: 460 }}>
        {targetKind === 'event' && (
          <>
            <Input label="Title" value={draft.title} onChange={(e) => patch({ title: e.target.value })} />
            <Input label="Location (optional)" value={draft.location} onChange={(e) => patch({ location: e.target.value })} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', color: 'var(--text-primary)' }}>
              <Switch checked={draft.all_day} onChange={(e) => patch({ all_day: e.target.checked, start_at: draft.start_at ? draft.start_at.slice(0, 10) : '' })} />
              All-day event
            </label>
            <Input
              label="When does this happen? (couldn't find a date in the original text)"
              type={draft.all_day ? 'date' : 'datetime-local'}
              value={draft.start_at}
              onChange={(e) => patch({ start_at: e.target.value })}
            />
          </>
        )}
        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" disabled={saving || !canSave} onClick={() => onConfirm(draft)}>{saving ? 'Creating…' : 'Create & link'}</Button>
        </div>
      </div>
    </Dialog>
  );
}

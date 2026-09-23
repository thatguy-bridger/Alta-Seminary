import React from 'react';
import { CROSS_CREATE_TARGETS, crossCreateLabel, buildCrossCreateDraft, createCrossLinkedItem } from './crossCreate.js';
import { CrossCreateMissingFieldsDialog } from './CrossCreateMissingFieldsDialog.jsx';
import { withBase } from '../lib/url.js';

// "+ Create & link a new X" row, shown under an event/announcement/album's
// own linked-content panel -- one shared component instead of each screen
// hand-rolling its own pair (this generalizes what used to be an
// EventsScreen-only feature, event -> announcement/album, to every
// direction in CROSS_CREATE_TARGETS). Clicking a target that
// buildCrossCreateDraft() could fill in completely creates & links
// immediately, same fast path as before; one that's missing something (most
// commonly: an event's date, when the source has no reliable date text to
// parse) opens a small dialog asking just for that.
export function CrossCreateButtons({ sourceKind, sourceRow, onCreated }) {
  const [pending, setPending] = React.useState(null); // { targetKind, draft }
  const [saving, setSaving] = React.useState(false);
  const targets = CROSS_CREATE_TARGETS[sourceKind] || [];

  async function handleClick(targetKind) {
    const { draft, missing } = buildCrossCreateDraft(sourceKind, sourceRow, targetKind);
    if (missing.length === 0) {
      await finish(targetKind, draft);
    } else {
      setPending({ targetKind, draft });
    }
  }

  async function finish(targetKind, draft) {
    setSaving(true);
    const result = await createCrossLinkedItem(sourceKind, sourceRow.id, targetKind, draft);
    setSaving(false);
    setPending(null);
    if (!result) return;
    if (result.redirect) {
      window.location.href = withBase(result.redirect);
    } else {
      onCreated?.();
    }
  }

  if (targets.length === 0) return null;

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginTop: 'var(--space-2)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)' }}>
        {targets.map((targetKind) => (
          <button key={targetKind} onClick={() => handleClick(targetKind)} style={linkBtnStyle}>
            + Create &amp; link a new {crossCreateLabel(targetKind)}
          </button>
        ))}
      </div>
      {pending && (
        <CrossCreateMissingFieldsDialog
          targetKind={pending.targetKind}
          initialDraft={pending.draft}
          saving={saving}
          onCancel={() => setPending(null)}
          onConfirm={(draft) => finish(pending.targetKind, draft)}
        />
      )}
    </>
  );
}

const linkBtnStyle = { border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-link)', fontFamily: 'inherit', fontSize: 'inherit' };

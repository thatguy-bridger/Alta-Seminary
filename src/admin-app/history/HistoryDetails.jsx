import React from 'react';
import { BlockRenderer } from '../../blocks/BlockRenderer.jsx';
import { diffRecord, formatDiffValue, IMAGE_KEYS } from './diff.js';

// Compact visual preview of a page/post's block content, scaled down to fit
// a small pane. Wrapped inert (pointer-events: none) since these blocks can
// include live things like a Contact Form or an embed -- this is a look-only
// preview of a past state, not a place to interact with one.
function BlocksPreview({ blocks, label }) {
  return (
    <div>
      <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ width: '100%', height: 220, overflow: 'hidden', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: 'var(--surface-page)' }}>
        {blocks.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-caption)', padding: 'var(--space-3)' }}>No content</p>
        ) : (
          <div style={{ width: '250%', transform: 'scale(0.4)', transformOrigin: 'top left', pointerEvents: 'none' }}>
            <BlockRenderer blocks={blocks} />
          </div>
        )}
      </div>
    </div>
  );
}

function ImageDiffRow({ change }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)' }}>
      <span style={{ color: 'var(--text-muted)', minWidth: 110 }}>{change.label}</span>
      {change.before ? <img src={change.before} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 'var(--radius-sm)', opacity: 0.6 }} /> : <span style={{ color: 'var(--text-muted)' }}>(none)</span>}
      <span style={{ color: 'var(--text-muted)' }}>→</span>
      {change.after ? <img src={change.after} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} /> : <span style={{ color: 'var(--text-muted)' }}>(none)</span>}
    </div>
  );
}

function FieldDiffRow({ change }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', flexWrap: 'wrap' }}>
      <span style={{ color: 'var(--text-muted)', minWidth: 110 }}>{change.label}</span>
      <span style={{ color: 'var(--text-secondary)', textDecoration: change.before != null && change.before !== '' ? 'line-through' : 'none' }}>
        {formatDiffValue(change.before)}
      </span>
      <span style={{ color: 'var(--text-muted)' }}>→</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: 'var(--fw-bold)' }}>{formatDiffValue(change.after)}</span>
    </div>
  );
}

// Parses a change_log row's raw before_data/after_data into readable field
// changes, with a rendered (non-interactive) preview standing in for the
// two page/post content snapshots rather than a literal screenshot.
export function HistoryDetails({ row }) {
  const { fieldChanges, blocksChange } = diffRecord(row.before_data, row.after_data);

  if (fieldChanges.length === 0 && !blocksChange) {
    return <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-caption)' }}>No field-level changes recorded.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-2)', maxWidth: 640 }}>
      {fieldChanges.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {fieldChanges.map((change) =>
            IMAGE_KEYS.has(change.key) ? <ImageDiffRow key={change.key} change={change} /> : <FieldDiffRow key={change.key} change={change} />
          )}
        </div>
      )}
      {blocksChange && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <BlocksPreview blocks={blocksChange.before} label="Before" />
          <BlocksPreview blocks={blocksChange.after} label="After" />
        </div>
      )}
    </div>
  );
}

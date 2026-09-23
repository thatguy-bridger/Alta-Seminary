import React from 'react';
import { Select } from '../design-system/components/forms/Select.jsx';
import { linkContent, unlinkContent, fetchLinkedItems, fetchAllOfKind, CONTENT_KINDS, kindLabel, kindIcon } from './contentLinks.js';

// "Everything communicates the same way": dropped identically into
// EventsScreen.jsx (per event), PostsListScreen.jsx (per announcement),
// and GalleryScreen.jsx (per active album) -- shows whatever's already
// linked to THIS item (from either direction) as removable chips, plus a
// picker to link an existing item of either other kind. `kind`/`id` are
// this item's own; `title` is only used in the unlink confirm.
// `refreshToken` (optional): bump it from outside to force a re-fetch of
// this item's links without remounting the whole panel (and losing the
// picker's own open state) -- needed because CrossCreateButtons.jsx links a
// new item from a SIBLING component, which this panel has no other way to
// find out about; its own load() only ever re-runs on kind/id changing or
// its own link/unlink actions.
export function LinkedContentPanel({ kind, id, title, refreshToken }) {
  const [linked, setLinked] = React.useState(null);
  const otherKinds = CONTENT_KINDS.filter((k) => k !== kind);
  const [pickerKind, setPickerKind] = React.useState(otherKinds[0]);
  const [pickerOptions, setPickerOptions] = React.useState(null);
  const [pickerId, setPickerId] = React.useState('');

  async function load() {
    setLinked(await fetchLinkedItems(kind, id));
  }
  React.useEffect(() => { load(); }, [kind, id, refreshToken]);

  React.useEffect(() => {
    setPickerOptions(null);
    setPickerId('');
    fetchAllOfKind(pickerKind).then(setPickerOptions);
  }, [pickerKind]);

  async function handleLink() {
    if (!pickerId) return;
    await linkContent(kind, id, pickerKind, pickerId);
    setPickerId('');
    load();
  }

  async function handleUnlink(item) {
    await unlinkContent(kind, id, item.kind, item.id);
    load();
  }

  // Already-linked items (of the picker's own kind) and this item itself
  // (only relevant when pickerKind === kind, i.e. never here since
  // otherKinds excludes it -- kept anyway in case that ever changes)
  // don't need to show up again as pickable options.
  const linkedIds = new Set((linked || []).filter((l) => l.kind === pickerKind).map((l) => l.id));
  const selectableOptions = (pickerOptions || []).filter((o) => o.id !== id && !linkedIds.has(o.id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {linked !== null && linked.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {linked.map((item) => (
            <span
              key={`${item.kind}-${item.id}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 8px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-subtle)',
                fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)',
              }}
            >
              {kindIcon(item.kind)}
              <a href={item.href} style={{ color: 'var(--text-link)' }}>{item.title}</a>
              <button
                onClick={() => handleUnlink(item)}
                title={`Unlink "${item.title}" from "${title}"`}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 1, fontSize: 14 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>Link existing:</span>
        <div style={{ minWidth: 130 }}>
          <Select
            value={pickerKind}
            options={otherKinds.map((k) => ({ value: k, label: kindLabel(k) }))}
            onChange={(e) => setPickerKind(e.target.value)}
          />
        </div>
        <div style={{ minWidth: 180 }}>
          <Select
            value={pickerId}
            options={[{ value: '', label: pickerOptions === null ? 'Loading…' : `Choose a ${kindLabel(pickerKind).toLowerCase()}…` }, ...selectableOptions.map((o) => ({ value: o.id, label: o.title }))]}
            onChange={(e) => setPickerId(e.target.value)}
          />
        </div>
        <button
          onClick={handleLink}
          disabled={!pickerId}
          style={{
            border: 'none', background: 'none', padding: 0, cursor: pickerId ? 'pointer' : 'default',
            color: pickerId ? 'var(--text-link)' : 'var(--text-muted)', fontFamily: 'inherit', fontSize: 'var(--fs-caption)',
          }}
        >
          Link
        </button>
      </div>
    </div>
  );
}

import React from 'react';
import { Dialog } from '../design-system/components/core/Dialog.jsx';
import { supabaseBrowser } from '../lib/supabase/browser-client';

// "Choose an existing image" -- every previous upload site-wide (see
// media_library tracking in imageUpload.js), newest first. Picking one just
// reuses its URL directly, no re-upload/re-crop -- it's already a finished
// asset exactly as it looked wherever it was first used.
export function MediaLibraryPicker({ open, onClose, onSelect }) {
  const [items, setItems] = React.useState(null);

  React.useEffect(() => {
    if (!open || items !== null) return;
    supabaseBrowser
      .from('media_library')
      .select('id, url')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => setItems(data || []));
  }, [open, items]);

  if (!open) return null;

  return (
    <Dialog open={open} title="Choose an existing image" onClose={onClose} wide>
      {items === null ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : items.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No images uploaded yet -- upload one first and it'll show up here next time.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 'var(--space-2)', maxHeight: '60vh', overflowY: 'auto' }}>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.url)}
              style={{ padding: 0, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', cursor: 'pointer', background: 'none' }}
            >
              <img src={item.url} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block' }} />
            </button>
          ))}
        </div>
      )}
    </Dialog>
  );
}

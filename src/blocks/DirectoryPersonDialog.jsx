import React from 'react';
import { Dialog } from '../design-system/components/core/Dialog.jsx';

// The "larger preview" opened when a visitor clicks a person card, either
// straight from a directory page or after being sent there from a teaser
// elsewhere (see DirectoryTeaserBlock.jsx). Always fetches fresh -- the
// teaser list only carries id/name/photo_url/bio, not extra_fields.
export function DirectoryPersonDialog({ personId, sourceType, onClose }) {
  const [entry, setEntry] = React.useState(null);
  const [fieldDefs, setFieldDefs] = React.useState([]);

  React.useEffect(() => {
    if (!personId) {
      setEntry(null);
      return;
    }
    let active = true;
    import('../lib/supabase/browser-client').then(({ supabaseBrowser }) =>
      import('./teaserData.js').then(({ fetchDirectoryEntry, fetchDirectoryFieldDefinitions }) => {
        Promise.all([
          fetchDirectoryEntry(supabaseBrowser, personId),
          fetchDirectoryFieldDefinitions(supabaseBrowser, sourceType),
        ]).then(([entryData, defs]) => {
          if (!active) return;
          setEntry(entryData);
          setFieldDefs(defs);
        });
      })
    );
    return () => { active = false; };
  }, [personId, sourceType]);

  const extraEntries = entry
    ? Object.entries(entry.extra_fields || {}).filter(([, value]) => value)
    : [];

  return (
    <Dialog open={!!personId} title={entry?.name || 'Loading…'} onClose={onClose}>
      {!entry ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {entry.photo_url && (
            <img
              src={entry.photo_url}
              alt=""
              style={{ width: 160, height: 160, objectFit: 'cover', borderRadius: 'var(--radius-md)', alignSelf: 'center' }}
            />
          )}
          {entry.bio && (
            <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-secondary)', margin: 0 }}>{entry.bio}</p>
          )}
          {extraEntries.length > 0 && (
            <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'var(--space-2) var(--space-4)', margin: 0 }}>
              {extraEntries.map(([key, value]) => {
                const label = fieldDefs.find((f) => f.field_key === key)?.label || key;
                return (
                  <React.Fragment key={key}>
                    <dt style={{ fontFamily: 'var(--font-sans)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>{label}</dt>
                    <dd style={{ margin: 0, fontFamily: 'var(--font-sans)', color: 'var(--text-secondary)' }}>{value}</dd>
                  </React.Fragment>
                );
              })}
            </dl>
          )}
        </div>
      )}
    </Dialog>
  );
}

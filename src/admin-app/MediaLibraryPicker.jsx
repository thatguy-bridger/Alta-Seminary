import React from 'react';
import { Dialog } from '../design-system/components/core/Dialog.jsx';
import { supabaseBrowser } from '../lib/supabase/browser-client';
import { useDebouncedValue, useImageSearch } from './gallery/useImageSearch.js';
import { ORIGINS, imageName, loadTags } from './gallery/imageLibrary.js';

// "Choose an existing image" -- the image library (see gallery/ImageLibrary.jsx): every picture used on the site, searchable by
// title, tags, description, alt text and credit. Picking one just reuses its address directly, no re-upload/re-crop -- it's already
// a finished asset exactly as it looked wherever it was first used. onSelect gets (url, image) so a caller can use the image's
// credit or description too.
export function MediaLibraryPicker({ open, onClose, onSelect, title = 'Choose an existing image', initialTag = '', db = supabaseBrowser }) {
  const [text, setText] = React.useState('');
  const [tag, setTag] = React.useState(initialTag);
  const [origin, setOrigin] = React.useState('');
  const [tags, setTags] = React.useState([]);
  const query = useDebouncedValue(text, 250);
  const search = useImageSearch({ query, tag, origin }, { enabled: open, db });

  React.useEffect(() => { if (open) loadTags(db).then(setTags); }, [open, db]);
  React.useEffect(() => { if (open) setTag(initialTag); }, [open, initialTag]);

  if (!open) return null;

  const filtered = Boolean(query.trim() || tag || origin);
  const field = { display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 140px', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' };
  return (
    <Dialog open={open} title={title} onClose={onClose} wide>
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
        <label style={{ ...field, flex: '2 1 220px' }}>Search
          <input className="input" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="A name, a place, a tag…" aria-label="Search pictures" />
        </label>
        <label style={field}>Tag
          <select className="select" value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Tag">
            <option value="">All tags</option>
            {tags.map((t) => <option key={t.tag} value={t.tag}>{t.tag} ({t.n})</option>)}
          </select>
        </label>
        <label style={field}>Where it came from
          <select className="select" value={origin} onChange={(e) => setOrigin(e.target.value)} aria-label="Where it came from">
            <option value="">Anywhere</option>
            {ORIGINS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>

      {search.error ? (
        <p role="alert" style={{ color: 'var(--color-error)' }}>Couldn't load the pictures: {search.error}</p>
      ) : !search.loaded ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : search.items.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>{filtered ? 'No picture matches that. Try fewer words.' : "No images uploaded yet -- upload one first and it'll show up here next time."}</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 'var(--space-2)', maxHeight: '52vh', overflowY: 'auto' }}>
          {search.items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.url, item)}
              title={[imageName(item), item.credit].filter(Boolean).join(' — ')}
              aria-label={`Use ${imageName(item)}`}
              style={{ padding: 0, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', cursor: 'pointer', background: 'none', textAlign: 'left' }}
            >
              <img src={item.url} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block' }} />
              <span style={{ display: 'block', padding: '2px 6px', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{imageName(item)}</span>
            </button>
          ))}
        </div>
      )}
      {search.hasMore && <p style={{ marginTop: 'var(--space-2)' }}><button type="button" className="btn btn-outline btn-sm" disabled={search.loading} onClick={search.loadMore}>{search.loading ? 'Loading…' : `Show more (${search.total - search.items.length} left)`}</button></p>}
    </Dialog>
  );
}

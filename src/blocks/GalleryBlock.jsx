import React from 'react';
import { EditableText } from '../admin-app/builder/EditableText.jsx';
import { textStyleToCss } from '../admin-app/builder/textStyle.js';

// See DirectoryTeaserBlock.jsx for the `items` pre-fetch-vs-client-fetch pattern.
export function GalleryBlock({ heading, albumFilter = 'all', columns = '3', count = '24', items, headingStyle, editable, onFieldChange }) {
  const [fetched, setFetched] = React.useState(null);
  const [openIndex, setOpenIndex] = React.useState(null);

  React.useEffect(() => {
    if (items !== undefined) return;
    let active = true;
    import('../lib/supabase/browser-client').then(({ supabaseBrowser }) =>
      import('./teaserData.js').then(({ fetchGalleryTeaserItems }) =>
        fetchGalleryTeaserItems(supabaseBrowser, albumFilter, count).then((data) => active && setFetched(data))
      )
    );
    return () => { active = false; };
  }, [items, albumFilter, count]);

  const list = items !== undefined ? items : fetched;

  return (
    <div>
      {(editable || heading) && (
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-heading)', margin: '0 0 var(--space-5)', textAlign: 'center', color: 'var(--text-primary)', ...textStyleToCss(headingStyle) }}>
          {editable ? (
            <EditableText value={heading} onCommit={(v) => onFieldChange('heading', v)} placeholder="Heading" styleValue={headingStyle} onStyleChange={(s) => onFieldChange('headingStyle', s)} />
          ) : heading}
        </h2>
      )}
      {list === null ? (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</p>
      ) : list.length === 0 ? (
        editable ? <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No published photos yet.</p> : null
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 'var(--space-3)' }}>
          {list.map((photo, idx) => (
            <button
              key={photo.id}
              onClick={!editable ? () => setOpenIndex(idx) : undefined}
              style={{ padding: 0, border: 'none', background: 'none', cursor: editable ? 'default' : 'zoom-in', display: 'block' }}
            >
              <img
                src={photo.image_url}
                alt={photo.alt_text || photo.caption || ''}
                loading="lazy"
                style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}
              />
            </button>
          ))}
        </div>
      )}
      {!editable && list && openIndex !== null && (
        <Lightbox photos={list} index={openIndex} onClose={() => setOpenIndex(null)} onNavigate={setOpenIndex} />
      )}
    </div>
  );
}

function Lightbox({ photos, index, onClose, onNavigate }) {
  const photo = photos[index];

  React.useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') onNavigate((index + 1) % photos.length);
      else if (e.key === 'ArrowLeft') onNavigate((index - 1 + photos.length) % photos.length);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [index, photos.length, onClose, onNavigate]);

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,22,0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1000, cursor: 'zoom-out', padding: 'var(--space-6)' }}
    >
      <img src={photo.image_url} alt={photo.alt_text || photo.caption || ''} style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 'var(--radius-md)' }} />
      {photo.caption && (
        <p style={{ color: '#fff', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', marginTop: 'var(--space-3)' }}>{photo.caption}</p>
      )}
      {photos.length > 1 && (
        <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-3)' }}>
          <button onClick={(e) => { e.stopPropagation(); onNavigate((index - 1 + photos.length) % photos.length); }} style={navButtonStyle}>‹ Prev</button>
          <button onClick={(e) => { e.stopPropagation(); onNavigate((index + 1) % photos.length); }} style={navButtonStyle}>Next ›</button>
        </div>
      )}
    </div>
  );
}

const navButtonStyle = { border: '1px solid rgba(255,255,255,0.4)', background: 'transparent', color: '#fff', borderRadius: 'var(--radius-sm)', padding: '6px 14px', cursor: 'pointer', fontFamily: 'var(--font-sans)' };

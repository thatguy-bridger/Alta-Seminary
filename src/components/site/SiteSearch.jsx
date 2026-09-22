import React from 'react';
import { Dialog } from '../../design-system/components/core/Dialog.jsx';
import { withBase } from '../../lib/url.js';

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const TYPE_LABEL = {
  page: 'Page', announcement: 'Announcement', directory: 'Directory',
  event: 'Event', gallery: 'Gallery',
};

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function SiteSearch() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [index, setIndex] = React.useState(null);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    setTimeout(() => inputRef.current?.focus(), 0);
    if (index !== null) return;
    fetch(withBase('/search-index.json'))
      .then((res) => (res.ok ? res.json() : []))
      .then(setIndex)
      .catch(() => setIndex([]));
  }, [open, index]);

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !index) return [];
    return index
      .filter((item) => [item.title, item.description, item.location, formatDate(item.date)]
        .some((field) => field && field.toLowerCase().includes(q)))
      .slice(0, 10);
  }, [query, index]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Search the site"
        title="Search (⌘K)"
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-default)', background: 'var(--surface-card)', color: 'var(--text-primary)', cursor: 'pointer' }}
      >
        <SearchIcon />
      </button>

      <Dialog open={open} title="Search" onClose={() => { setOpen(false); setQuery(''); }} wide>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search pages, announcements, directory, events, gallery…"
          className="input"
          style={{ width: '100%', marginBottom: 'var(--space-4)' }}
        />
        {index === null ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-small)' }}>Loading…</p>
        ) : query.trim() && results.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-small)' }}>No matches for "{query}".</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {results.map((item, idx) => (
              <li key={`${item.path}-${item.title}-${idx}`}>
                <a
                  href={withBase(item.path)}
                  style={{ display: 'block', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', textDecoration: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                    <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>{item.title}</div>
                    {TYPE_LABEL[item.type] && (
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-tiny, 0.75rem)', color: 'var(--text-muted)', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        {TYPE_LABEL[item.type]}
                      </span>
                    )}
                  </div>
                  {(item.date || item.location) && (
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', color: 'var(--text-link)', marginTop: 2 }}>
                      {[formatDate(item.date), item.location].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  {item.description && (
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', color: 'var(--text-muted)', marginTop: 2 }}>{item.description}</div>
                  )}
                </a>
              </li>
            ))}
          </ul>
        )}
      </Dialog>
    </>
  );
}

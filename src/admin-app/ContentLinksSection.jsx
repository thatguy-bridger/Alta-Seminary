import React from 'react';
import { LinkedContentPanel } from './LinkedContentPanel.jsx';
import { CrossCreateButtons } from './CrossCreateButtons.jsx';
import { fetchLinkedItems } from './contentLinks.js';

// Collapses LinkedContentPanel's chips/picker AND CrossCreateButtons' "+
// Create & link a new X" shortcuts behind one small disclosure toggle,
// closed by default -- dropped in wherever those two used to always render
// open (EventsScreen.jsx/PostsListScreen.jsx/GalleryScreen.jsx). Having
// both permanently expanded made every single row in a list visibly taller
// and busier than the row's own actual content (title, status, actions),
// even for an item with nothing linked yet -- exactly what got convoluted
// once a list held more than a handful of items. Collapsed, the toggle
// itself still says how many links exist (fetched once here, independent
// of LinkedContentPanel's own internal fetch, which only runs once expanded)
// so "there's nothing here" or "there's 3 things here" is visible without
// opening it.
export function ContentLinksSection({ kind, id, title, refreshToken, sourceKind, sourceRow, onLinkVersionBump }) {
  const [open, setOpen] = React.useState(false);
  const [count, setCount] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;
    fetchLinkedItems(kind, id).then((items) => { if (!cancelled) setCount(items.length); });
    return () => { cancelled = true; };
  }, [kind, id, refreshToken]);

  return (
    <div style={{ marginTop: 'var(--space-2)' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          border: 'none', background: 'none', padding: '2px 0', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)',
          color: count ? 'var(--text-link)' : 'var(--text-muted)',
        }}
      >
        <span aria-hidden style={{ display: 'inline-block', transition: 'transform var(--duration-fast)', transform: open ? 'rotate(90deg)' : 'none' }}>›</span>
        {count === null ? 'Links…' : count > 0 ? `🔗 ${count} linked` : 'Link to an event, announcement, or album'}
      </button>
      {open && (
        <div style={{ marginTop: 'var(--space-2)', paddingLeft: 'var(--space-4)', borderLeft: '2px solid var(--border-subtle)' }}>
          <LinkedContentPanel kind={kind} id={id} title={title} refreshToken={refreshToken} />
          <CrossCreateButtons sourceKind={sourceKind} sourceRow={sourceRow} onCreated={onLinkVersionBump} />
        </div>
      )}
    </div>
  );
}

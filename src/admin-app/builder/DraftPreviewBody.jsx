import React from 'react';
import { BlockRenderer } from '../../blocks/BlockRenderer.jsx';

// Mounted (client:only) inside preview-frame.astro's own real page --
// deliberately empty until the parent admin tab hands it content over
// postMessage, rather than fetching draft_blocks itself. That keeps this
// route free of any database access (nothing here to secure), and -- more
// importantly -- means the preview reflects whatever's currently being
// typed in the editor, not just whatever autosave last managed to write to
// the database a second or two ago.
//
// The whole reason this route exists at all: the OLD "Preview" tab
// re-rendered BlockRenderer in a width-constrained <div> inside the SAME
// admin document. That looks narrower, but every block's fluid font-size
// (fluidClamp() in textStyle.js, and the design system's own --fs-* tokens)
// is computed from `vw` units, which are relative to the REAL browser
// viewport -- not any div's width. A "Mobile" preview at 390px still
// measured `vw` off the full-width admin window, so text never actually
// shrank and reliably overflowed. Loading this as a genuine <iframe> gives
// it its own real `window.innerWidth`, so `vw`-based sizing responds
// exactly the way it would on an actual phone -- a true mock, not an
// approximation.
export function DraftPreviewBody() {
  const [blocks, setBlocks] = React.useState(null);

  React.useEffect(() => {
    function handleMessage(event) {
      if (event.source !== window.parent || event.origin !== window.location.origin) return;
      if (event.data?.type !== 'alta-preview-blocks') return;
      setBlocks(event.data.blocks || []);
    }
    window.addEventListener('message', handleMessage);
    // Tells the parent it's safe to start sending updates -- without this,
    // a message posted before this listener was attached (a real race,
    // this component mounts asynchronously under client:only) would be
    // silently missed and the frame would just stay blank until the next edit.
    window.parent.postMessage({ type: 'alta-preview-ready' }, window.location.origin);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  if (blocks === null) {
    return (
      <div style={{ padding: 'var(--space-16)', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
        Loading preview…
      </div>
    );
  }
  if (blocks.length === 0) {
    return (
      <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-16) 0' }}>
        No blocks yet — add some in the Edit tab.
      </p>
    );
  }
  return <BlockRenderer blocks={blocks} />;
}

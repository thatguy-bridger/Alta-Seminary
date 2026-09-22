import React from 'react';
import { DEFAULT_LAYOUT } from './registry.js';

const SPACING_VAR = { none: '0', sm: 'var(--space-4)', md: 'var(--space-8)', lg: 'var(--space-16)', xl: 'var(--space-24)' };

// Universal per-block layout (spacing/contained/background) -- applied the same
// way whether rendering statically (Astro build, public site, Preview tab) or
// interactively (the admin edit canvas). See registry.js DEFAULT_LAYOUT/LAYOUT_FIELDS.
export function BlockWrapper({ layout, children }) {
  const l = { ...DEFAULT_LAYOUT, ...layout };
  const background = l.background === 'sunken' ? 'var(--surface-sunken)' : l.background === 'inverse' ? 'var(--surface-inverse)' : undefined;
  const color = l.background === 'inverse' ? 'var(--text-on-inverse)' : undefined;

  return (
    // .reveal-on-scroll: purely inert here -- the CSS/JS that actually
    // defines the fade/glide-in effect only ever loads on public pages
    // (PublicLayout.astro), never in the admin app (a separate React SPA
    // that doesn't use that layout at all), so this same shared wrapper is
    // safe to use for BOTH the admin edit canvas (EditableCanvas.jsx) and
    // the public site/Preview tab (BlockRenderer.jsx) without an editor
    // ever seeing blocks fade in while they're trying to work on them.
    <div id={l.anchor || undefined} className="reveal-on-scroll" style={{ padding: `${SPACING_VAR[l.spacing] || SPACING_VAR.md} 0`, background, color, scrollMarginTop: 'var(--space-16)' }}>
      <div style={{ maxWidth: l.contained ? 640 : undefined, marginLeft: l.contained ? 'auto' : undefined, marginRight: l.contained ? 'auto' : undefined }}>
        {children}
      </div>
    </div>
  );
}

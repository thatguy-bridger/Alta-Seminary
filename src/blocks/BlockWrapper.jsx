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
    <div id={l.anchor || undefined} style={{ padding: `${SPACING_VAR[l.spacing] || SPACING_VAR.md} 0`, background, color, scrollMarginTop: 'var(--space-16)' }}>
      <div style={{ maxWidth: l.contained ? 640 : undefined, marginLeft: l.contained ? 'auto' : undefined, marginRight: l.contained ? 'auto' : undefined }}>
        {children}
      </div>
    </div>
  );
}

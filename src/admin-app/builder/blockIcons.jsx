import React from 'react';

// Small hand-drawn glyphs for the "Add a block" picker, keyed by the `icon`
// string on each BLOCK_REGISTRY entry -- matches the rest of the admin UI's
// line-icon style (see icons.jsx). Purely a picker aid, not used anywhere
// content is actually rendered.
const props = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', width: 20, height: 20 };

const ICONS = {
  type: () => (
    <svg {...props}><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></svg>
  ),
  'align-left': () => (
    <svg {...props}><line x1="21" y1="6" x2="3" y2="6" /><line x1="17" y1="10" x2="3" y2="10" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="17" y1="18" x2="3" y2="18" /></svg>
  ),
  image: () => (
    <svg {...props}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
  ),
  'columns-2': () => (
    <svg {...props}><rect x="3" y="4" width="7" height="16" rx="1" /><rect x="14" y="4" width="7" height="16" rx="1" /></svg>
  ),
  'mouse-pointer-click': () => (
    <svg {...props}><path d="M4 4l7.07 17 2.51-7.39L21 11.07z" /></svg>
  ),
  'columns-3': () => (
    <svg {...props}><rect x="3" y="4" width="5" height="16" rx="1" /><rect x="9.5" y="4" width="5" height="16" rx="1" /><rect x="16" y="4" width="5" height="16" rx="1" /></svg>
  ),
  quote: () => (
    <svg {...props} fill="currentColor" stroke="none"><path d="M7 6C4.8 6 3 7.8 3 10v6h6v-6H6c0-1.1.9-2 2-2V6h-1zm10 0c-2.2 0-4 1.8-4 4v6h6v-6h-3c0-1.1.9-2 2-2V6h-1z" /></svg>
  ),
  minus: () => (
    <svg {...props}><line x1="4" y1="12" x2="20" y2="12" /></svg>
  ),
  map: () => (
    <svg {...props}><rect x="3" y="4" width="18" height="16" rx="2" /><polygon points="10 9 16 12 10 15" /></svg>
  ),
  'gallery-horizontal': () => (
    <svg {...props}><rect x="2" y="6" width="14" height="12" rx="2" /><path d="M17 7v10" /><path d="M20 9v6" /></svg>
  ),
  'share-2': () => (
    <svg {...props}><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><line x1="8.3" y1="10.7" x2="15.7" y2="6.3" /><line x1="8.3" y1="13.3" x2="15.7" y2="17.7" /></svg>
  ),
  download: () => (
    <svg {...props}><path d="M12 3v12" /><polyline points="7 11 12 16 17 11" /><line x1="4" y1="20" x2="20" y2="20" /></svg>
  ),
  megaphone: () => (
    <svg {...props}><path d="M3 11v2a2 2 0 002 2h1l3 5V4L6 9H5a2 2 0 00-2 2z" /><path d="M14 8a4 4 0 010 8" /><path d="M17 5a8 8 0 010 14" /></svg>
  ),
  users: () => (
    <svg {...props}><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.5" /><path d="M15 14.2c2.6.5 4.5 2.7 4.5 5.8" /></svg>
  ),
  calendar: () => (
    <svg {...props}><rect x="3" y="5" width="18" height="16" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="16" y1="3" x2="16" y2="7" /></svg>
  ),
  newspaper: () => (
    <svg {...props}><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="7" y1="8" x2="17" y2="8" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="7" y1="16" x2="13" y2="16" /></svg>
  ),
  mail: () => (
    <svg {...props}><rect x="3" y="5" width="18" height="14" rx="2" /><polyline points="3 7 12 13 21 7" /></svg>
  ),
};

const Fallback = () => <svg {...props}><rect x="4" y="4" width="16" height="16" rx="2" /></svg>;

export function BlockIcon({ name }) {
  const Icon = ICONS[name] || Fallback;
  return <Icon />;
}

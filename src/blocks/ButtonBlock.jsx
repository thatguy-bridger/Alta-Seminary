import React from 'react';
import { EditableText } from '../admin-app/builder/EditableText.jsx';
import { textStyleToCss } from '../admin-app/builder/textStyle.js';

const ICONS = {
  arrow: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  download: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  external: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  ),
};

// Renders as a styled <a>, not a nested <button> inside <a> (invalid HTML) --
// reuses the exact same .btn/.btn-* classes Button.jsx applies to its <button>.
export function ButtonBlock({ label, href = '#', variant = 'primary', size = 'md', align = 'left', icon = 'none', fullWidth = false, newTab = false, labelStyle, editable, onFieldChange }) {
  if (!editable && !label) return null;
  const cls = ['btn', 'btn-' + variant, size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : ''].filter(Boolean).join(' ');
  const content = editable ? (
    <EditableText value={label} onCommit={(v) => onFieldChange('label', v)} placeholder="Button label" styleValue={labelStyle} onStyleChange={(s) => onFieldChange('labelStyle', s)} />
  ) : label;
  const iconEl = icon !== 'none' ? ICONS[icon] : null;

  const style = { textDecoration: 'none', width: fullWidth ? '100%' : undefined, justifyContent: fullWidth ? 'center' : undefined, ...textStyleToCss(labelStyle) };

  return (
    <div style={{ textAlign: align }}>
      {editable ? (
        <span className={cls} style={style}>{iconEl}{content}</span>
      ) : (
        <a href={href} className={cls} style={style} target={newTab ? '_blank' : undefined} rel={newTab ? 'noopener noreferrer' : undefined}>
          {iconEl}{content}
        </a>
      )}
    </div>
  );
}

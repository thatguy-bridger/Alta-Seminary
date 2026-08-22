import React from 'react';
import { createPortal } from 'react-dom';
import { FONT_OPTIONS } from './textStyle.js';
import { TEXT_COLOR_TOKENS } from '../../lib/richTextTokens.js';

// Small floating toolbar shown above whichever text field is currently
// focused (see EditableText.jsx) -- color/size/font overrides for that one
// field specifically. Rendered via portal so it's never a DOM descendant of
// the contentEditable element it's editing, and positioned as `fixed` off a
// rect captured on focus (see EditableText) rather than tracked continuously,
// so it can drift slightly if the page scrolls mid-edit -- an acceptable
// trade for not wiring scroll/resize listeners for a rare edge case.
export function TextStyleToolbar({ toolbarRef, anchorRect, value, onChange }) {
  if (!anchorRect) return null;
  const current = value || {};

  function patch(p) { onChange({ ...current, ...p }); }
  function reset() { onChange({}); }

  const hasOverride = !!(current.color || current.fontSize || current.fontFamily);

  return createPortal(
    <div
      ref={toolbarRef}
      style={{
        position: 'fixed',
        top: anchorRect.top,
        left: anchorRect.left,
        transform: 'translateY(calc(-100% - 8px))',
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px', borderRadius: 'var(--radius-md)',
        background: 'var(--surface-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-lg)',
        zIndex: 2000, whiteSpace: 'nowrap',
      }}
    >
      {/* The same 6 curated color tokens as the rich text editor's swatches
          (richTextTokens.js) -- every token maps to one of the site's own
          design-system CSS variables, which already have separate light/
          dark values, instead of a raw hex picker that could pick a color
          that looks wrong (or unreadable) once dark mode is toggled. */}
      <div style={{ display: 'flex', gap: 4 }}>
        {TEXT_COLOR_TOKENS.map((t) => {
          const tokenValue = `var(${t.var})`;
          const active = current.color === tokenValue;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => patch({ color: tokenValue })}
              title={t.label}
              style={{
                width: 18, height: 18, borderRadius: '50%', padding: 0, cursor: 'pointer',
                background: tokenValue, border: active ? '2px solid var(--brand-secondary)' : '1px solid var(--border-default)',
              }}
            />
          );
        })}
      </div>
      <input
        type="number"
        min={8}
        max={120}
        value={current.fontSize || ''}
        placeholder="Size"
        onChange={(e) => patch({ fontSize: e.target.value ? Number(e.target.value) : undefined })}
        title="Font size at desktop width -- scales proportionally on every screen size"
        style={{ width: 52, fontSize: 12, padding: '3px 5px', borderRadius: 4, border: '1px solid var(--border-default)', background: 'var(--surface-page)', color: 'var(--text-primary)' }}
      />
      <select
        value={current.fontFamily || ''}
        onChange={(e) => patch({ fontFamily: e.target.value || undefined })}
        title="Font"
        style={{ fontSize: 12, padding: '3px 5px', borderRadius: 4, border: '1px solid var(--border-default)', background: 'var(--surface-page)', color: 'var(--text-primary)' }}
      >
        {FONT_OPTIONS.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
      </select>
      {hasOverride && (
        <button
          type="button"
          onClick={reset}
          title="Reset to the block's default style"
          style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: 0 }}
        >
          Reset
        </button>
      )}
    </div>,
    document.body
  );
}

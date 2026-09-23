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
// onMark (optional): {bold,italic,underline,onApplyLink} -- shows a small
// per-selection formatting cluster (Bold/Italic/Underline/Link) ahead of
// the whole-field color/size/font controls below. Only EditableText.jsx
// passes this (its own inline rich-text marks); RichTextBlock's separate
// RichTextEditor.jsx has its own full toolbar and never renders this one.
export function TextStyleToolbar({ toolbarRef, anchorRect, value, onChange, onMark }) {
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [linkValue, setLinkValue] = React.useState('');
  if (!anchorRect) return null;
  const current = value || {};

  // onApplyLink (not a plain onClick callback) restores the selection AND
  // applies the link in the same synchronous click handler -- deliberately
  // NOT a window.prompt() (what this used to be): a blocking native dialog
  // pauses all page JS while it's open, and different browsers/OSes don't
  // consistently preserve the DOM Selection across that pause, so the link
  // would silently land on nothing (or the wrong text) depending on timing
  // -- exactly the "rich text doesn't always save links" symptom. A plain
  // inline popover never blocks, so there's no gap for the selection to be
  // lost in between "pick the URL" and "apply it" -- same technique
  // RichTextEditor.jsx's own link button already used correctly.
  function applyLink() {
    if (!linkValue.trim()) return;
    onMark.onApplyLink(linkValue.trim());
    setLinkOpen(false);
    setLinkValue('');
  }

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
      {onMark && (
        <>
          <div style={{ display: 'flex', gap: 2 }}>
            <button type="button" title="Bold" onMouseDown={(e) => e.preventDefault()} onClick={onMark.bold} style={{ ...markBtnStyle, fontWeight: 700 }}>B</button>
            <button type="button" title="Italic" onMouseDown={(e) => e.preventDefault()} onClick={onMark.italic} style={{ ...markBtnStyle, fontStyle: 'italic' }}>I</button>
            <button type="button" title="Underline" onMouseDown={(e) => e.preventDefault()} onClick={onMark.underline} style={{ ...markBtnStyle, textDecoration: 'underline' }}>U</button>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                title="Link"
                // No preventDefault here (unlike the other 3 marks): opening
                // the popover needs the input to actually be focusable, and
                // the selection itself is restored later, at applyLink()
                // time -- same reasoning as RichTextEditor.jsx's own link button.
                onClick={() => setLinkOpen((o) => !o)}
                style={markBtnStyle}
              >
                🔗
              </button>
              {linkOpen && (
                <div
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute', top: '100%', left: 0, marginTop: 4, display: 'flex', gap: 4, zIndex: 1,
                    background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: 6,
                  }}
                >
                  <input
                    autoFocus
                    value={linkValue}
                    onChange={(e) => setLinkValue(e.target.value)}
                    onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); applyLink(); } }}
                    placeholder="https://…"
                    style={{ fontSize: 12, padding: '3px 6px', borderRadius: 4, border: '1px solid var(--border-default)', width: 160 }}
                  />
                  <button type="button" onClick={applyLink} className="btn btn-primary btn-sm">Add</button>
                </div>
              )}
            </div>
          </div>
          <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border-subtle)' }} />
        </>
      )}
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

const markBtnStyle = { border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, padding: '3px 6px', borderRadius: 4, color: 'var(--text-primary)' };

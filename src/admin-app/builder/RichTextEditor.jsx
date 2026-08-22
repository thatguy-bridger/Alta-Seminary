import React from 'react';
import { createPortal } from 'react-dom';
import { legacyToHtml, looksLikeHtml } from '../../lib/richTextHtml.js';
import { sanitizeRichHtml } from './sanitizeRichHtml.js';
import { TEXT_COLOR_TOKENS, BG_COLOR_TOKENS, FONT_SIZE_OPTIONS } from '../../lib/richTextTokens.js';
import { FONT_OPTIONS, fluidClamp } from './textStyle.js';

// Wraps the current selection in a <span style="prop:value">, used for
// text color / text box color / font size / font family -- the four marks
// that need a specific value rather than a simple on/off toggle, so they
// can't go through document.execCommand('foreColor'/'fontSize'/...) the way
// bold/italic/lists do (execCommand only accepts literal colors/sizes, not
// the `var(--token)` values this editor deliberately uses -- see
// richTextTokens.js on why literal colors aren't used here).
function applyInlineStyle(prop, value) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
  const range = sel.getRangeAt(0);
  const span = document.createElement('span');
  span.style[prop] = value;
  try {
    range.surroundContents(span);
  } catch {
    // Selection crosses an element boundary (e.g. spans two words that are
    // already differently formatted) -- surroundContents can't handle that
    // directly, so extract + rewrap instead.
    const frag = range.extractContents();
    span.appendChild(frag);
    range.insertNode(span);
  }
  sel.removeAllRanges();
  const newRange = document.createRange();
  newRange.selectNodeContents(span);
  sel.addRange(newRange);
  return true;
}

// Google-Docs-style rich text editing for `richtext`-kind fields (Rich Text
// block's Content, Image+Text's Body, Quote's Quote text) -- a real
// contentEditable surface with a floating formatting toolbar, replacing the
// old raw **bold**/*italic*-syntax textarea. Selection (mouse-drag or
// keyboard) is native contentEditable behavior; formatting applies to
// exactly whatever's selected, same as any real word processor.
// A block using this editor (RichTextBlock/ImageTextBlock/QuoteBlock) may
// already have an old whole-field color/size/font override from before this
// editor existed (contentStyle/bodyStyle/quoteTextStyle -- see textStyle.js).
// That's deliberately left in place and still read by those blocks' own
// wrapping element -- CSS inheritance means it already applies to whatever
// renders inside, in both the editor and the public page, with no extra
// work needed here. New edits made with this editor's own color/size/font
// marks below simply override it per-selection, same as any real override.
export function RichTextEditor({ value, onCommit, placeholder }) {
  const ref = React.useRef(null);
  const toolbarRef = React.useRef(null);
  const [toolbarOpen, setToolbarOpen] = React.useState(false);
  const [anchorRect, setAnchorRect] = React.useState(null);
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [linkValue, setLinkValue] = React.useState('');
  const convertedOnce = React.useRef(false);

  // Consistent <p>-per-line behavior across browsers on Enter (some default
  // to bare <div>s otherwise, which the sanitizer still accepts but this
  // keeps the DOM predictable).
  React.useEffect(() => {
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch { /* unsupported in some browsers; harmless */ }
  }, []);

  // Legacy **bold**/*italic*/[link](url) plain text (everything written
  // before this editor existed) is converted to real HTML the moment the
  // field is opened, and immediately persisted -- see richTextHtml.js.
  React.useEffect(() => {
    if (!ref.current) return;
    const isHtml = looksLikeHtml(value);
    const html = isHtml ? (value || '') : legacyToHtml(value);
    if (ref.current.innerHTML !== html) ref.current.innerHTML = html;
    if (!isHtml && value && !convertedOnce.current) {
      convertedOnce.current = true;
      onCommit(html);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-sync when the stored value actually changes, not on every render
  }, [value]);

  React.useEffect(() => {
    if (!toolbarOpen) return;
    function handlePointerDown(e) {
      if (ref.current?.contains(e.target) || toolbarRef.current?.contains(e.target)) return;
      setToolbarOpen(false);
      setLinkOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [toolbarOpen]);

  function commit() {
    if (!ref.current) return;
    const html = sanitizeRichHtml(ref.current);
    if (html !== value) onCommit(html);
  }

  function handleFocus() {
    setAnchorRect(ref.current?.getBoundingClientRect() ?? null);
    setToolbarOpen(true);
  }

  function handleKeyDown(e) {
    // Stop every keystroke from bubbling to the canvas block wrapper, which
    // carries dnd-kit's drag listeners (see EditableText.jsx for the same guard).
    e.stopPropagation();
  }

  // Clipboard HTML can carry arbitrary markup/handlers -- force plain text
  // only, same posture as the rest of this block system ("no HTML-injection
  // surface" -- richText.jsx). Formatting can still be reapplied afterward
  // with the toolbar.
  function handlePaste(e) {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }

  function exec(command, arg) {
    document.execCommand(command, false, arg);
    commit();
  }

  function handleColor(tokenVar) {
    if (applyInlineStyle('color', `var(${tokenVar})`)) commit();
  }
  function handleBg(tokenVar) {
    if (applyInlineStyle('backgroundColor', `var(${tokenVar})`)) commit();
  }
  function handleFontSize(px) {
    if (applyInlineStyle('fontSize', fluidClamp(px))) commit();
  }
  function handleFontFamily(family) {
    if (family && applyInlineStyle('fontFamily', family)) commit();
  }
  function handleApplyLink() {
    if (!linkValue.trim()) return;
    exec('createLink', linkValue.trim());
    setLinkOpen(false);
    setLinkValue('');
  }

  return (
    <>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onFocus={handleFocus}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onClick={(e) => e.stopPropagation()}
        data-placeholder={placeholder}
        className="rich-text-editor"
      />
      {toolbarOpen && anchorRect && createPortal(
        <div
          ref={toolbarRef}
          // Prevents the browser from shifting focus off the editor (which
          // would collapse the selection) the instant a toolbar button is
          // pressed -- standard rich-editor technique so Bold/color/etc.
          // still apply to whatever was actually selected.
          onMouseDown={(e) => e.preventDefault()}
          // stopPropagation (a separate concern from the preventDefault
          // above -- dnd-kit listens for pointerdown, not mousedown): this
          // toolbar is rendered via a portal straight onto document.body,
          // but React still delivers its events through the component tree,
          // not the DOM tree -- so without this, clicking any button/select
          // here (this field's own richtext block sits inside a draggable
          // canvas block) still bubbles up to dnd-kit's listeners and starts
          // a reorder drag right after the click, exactly like a plain
          // <select> would without Select.jsx's own equivalent guard.
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            // Clamped so the toolbar never sits partly off the right edge
            // of the viewport -- a fixed-position element extending past
            // the viewport boundary still widens the page's own scrollable
            // area in most browsers, which would show up as a (very
            // situational) sideways scrollbar while editing near the edge.
            position: 'fixed', top: anchorRect.top, left: Math.min(anchorRect.left, window.innerWidth - 520 - 8),
            transform: 'translateY(calc(-100% - 8px))',
            display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', maxWidth: 520,
            padding: '6px 8px', borderRadius: 'var(--radius-md)',
            background: 'var(--surface-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-lg)',
            zIndex: 2000,
          }}
        >
          <ToolbarButton label="B" title="Bold" bold onClick={() => exec('bold')} />
          <ToolbarButton label="I" title="Italic" italic onClick={() => exec('italic')} />
          <ToolbarButton label="U" title="Underline" underline onClick={() => exec('underline')} />
          <Divider />
          <ToolbarButton label="•" title="Bullet list" onClick={() => exec('insertUnorderedList')} />
          <ToolbarButton label="1." title="Numbered list" onClick={() => exec('insertOrderedList')} />
          <Divider />
          <ToolbarButton label="⇤" title="Align left" onClick={() => exec('justifyLeft')} />
          <ToolbarButton label="⇔" title="Align center" onClick={() => exec('justifyCenter')} />
          <ToolbarButton label="⇥" title="Align right" onClick={() => exec('justifyRight')} />
          <Divider />
          <div style={{ position: 'relative' }}>
            <button type="button" onClick={() => setLinkOpen((o) => !o)} title="Link" style={toolbarBtnStyle}>🔗</button>
            {linkOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, display: 'flex', gap: 4, background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: 6 }}>
                <input
                  autoFocus
                  value={linkValue}
                  onChange={(e) => setLinkValue(e.target.value)}
                  onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); handleApplyLink(); } }}
                  placeholder="https://…"
                  style={{ fontSize: 12, padding: '3px 6px', borderRadius: 4, border: '1px solid var(--border-default)', width: 160 }}
                />
                <button type="button" onClick={handleApplyLink} className="btn btn-primary btn-sm">Add</button>
              </div>
            )}
          </div>
          <Divider />
          <ColorSwatchMenu label="A" title="Text color" tokens={TEXT_COLOR_TOKENS} onPick={handleColor} />
          <ColorSwatchMenu label="▧" title="Text box color" tokens={BG_COLOR_TOKENS} onPick={handleBg} />
          <Divider />
          <select onChange={(e) => e.target.value && handleFontSize(Number(e.target.value))} defaultValue="" title="Font size" style={selectStyle}>
            <option value="" disabled>Size</option>
            {FONT_SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}px</option>)}
          </select>
          <select onChange={(e) => handleFontFamily(e.target.value)} defaultValue="" title="Font" style={selectStyle}>
            {FONT_OPTIONS.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
          </select>
        </div>,
        document.body
      )}
    </>
  );
}

function Divider() {
  return <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border-subtle)' }} />;
}

const toolbarBtnStyle = { border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, padding: '4px 6px', borderRadius: 4, color: 'var(--text-primary)' };
const selectStyle = { fontSize: 12, padding: '3px 5px', borderRadius: 4, border: '1px solid var(--border-default)', background: 'var(--surface-page)', color: 'var(--text-primary)' };

function ToolbarButton({ label, title, onClick, bold, italic, underline }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{ ...toolbarBtnStyle, fontWeight: bold ? 700 : 400, fontStyle: italic ? 'italic' : 'normal', textDecoration: underline ? 'underline' : 'none' }}
    >
      {label}
    </button>
  );
}

function ColorSwatchMenu({ label, title, tokens, onPick }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen((o) => !o)} title={title} style={toolbarBtnStyle}>{label}</button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, display: 'flex', gap: 4, background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: 6 }}>
          {tokens.map((t) => (
            <button
              key={t.key}
              type="button"
              title={t.label}
              onClick={() => { onPick(t.var); setOpen(false); }}
              style={{ width: 20, height: 20, borderRadius: '50%', border: '1px solid var(--border-default)', background: `var(${t.var})`, cursor: 'pointer', padding: 0 }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

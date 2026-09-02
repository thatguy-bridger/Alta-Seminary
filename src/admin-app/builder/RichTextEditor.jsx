import React from 'react';
import { createPortal } from 'react-dom';
import { legacyToHtml, looksLikeHtml } from '../../lib/richTextHtml.js';
import { sanitizeRichHtml } from './sanitizeRichHtml.js';
import { TEXT_COLOR_TOKENS, BG_COLOR_TOKENS } from '../../lib/richTextTokens.js';
import { FONT_OPTIONS, fluidClamp } from './textStyle.js';

const DEFAULT_FONT_SIZE_PX = 16;
const MIN_FONT_SIZE_PX = 8;
const MAX_FONT_SIZE_PX = 96;

// Wraps a given Range in a <span style="prop:value">, used for text color /
// text box color / font size / font family -- the four marks that need a
// specific value rather than a simple on/off toggle, so they can't go
// through document.execCommand('foreColor'/'fontSize'/...) the way bold/
// italic/lists do (execCommand only accepts literal colors/sizes, not the
// `var(--token)` values this editor deliberately uses -- see
// richTextTokens.js on why literal colors aren't used here). Returns the
// span so callers can read/report the applied value back.
function wrapRangeInStyledSpan(range, prop, value) {
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
  const sel = window.getSelection();
  sel.removeAllRanges();
  const newRange = document.createRange();
  newRange.selectNodeContents(span);
  sel.addRange(newRange);
  return span;
}

// fluidClamp(px) always ends in `, Npx)` -- pulls the plain design size back
// out of that so the toolbar can show "this selection is currently 24px"
// instead of a fixed/blank control that doesn't reflect the selection.
function designPxFromFontSize(fontSizeValue) {
  const match = /,\s*([\d.]+)px\s*\)\s*$/.exec(fontSizeValue || '');
  return match ? Math.round(parseFloat(match[1])) : null;
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
  const [currentFontSize, setCurrentFontSize] = React.useState(null); // null = no explicit size on the selection
  const convertedOnce = React.useRef(false);
  // The last HTML string *we* committed -- lets the value-sync effect below
  // tell "the parent re-rendered because of my own edit" (DOM is already
  // correct, don't touch it) apart from "the value changed for some other
  // reason" (e.g. undo, or a totally fresh value -- DOM needs resyncing).
  const lastCommittedRef = React.useRef(null);
  // Selection inside the contentEditable, kept alive across a click into a
  // toolbar text input (font size). Moving focus to an <input> so the user
  // can type into it also moves the browser's Selection off the
  // contentEditable, which would otherwise make every mark-applying handler
  // below find "no selection" the moment a text input is involved.
  const savedRangeRef = React.useRef(null);
  const debounceTimer = React.useRef(null);
  React.useEffect(() => () => clearTimeout(debounceTimer.current), []);

  // commit() used to only ever run on blur or right after a toolbar action
  // -- fine as long as you eventually click away, but nothing committed
  // plain typing on its own. Navigating away before ever blurring (closing
  // the tab, the browser's own reload/back) lost whatever was typed, even
  // after pausing for a while, since React never found out about it. This
  // debounces a commit while typing too, matching what the "Saving…"/
  // "Saved" indicator already implies is happening.
  function handleInput() {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(commit, 800);
  }

  // Consistent <p>-per-line behavior across browsers on Enter (some default
  // to bare <div>s otherwise, which the sanitizer still accepts but this
  // keeps the DOM predictable).
  React.useEffect(() => {
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch { /* unsupported in some browsers; harmless */ }
  }, []);

  // Legacy **bold**/*italic*/[link](url) plain text (everything written
  // before this editor existed) is converted to real HTML the moment the
  // field is opened, and immediately persisted -- see richTextHtml.js.
  //
  // Skips touching the live DOM entirely when this `value` is the exact
  // thing we ourselves just committed: overwriting innerHTML resets the
  // browser's Selection even when the resulting markup is unchanged, which
  // was silently breaking every "apply one mark, then immediately apply
  // another" sequence (e.g. set a color, then try to bold the same text --
  // the color's commit already destroyed the selection bold needed).
  React.useEffect(() => {
    if (!ref.current) return;
    if (value === lastCommittedRef.current) return;
    const isHtml = looksLikeHtml(value);
    const html = isHtml ? (value || '') : legacyToHtml(value);
    if (ref.current.innerHTML !== html) ref.current.innerHTML = html;
    if (!isHtml && value && !convertedOnce.current) {
      convertedOnce.current = true;
      commitHtml(html);
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

  // Tracks the live selection while it's actually inside the editor (saving
  // a clone so it survives focus moving elsewhere -- see savedRangeRef
  // above) and reads the nearest explicit font-size for the toolbar's size
  // control, so it reflects what's really selected instead of a blank/fixed value.
  React.useEffect(() => {
    if (!toolbarOpen) return;
    function handleSelectionChange() {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !ref.current?.contains(sel.anchorNode)) return;
      if (!sel.isCollapsed) savedRangeRef.current = sel.getRangeAt(0).cloneRange();
      let node = sel.anchorNode;
      if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;
      while (node && node !== ref.current) {
        if (node.style?.fontSize) {
          setCurrentFontSize(designPxFromFontSize(node.style.fontSize));
          return;
        }
        node = node.parentElement;
      }
      setCurrentFontSize(null);
    }
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [toolbarOpen]);

  function commitHtml(html) {
    lastCommittedRef.current = html;
    onCommit(html);
  }

  function commit() {
    if (!ref.current) return;
    const html = sanitizeRichHtml(ref.current);
    if (html !== value) commitHtml(html);
  }

  function handleFocus() {
    setAnchorRect(ref.current?.getBoundingClientRect() ?? null);
    setToolbarOpen(true);
  }

  function handleKeyDown(e) {
    // Escape deliberately does NOT stopPropagation like everything else here
    // -- it needs to keep bubbling up to PageBuilderScreen's own keyboard-
    // shortcut handler so the block itself also gets deselected (its
    // border/Settings bar), not just this field's own toolbar closed.
    // Previously this field had no local Escape handling at all, so Escape
    // did visibly nothing while editing rich text.
    if (e.key === 'Escape') {
      ref.current?.blur();
      setToolbarOpen(false);
      return;
    }
    // Stop every other keystroke from bubbling to the canvas block wrapper,
    // which carries dnd-kit's drag listeners (see EditableText.jsx for the same guard).
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
    // execCommand('justifyLeft'/'justifyCenter'/'justifyRight') -- the
    // toolbar's alignment buttons -- inconsistently apply the result as
    // either a `style="text-align:..."` CSS declaration or a legacy
    // `align="..."` HTML ATTRIBUTE on the affected block element, depending
    // on the browser (and version). Both look identical while editing --
    // the browser honors a plain `align` attribute visually regardless --
    // but sanitizeRichHtml.js's serializer only ever read the style
    // attribute, so alignment applied via the `align` form vanished the
    // moment the field was committed and re-sanitized: worked live, quietly
    // reverted to left in Preview/after publishing. Normalizing whichever
    // form the browser just produced into the CSS style form immediately
    // (sanitizeRichHtml.js now also understands the attribute form directly,
    // as a second layer of the same fix) means this never depends on which
    // representation happened to come out of execCommand in the first place.
    if (command.startsWith('justify')) {
      ref.current?.querySelectorAll('[align]').forEach((el) => {
        const align = el.getAttribute('align');
        el.removeAttribute('align');
        if (align) el.style.textAlign = align;
      });
    }
    commit();
  }

  // Restores the last known selection inside the editor onto
  // window.getSelection() -- needed before any mark-applying action that
  // might run after focus moved to a toolbar text input (font size),
  // since typing there moves the browser's Selection off the contentEditable.
  function restoreSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed && ref.current?.contains(sel.anchorNode)) return true;
    if (!savedRangeRef.current || !ref.current?.contains(savedRangeRef.current.commonAncestorContainer)) return false;
    sel.removeAllRanges();
    sel.addRange(savedRangeRef.current);
    return true;
  }

  function applyMark(prop, value) {
    if (!restoreSelection()) return false;
    const sel = window.getSelection();
    const span = wrapRangeInStyledSpan(sel.getRangeAt(0), prop, value);
    savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    commit();
    return !!span;
  }

  function handleColor(tokenVar) {
    applyMark('color', `var(${tokenVar})`);
  }
  function handleBg(tokenVar) {
    applyMark('backgroundColor', `var(${tokenVar})`);
  }
  function setFontSize(px) {
    const clamped = Math.min(MAX_FONT_SIZE_PX, Math.max(MIN_FONT_SIZE_PX, Math.round(px)));
    if (applyMark('fontSize', fluidClamp(clamped))) setCurrentFontSize(clamped);
  }
  function handleFontFamily(family) {
    if (family) applyMark('fontFamily', family);
  }
  function handleApplyLink() {
    if (!linkValue.trim()) return;
    if (!restoreSelection()) return;
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
        onBlur={() => { clearTimeout(debounceTimer.current); commit(); }}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onClick={(e) => e.stopPropagation()}
        // stopPropagation on pointerdown: without it, click-dragging across
        // text to select it bubbles a pointerdown up to the canvas block's
        // draggable wrapper, and dnd-kit's activation distance (a few px of
        // movement) is exactly what a text-selection drag looks like -- it
        // was hijacking the gesture into a block reorder instead of
        // selecting text. Same fix as EditableText.jsx's plain-text fields.
        onPointerDown={(e) => e.stopPropagation()}
        data-placeholder={placeholder}
        className="rich-text-editor"
      />
      {toolbarOpen && anchorRect && createPortal(
        <div
          ref={toolbarRef}
          // Prevents the browser from shifting focus off the editor (which
          // would collapse the selection) the instant a toolbar button is
          // pressed -- standard rich-editor technique so Bold/color/etc.
          // still apply to whatever was actually selected. Text inputs
          // (the font-size box, the link URL box) are excluded -- they need
          // real focus to be typeable, which is exactly what restoreSelection()
          // above compensates for.
          onMouseDown={(e) => { if (e.target.tagName !== 'INPUT') e.preventDefault(); }}
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
          <FontSizeStepper value={currentFontSize} onChange={setFontSize} />
          <select onChange={(e) => handleFontFamily(e.target.value)} defaultValue="" title="Font" style={selectStyle}>
            {FONT_OPTIONS.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
          </select>
        </div>,
        document.body
      )}
    </>
  );
}

// Shows the selection's actual current size (blank if the selection spans
// mixed sizes or has no explicit override yet) instead of a fixed dropdown
// -- with +/- steppers for a quick nudge, or type an exact value directly.
function FontSizeStepper({ value, onChange }) {
  const [typed, setTyped] = React.useState('');
  const displayValue = typed !== '' ? typed : (value ?? '');

  function commitTyped() {
    const n = Number(typed);
    if (typed !== '' && !Number.isNaN(n)) onChange(n);
    setTyped('');
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }} title="Font size">
      <button type="button" onClick={() => onChange((value ?? DEFAULT_FONT_SIZE_PX) - 1)} style={stepperBtnStyle}>−</button>
      <input
        type="number"
        value={displayValue}
        placeholder={String(DEFAULT_FONT_SIZE_PX)}
        onChange={(e) => setTyped(e.target.value)}
        onBlur={commitTyped}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); commitTyped(); } }}
        style={{ width: 40, textAlign: 'center', fontSize: 12, padding: '3px 2px', borderRadius: 4, border: '1px solid var(--border-default)', background: 'var(--surface-page)', color: 'var(--text-primary)' }}
      />
      <button type="button" onClick={() => onChange((value ?? DEFAULT_FONT_SIZE_PX) + 1)} style={stepperBtnStyle}>+</button>
    </div>
  );
}

function Divider() {
  return <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border-subtle)' }} />;
}

const toolbarBtnStyle = { border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, padding: '4px 6px', borderRadius: 4, color: 'var(--text-primary)' };
const stepperBtnStyle = { ...toolbarBtnStyle, padding: '2px 5px', border: '1px solid var(--border-default)' };
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

import React from 'react';
import { TextStyleToolbar } from './TextStyleToolbar.jsx';
import { textStyleToCss } from './textStyle.js';
import { looksLikeHtml, legacyToHtml } from '../../lib/richTextHtml.js';
import { sanitizeRichHtml } from './sanitizeRichHtml.js';

// This field's content must stay strictly inline (see handleKeyDown below),
// but legacyToHtml() -- shared with the block-level RichTextEditor -- always
// wraps in block-level <p>s, one per blank-line-separated paragraph. Flattens
// that down to plain inline flow: the outermost <p>...</p> is stripped, and
// any paragraph BOUNDARY becomes a <br> so multi-paragraph legacy content
// (rare for a single text field, but possible) doesn't just silently lose
// its line breaks.
function legacyToInlineHtml(value) {
  return legacyToHtml(value || '').replace(/<\/p><p[^>]*>/g, '<br>').replace(/^<p[^>]*>|<\/p>$/g, '');
}

// Click-to-edit text directly on the canvas -- used for every plain "text"
// field across every block (headings, buttons, badges, captions, bios, ...).
// A real contentEditable surface with Bold/Italic/Underline/Link marks (see
// the toolbar cluster TextStyleToolbar.jsx renders when `onMark` is passed),
// sharing the exact same sanitizeRichHtml.js allow-list and stored-HTML
// format as the block-level RichTextEditor.jsx -- just constrained to
// inline-only content (never <p>/<div>/<ul>, see handleKeyDown below), so a
// button label or badge can never end up with an invalid block element
// inside it. `multiline` (unchanged from before) only controls whether
// Enter inserts a line break (<br>) or blurs the field.
//
// Old plain-text values (**bold**/*italic*/everything written before this
// existed) are converted to the same inline HTML the moment the field is
// focused -- see legacyToHtml -- and immediately re-committed, exactly like
// RichTextEditor.jsx does for its own legacy content.
//
// styleValue/onStyleChange (optional): unchanged -- a separate, WHOLE-FIELD
// color/size/font override (independent of the new per-selection marks
// above), still shown in the same floating toolbar.
export function EditableText({ value, onCommit, as: Tag = 'span', multiline = false, placeholder, style, className, styleValue, onStyleChange }) {
  const ref = React.useRef(null);
  const toolbarRef = React.useRef(null);
  const [toolbarOpen, setToolbarOpen] = React.useState(false);
  const [anchorRect, setAnchorRect] = React.useState(null);
  const debounceTimer = React.useRef(null);
  const savedRangeRef = React.useRef(null);
  // The last HTML string *we* committed -- lets the value-sync effect below
  // tell "the parent re-rendered because of my own edit" (DOM already
  // correct, don't touch it -- overwriting innerHTML resets the browser's
  // Selection even when the markup is unchanged) apart from "the value
  // changed for some other reason" (needs a real resync). Same technique as
  // RichTextEditor.jsx.
  const lastCommittedRef = React.useRef(null);
  const convertedOnce = React.useRef(false);

  React.useEffect(() => () => clearTimeout(debounceTimer.current), []);

  // Commit used to only ever fire on blur -- fine as long as you eventually
  // click away, but PageBuilderScreen's own "Saving…"/"Saved" indicator and
  // its 1s autosave debounce implied typing-then-pausing was enough on its
  // own. It wasn't: navigating away before ever blurring the field (closing
  // the tab, hitting the browser's own reload/back, even just being fast
  // enough) lost whatever was typed, since nothing had told React about it
  // yet. This mirrors that same debounce locally so a pause while typing
  // commits on its own, not only a literal click away.
  function commitIfChanged() {
    if (!ref.current) return;
    const html = sanitizeRichHtml(ref.current);
    if (html !== (value || '')) {
      lastCommittedRef.current = html;
      onCommit(html);
    }
  }

  function handleInput() {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(commitIfChanged, 800);
  }

  // Mirrors RichTextEditor.jsx's own value-sync effect: legacy plain text
  // is converted to HTML once, real HTML is trusted as-is, and the live DOM
  // is only overwritten when `value` actually changed for a reason OTHER
  // than this field's own last commit (see lastCommittedRef above).
  React.useEffect(() => {
    if (!ref.current) return;
    if (value === lastCommittedRef.current) return;
    const isHtml = looksLikeHtml(value);
    const html = isHtml ? (value || '') : legacyToInlineHtml(value);
    if (ref.current.innerHTML !== html) ref.current.innerHTML = html;
    if (!isHtml && value && !convertedOnce.current) {
      convertedOnce.current = true;
      lastCommittedRef.current = html;
      onCommit(html);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-sync when the stored value actually changes, not on every render
  }, [value]);

  // Closes the toolbar on any click outside both the text field and the
  // toolbar itself (rendered via portal, so not a DOM descendant of this
  // element) -- deliberately not tied to the text field's own blur event,
  // since blur fires the instant a toolbar control is clicked, which would
  // tear the toolbar down before that click registers.
  React.useEffect(() => {
    if (!toolbarOpen) return;
    function handlePointerDown(e) {
      if (ref.current?.contains(e.target) || toolbarRef.current?.contains(e.target)) return;
      setToolbarOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [toolbarOpen]);

  // Tracks the live selection while focused so a toolbar click (which
  // momentarily steals focus) can still restore exactly what was selected
  // -- same technique as RichTextEditor.jsx's savedRangeRef.
  React.useEffect(() => {
    if (!toolbarOpen) return;
    function handleSelectionChange() {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !ref.current?.contains(sel.anchorNode)) return;
      if (!sel.isCollapsed) savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [toolbarOpen]);

  function restoreSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed && ref.current?.contains(sel.anchorNode)) return true;
    if (!savedRangeRef.current || !ref.current?.contains(savedRangeRef.current.commonAncestorContainer)) return false;
    sel.removeAllRanges();
    sel.addRange(savedRangeRef.current);
    return true;
  }

  function exec(command, arg) {
    if (!restoreSelection()) return;
    document.execCommand(command, false, arg);
    commitIfChanged();
  }

  // Called by TextStyleToolbar.jsx's own inline popover, at the moment its
  // "Add" button is actually clicked -- restoreSelection() here (not
  // earlier) is what makes this reliable: the popover's input necessarily
  // stole focus (and with it, window.getSelection()) away from this field
  // the moment it opened, so re-establishing the saved range right before
  // execCommand runs is the only way createLink has anything valid to
  // apply to. This replaced a window.prompt()-based version that restored
  // the selection BEFORE opening that blocking dialog -- by the time the
  // admin actually typed a URL and confirmed, the selection could already
  // be gone depending on the browser/OS, so the link silently didn't save.
  function handleApplyLink(url) {
    if (!restoreSelection()) return;
    document.execCommand('createLink', false, url);
    commitIfChanged();
  }

  function handleFocus() {
    setAnchorRect(ref.current?.getBoundingClientRect() ?? null);
    setToolbarOpen(true);
  }

  function handleBlur() {
    clearTimeout(debounceTimer.current);
    commitIfChanged();
  }

  // Clipboard HTML can carry arbitrary markup/handlers -- force plain text
  // only, same posture as RichTextEditor.jsx ("no HTML-injection surface" --
  // richText.jsx). Formatting can still be reapplied afterward with the marks above.
  function handlePaste(e) {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }

  function handleKeyDown(e) {
    // Escape deliberately does NOT stopPropagation like everything else
    // below -- it needs to keep bubbling up to PageBuilderScreen's own
    // keyboard-shortcut handler so the block itself also gets deselected
    // (its border/Settings bar), not just this one field blurred. Without
    // this, pressing Escape while editing text closed nothing but this
    // field's own toolbar.
    if (e.key === 'Escape') {
      const isHtml = looksLikeHtml(value);
      ref.current.innerHTML = isHtml ? (value || '') : legacyToInlineHtml(value);
      ref.current.blur();
      setToolbarOpen(false);
      return;
    }
    // Stop every other keystroke here from bubbling up to the block wrapper
    // -- it carries dnd-kit's drag listeners (see EditableCanvas.jsx), which
    // treats Space/Enter as "pick up for dragging." Without this, typing a
    // space or pressing Enter while editing text would hijack focus into drag mode.
    e.stopPropagation();
    if (e.key === 'Enter') {
      // Never let the browser insert its own default block (<p>/<div>) on
      // Enter -- this field's content must stay strictly inline (text/
      // strong/em/u/a/span/br only, see sanitizeRichHtml.js) so it's always
      // safe to drop into a heading, button, or badge. `multiline` fields
      // (captions, bios, ...) get a plain line break instead of blurring.
      e.preventDefault();
      if (multiline) {
        document.execCommand('insertLineBreak');
        handleInput();
      } else {
        ref.current.blur();
      }
    }
  }

  return (
    <>
      <Tag
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onFocus={handleFocus}
        onBlur={handleBlur}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onClick={(e) => e.stopPropagation()}
        // stopPropagation on pointerdown (a separate concern from onClick
        // above): without it, click-dragging across text to select it
        // bubbles a pointerdown up to the canvas block's draggable wrapper,
        // and dnd-kit's activation distance (a few px of movement) is
        // exactly what a text-selection drag looks like -- it was hijacking
        // the gesture into a block reorder instead of selecting text.
        onPointerDown={(e) => e.stopPropagation()}
        data-placeholder={placeholder}
        className={`editable-text${className ? ' ' + className : ''}`}
        style={{ outline: 'none', cursor: 'text', whiteSpace: multiline ? 'pre-wrap' : 'nowrap', ...textStyleToCss(styleValue), ...style }}
      />
      {toolbarOpen && (
        <TextStyleToolbar
          toolbarRef={toolbarRef}
          anchorRect={anchorRect}
          value={styleValue}
          onChange={onStyleChange || (() => {})}
          onMark={{
            bold: () => exec('bold'),
            italic: () => exec('italic'),
            underline: () => exec('underline'),
            onApplyLink: handleApplyLink,
          }}
        />
      )}
    </>
  );
}

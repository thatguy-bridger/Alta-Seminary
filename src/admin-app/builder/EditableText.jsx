import React from 'react';
import { TextStyleToolbar } from './TextStyleToolbar.jsx';
import { textStyleToCss } from './textStyle.js';

// Click-to-edit text directly on the canvas. Renders a contentEditable element
// kept in sync with `value`; commits on blur (or Enter, for single-line fields).
// Rich-text fields still hold raw markdown-lite syntax (**bold**, etc.) here --
// editing shows the raw source, same as the old side-panel textarea did; the
// formatted version only appears in Preview/the public site (see RichTextBlock).
//
// styleValue/onStyleChange (optional): when passed, focusing this field shows
// a floating color/size/font toolbar (TextStyleToolbar) for overriding just
// this one field's look, independent of the block's own style options.
export function EditableText({ value, onCommit, as: Tag = 'span', multiline = false, placeholder, style, className, styleValue, onStyleChange }) {
  const ref = React.useRef(null);
  const toolbarRef = React.useRef(null);
  const [toolbarOpen, setToolbarOpen] = React.useState(false);
  const [anchorRect, setAnchorRect] = React.useState(null);
  const debounceTimer = React.useRef(null);

  // Commit used to only ever fire on blur -- fine as long as you eventually
  // click away, but PageBuilderScreen's own "Saving…"/"Saved" indicator and
  // its 1s autosave debounce implied typing-then-pausing was enough on its
  // own. It wasn't: navigating away before ever blurring the field (closing
  // the tab, hitting the browser's own reload/back, even just being fast
  // enough) lost whatever was typed, since nothing had told React about it
  // yet. This mirrors that same debounce locally so a pause while typing
  // commits on its own, not only a literal click away.
  React.useEffect(() => () => clearTimeout(debounceTimer.current), []);

  function commitIfChanged() {
    const next = ref.current.innerText.replace(/ /g, ' ');
    if (next !== (value || '')) onCommit(next);
  }

  function handleInput() {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(commitIfChanged, 800);
  }

  React.useEffect(() => {
    if (!ref.current) return;
    // Backspacing a contentEditable to nothing doesn't necessarily leave it
    // truly empty -- browsers commonly leave a stray <br> behind so the
    // cursor still has a line to sit on. innerText already reads as '' in
    // that case, so the plain !== check below silently skipped touching the
    // DOM, leaving that <br> stuck forever: not :empty, so the CSS
    // placeholder (:empty:before) never showed, and the field collapsed to
    // that <br>'s zero-width line -- invisible and unclickable. Forcing a
    // real, childless empty element here (instead of relying on innerText)
    // is what lets :empty:before take back over.
    if (!value) {
      if (ref.current.childNodes.length > 0) ref.current.replaceChildren();
    } else if (ref.current.innerText !== value) {
      ref.current.innerText = value;
    }
  }, [value]);

  // Closes the toolbar on any click outside both the text field and the
  // toolbar itself (rendered via portal, so not a DOM descendant of this
  // element) -- deliberately not tied to the text field's own blur event,
  // since blur fires the instant a toolbar control (color/size/font) is
  // clicked, which would tear the toolbar down before that click registers.
  React.useEffect(() => {
    if (!toolbarOpen) return;
    function handlePointerDown(e) {
      if (ref.current?.contains(e.target) || toolbarRef.current?.contains(e.target)) return;
      setToolbarOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [toolbarOpen]);

  function handleFocus() {
    if (!onStyleChange) return;
    setAnchorRect(ref.current?.getBoundingClientRect() ?? null);
    setToolbarOpen(true);
  }

  function handleBlur() {
    clearTimeout(debounceTimer.current);
    commitIfChanged();
  }

  function handleKeyDown(e) {
    // Escape deliberately does NOT stopPropagation like everything else
    // below -- it needs to keep bubbling up to PageBuilderScreen's own
    // keyboard-shortcut handler so the block itself also gets deselected
    // (its border/Settings bar), not just this one field blurred. Without
    // this, pressing Escape while editing text closed nothing but this
    // field's own toolbar -- the block stayed visibly "selected."
    if (e.key === 'Escape') {
      if (value) ref.current.innerText = value;
      else ref.current.replaceChildren();
      ref.current.blur();
      setToolbarOpen(false);
      return;
    }
    // Stop every other keystroke here from bubbling up to the block wrapper
    // -- it carries dnd-kit's drag listeners (see EditableCanvas.jsx), which
    // treats Space/Enter as "pick up for dragging." Without this, typing a
    // space or pressing Enter while editing text would hijack focus into drag mode.
    e.stopPropagation();
    if (!multiline && e.key === 'Enter') {
      e.preventDefault();
      ref.current.blur();
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
      {toolbarOpen && onStyleChange && (
        <TextStyleToolbar toolbarRef={toolbarRef} anchorRect={anchorRect} value={styleValue} onChange={onStyleChange} />
      )}
    </>
  );
}

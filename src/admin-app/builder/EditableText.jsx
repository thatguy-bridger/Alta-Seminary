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

  React.useEffect(() => {
    if (ref.current && ref.current.innerText !== (value || '')) {
      ref.current.innerText = value || '';
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
    const next = ref.current.innerText.replace(/ /g, ' ');
    if (next !== (value || '')) onCommit(next);
  }

  function handleKeyDown(e) {
    // Stop every keystroke here from bubbling up to the block wrapper -- it
    // carries dnd-kit's drag listeners (see EditableCanvas.jsx), which treats
    // Space/Enter as "pick up for dragging." Without this, typing a space or
    // pressing Enter while editing text would hijack focus into drag mode.
    e.stopPropagation();
    if (!multiline && e.key === 'Enter') {
      e.preventDefault();
      ref.current.blur();
    }
    if (e.key === 'Escape') {
      ref.current.innerText = value || '';
      ref.current.blur();
      setToolbarOpen(false);
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
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
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

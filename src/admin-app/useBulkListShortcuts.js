import React from 'react';

// Shared by every admin list screen with bulk-select (Posts, Events, ...):
// Cmd/Ctrl+A selects everything currently filtered into view, Escape clears
// the selection, Delete/Backspace deletes whatever's selected (routed
// through the screen's own confirm-backed delete handler, so it still gets
// the same "are you sure" dialog as clicking the button). Ignored while
// typing anywhere (the filter box, a dialog field, ...) so Cmd+A there just
// does the browser's normal select-all-text instead of hijacking it.
export function useBulkListShortcuts({ selected, setSelected, allIds, onDeleteSelected }) {
  React.useEffect(() => {
    function isTyping() {
      const el = document.activeElement;
      if (!el) return false;
      if (el.isContentEditable) return true;
      return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
    }

    function onKeyDown(e) {
      if (isTyping()) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelected(new Set(allIds));
      } else if (e.key === 'Escape' && selected.size > 0) {
        setSelected(new Set());
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected.size > 0) {
        e.preventDefault();
        onDeleteSelected();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected, allIds, onDeleteSelected]);
}

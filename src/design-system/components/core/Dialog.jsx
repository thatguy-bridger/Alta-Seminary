import React from "react";
import { createPortal } from "react-dom";

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function Dialog({open,title,children,onClose,wide=false}) {
  const panelRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const previouslyFocused = document.activeElement;
    const focusable = panel ? panel.querySelectorAll(FOCUSABLE) : [];
    (focusable[0] || panel)?.focus();

    function onKeyDown(e) {
      if (e.key === "Escape") {
        onClose && onClose();
        return;
      }
      if (e.key === "Tab" && focusable.length) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused && previouslyFocused.focus && previouslyFocused.focus();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    // Portaled straight onto document.body -- a dialog opened from inside a
    // draggable canvas block (e.g. CropEditor from an EditableImage) used to
    // sit nested under that block's own stacking context, which isn't just
    // a z-index risk but, combined with dnd-kit's listeners further up that
    // same React tree, meant dragging a slider or clicking inside the dialog
    // still bubbled a pointerdown up to the block and started a reorder
    // drag right underneath the open modal. onPointerDown stopPropagation
    // is the actual fix for that (portaling alone only changes DOM
    // position, not React's event tree, which is what dnd-kit listens on).
    <div className="dialog-overlay" onClick={onClose} onPointerDown={(e) => e.stopPropagation()}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title || undefined}
        tabIndex={-1}
        ref={panelRef}
        onClick={e=>e.stopPropagation()}
        style={wide ? {maxWidth:760} : undefined}
      >
        {title && <h3 style={{margin:"0 0 12px",fontFamily:"var(--font-display)"}}>{title}</h3>}
        {children}
      </div>
    </div>,
    document.body
  );
}

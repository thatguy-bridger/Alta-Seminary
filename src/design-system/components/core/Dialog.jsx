import React from "react";

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
  return (
    <div className="dialog-overlay" onClick={onClose}>
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
    </div>
  );
}

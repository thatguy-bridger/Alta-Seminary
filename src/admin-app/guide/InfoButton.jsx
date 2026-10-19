import React from 'react';
import { FEATURES } from './guideContent.js';
import { useGuide } from './GuideProvider.jsx';

// A small (i) beside a feature. Opens a short explanation with a
// "Demonstrate for me" button that jumps to that slide of the guide.
export function InfoButton({ feature }) {
  const info = FEATURES[feature];
  const { openGuide } = useGuide();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (!info) return null;
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle' }} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label={`About: ${info.title}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 22, height: 22, borderRadius: '50%', cursor: 'pointer', padding: 0, lineHeight: 1,
          border: '1px solid var(--border-strong)', background: open ? 'var(--brand-secondary)' : 'var(--surface-card)',
          color: open ? 'var(--text-on-secondary)' : 'var(--text-secondary)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 'var(--fw-bold)',
        }}
      >
        i
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={info.title}
          style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 400, width: 270,
            padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--surface-card)',
            border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-lg)', fontFamily: 'var(--font-sans)', textAlign: 'left',
          }}
        >
          <strong style={{ display: 'block', marginBottom: 'var(--space-1)', color: 'var(--text-primary)', fontSize: 'var(--fs-body)' }}>{info.title}</strong>
          <p style={{ margin: '0 0 var(--space-3)', color: 'var(--text-secondary)', fontSize: 'var(--fs-small)', lineHeight: 1.5, fontWeight: 'normal' }}>{info.blurb}</p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => { setOpen(false); openGuide(info.slide); }}
          >
            Demonstrate for me
          </button>
        </div>
      )}
    </span>
  );
}

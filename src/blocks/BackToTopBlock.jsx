import React from 'react';
import { BlockIcon } from '../admin-app/builder/blockIcons.jsx';

const POSITION_STYLE = {
  'bottom-right': { bottom: 'var(--space-4)', right: 'var(--space-4)' },
  'bottom-left': { bottom: 'var(--space-4)', left: 'var(--space-4)' },
};

// Chromeless (registry.js) -- see BackgroundMusicBlock.jsx for the pattern.
export function BackToTopBlock({ position = 'bottom-right', showAfter = 400, editable }) {
  if (editable) {
    return (
      <div style={{ display: 'flex', gap: 'var(--space-3)', padding: 'var(--space-3)', border: '1px dashed var(--border-default)', borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)' }}>
        <span style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'var(--tint-info-bg)', color: 'var(--brand-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <BlockIcon name="arrow-up" />
        </span>
        <div>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-small)', color: 'var(--text-primary)' }}>
            Back to Top Button
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>
            Appears after a visitor scrolls down {showAfter}px, jumps back to the top of the page — doesn't take up space here in the block list.
          </div>
        </div>
      </div>
    );
  }

  return <LiveBackToTop position={position} showAfter={showAfter} />;
}

function LiveBackToTop({ position, showAfter }) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > showAfter);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [showAfter]);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      style={{
        position: 'fixed', zIndex: 450, ...(POSITION_STYLE[position] || POSITION_STYLE['bottom-right']),
        width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer',
        background: 'var(--brand-secondary)', color: 'var(--text-on-secondary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-md)',
      }}
    >
      <BlockIcon name="arrow-up" />
    </button>
  );
}

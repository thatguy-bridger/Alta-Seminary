import React from 'react';
import { EditableText } from '../admin-app/builder/EditableText.jsx';
import { BlockIcon } from '../admin-app/builder/blockIcons.jsx';

const TONE_FG = { info: 'var(--color-info)', success: 'var(--color-success)', warning: 'var(--color-warning)', error: 'var(--color-error)' };

function dismissKey(blockId) {
  return `alta-popup-dismissed-${blockId}`;
}

// Chromeless (registry.js) -- same message/link idea as Announcement Banner,
// shown as a dismissible modal after a delay instead of an inline bar. See
// BackgroundMusicBlock.jsx for the general chromeless-block pattern.
export function TimedPopupBlock({
  heading, message, tone = 'info', link, linkLabel, delaySeconds = 3, oncePerVisitor = true,
  editable, onFieldChange, blockId,
}) {
  if (editable) {
    return (
      <div style={{ display: 'flex', gap: 'var(--space-3)', padding: 'var(--space-3)', border: '1px dashed var(--border-default)', borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)' }}>
        <span style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'var(--tint-info-bg)', color: 'var(--brand-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <BlockIcon name="megaphone" />
        </span>
        <div style={{ flex: 1, minWidth: 0 }} onPointerDown={(e) => e.stopPropagation()}>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-small)', color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
            <EditableText value={heading} onCommit={(v) => onFieldChange('heading', v)} placeholder="Timed Popup — heading (optional)" />
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', color: 'var(--text-secondary)' }}>
            <EditableText value={message} onCommit={(v) => onFieldChange('message', v)} placeholder="Popup message" multiline />
          </div>
          <div style={{ marginTop: 'var(--space-2)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>
            Pops up {delaySeconds}s after a visitor arrives{oncePerVisitor ? ' (once per visitor)' : ' (every visit)'} — doesn't take up space here in the block list.
          </div>
        </div>
      </div>
    );
  }

  return (
    <LiveTimedPopup
      heading={heading} message={message} tone={tone} link={link} linkLabel={linkLabel}
      delaySeconds={delaySeconds} oncePerVisitor={oncePerVisitor} blockId={blockId}
    />
  );
}

function LiveTimedPopup({ heading, message, tone, link, linkLabel, delaySeconds, oncePerVisitor, blockId }) {
  const [show, setShow] = React.useState(false);
  const [closed, setClosed] = React.useState(false);

  React.useEffect(() => {
    if (oncePerVisitor && blockId && typeof window !== 'undefined' && window.localStorage.getItem(dismissKey(blockId)) === '1') {
      setClosed(true);
      return;
    }
    const timer = setTimeout(() => setShow(true), Math.max(0, delaySeconds) * 1000);
    return () => clearTimeout(timer);
  }, [delaySeconds, oncePerVisitor, blockId]);

  function handleClose() {
    setShow(false);
    setClosed(true);
    if (oncePerVisitor && blockId) window.localStorage.setItem(dismissKey(blockId), '1');
  }

  if (closed || !show || !message) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={handleClose}
      style={{ position: 'fixed', inset: 0, zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(20,20,22,0.5)', padding: 'var(--space-4)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 420, width: '100%', background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', padding: 'var(--space-6)', position: 'relative' }}
      >
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          style={{ position: 'absolute', top: 'var(--space-3)', right: 'var(--space-3)', border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1, color: 'var(--text-muted)' }}
        >
          &times;
        </button>
        {heading && (
          <h3 style={{ margin: '0 0 var(--space-2)', fontFamily: 'var(--font-display)', fontSize: 'var(--fs-subheading)', color: TONE_FG[tone] || TONE_FG.info }}>
            {heading}
          </h3>
        )}
        <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-body)', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
          {message}
        </p>
        {link && linkLabel && (
          <a href={link} className="btn btn-primary btn-sm" style={{ marginTop: 'var(--space-4)', display: 'inline-block' }}>
            {linkLabel}
          </a>
        )}
      </div>
    </div>
  );
}

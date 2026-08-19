import React from 'react';
import { EditableText } from '../admin-app/builder/EditableText.jsx';
import { textStyleToCss } from '../admin-app/builder/textStyle.js';

const TONE_BG = { info: 'var(--tint-info-bg)', success: 'var(--tint-success-bg)', warning: 'var(--tint-warning-bg)', error: 'var(--tint-error-bg)' };
const TONE_FG = { info: 'var(--color-info)', success: 'var(--color-success)', warning: 'var(--color-warning)', error: 'var(--color-error)' };

function dismissKey(blockId) {
  return `alta-banner-dismissed-${blockId}`;
}

export function AnnouncementBannerBlock({ message, tone = 'info', link, linkLabel, dismissible = true, messageStyle, editable, onFieldChange, blockId }) {
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    if (!editable && dismissible && blockId && typeof window !== 'undefined') {
      setDismissed(window.localStorage.getItem(dismissKey(blockId)) === '1');
    }
  }, [editable, dismissible, blockId]);

  if (!editable && (!message || dismissed)) return null;

  function handleDismiss() {
    if (blockId && typeof window !== 'undefined') window.localStorage.setItem(dismissKey(blockId), '1');
    setDismissed(true);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-6)', background: TONE_BG[tone] || TONE_BG.info, color: TONE_FG[tone] || TONE_FG.info, borderRadius: 'var(--radius-md)', flexWrap: 'wrap' }}>
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', fontWeight: 'var(--fw-bold)', ...textStyleToCss(messageStyle) }}>
        {editable ? (
          <EditableText value={message} onCommit={(v) => onFieldChange('message', v)} placeholder="Announcement message" styleValue={messageStyle} onStyleChange={(s) => onFieldChange('messageStyle', s)} />
        ) : message}
      </span>
      {!editable && link && linkLabel && (
        <a href={link} style={{ color: 'inherit', textDecoration: 'underline', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', fontWeight: 'var(--fw-bold)' }}>
          {linkLabel}
        </a>
      )}
      {!editable && dismissible && (
        <button
          onClick={handleDismiss}
          aria-label="Dismiss announcement"
          style={{ border: 'none', background: 'none', color: 'inherit', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0, marginLeft: 'var(--space-2)' }}
        >
          ×
        </button>
      )}
    </div>
  );
}

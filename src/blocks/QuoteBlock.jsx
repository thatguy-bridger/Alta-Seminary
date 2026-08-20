import React from 'react';
import { EditableText } from '../admin-app/builder/EditableText.jsx';
import { EditableImage } from '../admin-app/builder/EditableImage.jsx';
import { textStyleToCss } from '../admin-app/builder/textStyle.js';

const SIZE_VAR = { normal: 'var(--fs-heading)', large: 'var(--fs-heading-lg)' };

export function QuoteBlock({
  quoteText, citation, style = 'plain', align = 'center', avatarImage = '', size = 'normal', tintBackground = false,
  quoteTextStyle, citationStyle, editable, onFieldChange, pathPrefix,
}) {
  if (!editable && !quoteText) return null;
  const bordered = style === 'bordered';

  return (
    <blockquote
      style={{
        margin: 0,
        padding: bordered ? 'var(--space-2) var(--space-6)' : tintBackground ? 'var(--space-6)' : 0,
        borderLeft: bordered ? '3px solid var(--brand-secondary)' : 'none',
        background: tintBackground ? 'var(--surface-sunken)' : undefined,
        borderRadius: tintBackground ? 'var(--radius-lg)' : undefined,
        textAlign: bordered ? 'left' : align,
      }}
    >
      <p style={{ fontFamily: 'var(--font-serif)', fontSize: SIZE_VAR[size] || SIZE_VAR.normal, lineHeight: 'var(--lh-heading)', color: 'var(--text-primary)', margin: 0, fontStyle: 'italic', ...textStyleToCss(quoteTextStyle) }}>
        “{editable ? (
          <EditableText value={quoteText} onCommit={(v) => onFieldChange('quoteText', v)} placeholder="Quote" multiline as="span" styleValue={quoteTextStyle} onStyleChange={(s) => onFieldChange('quoteTextStyle', s)} />
        ) : quoteText}”
      </p>
      {(editable || citation || avatarImage) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: bordered ? 'flex-start' : align === 'center' ? 'center' : 'flex-start', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
          {(editable || avatarImage) && (
            editable ? (
              <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                <EditableImage value={avatarImage} alt="" onChange={(url) => onFieldChange('avatarImage', url)} pathPrefix={pathPrefix} emptyLabel="Photo" style={{ width: 40, height: 40 }} />
              </div>
            ) : avatarImage ? (
              <img src={avatarImage} alt={citation || ''} loading="lazy" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            ) : null
          )}
          {(editable || citation) && (
            <cite style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', color: 'var(--text-secondary)', fontStyle: 'normal', ...textStyleToCss(citationStyle) }}>
              {editable ? (
                <EditableText value={citation} onCommit={(v) => onFieldChange('citation', v)} placeholder="Citation" styleValue={citationStyle} onStyleChange={(s) => onFieldChange('citationStyle', s)} />
              ) : citation}
            </cite>
          )}
        </div>
      )}
    </blockquote>
  );
}

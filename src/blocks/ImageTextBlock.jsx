import React from 'react';
import { RichText } from './richText.jsx';
import { EditableText } from '../admin-app/builder/EditableText.jsx';
import { EditableImage } from '../admin-app/builder/EditableImage.jsx';
import { RichTextEditor } from '../admin-app/builder/RichTextEditor.jsx';
import { textStyleToCss } from '../admin-app/builder/textStyle.js';

const ALIGN_ITEMS = { top: 'flex-start', center: 'center', bottom: 'flex-end' };
const GAP_VAR = { sm: 'var(--space-4)', md: 'var(--space-6)', lg: 'var(--space-8)' };

export function ImageTextBlock({
  imageUrl, alt = '', heading, body, imagePosition = 'left',
  verticalAlign = 'center', gap = 'lg', mobileImageFirst = true,
  headingStyle, bodyStyle, editable, onFieldChange, pathPrefix,
}) {
  // Desktop order is controlled purely via CSS `order`, independent of DOM
  // position, so the mobile override below (also `order`-based) composes
  // cleanly regardless of which side the image is on for desktop.
  const desktopImageOrder = imagePosition === 'left' ? 1 : 2;

  const image = (
    <div className="it-image" style={{ order: desktopImageOrder }}>
      {editable ? (
        <>
          <EditableImage value={imageUrl} alt={alt} onChange={(url) => onFieldChange('imageUrl', url)} pathPrefix={pathPrefix} style={{ boxShadow: 'var(--shadow-sm)' }} />
          {imageUrl && !alt.trim() && (
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--color-warning)', margin: 'var(--space-2) 0 0' }}>
              No alt text yet — add it in the panel on the right.
            </p>
          )}
        </>
      ) : imageUrl ? (
        <img src={imageUrl} alt={alt} loading="lazy" style={{ width: '100%', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', display: 'block' }} />
      ) : null}
    </div>
  );

  const text = (
    <div className="it-text" style={{ order: desktopImageOrder === 1 ? 2 : 1 }}>
      {(editable || heading) && (
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-heading)', margin: '0 0 var(--space-3)', color: 'var(--text-primary)', ...textStyleToCss(headingStyle) }}>
          {editable ? (
            <EditableText value={heading} onCommit={(v) => onFieldChange('heading', v)} placeholder="Heading" styleValue={headingStyle} onStyleChange={(s) => onFieldChange('headingStyle', s)} />
          ) : heading}
        </h2>
      )}
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-body)', color: 'var(--text-secondary)', ...textStyleToCss(bodyStyle) }}>
        {editable ? (
          <RichTextEditor value={body} onCommit={(v) => onFieldChange('body', v)} placeholder="Body text…" />
        ) : (
          <RichText text={body} />
        )}
      </div>
    </div>
  );

  return (
    <div
      className={`block-image-text ${mobileImageFirst ? 'mobile-image-first' : 'mobile-text-first'}`}
      style={{ alignItems: ALIGN_ITEMS[verticalAlign] || 'center', gap: GAP_VAR[gap] || GAP_VAR.lg }}
    >
      {image}
      {text}
    </div>
  );
}

import React from 'react';
import { Badge } from '../design-system/components/core/Badge.jsx';
import { EditableText } from '../admin-app/builder/EditableText.jsx';
import { EditableImage } from '../admin-app/builder/EditableImage.jsx';
import { textStyleToCss } from '../admin-app/builder/textStyle.js';

const HEADING_SIZE_VAR = { normal: 'var(--fs-display)', large: 'var(--fs-display-lg)', xlarge: 'calc(var(--fs-display-lg) * 1.15)' };
const OVERLAY_ALPHA = { light: 0.25, medium: 0.45, dark: 0.65 };

export function HeroBlock({
  eyebrow, heading, subheading, align = 'center', background = 'none', backgroundImage,
  headingSize = 'normal', overlayOpacity = 'medium', textColor = 'auto',
  eyebrowStyle, headingStyle, subheadingStyle,
  editable, onFieldChange, pathPrefix,
}) {
  const forcedColor = textColor === 'light' ? '#fff' : textColor === 'dark' ? 'var(--text-primary)' : undefined;
  const isImageBg = background === 'image' && backgroundImage;
  const alpha = OVERLAY_ALPHA[overlayOpacity] ?? OVERLAY_ALPHA.medium;

  const wrapStyle = {
    position: 'relative',
    textAlign: align,
    padding: 'var(--space-8) var(--space-6)',
    ...(background === 'tint' ? { background: 'var(--surface-sunken)', borderRadius: 'var(--radius-lg)' } : {}),
    ...(isImageBg
      ? {
          backgroundImage: `linear-gradient(rgba(0,0,0,${alpha}),rgba(0,0,0,${alpha})), url(${backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          borderRadius: 'var(--radius-lg)',
          color: '#fff',
        }
      : {}),
  };
  const color = forcedColor || (isImageBg ? 'inherit' : undefined);

  return (
    <div style={wrapStyle}>
      {editable && background === 'image' && (
        <div style={{ position: 'absolute', top: 'var(--space-3)', right: 'var(--space-3)', zIndex: 1 }}>
          <EditableImage
            value={backgroundImage}
            alt=""
            onChange={(url) => onFieldChange('backgroundImage', url)}
            pathPrefix={pathPrefix}
            emptyLabel="Background image"
            style={{ width: 160, height: 90 }}
            showCropThumbnail={false}
          />
        </div>
      )}
      {(editable || eyebrow) && (
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <Badge tone="info">
            {editable ? (
              <EditableText
                value={eyebrow}
                onCommit={(v) => onFieldChange('eyebrow', v)}
                placeholder="Eyebrow"
                styleValue={eyebrowStyle}
                onStyleChange={(s) => onFieldChange('eyebrowStyle', s)}
              />
            ) : <span style={textStyleToCss(eyebrowStyle)}>{eyebrow}</span>}
          </Badge>
        </div>
      )}
      {(editable || heading) && (
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: HEADING_SIZE_VAR[headingSize] || HEADING_SIZE_VAR.normal, margin: 0, color: color || 'var(--text-primary)' }}>
          {editable ? (
            <EditableText
              value={heading}
              onCommit={(v) => onFieldChange('heading', v)}
              placeholder="Heading"
              styleValue={headingStyle}
              onStyleChange={(s) => onFieldChange('headingStyle', s)}
            />
          ) : <span style={textStyleToCss(headingStyle)}>{heading}</span>}
        </h1>
      )}
      {(editable || subheading) && (
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-body-lg)', marginTop: 'var(--space-4)', color: color || 'var(--text-secondary)' }}>
          {editable ? (
            <EditableText
              value={subheading}
              onCommit={(v) => onFieldChange('subheading', v)}
              placeholder="Subheading"
              multiline
              styleValue={subheadingStyle}
              onStyleChange={(s) => onFieldChange('subheadingStyle', s)}
            />
          ) : <span style={textStyleToCss(subheadingStyle)}>{subheading}</span>}
        </p>
      )}
    </div>
  );
}

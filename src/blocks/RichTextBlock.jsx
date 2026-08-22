import React from 'react';
import { RichText } from './richText.jsx';
import { RichTextEditor } from '../admin-app/builder/RichTextEditor.jsx';
import { textStyleToCss } from '../admin-app/builder/textStyle.js';

const TONE_VAR = { default: 'var(--text-primary)', muted: 'var(--text-secondary)' };
const FONT_SIZE_VAR = { small: 'var(--fs-small)', normal: 'var(--fs-body)', large: 'var(--fs-body-lg)' };

export function RichTextBlock({
  content, width = 'normal', textAlign = 'left', textTone = 'default', fontSize = 'normal',
  firstLineHeading = false, twoColumn = false, contentStyle, editable, onFieldChange,
}) {
  const override = textStyleToCss(contentStyle);
  return (
    <div
      style={{
        maxWidth: width === 'narrow' ? 640 : undefined,
        margin: width === 'narrow' ? '0 auto' : undefined,
        textAlign,
        fontFamily: override.fontFamily || 'var(--font-sans)',
        fontSize: override.fontSize || FONT_SIZE_VAR[fontSize] || FONT_SIZE_VAR.normal,
        lineHeight: 'var(--lh-body)',
        color: override.color || TONE_VAR[textTone] || TONE_VAR.default,
        columnCount: twoColumn ? 2 : undefined,
        columnGap: twoColumn ? 'var(--space-8)' : undefined,
      }}
      className={twoColumn ? 'rich-text-two-column' : undefined}
    >
      {editable ? (
        <RichTextEditor
          value={content}
          onCommit={(v) => onFieldChange('content', v)}
          placeholder="Write something…"
        />
      ) : (
        <RichText text={content} firstLineHeading={firstLineHeading} />
      )}
    </div>
  );
}

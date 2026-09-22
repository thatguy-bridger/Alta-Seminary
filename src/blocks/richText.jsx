import React from 'react';
import { looksLikeHtml, applyFirstLineHeading } from '../lib/richTextHtml.js';

// Legacy path: plain-text input (everything written before the WYSIWYG
// RichTextEditor existed, admin-app/builder/RichTextEditor.jsx), split into
// paragraphs on blank lines, with **bold**, *italic*, and [text](url) support.
// Never touches innerHTML -- everything below is React elements built from
// parsed text, so there's no HTML-injection surface to sanitize in the first place.

function renderInline(text, keyPrefix) {
  const parts = [];
  const pattern = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let lastIndex = 0;
  let match;
  let i = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    if (match[1] !== undefined) {
      parts.push(<strong key={`${keyPrefix}-${i++}`}>{match[1]}</strong>);
    } else if (match[2] !== undefined) {
      parts.push(<em key={`${keyPrefix}-${i++}`}>{match[2]}</em>);
    } else if (match[3] !== undefined) {
      parts.push(<a key={`${keyPrefix}-${i++}`} href={match[4]}>{match[3]}</a>);
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

// `inline` (used by EditableText.jsx-backed fields -- headings, buttons,
// badges, captions, ...): renders a single <span>, never the <div>/<p>/<ul>
// wrapping below. Safe because EditableText.jsx's own sanitize pass already
// guarantees inline-only content (text/strong/em/u/a/span/br) for anything
// stored through it -- see that file's own comment. Legacy plain values
// (never edited since before rich text existed) get the same **bold**/
// *italic*/[link](url) parsing as the block-level path, just without ever
// splitting on blank lines into multiple paragraphs.
export function RichText({ text, style, firstLineHeading = false, inline = false }) {
  if (inline) {
    if (!text) return null;
    if (looksLikeHtml(text)) {
      return <span style={style} dangerouslySetInnerHTML={{ __html: text }} />;
    }
    return <span style={style}>{renderInline(text, 'inline')}</span>;
  }

  // Real HTML written by RichTextEditor.jsx -- already sanitized at commit
  // time (see admin-app/builder/sanitizeRichHtml.js), so it's trusted here
  // the same way the rest of this admin's authored content is trusted.
  if (looksLikeHtml(text)) {
    const html = firstLineHeading ? applyFirstLineHeading(text) : text;
    return <div className="rich-text-content" style={style} dangerouslySetInnerHTML={{ __html: html }} />;
  }

  const paragraphs = (text || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (!paragraphs.length) return null;
  return (
    <>
      {paragraphs.map((p, idx) => {
        if (idx === 0 && firstLineHeading) {
          return (
            <h3 key={idx} style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-subheading)', margin: '0 0 var(--space-3)', color: 'var(--text-primary)' }}>
              {renderInline(p, idx)}
            </h3>
          );
        }
        return (
          <p key={idx} style={{ margin: idx === 0 ? '0 0 var(--space-3)' : 'var(--space-3) 0', ...style }}>
            {renderInline(p, idx)}
          </p>
        );
      })}
    </>
  );
}

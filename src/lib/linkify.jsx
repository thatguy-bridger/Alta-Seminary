import React from 'react';

// Turns emails/URLs/phone numbers inside plain admin-typed text (directory
// bios, extra fields) into real clickable links -- that text has no markup
// of its own, so this is the only way something like an email address
// becomes tappable instead of just sitting there as a string.
const PATTERN = /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})|(https?:\/\/[^\s<>"')]+)|(www\.[^\s<>"')]+)|(\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b)/gi;

export function linkify(text) {
  if (!text) return text;
  const parts = [];
  let lastIndex = 0;
  let key = 0;
  let match;
  PATTERN.lastIndex = 0;
  while ((match = PATTERN.exec(text))) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const [full, email, url, www, phone] = match;
    if (email) {
      parts.push(<a key={key++} href={`mailto:${email}`}>{email}</a>);
    } else if (url) {
      parts.push(<a key={key++} href={url} target="_blank" rel="noopener noreferrer">{url}</a>);
    } else if (www) {
      parts.push(<a key={key++} href={`https://${www}`} target="_blank" rel="noopener noreferrer">{www}</a>);
    } else if (phone) {
      parts.push(<a key={key++} href={`tel:${phone.replace(/[^\d+]/g, '')}`}>{phone}</a>);
    }
    lastIndex = match.index + full.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

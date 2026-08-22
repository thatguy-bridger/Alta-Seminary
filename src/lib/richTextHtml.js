// Isomorphic (no DOM) helpers shared between the admin's rich text editor
// (RichTextEditor.jsx, browser-only) and the public renderer (richText.jsx,
// which also runs server-side during Astro SSR) -- keep this file free of
// `document`/`window` so it stays safe to import from either.

export function looksLikeHtml(value) {
  return typeof value === 'string' && /<\/?[a-z][\s\S]*>/i.test(value);
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineToHtml(text) {
  const pattern = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let out = '';
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(text))) {
    out += escapeHtml(text.slice(lastIndex, match.index));
    if (match[1] !== undefined) out += `<strong>${escapeHtml(match[1])}</strong>`;
    else if (match[2] !== undefined) out += `<em>${escapeHtml(match[2])}</em>`;
    else if (match[3] !== undefined) out += `<a href="${match[4]}">${escapeHtml(match[3])}</a>`;
    lastIndex = pattern.lastIndex;
  }
  out += escapeHtml(text.slice(lastIndex));
  return out;
}

// Converts old-style **bold**/*italic*/[text](url) plain text (everything
// written before the WYSIWYG editor existed) into the minimal HTML the new
// editor understands -- run once, the moment a field with legacy content is
// opened for editing (see RichTextEditor.jsx), so nobody has to manually
// retype existing formatting.
export function legacyToHtml(text) {
  const paragraphs = (text || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return paragraphs.map((p) => `<p>${inlineToHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
}

// `firstLineHeading` (RichTextBlock's own toggle) is a purely cosmetic
// "treat the first line as a heading" switch -- it never changes what's
// stored, just how it renders. For real HTML content this means swapping
// only the very first top-level <p>'s tag name; since that <p> always comes
// from our own whitelist (see sanitizeRichHtml.js), a single targeted
// replace on just its opening/closing tag is safe (no user text can contain
// a literal "<p>" -- it would have been HTML-escaped on the way in).
export function applyFirstLineHeading(html) {
  if (!/^<p(\s[^>]*)?>/.test(html)) return html;
  // Non-global regex.replace stops at the first match, so this only ever
  // touches the opening tag and its matching first close tag.
  return html.replace(/^<p(\s[^>]*)?>/, '<h3$1>').replace('</p>', '</h3>');
}

// Browser-only (uses `document`/DOM APIs) -- never imported from anything
// that runs at Astro SSR time. Walks the *live, already browser-parsed* DOM
// of the rich text editor's contentEditable element and rebuilds a plain
// string from an explicit tag/attribute whitelist. This is the actual
// security boundary: nothing here copies raw innerHTML or matches against
// serialized HTML text (the usual way a string-regex "sanitizer" gets
// bypassed) -- every node is real, already-parsed DOM, and anything not in
// the switch below is either re-escaped as plain text or has its wrapper
// silently dropped (never trusted verbatim).
// #hex is allowed alongside var(--token) so a pre-existing per-field color
// override (set by the old TextStyleToolbar, a literal hex value) still
// carries over visually when its content is first converted into this
// editor's HTML -- see RichTextEditor.jsx's `legacyStyleOverride`. Every new
// edit made through THIS editor's own color swatches always uses var(--token).
const ALLOWED_STYLE_DECL = /^(color|background-color|font-size|font-family):\s*(var\(--[a-zA-Z0-9-]+\)|#[0-9a-fA-F]{3,8}|[\d.]+(px|vw)|[a-zA-Z0-9 ,."'-]+)$|^text-align:\s*(left|center|right)$/;

function escapeText(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// One unified allow-listed style-attribute reader for every tag -- alignment
// AND color/background/font-size/font-family can all land on a block-level
// tag (p/h3/li) or an inline one (span/font), so there's no separate
// "alignment only" path to accidentally drop the others on re-sanitize.
// Only ever reads this exact element's own inline `style` attribute (never
// getComputedStyle, which would pull in inherited/page-wide styles that have
// nothing to do with what the admin actually selected).
function inlineStyleAttr(el) {
  const raw = el.getAttribute('style') || '';
  const decls = raw.split(';').map((d) => d.trim().replace(/\s+/g, ' ')).filter((d) => d && ALLOWED_STYLE_DECL.test(d));
  return decls.length ? ` style="${decls.join(';')}"` : '';
}

function serializeChildren(node) {
  return Array.from(node.childNodes).map(serializeNode).join('');
}

function serializeNode(node) {
  if (node.nodeType === Node.TEXT_NODE) return escapeText(node.textContent);
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const tag = node.tagName.toLowerCase();
  const inner = serializeChildren(node);

  switch (tag) {
    case 'p':
    case 'h3':
    case 'ul':
    case 'ol':
    case 'li':
      return `<${tag}${inlineStyleAttr(node)}>${inner}</${tag}>`;
    case 'strong':
    case 'b':
      return `<strong>${inner}</strong>`;
    case 'em':
    case 'i':
      return `<em>${inner}</em>`;
    case 'u':
      return `<u>${inner}</u>`;
    case 'br':
      return '<br>';
    case 'a': {
      const href = node.getAttribute('href') || '';
      if (!/^(https?:\/\/|\/|mailto:|tel:)/.test(href)) return inner;
      return `<a href="${href.replace(/"/g, '&quot;')}">${inner}</a>`;
    }
    case 'span':
    case 'font': {
      const styleAttr = inlineStyleAttr(node);
      return styleAttr ? `<span${styleAttr}>${inner}</span>` : inner;
    }
    // contentEditable sometimes wraps a line in <div> instead of <p>
    // depending on the browser -- treat it exactly like a paragraph rather
    // than silently dropping its text.
    case 'div':
      return `<p${inlineStyleAttr(node)}>${inner}</p>`;
    default:
      return inner; // unrecognized tag: keep the text, drop the wrapper
  }
}

export function sanitizeRichHtml(rootEl) {
  return serializeChildren(rootEl);
}

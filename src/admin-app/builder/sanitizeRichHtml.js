// Browser-only (uses `document`/DOM APIs) -- never imported from anything
// that runs at Astro SSR time. Walks the *live, already browser-parsed* DOM
// of the rich text editor's contentEditable element and rebuilds a plain
// string from an explicit tag/attribute whitelist. This is the actual
// security boundary: nothing here copies raw innerHTML or matches against
// serialized HTML text (the usual way a string-regex "sanitizer" gets
// bypassed) -- every node is real, already-parsed DOM, and anything not in
// the switch below is either re-escaped as plain text or has its wrapper
// silently dropped (never trusted verbatim).
// #hex is allowed alongside var(--token) for color/background-color so a
// pre-existing whole-field color override (set by the old TextStyleToolbar
// before this editor existed, a literal hex value -- see RichTextBlock.jsx's
// contentStyle) still displays correctly; this editor's own color swatches
// always write var(--token) instead. The clamp(...) alternative is
// fluidClamp()'s output (textStyle.js) -- the same fluid min/max font-size
// formula used by the design system's own --fs-* tokens (typography.css),
// applied here to a custom per-selection font size too.
// Number sub-pattern is deliberately loose on precision/sign (-?[\d.]+) --
// this value round-trips through the browser's own CSSOM (set via
// span.style.fontSize = fluidClamp(px), read back later via
// getAttribute('style')), which can re-serialize the decimals slightly
// differently than fluidClamp()'s own .toFixed() output.
const NUM = '-?[\\d.]+';
const ALLOWED_STYLE_DECL = new RegExp(
  `^(color|background-color):\\s*(var\\(--[a-zA-Z0-9-]+\\)|#[0-9a-fA-F]{3,8})$` +
  `|^font-size:\\s*(var\\(--[a-zA-Z0-9-]+\\)|${NUM}px|clamp\\(\\s*${NUM}px\\s*,\\s*${NUM}px\\s*\\+\\s*${NUM}vw\\s*,\\s*${NUM}px\\s*\\))$` +
  `|^font-family:\\s*(var\\(--[a-zA-Z0-9-]+\\)|[a-zA-Z0-9 ,."'-]+)$` +
  `|^text-align:\\s*(left|center|right)$`
);

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
  // Backspacing all the way to nothing typically leaves a stray <p><br></p>
  // behind (contentEditable's own doing, so the cursor still has a line to
  // sit on) rather than a truly empty element. Serializing that as-is would
  // commit "<p><br></p>" instead of "", which is never falsy to any caller
  // checking `!value` -- the field would look blank but never show its
  // placeholder again, and any "hide when empty" block-level check on the
  // public site would keep rendering an empty paragraph. innerText strips
  // that stray markup down to a true blank, so it's the right emptiness check.
  if (!rootEl.innerText.trim()) return '';
  return serializeChildren(rootEl);
}

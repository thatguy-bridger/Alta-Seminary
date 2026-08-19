// Shared by every block's inline text fields -- lets an admin override a
// specific piece of text's color/size/font beyond the block's own style
// options, without touching arbitrary HTML (kept to plain CSS values only,
// same no-HTML-injection posture as the rest of the block system).
export const FONT_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'var(--font-serif)', label: 'Serif' },
  { value: 'var(--font-sans)', label: 'Sans-serif' },
  { value: 'Georgia, "Times New Roman", serif', label: 'Elegant serif' },
  { value: '-apple-system, "Segoe UI", system-ui, sans-serif', label: 'Modern sans' },
  { value: 'ui-monospace, Menlo, Consolas, monospace', label: 'Monospace' },
];

// The admin picks a font size in familiar px terms (as it'd look at a
// ~1200px-wide desktop), but it's stored/applied as a `vw` unit -- so the
// text takes up the same proportion of the screen at any width instead of
// staying visually tiny on a narrow phone or comically small on a huge
// monitor. Deliberately uncapped (no clamp min/max): a 500px-wide screen and
// a 4000px-wide screen render the exact same proportional size, as asked.
const REFERENCE_WIDTH_PX = 1200;

export function fontSizeToVw(px) {
  return (px / REFERENCE_WIDTH_PX) * 100;
}

export function textStyleToCss(override) {
  if (!override) return {};
  const css = {};
  if (override.color) css.color = override.color;
  if (override.fontSize) css.fontSize = `${fontSizeToVw(override.fontSize)}vw`;
  if (override.fontFamily) css.fontFamily = override.fontFamily;
  return css;
}

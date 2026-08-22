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
// ~1200px-wide desktop). It used to scale as a pure, uncapped `vw` unit --
// same proportion of the screen at any width -- but that meant a heading
// sized for desktop shrank all the way down to near-illegible on a phone,
// and every OTHER piece of text (the design system's fixed --fs-* tokens,
// see typography.css) didn't scale at all, so the two systems drifted apart
// on a narrow screen. This now uses the exact same fluid clamp() formula as
// those tokens (see fluidClamp below) -- shrinks with viewport width down to
// a floor instead of indefinitely, and both systems move together.
const MIN_VIEWPORT_PX = 375; // a small phone
const MAX_VIEWPORT_PX = 1200; // the desktop width these px values are "as drawn"

// How much a given desktop size is allowed to shrink by the time the
// viewport reaches MIN_VIEWPORT_PX -- bigger text (headings) has more visual
// "excess" to give up on a small screen, so it shrinks proportionally more;
// small text (captions) is already tight, so it barely shrinks at all.
// Fitted to look right across the whole --fs-* scale, from 12px captions up
// to 56px display headings -- see typography.css for that scale's own
// (identically-derived) clamp() values.
function minSizeFor(px) {
  const ratio = Math.min(1, Math.max(0.6, 1 - (px - 12) * 0.009));
  return px * ratio;
}

// Builds `clamp(min, intercept + slope*vw, max)` -- linear interpolation
// between (MIN_VIEWPORT_PX, min) and (MAX_VIEWPORT_PX, max), expressed as a
// vw-based CSS calc so it needs no JS/resize listener to stay in sync.
export function fluidClamp(maxPx, minPx = minSizeFor(maxPx)) {
  const slope = (maxPx - minPx) / (MAX_VIEWPORT_PX - MIN_VIEWPORT_PX);
  const intercept = minPx - slope * MIN_VIEWPORT_PX;
  const vwCoefficient = slope * 100;
  return `clamp(${minPx.toFixed(2)}px, ${intercept.toFixed(2)}px + ${vwCoefficient.toFixed(3)}vw, ${maxPx.toFixed(2)}px)`;
}

export function textStyleToCss(override) {
  if (!override) return {};
  const css = {};
  if (override.color) css.color = override.color;
  if (override.fontSize) css.fontSize = fluidClamp(override.fontSize);
  if (override.fontFamily) css.fontFamily = override.fontFamily;
  return css;
}

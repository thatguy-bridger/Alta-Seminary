// Curated color choices for the rich text editor's Text color / Text box
// color swatches -- deliberately NOT a raw hex picker. Every option maps to
// one of the site's existing design-system CSS variables (colors.css),
// which already have separate light/dark values (see the [data-theme="dark"]
// block there), so "does this look right in dark mode" is handled for free:
// the swatch stores `var(--token)`, never a literal color, and the browser
// resolves it to whichever theme is active wherever it's shown.
export const TEXT_COLOR_TOKENS = [
  { key: 'default', label: 'Default', var: '--text-primary' },
  { key: 'muted', label: 'Muted', var: '--text-secondary' },
  { key: 'brand', label: 'Brand', var: '--brand-secondary' },
  { key: 'success', label: 'Success', var: '--color-success' },
  { key: 'warning', label: 'Warning', var: '--color-warning' },
  { key: 'error', label: 'Error', var: '--color-error' },
];

export const BG_COLOR_TOKENS = [
  { key: 'sunken', label: 'Sunken', var: '--surface-sunken' },
  { key: 'tint-info', label: 'Info tint', var: '--tint-info-bg' },
  { key: 'tint-success', label: 'Success tint', var: '--tint-success-bg' },
  { key: 'tint-warning', label: 'Warning tint', var: '--tint-warning-bg' },
  { key: 'tint-error', label: 'Error tint', var: '--tint-error-bg' },
];

export const FONT_SIZE_OPTIONS = [12, 14, 16, 18, 20, 24, 28, 32];

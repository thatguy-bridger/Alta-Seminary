// Editable site header + footer. Stored as one jsonb value on site_settings
// (site_chrome); everything here is pure so the admin form, the public
// layout and the tests all share one definition of "valid".

export const DEFAULT_CHROME = {
  header: { logoUrl: '', logoAlt: 'Alta Seminary', showSearch: true, showTextSize: true, showThemeToggle: true },
  footer: {
    text: '© {year} Alta Seminary · Seminaries and Institutes, The Church of Jesus Christ of Latter-day Saints',
    links: [{ label: 'Contact', url: '/contact' }],
  },
};

const str = (v, fallback) => (typeof v === 'string' ? v : fallback);
const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);

// Anything stored (or missing, or hand-edited in the database) becomes a
// complete config. Blank required values fall back to the defaults so the
// public site can never render an empty header or footer.
export function normalizeChrome(raw) {
  const h = raw?.header || {};
  const f = raw?.footer || {};
  const d = DEFAULT_CHROME;
  const links = Array.isArray(f.links)
    ? f.links.map((l) => ({ label: str(l?.label, '').trim(), url: str(l?.url, '').trim() })).filter((l) => l.label && l.url)
    : null;
  return {
    header: {
      logoUrl: str(h.logoUrl, '').trim(),
      logoAlt: str(h.logoAlt, '').trim() || d.header.logoAlt,
      showSearch: bool(h.showSearch, true),
      showTextSize: bool(h.showTextSize, true),
      showThemeToggle: bool(h.showThemeToggle, true),
    },
    footer: {
      text: str(f.text, '').trim() || d.footer.text,
      links: links && links.length ? links : d.footer.links,
    },
  };
}

const URL_OK = /^(\/|https?:\/\/|mailto:|tel:|#)/i;

// Errors for the admin form: { 'header.logoAlt': '...', 'footer.links.0.url': '...' }.
// Empty object means it is safe to save.
export function validateChrome(c) {
  const errors = {};
  if (!c.header.logoAlt?.trim()) errors['header.logoAlt'] = 'Describe the logo (used by screen readers). Required.';
  if (!c.footer.text?.trim()) errors['footer.text'] = 'The footer needs some text. Required.';
  if (!c.footer.links.length) errors['footer.links'] = 'Keep at least one footer link (e.g. Contact).';
  c.footer.links.forEach((l, i) => {
    if (!l.label?.trim()) errors[`footer.links.${i}.label`] = 'Label required.';
    if (!l.url?.trim()) errors[`footer.links.${i}.url`] = 'Link required.';
    else if (!URL_OK.test(l.url.trim())) errors[`footer.links.${i}.url`] = 'Start with /, https://, mailto: or tel:.';
  });
  return errors;
}

export const footerText = (text, year) => text.replaceAll('{year}', String(year));

// Prefixes an absolute in-site path with Astro's configured `base`, so
// links/redirects still resolve correctly whether the site is served from
// the repo subpath (github.io/Alta-Seminary) or the eventual root domain --
// see the base/site notes in astro.config.mjs.
export function withBase(path) {
  const base = import.meta.env.BASE_URL;
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

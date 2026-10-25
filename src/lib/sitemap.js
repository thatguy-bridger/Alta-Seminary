// Pure helpers for /sitemap.xml and /llms.txt so the formatting is testable.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// entries: [{ path, lastmod? }] -> sitemap XML. Paths are made absolute against `site`.
export function buildSitemapXml(site, entries) {
  const origin = site.replace(/\/$/, '');
  const seen = new Set();
  const urls = entries
    .filter((e) => e.path && !seen.has(e.path) && seen.add(e.path))
    .map((e) => `  <url><loc>${esc(origin + (e.path === '/' ? '/' : e.path))}</loc>${e.lastmod ? `<lastmod>${new Date(e.lastmod).toISOString()}</lastmod>` : ''}</url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

// llms.txt: a short plain-text map of the site for AI assistants.
export function buildLlmsTxt(site, entries) {
  const origin = site.replace(/\/$/, '');
  const lines = entries.filter((e) => e.title).map((e) => `- [${e.title}](${origin}${e.path})`);
  return `# Alta Seminary\n\n> The public website for Alta Seminary, part of Seminaries and Institutes of The Church of Jesus Christ of Latter-day Saints. Pages below are kept up to date by the school.\n\n## Pages\n\n${lines.join('\n')}\n`;
}

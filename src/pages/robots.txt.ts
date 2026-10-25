import type { APIContext } from 'astro';

// Generated so the Sitemap line always matches the site's configured address
// (astro.config.mjs `site`) -- no editing it when the real domain goes live.
export function GET(context: APIContext) {
  const site = String(context.site).replace(/\/$/, '');
  return new Response(`User-agent: *\nDisallow: /admin/\n\nSitemap: ${site}/sitemap.xml\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

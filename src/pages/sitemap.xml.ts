import type { APIContext } from 'astro';
import { supabaseBuild } from '../lib/supabase/build-client';
import { buildSitemapXml } from '../lib/sitemap.js';

// A live /sitemap.xml: every published page, announcement, event and directory
// person's routes straight from the database, so new content is listed
// without a rebuild.
export async function GET(context: APIContext) {
  const [pages, posts, events] = await Promise.all([
    supabaseBuild.from('public_pages').select('route_path'),
    supabaseBuild.from('public_blog_posts').select('slug, published_at'),
    supabaseBuild.from('calendar_events').select('slug, published_at').eq('status', 'published'),
  ]);
  const entries = [
    ...(pages.data || []).map((r: { route_path: string }) => ({ path: r.route_path })),
    ...(posts.data || []).map((r: { slug: string; published_at: string | null }) => ({ path: `/announcements/${r.slug}`, lastmod: r.published_at })),
    ...(events.data || []).filter((r: { slug: string | null }) => r.slug).map((r: { slug: string; published_at: string | null }) => ({ path: `/events/${r.slug}`, lastmod: r.published_at })),
    { path: '/events/archive' },
  ];
  return new Response(buildSitemapXml(String(context.site), entries), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=3600' },
  });
}

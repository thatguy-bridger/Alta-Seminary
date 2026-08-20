import { supabaseBuild } from './supabase/build-client';
import { withBase } from './url.js';

// Build-time only: reads the public_pages VIEW (never the base `pages` table),
// which only exposes published_blocks for rows with status='published' --
// see the RLS/view comments in supabase/migrations/0001_init.sql.
export async function getPublishedPage(slug) {
  const { data, error } = await supabaseBuild
    .from('public_pages')
    .select('id, title, meta_description, og_image_url, published_blocks')
    .eq('slug', slug)
    .maybeSingle();
  if (error) {
    console.error(`Failed to fetch page "${slug}":`, error.message);
    return null;
  }
  return data;
}

// Builds the site nav tree (builder pages + route/section entries, with
// Directory-style subpages nested under their parent) from the same
// public_pages view -- used by Nav.astro instead of a hardcoded link list.
export async function getNavTree() {
  const { data, error } = await supabaseBuild
    .from('public_pages')
    .select('id, nav_label, nav_order, show_in_nav, parent_id, route_path')
    .eq('show_in_nav', true)
    .order('nav_order');
  if (error) {
    console.error('Failed to fetch nav tree:', error.message);
    return [];
  }
  const byParent = new Map();
  for (const row of data) {
    const key = row.parent_id || 'root';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(row);
  }
  const attachChildren = (row) => ({
    label: row.nav_label,
    href: row.route_path ? withBase(row.route_path) : undefined,
    children: (byParent.get(row.id) || []).map(attachChildren),
  });
  return (byParent.get('root') || []).map(attachChildren);
}

// Every real published path on the site (route_path from pages, plus each
// published announcement's own /announcements/<slug>) -- consumed by
// routes.json.ts and, from there, by 404.astro's "closest real page" fallback.
// Raw paths, no `base` prefix -- see withBase() usage in 404.astro.
export async function getAllRoutes() {
  const [pagesResult, postsResult] = await Promise.all([
    supabaseBuild.from('public_pages').select('route_path'),
    supabaseBuild.from('public_blog_posts').select('slug'),
  ]);
  const pageRoutes = (pagesResult.data || [])
    .map((row) => row.route_path)
    .filter(Boolean);
  const postRoutes = (postsResult.data || []).map((row) => `/announcements/${row.slug}`);
  return [...new Set([...pageRoutes, ...postRoutes])];
}

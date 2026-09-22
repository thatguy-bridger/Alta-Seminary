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
  // A "show on all pages" chromeless block (Background Music, Back to Top,
  // ...) still physically lives in whichever page's own block list the
  // admin dropped it on -- editing it there is what BlockConfigPanel's
  // toggle actually changes. But rendering it needs to happen exactly once
  // per page load, via PublicLayout.astro's own getGlobalChromelessBlocks()
  // call below, not also here on top of that -- otherwise the one page it's
  // physically stored on would render it twice.
  if (data?.published_blocks) {
    data.published_blocks = data.published_blocks.filter((b) => b?.layout?.showOnAllPages !== true);
  }
  return data;
}

// Every chromeless block (see registry.js) flagged "Show on all pages" --
// regardless of which specific page it's actually stored on -- read from the
// global_chromeless_blocks view (0023_global_chromeless_blocks.sql).
// PublicLayout.astro renders these once per page load, on every public page,
// so an admin only has to place one of these blocks somewhere once.
export async function getGlobalChromelessBlocks() {
  const { data, error } = await supabaseBuild
    .from('global_chromeless_blocks')
    .select('id, type, props, layout');
  if (error) {
    console.error('Failed to fetch global blocks:', error.message);
    return [];
  }
  return data || [];
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
// Build-time search index -- title + short description + path for every
// published page and announcement, consumed by search-index.json.ts and, from
// there, by SiteSearch.jsx's client-side filter. No server/DB round-trip at
// search time -- the whole index is small enough to fetch once and filter
// in the browser.
// Directory kinds with a dedicated public page to deep-link a person into
// (via ?person=<id>, opened by DirectoryTeaserBlock.jsx). Matches KIND_PATH there.
const DIRECTORY_KIND_PATH = { staff: 'staff', council: 'council', missionary: 'missionaries' };

export async function getSearchIndex() {
  const [pagesResult, postsResult, directoryResult, eventsResult, galleryResult] = await Promise.all([
    supabaseBuild.from('public_pages').select('title, meta_description, route_path'),
    supabaseBuild.from('public_blog_posts').select('title, excerpt, slug'),
    supabaseBuild.from('directory_entries').select('id, name, bio, extra_fields, directory_kind').eq('status', 'published'),
    supabaseBuild.from('calendar_events').select('id, title, description, location, start_at').eq('status', 'published'),
    supabaseBuild.from('gallery_photos').select('id, caption, alt_text, created_at, gallery_albums(name)').eq('status', 'published'),
  ]);

  const pages = (pagesResult.data || [])
    .filter((row) => row.route_path)
    .map((row) => ({ type: 'page', title: row.title, description: row.meta_description || '', path: row.route_path }));

  const posts = (postsResult.data || []).map((row) => ({
    type: 'announcement', title: row.title, description: row.excerpt || '', path: `/announcements/${row.slug}`,
  }));

  // Only the 3 built-in kinds have a page to deep-link into; entries of any
  // other kind still exist for admins but aren't publicly browsable, so skip them.
  const directory = (directoryResult.data || [])
    .filter((row) => DIRECTORY_KIND_PATH[row.directory_kind])
    .map((row) => {
      const extra = Object.values(row.extra_fields || {}).filter(Boolean).join(' · ');
      return {
        type: 'directory',
        title: row.name,
        description: [row.bio, extra].filter(Boolean).join(' · '),
        path: `/directory/${DIRECTORY_KIND_PATH[row.directory_kind]}?person=${row.id}`,
      };
    });

  const events = (eventsResult.data || []).map((row) => ({
    type: 'event',
    title: row.title,
    description: [row.description, row.location].filter(Boolean).join(' · '),
    date: row.start_at,
    location: row.location || '',
    path: '/events',
  }));

  const gallery = (galleryResult.data || []).map((row) => ({
    type: 'gallery',
    title: row.caption || row.gallery_albums?.name || 'Photo',
    description: [row.alt_text, row.gallery_albums?.name].filter(Boolean).join(' · '),
    date: row.created_at,
    location: row.gallery_albums?.name || '',
    path: '/gallery',
  }));

  return [...pages, ...posts, ...directory, ...events, ...gallery];
}

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

function normalizePath(path) {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

// Walks a broken path up one segment at a time -- /directory/staff/john ->
// /directory/staff -> /directory -- until it finds a real published route,
// falling back to the homepage if nothing along the way matches. Used by
// [...path].astro and announcements/[slug].astro's own not-found cases, now
// that server rendering means this can happen as a real redirect instead of
// 404.astro's old client-side-only version (still there as a rarely-hit
// backup for genuinely unrouted requests).
export async function findClosestRoute(requestedPath) {
  const routes = await getAllRoutes();
  const known = new Set(routes.map(normalizePath));
  known.add('/');
  let candidate = normalizePath(requestedPath);
  while (candidate !== '/' && !known.has(candidate)) {
    candidate = normalizePath(candidate.slice(0, candidate.lastIndexOf('/')) || '/');
  }
  return candidate;
}

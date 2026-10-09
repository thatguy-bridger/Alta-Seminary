import { slugify } from './slug.js';

import { DEDICATED_ROUTES, NON_PAGE_ROUTES } from '../lib/dedicatedRoutes.js';

// A dedicated route (src/lib/dedicatedRoutes.js) may only be taken by the
// page whose slug owns it; a non-page route may never be taken at all.
// Slug is a page's permanent identity -- only route_path ever moves on rename.
const RESERVED_ROUTES = { ...DEDICATED_ROUTES, ...Object.fromEntries(NON_PAGE_ROUTES.map((r) => [r, ''])) };

// The public URL a renamed page should live at: its title, slugified, nested
// under its parent's URL when it's a sub page (so "Faculty Directory" under
// /directory becomes /directory/faculty-directory, not a flat /faculty-directory).
// The home page never moves. Suffixed -2, -3, ... if another page already
// has that URL or a dedicated route file owned by a different page does.
export function nextRoutePath(row, newTitle, pages) {
  if (row.route_path === '/') return '/';
  const parent = row.parent_id ? pages.find((p) => p.id === row.parent_id) : null;
  const prefix = parent?.route_path && parent.route_path !== '/' ? parent.route_path : '';
  const base = `${prefix}/${slugify(newTitle)}`;
  const taken = new Set(pages.filter((p) => p.id !== row.id).map((p) => p.route_path));
  const blocked = (path) => taken.has(path) || (path in RESERVED_ROUTES && RESERVED_ROUTES[path] !== row.slug);
  let candidate = base;
  let n = 2;
  while (blocked(candidate)) candidate = `${base}-${n++}`;
  return candidate;
}

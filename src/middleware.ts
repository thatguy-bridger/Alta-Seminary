import { defineMiddleware } from 'astro:middleware';
import { DEDICATED_ROUTES } from './lib/dedicatedRoutes.js';
import { supabaseBuild } from './lib/supabase/build-client';

// A renamed page keeps its slug but gets a new URL (see admin-app/
// pageRoutes.js), while its dedicated route file (about.astro,
// directory/staff.astro, ...) still answers at the ORIGINAL path -- which
// would otherwise keep serving a second copy there. Forward those to the
// page's current URL so old links and bookmarks keep working.
//
// This is middleware (not a redirect inside BuilderPage.astro) because Astro
// can't redirect from a component once the page has started streaming --
// that throws ResponseSentError. 302 on purpose: a cached permanent
// redirect would loop if the page were ever renamed back to its old URL.
export const onRequest = defineMiddleware(async (context, next) => {
  if (context.request.method !== 'GET') return next();
  const path = context.url.pathname.replace(/\/+$/, '') || '/';
  const slug = (DEDICATED_ROUTES as Record<string, string>)[path];
  if (!slug) return next();

  const { data } = await supabaseBuild.from('public_pages').select('route_path').eq('slug', slug).maybeSingle();
  if (data?.route_path && data.route_path !== path) {
    return context.redirect(data.route_path + context.url.search, 302);
  }
  return next();
});

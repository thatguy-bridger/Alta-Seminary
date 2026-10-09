// Public URLs answered by a dedicated src/pages/*.astro file, mapped to the
// page slug that file hardcodes in its <BuilderPage slug="..."> call. A page's
// slug is its permanent identity -- these files look pages up by it -- so only
// a page's route_path ever changes when it's renamed. Shared by the admin
// (pageRoutes.js, to keep renames from colliding with these) and by
// middleware.ts (to forward a dedicated URL to wherever its page lives now).
export const DEDICATED_ROUTES = {
  '/': 'home',
  '/about': 'about',
  '/announcements': 'announcements',
  '/contact': 'contact',
  '/directory': 'directory',
  '/directory/council': 'directory-council',
  '/directory/staff': 'directory-staff',
  '/directory/missionaries': 'directory-missionaries',
  '/enrollment': 'enrollment',
  '/events': 'events',
  '/gallery': 'gallery',
  '/makeup-work': 'makeup-work',
  '/schedule': 'schedule',
};

// Routes that exist but aren't pages -- no page may ever be renamed onto one.
export const NON_PAGE_ROUTES = ['/404', '/admin', '/rss.xml', '/routes.json', '/search-index.json'];

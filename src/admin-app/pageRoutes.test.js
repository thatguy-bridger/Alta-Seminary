import { describe, it, expect } from 'vitest';
import { nextRoutePath } from './pageRoutes.js';

const pages = [
  { id: 'dir', slug: 'directory', route_path: '/directory', parent_id: null },
  { id: 'staff', slug: 'directory-staff', route_path: '/directory/faculty-directory', parent_id: 'dir' },
  { id: 'council', slug: 'directory-council', route_path: '/directory/council', parent_id: 'dir' },
  { id: 'about', slug: 'about', route_path: '/info', parent_id: null },
  { id: 'home', slug: 'home', route_path: '/', parent_id: null },
  { id: 'events', slug: 'events', route_path: '/events', parent_id: null },
  { id: 'custom', slug: 'parents', route_path: '/parents', parent_id: null },
];
const route = (id, title) => nextRoutePath(pages.find((p) => p.id === id), title, pages);

describe('nextRoutePath (where a renamed page lives)', () => {
  it('slugifies the new title for a top-level page', () => {
    expect(route('custom', 'For Parents & Guardians!')).toBe('/for-parents-guardians');
  });

  it('keeps sub pages nested under their parent instead of flattening them', () => {
    expect(route('staff', 'Staff Directory')).toBe('/directory/staff-directory');
  });

  it('never moves the home page', () => {
    expect(route('home', 'Welcome')).toBe('/');
  });

  it('lets a page reclaim the dedicated URL that belongs to its own slug', () => {
    // "Info" lives at /info but its slug is "about", which owns /about.
    expect(route('about', 'About')).toBe('/about');
  });

  it("won't take another page's dedicated URL", () => {
    expect(route('about', 'Events')).toBe('/events-2');
    expect(route('council', 'Staff')).toBe('/directory/staff-2'); // /directory/staff belongs to directory-staff
  });

  it("won't take a URL another page is already using", () => {
    expect(route('custom', 'Faculty Directory')).toBe('/faculty-directory'); // top-level, not the nested one
    expect(route('about', 'Parents')).toBe('/parents-2');
  });

  it('never lands on a non-page route', () => {
    expect(route('custom', 'Admin')).toBe('/admin-2');
    expect(route('custom', 'RSS.xml')).toBe('/rss-xml'); // slugified, so it can't collide with /rss.xml
  });
});

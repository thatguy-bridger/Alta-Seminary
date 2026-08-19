-- Pivot away from fixed "route" pages with hardcoded templates. Every page in
-- the site nav -- including Schedule/Announcements/Directory (+ its 3
-- subpages)/Gallery/Events/Contact/Makeup Work -- becomes a normal
-- block-builder page, editable through the exact same /admin/pages/edit
-- screen as Home/About/Enrollment. Admins compose these pages themselves
-- using blocks (e.g. a Directory Teaser block with count=all dropped onto the
-- "Directory" page), instead of us maintaining a bespoke template per section.
--
-- page_kind stays as a column (default 'builder', still checked against
-- ('builder','route')) in case a genuinely fixed route is ever needed again,
-- but nothing is seeded as 'route' anymore.

update public.pages set page_kind = 'builder' where page_kind = 'route';

-- The "Directory" parent entry had no route_path (it was just a nav dropdown
-- label with no page of its own) -- give it one so it's a real editable page
-- too, e.g. an overview page linking out to or embedding the three sub-directories.
update public.pages set route_path = '/directory' where slug = 'directory';

-- The Announcements List block (public_blog_posts-backed) needs to be
-- readable both at build time (anon) and from the admin canvas/preview
-- (authenticated) -- the view's security_invoker=false already means it runs
-- as owner, so this grant is just extending the read grant to the other role.
grant select on public.public_blog_posts to authenticated;

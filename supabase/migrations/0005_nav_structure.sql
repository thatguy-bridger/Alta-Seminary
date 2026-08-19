-- Extends `pages` so the admin Pages screen can manage the ENTIRE site nav
-- structure -- not just the drag-and-drop-editable pages (Home/About/
-- Enrollment/etc, page_kind='builder'), but also fixed feature routes like
-- Schedule/Announcements/Gallery/Events/Contact/Directory (page_kind='route',
-- no block content -- just nav placement/visibility) and their subpages
-- (parent_id), e.g. the three Directory kinds nested under a "Directory" entry.

alter table public.pages add column parent_id uuid references public.pages(id) on delete cascade;
alter table public.pages add column page_kind text not null default 'builder' check (page_kind in ('builder','route'));
alter table public.pages add column route_path text;

-- Backfill the existing block-builder pages with their public route + a
-- renumbered nav_order that interleaves correctly with the route pages below.
update public.pages set route_path = '/', nav_order = 1 where slug = 'home';
update public.pages set route_path = '/about', nav_order = 2 where slug = 'about';
update public.pages set route_path = '/enrollment', nav_order = 6 where slug = 'enrollment';

-- Route-kind entries for every other page/section of the site. status is
-- fixed to 'published' since these carry no draft content of their own --
-- show_in_nav is what actually controls visibility, independent of status.
insert into public.pages (slug, title, nav_label, nav_order, show_in_nav, page_kind, route_path, status)
values
  ('schedule', 'Schedule', 'Schedule', 3, true, 'route', '/schedule', 'published'),
  ('announcements', 'Announcements', 'Announcements', 4, true, 'route', '/announcements', 'published'),
  ('directory', 'Directory', 'Directory', 5, true, 'route', null, 'published'),
  ('gallery', 'Gallery', 'Gallery', 7, true, 'route', '/gallery', 'published'),
  ('events', 'Events', 'Events', 8, true, 'route', '/events', 'published'),
  ('contact', 'Contact', 'Contact', 9, true, 'route', '/contact', 'published'),
  ('makeup-work', 'Makeup Work', 'Makeup Work', 10, true, 'route', '/makeup-work', 'published')
on conflict (slug) do nothing;

-- Directory subpages, nested under the "directory" parent entry above.
insert into public.pages (slug, title, nav_label, nav_order, show_in_nav, page_kind, route_path, status, parent_id)
select 'directory-council', 'Seminary Council Directory', 'Seminary Council', 1, true, 'route', '/directory/council', 'published', id
from public.pages where slug = 'directory'
on conflict (slug) do nothing;

insert into public.pages (slug, title, nav_label, nav_order, show_in_nav, page_kind, route_path, status, parent_id)
select 'directory-missionaries', 'Missionary Directory', 'Missionaries', 2, true, 'route', '/directory/missionaries', 'published', id
from public.pages where slug = 'directory'
on conflict (slug) do nothing;

insert into public.pages (slug, title, nav_label, nav_order, show_in_nav, page_kind, route_path, status, parent_id)
select 'directory-staff', 'Staff Directory', 'Staff', 3, true, 'route', '/directory/staff', 'published', id
from public.pages where slug = 'directory'
on conflict (slug) do nothing;

-- Extend the public view with the new nav-structure columns (appended at the
-- end -- CREATE OR REPLACE VIEW requires existing column order/names to stay put).
create or replace view public.public_pages with (security_invoker = false) as
  select id, slug, title, meta_description, og_image_url, nav_label, nav_order, show_in_nav,
         published_blocks, published_at, parent_id, page_kind, route_path
  from public.pages where status = 'published';
grant select on public.public_pages to anon;

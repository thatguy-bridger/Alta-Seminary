-- Ties an event to the announcement post and/or gallery album an admin
-- creates FOR it (see EventsScreen.jsx's "Create Announcement"/"Create
-- Photo Album" buttons) -- both nullable and ON DELETE SET NULL, since
-- deleting the linked post/album later shouldn't take the event down with
-- it, just quietly drop the link.
alter table public.calendar_events
  add column announcement_post_id uuid references public.blog_posts(id) on delete set null,
  add column gallery_album_id uuid references public.gallery_albums(id) on delete set null;

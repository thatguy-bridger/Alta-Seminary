-- What the public Events page needs to know about each event's linked content:
-- "Read more" (its announcement) and "Photos" (its album). content_links itself
-- is admin-only (RLS), and the public site reads with the anon key, so this is a
-- narrow, read-only window onto it -- exactly like public_pages/public_blog_posts.
--
-- Deliberately only exposes a link when its TARGET is publicly visible:
--   * an announcement, once it's published (never a draft or scheduled one)
--   * an album, once it's published AND has at least one published photo
--     (an empty or unpublished album would just be a dead link)
--
-- content_links stores each pair once in alphabetical-by-kind order, and
-- 'album' < 'announcement' < 'event', so an event is always the b side.
create or replace view public.public_event_links with (security_invoker = false) as
  select l.b_id as event_id, 'announcement'::text as kind, p.id as target_id, p.slug, p.title
  from public.content_links l
  join public.blog_posts p on p.id = l.a_id
  where l.a_kind = 'announcement' and l.b_kind = 'event' and p.status = 'published'
  union all
  select l.b_id as event_id, 'album'::text as kind, a.id as target_id, null::text as slug, a.name as title
  from public.content_links l
  join public.gallery_albums a on a.id = l.a_id
  where l.a_kind = 'album' and l.b_kind = 'event' and a.status = 'published'
    and exists (select 1 from public.gallery_photos ph where ph.album_id = a.id and ph.status = 'published');

grant select on public.public_event_links to anon, authenticated;

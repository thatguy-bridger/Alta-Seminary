-- log_publish_event() only fired the FIRST time a row went draft -> published
-- (old.status is distinct from 'published'), so it silently never fired
-- again for the same row -- editing an already-published page/post and
-- clicking Publish again, or editing an already-published directory entry/
-- gallery item/event, never re-triggered the deploy webhook. The edit saved
-- to the database fine; the live static site just never rebuilt to show it.

-- pages/blog_posts: still driven by their draft_blocks/published_blocks
-- split, so this only needs to also catch published_blocks actually
-- changing on an already-published row (a second Publish click with new
-- content) -- it deliberately still ignores draft_blocks-only autosave,
-- which never touches published_blocks/status at all.
create or replace function public.log_publish_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published'
     and (old.status is distinct from new.status or old.published_blocks is distinct from new.published_blocks) then
    insert into public.publish_events (owner_type, owner_id, triggered_by)
      values (tg_argv[0], new.id, auth.uid());
    update public.site_settings set last_published_at = now(), updated_at = now() where id = true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pages_publish on public.pages;
create trigger trg_pages_publish after update of status, published_blocks on public.pages
  for each row execute function public.log_publish_event('page');

drop trigger if exists trg_posts_publish on public.blog_posts;
create trigger trg_posts_publish after update of status, published_blocks on public.blog_posts
  for each row execute function public.log_publish_event('post');

-- directory_entries/gallery_albums/gallery_photos/calendar_events have no
-- draft/live split -- editing a field IS editing the live content, gated
-- only by status. Any edit while already published (not just the initial
-- publish) needs to rebuild the site. Each of these is only saved via an
-- explicit Save button (confirmed, not autosave-per-keystroke), so this
-- can't turn into a rebuild storm the way watching every column on
-- pages/blog_posts would.
create or replace function public.log_publish_event_direct()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published' then
    insert into public.publish_events (owner_type, owner_id, triggered_by)
      values (tg_argv[0], new.id, auth.uid());
    update public.site_settings set last_published_at = now(), updated_at = now() where id = true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_directory_publish on public.directory_entries;
create trigger trg_directory_publish after update on public.directory_entries
  for each row execute function public.log_publish_event_direct('directory');

drop trigger if exists trg_gallery_album_publish on public.gallery_albums;
create trigger trg_gallery_album_publish after update on public.gallery_albums
  for each row execute function public.log_publish_event_direct('gallery');

drop trigger if exists trg_gallery_photo_publish on public.gallery_photos;
create trigger trg_gallery_photo_publish after update on public.gallery_photos
  for each row execute function public.log_publish_event_direct('gallery');

drop trigger if exists trg_calendar_event_publish on public.calendar_events;
create trigger trg_calendar_event_publish after update on public.calendar_events
  for each row execute function public.log_publish_event_direct('event');

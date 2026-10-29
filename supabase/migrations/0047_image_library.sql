-- The image library: every picture used anywhere on the site, with information that can be searched.
--
-- Before this, media_library was a bare list of addresses that the "choose an existing image" picker read. Now each image has a
-- title, description, alt text, tags, a credit and licence note, where it came from (uploaded to our storage, shipped with the
-- site, or only linked from another website), its size, and a full-text search column with an index.
--
-- Where an image is USED is never stored (it would go stale): the media_library_usage view works it out from the real content
-- (pages, announcements, events, the directory, photo albums, lesson pictures, the site header and footer) every time it is read.
--
-- Anything uploaded to the `images` storage bucket is registered here automatically by a trigger, whoever uploaded it, and the
-- admin fills in the details. The trigger can never stop an upload: if it fails, the upload still succeeds.

-- ---------------------------------------------------------------------------------------------------------------------------
-- The table
-- ---------------------------------------------------------------------------------------------------------------------------
alter table public.media_library alter column storage_path drop not null;   -- only images we host have a path in our storage

alter table public.media_library
  add column if not exists origin text not null default 'uploaded' check (origin in ('uploaded', 'site', 'linked')),
  add column if not exists title text not null default '',
  add column if not exists description text not null default '',
  add column if not exists alt_text text not null default '',
  add column if not exists tags text[] not null default '{}',
  add column if not exists credit text not null default '',
  add column if not exists license text not null default '',
  add column if not exists source_url text,
  add column if not exists mime_type text,
  add column if not exists width integer check (width is null or width > 0),
  add column if not exists height integer check (height is null or height > 0),
  add column if not exists size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid,          -- just a note of who last changed it, so no foreign key that could ever block an edit
  add column if not exists search tsvector;

comment on column public.media_library.origin is 'uploaded = a file in our images bucket; site = a file shipped with the site (a copy is kept in the bucket, source_url is its original path); linked = only an address on another website';

-- One row per address.
create unique index if not exists media_library_url_key on public.media_library (url);
create index if not exists media_library_search_idx on public.media_library using gin (search);
create index if not exists media_library_tags_idx on public.media_library using gin (tags);
create index if not exists media_library_origin_idx on public.media_library (origin);

-- Where the public files of the images bucket live. The storage trigger below needs it to know an upload's address. After the
-- site is moved to another Supabase project this one row must be updated (see docs/IMAGE_GALLERY.md).
create table if not exists public.media_config (
  id boolean primary key default true check (id),
  public_base_url text not null
);
alter table public.media_config enable row level security;
drop policy if exists "admin read media config" on public.media_config;
create policy "admin read media config" on public.media_config for select using (auth.role() = 'authenticated');
revoke all on public.media_config from anon, public;
grant select on public.media_config to authenticated;
insert into public.media_config (public_base_url)
  select substring(url from '^(.*/storage/v1/object/public/images/)') from public.media_library
  where url like '%/storage/v1/object/public/images/%' limit 1
  on conflict (id) do nothing;

-- ---------------------------------------------------------------------------------------------------------------------------
-- Keeping the search column and the tidy-up rules in one place
-- ---------------------------------------------------------------------------------------------------------------------------
create or replace function public.media_library_before_write() returns trigger
language plpgsql set search_path to 'public'
as $fn$
begin
  if tg_op = 'UPDATE' and auth.role() = 'authenticated'
     and (new.url is distinct from old.url or new.storage_path is distinct from old.storage_path or new.origin is distinct from old.origin) then
    raise exception 'An image''s address and where it came from cannot be changed. Upload a new image instead.';
  end if;

  -- Sensible limits, so nothing absurd can be saved however it arrives.
  new.title := left(btrim(coalesce(new.title, '')), 200);
  new.description := left(btrim(coalesce(new.description, '')), 1000);
  new.alt_text := left(btrim(coalesce(new.alt_text, '')), 300);
  new.credit := left(btrim(coalesce(new.credit, '')), 300);
  new.license := left(btrim(coalesce(new.license, '')), 300);
  -- Tags: lower case, trimmed, no blanks, no repeats, at most 20 of at most 40 characters, in alphabetical order.
  new.tags := coalesce((select array_agg(t order by t) from (
      select distinct left(lower(btrim(x)), 40) as t from unnest(coalesce(new.tags, '{}')) as x where btrim(x) <> '' limit 20) s), '{}');

  new.search :=
    setweight(to_tsvector('english', new.title), 'A') ||
    setweight(to_tsvector('english', array_to_string(new.tags, ' ')), 'A') ||
    setweight(to_tsvector('english', new.alt_text || ' ' || new.description), 'B') ||
    setweight(to_tsvector('english', new.credit || ' ' || new.license || ' ' || new.origin), 'C');

  if tg_op = 'UPDATE' then
    new.updated_at := now();
    if auth.role() = 'authenticated' then new.updated_by := auth.uid(); end if;
  end if;
  return new;
end
$fn$;

drop trigger if exists media_library_before_write on public.media_library;
create trigger media_library_before_write before insert or update on public.media_library
  for each row execute function public.media_library_before_write();

-- ---------------------------------------------------------------------------------------------------------------------------
-- Who may do what (admins only: the public site never reads this table, it reads the addresses straight from the content)
-- ---------------------------------------------------------------------------------------------------------------------------
drop policy if exists "admin update media library" on public.media_library;
create policy "admin update media library" on public.media_library for update
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "admin delete media library" on public.media_library;
create policy "admin delete media library" on public.media_library for delete using (auth.role() = 'authenticated');
grant select, insert, update, delete on public.media_library to authenticated;
revoke all on public.media_library from anon;

-- ---------------------------------------------------------------------------------------------------------------------------
-- Every upload to the images bucket lands in the library, and every removal leaves it. These can never stop the upload or the
-- removal: a problem here is swallowed.
-- ---------------------------------------------------------------------------------------------------------------------------
create or replace function public.media_library_on_upload() returns trigger
language plpgsql security definer set search_path to 'public'
as $fn$
declare base text;
begin
  select public_base_url into base from public.media_config limit 1;
  if base is null then return new; end if;
  begin
    insert into public.media_library (url, storage_path, origin, mime_type, size_bytes, uploaded_by)
      values (base || new.name, new.name, 'uploaded', new.metadata ->> 'mimetype', nullif(new.metadata ->> 'size', '')::bigint, new.owner)
      on conflict (url) do nothing;
  exception when foreign_key_violation then          -- an uploader that is not a known user: register it without one
    insert into public.media_library (url, storage_path, origin, mime_type, size_bytes)
      values (base || new.name, new.name, 'uploaded', new.metadata ->> 'mimetype', nullif(new.metadata ->> 'size', '')::bigint)
      on conflict (url) do nothing;
  end;
  return new;
exception when others then
  return new;
end
$fn$;

create or replace function public.media_library_on_remove() returns trigger
language plpgsql security definer set search_path to 'public'
as $fn$
begin
  delete from public.media_library where storage_path = old.name and origin in ('uploaded', 'site');
  return old;
exception when others then
  return old;
end
$fn$;

revoke all on function public.media_library_on_upload() from public, anon, authenticated;
revoke all on function public.media_library_on_remove() from public, anon, authenticated;

drop trigger if exists media_library_register_upload on storage.objects;
create trigger media_library_register_upload after insert on storage.objects
  for each row when (new.bucket_id = 'images') execute function public.media_library_on_upload();
drop trigger if exists media_library_forget_removed on storage.objects;
create trigger media_library_forget_removed after delete on storage.objects
  for each row when (old.bucket_id = 'images') execute function public.media_library_on_remove();

-- ---------------------------------------------------------------------------------------------------------------------------
-- Where each image is used, worked out from the real content every time
-- ---------------------------------------------------------------------------------------------------------------------------
-- area: page | post | event | directory | gallery | lesson | site.  Counted once per place, however often it appears there.
create or replace view public.media_library_usage with (security_invoker = true) as
with refs as (
  select p.og_image_url as url, 'page'::text as area, 'Social share image'::text as detail, p.id::text as ref_id, p.slug as ref_slug, p.title as label
    from public.pages p where coalesce(p.og_image_url, '') <> ''
  union all
  select u[1], 'page', 'Image on the page', p.id::text, p.slug, p.title
    from public.pages p cross join lateral regexp_matches(coalesce(p.draft_blocks::text, '') || ' ' || coalesce(p.published_blocks::text, ''), '(https?://[^"\\\s]+)', 'g') as u
  union all
  select p.cover_image_url, 'post', 'Cover image', p.id::text, p.slug, p.title
    from public.blog_posts p where coalesce(p.cover_image_url, '') <> ''
  union all
  select u[1], 'post', 'Image in the announcement', p.id::text, p.slug, p.title
    from public.blog_posts p cross join lateral regexp_matches(coalesce(p.draft_blocks::text, '') || ' ' || coalesce(p.published_blocks::text, ''), '(https?://[^"\\\s]+)', 'g') as u
  union all
  select u[1], 'event', 'Image in the event', p.id::text, p.slug, p.title
    from public.calendar_events p cross join lateral regexp_matches(coalesce(p.draft_blocks::text, '') || ' ' || coalesce(p.published_blocks::text, ''), '(https?://[^"\\\s]+)', 'g') as u
  union all
  select e.photo_url, 'directory', 'Photo', e.id::text, null::text, e.name
    from public.directory_entries e where coalesce(e.photo_url, '') <> ''
  union all
  select g.image_url, 'gallery', 'Album photo', g.id::text, null::text, coalesce(nullif(g.caption, ''), 'Album photo')
    from public.gallery_photos g where coalesce(g.image_url, '') <> ''
  union all
  select s.thumbnail_url, 'lesson', 'Lesson picture', s.id::text, null::text, s.title
    from public.makeup_sources s where coalesce(s.thumbnail_url, '') <> ''
  union all
  -- a video lesson with no picture of its own shows YouTube's picture for the video
  select 'https://i.ytimg.com/vi/' || (regexp_match(s.embed_url, '(?:youtu\.be/|[?&]v=|/embed/|/shorts/|/live/)([A-Za-z0-9_-]{6,})'))[1] || '/hqdefault.jpg',
         'lesson', 'Lesson picture', s.id::text, null::text, s.title
    from public.makeup_sources s
    where s.kind = 'video' and coalesce(s.thumbnail_url, '') = '' and s.embed_url ~ '(youtu\.be/|[?&]v=|/embed/|/shorts/|/live/)[A-Za-z0-9_-]{6,}'
  union all
  select u[1], 'site', 'Site header or footer', 'site', null::text, 'Site header and footer'
    from public.site_settings st cross join lateral regexp_matches(coalesce(st.site_chrome::text, ''), '(https?://[^"\\\s]+)', 'g') as u
)
select distinct m.id as media_id, r.area, r.detail, r.ref_id, r.ref_slug, r.label
  from refs r join public.media_library m on m.url = r.url
union
select distinct m.id, r.area, r.detail, r.ref_id, r.ref_slug, r.label
  from refs r join public.media_library m on m.source_url = r.url;

create or replace view public.media_library_tag_counts with (security_invoker = true) as
  select tag, count(*)::integer as n from public.media_library, unnest(tags) as tag group by tag;

revoke all on public.media_library_usage from anon, public;
revoke all on public.media_library_tag_counts from anon, public;
grant select on public.media_library_usage to authenticated;
grant select on public.media_library_tag_counts to authenticated;

-- ---------------------------------------------------------------------------------------------------------------------------
-- Searching. Typing "bloc" finds "Bloch": every word is a prefix, all words must match, best matches first.
-- Also filters by one tag, where it came from, used or not, and which part of the site uses it. Paged.
-- ---------------------------------------------------------------------------------------------------------------------------
create or replace function public.search_media_library(
  p_query text default '', p_tag text default null, p_origin text default null, p_use text default null, p_area text default null,
  p_limit integer default 60, p_offset integer default 0
) returns table (
  id uuid, url text, storage_path text, origin text, title text, description text, alt_text text, tags text[], credit text, license text,
  source_url text, mime_type text, width integer, height integer, size_bytes bigint, created_at timestamptz, updated_at timestamptz,
  usage_count integer, total_count bigint
)
language sql stable security invoker set search_path to 'public'
as $fn$
  with q as (
    select case when btrim(coalesce(p_query, '')) = '' then null::tsquery
      else to_tsquery('english', (select string_agg(w || ':*', ' & ') from regexp_split_to_table(lower(p_query), '[^a-z0-9]+') as w where w <> '')) end as tsq
  ), used as (
    select media_id, count(*)::integer as n from public.media_library_usage group by media_id
  ), found as (
    select m.id, m.url, m.storage_path, m.origin, m.title, m.description, m.alt_text, m.tags, m.credit, m.license, m.source_url, m.mime_type,
           m.width, m.height, m.size_bytes, m.created_at, m.updated_at, coalesce(u.n, 0) as usage_count,
           case when q.tsq is null or numnode(q.tsq) = 0 then 0 else ts_rank(m.search, q.tsq) end as rank
      from public.media_library m cross join q left join used u on u.media_id = m.id
     where (q.tsq is null or numnode(q.tsq) = 0 or m.search @@ q.tsq)
       and (coalesce(p_tag, '') = '' or p_tag = any (m.tags))
       and (coalesce(p_origin, '') = '' or m.origin = p_origin)
       and (coalesce(p_use, '') <> 'used' or coalesce(u.n, 0) > 0)
       and (coalesce(p_use, '') <> 'unused' or coalesce(u.n, 0) = 0)
       and (coalesce(p_area, '') = '' or exists (select 1 from public.media_library_usage x where x.media_id = m.id and x.area = p_area))
  )
  select f.id, f.url, f.storage_path, f.origin, f.title, f.description, f.alt_text, f.tags, f.credit, f.license, f.source_url, f.mime_type,
         f.width, f.height, f.size_bytes, f.created_at, f.updated_at, f.usage_count, count(*) over () as total_count
    from found f
   order by f.rank desc, f.created_at desc, f.id
   limit greatest(least(coalesce(p_limit, 60), 200), 1) offset greatest(coalesce(p_offset, 0), 0)
$fn$;

revoke all on function public.search_media_library(text, text, text, text, text, integer, integer) from public, anon;
grant execute on function public.search_media_library(text, text, text, text, text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------------------
-- Backfill: bring in what was never registered, and describe it. Everything here only fills blanks, and can safely be run again.
-- ---------------------------------------------------------------------------------------------------------------------------
-- 1. Files in the images bucket that were uploaded before the library existed.
insert into public.media_library (url, storage_path, origin, mime_type, size_bytes, created_at)
  select c.public_base_url || o.name, o.name, 'uploaded', o.metadata ->> 'mimetype', nullif(o.metadata ->> 'size', '')::bigint, o.created_at
    from storage.objects o cross join public.media_config c
   where o.bucket_id = 'images' and not exists (select 1 from public.media_library m where m.storage_path = o.name)
  on conflict (url) do nothing;

update public.media_library m
   set mime_type = coalesce(m.mime_type, o.metadata ->> 'mimetype'), size_bytes = coalesce(m.size_bytes, nullif(o.metadata ->> 'size', '')::bigint)
  from storage.objects o where o.bucket_id = 'images' and o.name = m.storage_path and (m.mime_type is null or m.size_bytes is null);

-- 2. Tags from where in storage the file was put.
update public.media_library
   set tags = case split_part(storage_path, '/', 1)
     when 'pages' then array['page'] when 'posts' then array['announcement'] when 'blog_posts' then array['announcement']
     when 'events' then array['event'] when 'directory' then array['directory', split_part(storage_path, '/', 2)]
     when 'gallery' then array['gallery'] when 'makeup' then array['lesson'] when 'site' then array['site'] else array['uploaded'] end
 where origin = 'uploaded' and storage_path is not null and tags = '{}';

-- 3. Titles and alt text from the content that uses each image.
update public.media_library m set title = 'Photo of ' || e.name, alt_text = case when m.alt_text = '' then 'Photo of ' || e.name else m.alt_text end
  from public.directory_entries e where e.photo_url = m.url and m.title = '';
update public.media_library m set title = coalesce(nullif(g.caption, ''), 'Album photo'), alt_text = case when m.alt_text = '' then coalesce(g.alt_text, '') else m.alt_text end,
       tags = m.tags || coalesce((select lower(a.name) from public.gallery_albums a where a.id = g.album_id), 'unsorted')
  from public.gallery_photos g where g.image_url = m.url and m.title = '';
update public.media_library m set title = 'Cover image for “' || p.title || '”' from public.blog_posts p where p.cover_image_url = m.url and m.title = '';
update public.media_library m set title = 'Social share image for “' || p.title || '”' from public.pages p where p.og_image_url = m.url and m.title = '';
update public.media_library m set title = 'Image on the page “' || p.title || '”' from public.pages p
  where m.title = '' and m.storage_path like 'pages/' || p.id::text || '/%';
update public.media_library m set title = 'Image in the announcement “' || p.title || '”' from public.blog_posts p
  where m.title = '' and (m.storage_path like 'posts/' || p.id::text || '/%' or m.storage_path like 'blog_posts/' || p.id::text || '/%');
update public.media_library set title = case split_part(storage_path, '/', 1)
     when 'pages' then 'Page image' when 'posts' then 'Announcement image' when 'blog_posts' then 'Announcement image' when 'directory' then 'Directory photo'
     when 'gallery' then 'Album photo' when 'makeup' then 'Lesson picture' else 'Uploaded image' end
 where title = '' and origin = 'uploaded';

-- 4. Pictures only linked from other websites: the Church's own picture for each talk, and YouTube's for each video lesson.
insert into public.media_library (url, origin, title, description, tags, credit, license, source_url)
  select distinct on (s.thumbnail_url) s.thumbnail_url, 'linked', s.title,
         'The picture the Church shows for “' || s.title || '”' || coalesce(' by ' || nullif(s.author, ''), '') || coalesce(', ' || nullif(s.series, ''), '') || '.',
         array_remove(array['church', 'talk', 'conference', lower(nullif(s.series, ''))], null),
         'The Church of Jesus Christ of Latter-day Saints', 'Linked from churchofjesuschrist.org, not copied.', s.origin_url
    from public.makeup_sources s
   where s.thumbnail_url ~* '^https://(www\.)?churchofjesuschrist\.org/'
   order by s.thumbnail_url, s.sort_order
  on conflict (url) do nothing;

insert into public.media_library (url, origin, title, description, tags, credit, license, source_url)
  select distinct on (v.yt) 'https://i.ytimg.com/vi/' || v.yt || '/hqdefault.jpg', 'linked', v.title,
         'The picture YouTube shows for the video “' || v.title || '”' || coalesce(' by ' || nullif(v.author, ''), '') || '.',
         array_remove(array['video', 'youtube', 'talk', lower(nullif(v.series, ''))], null), 'YouTube', 'Linked from YouTube, not copied.', v.embed_url
    from (select s.title, s.author, s.series, s.embed_url, s.sort_order, (regexp_match(s.embed_url, '(?:youtu\.be/|[?&]v=|/embed/|/shorts/|/live/)([A-Za-z0-9_-]{6,})'))[1] as yt
            from public.makeup_sources s where s.kind = 'video' and coalesce(s.thumbnail_url, '') = '' and s.embed_url is not null) v
   where v.yt is not null
   order by v.yt, v.sort_order
  on conflict (url) do nothing;

-- 5. Rebuild every row's search text and tidy its tags (the write trigger does both).
update public.media_library set title = title;

-- (for databases that ran an earlier draft of this migration, where updated_by had a foreign key)
alter table public.media_library drop constraint if exists media_library_updated_by_fkey;

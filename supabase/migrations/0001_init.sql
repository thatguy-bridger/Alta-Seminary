-- Alta Seminary Site — initial schema
-- See PROJECT_SPEC.md and the approved build plan for full context.

create extension if not exists pgcrypto;

create type content_status as enum ('draft', 'published');
create type directory_kind as enum ('council', 'missionary', 'staff');
create type submission_status as enum ('new', 'read', 'archived');
create type field_input_type as enum ('text', 'textarea', 'url', 'email', 'phone', 'date', 'date_range');

-- ============================================================
-- Pages (block-builder driven)
-- ============================================================
create table public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  meta_description text,
  og_image_url text,
  nav_label text,
  nav_order int,
  show_in_nav boolean not null default true,
  status content_status not null default 'draft',
  draft_blocks jsonb not null default '[]'::jsonb,      -- [{id, type, props}, ...] — in-progress
  published_blocks jsonb,                               -- last-published snapshot; what Astro build reads
  draft_updated_at timestamptz,
  published_at timestamptz,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Announcements (same block-builder shape as pages)
-- ============================================================
create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text,
  cover_image_url text,
  status content_status not null default 'draft',
  draft_blocks jsonb not null default '[]'::jsonb,
  published_blocks jsonb,
  draft_updated_at timestamptz,
  published_at timestamptz,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index blog_posts_published_at_idx on public.blog_posts (published_at desc) where status = 'published';

-- ============================================================
-- Directory entries (Council / Missionary / Staff)
-- Required: photo, name, bio. Everything else is optional and flexible.
-- ============================================================
create table public.directory_entries (
  id uuid primary key default gen_random_uuid(),
  directory_kind directory_kind not null,
  name text not null,
  photo_url text not null,
  bio text not null,
  extra_fields jsonb not null default '{}'::jsonb,
  status content_status not null default 'draft',
  sort_order int not null default 0,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index directory_entries_kind_idx on public.directory_entries (directory_kind, sort_order);

-- Catalog of optional field types the "add a field" control offers per directory kind (null = any kind)
create table public.directory_field_definitions (
  id uuid primary key default gen_random_uuid(),
  directory_kind directory_kind,
  field_key text not null,
  label text not null,
  input_type field_input_type not null default 'text',
  sort_order int not null default 0,
  unique (directory_kind, field_key)
);

-- ============================================================
-- Photo gallery
-- ============================================================
create table public.gallery_albums (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status content_status not null default 'draft',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.gallery_photos (
  id uuid primary key default gen_random_uuid(),
  album_id uuid references public.gallery_albums(id) on delete set null,
  image_url text not null,
  caption text,
  alt_text text,
  status content_status not null default 'draft',
  sort_order int not null default 0,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index gallery_photos_album_idx on public.gallery_photos (album_id, sort_order);

-- ============================================================
-- Events calendar
-- ============================================================
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text,
  start_at timestamptz not null,
  end_at timestamptz,
  all_day boolean not null default false,
  status content_status not null default 'draft',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index calendar_events_start_idx on public.calendar_events (start_at);

-- ============================================================
-- Contact form submissions
-- ============================================================
create table public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  message text not null,
  status submission_status not null default 'new',
  honeypot text,                -- must arrive empty; non-empty = bot, rejected before emailing
  created_at timestamptz not null default now()
);

-- ============================================================
-- Site-wide settings — single-row config table
-- ============================================================
create table public.site_settings (
  id boolean primary key default true check (id),
  contact_notify_email text not null default 'you@example.com',
  google_analytics_id text,
  makeup_work_enabled boolean not null default false,
  last_published_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.site_settings (id) values (true);

-- ============================================================
-- Unified publish-event log — the single trigger point the outbound webhook watches
-- ============================================================
create table public.publish_events (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('page','post','directory','gallery','event','settings','manual')),
  owner_id uuid,
  triggered_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Generic "log a publish event when status flips to published" trigger, reused everywhere
create or replace function public.log_publish_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published' and (old.status is distinct from 'published') then
    insert into public.publish_events (owner_type, owner_id, triggered_by)
      values (tg_argv[0], new.id, auth.uid());
    update public.site_settings set last_published_at = now(), updated_at = now() where id = true;
  end if;
  return new;
end;
$$;

create trigger trg_pages_publish after update of status on public.pages
  for each row execute function public.log_publish_event('page');
create trigger trg_posts_publish after update of status on public.blog_posts
  for each row execute function public.log_publish_event('post');
create trigger trg_directory_publish after update of status on public.directory_entries
  for each row execute function public.log_publish_event('directory');
create trigger trg_gallery_album_publish after update of status on public.gallery_albums
  for each row execute function public.log_publish_event('gallery');
create trigger trg_gallery_photo_publish after update of status on public.gallery_photos
  for each row execute function public.log_publish_event('gallery');
create trigger trg_calendar_event_publish after update of status on public.calendar_events
  for each row execute function public.log_publish_event('event');

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.pages enable row level security;
alter table public.blog_posts enable row level security;
alter table public.directory_entries enable row level security;
alter table public.directory_field_definitions enable row level security;
alter table public.gallery_albums enable row level security;
alter table public.gallery_photos enable row level security;
alter table public.calendar_events enable row level security;
alter table public.contact_submissions enable row level security;
alter table public.site_settings enable row level security;
alter table public.publish_events enable row level security;

-- Admin (any authenticated user — no super-admin tier) full CRUD everywhere
create policy "admin full access" on public.pages for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin full access" on public.blog_posts for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin full access" on public.directory_entries for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin full access" on public.directory_field_definitions for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin full access" on public.gallery_albums for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin full access" on public.gallery_photos for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin full access" on public.calendar_events for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin full access" on public.site_settings for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin read" on public.publish_events for select using (auth.role() = 'authenticated');
create policy "public read field defs" on public.directory_field_definitions for select using (true);

-- Public read for simple status-toggle tables is safe at the row level (no sensitive columns)
create policy "public read published directory" on public.directory_entries for select using (status = 'published');
create policy "public read published albums" on public.gallery_albums for select using (status = 'published');
create policy "public read published photos" on public.gallery_photos for select using (status = 'published');
create policy "public read published events" on public.calendar_events for select using (status = 'published');

-- IMPORTANT: pages/blog_posts intentionally do NOT get a blanket public SELECT policy on the
-- base table — that would let anyone query the `draft_blocks` column of an already-published
-- row and see an admin's in-progress edits. Public reads go through narrow views instead.
--
-- security_invoker = false (the default) is required here: it makes the view run as its
-- OWNER, bypassing the base table's RLS, so anon (which has no read policy on `pages` itself)
-- can still use it. The view's own `where status = 'published'` + narrow column list is what
-- actually protects draft_blocks -- not the base table's RLS. (security_invoker = true would
-- do the opposite: it'd enforce the CALLER's RLS on `pages`, and since anon has no policy
-- there at all, the view would return nothing for anon -- caught via live testing.)
create view public.public_pages with (security_invoker = false) as
  select id, slug, title, meta_description, og_image_url, nav_label, nav_order, show_in_nav,
         published_blocks, published_at
  from public.pages where status = 'published';
grant select on public.public_pages to anon;

create view public.public_blog_posts with (security_invoker = false) as
  select id, slug, title, excerpt, cover_image_url, published_blocks, published_at
  from public.blog_posts where status = 'published';
grant select on public.public_blog_posts to anon;
-- The Astro build queries these views, never the base tables, for public rendering.

-- Contact form: anonymous INSERT only; only admins can read/triage
create policy "public can submit contact form" on public.contact_submissions for insert with check (true);
create policy "admin read contact submissions" on public.contact_submissions for select using (auth.role() = 'authenticated');
create policy "admin update contact submissions" on public.contact_submissions for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin delete contact submissions" on public.contact_submissions for delete using (auth.role() = 'authenticated');

-- ============================================================
-- Storage bucket for images (public read, admin write)
-- Object path convention (not enforced in SQL, just a team convention):
--   images/pages/{page_id}/..., images/posts/{post_id}/...,
--   images/directory/{entry_id}/..., images/gallery/{photo_id}/...
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', true, 5242880, array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do nothing;

create policy "public read images" on storage.objects for select using (bucket_id = 'images');
create policy "admin upload images" on storage.objects for insert with check (bucket_id = 'images' and auth.role() = 'authenticated');
create policy "admin update images" on storage.objects for update using (bucket_id = 'images' and auth.role() = 'authenticated') with check (bucket_id = 'images' and auth.role() = 'authenticated');
create policy "admin delete images" on storage.objects for delete using (bucket_id = 'images' and auth.role() = 'authenticated');

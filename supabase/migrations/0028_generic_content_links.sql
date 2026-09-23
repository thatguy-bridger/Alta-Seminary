-- Replaces 0027's one-directional calendar_events.announcement_post_id/
-- gallery_album_id (events could link OUT to a post/album, but a post or
-- album had no way to link back, or to link to each other at all) with one
-- generic, symmetric join table any two of {event, announcement, album}
-- can use -- "everything communicates the same way" instead of a different
-- bespoke FK per direction.
--
-- Each pair is stored as exactly ONE row regardless of which side created
-- the link -- (a_type, a_id) is always the alphabetically-first side (see
-- canonicalPair() in contentLinks.js, the only code that ever writes here),
-- so an event<->album link and an album<->event link are the same row, not
-- two. Reading has to check both sides for the same reason (see
-- fetchLinkedItems()).
create type content_kind as enum ('event', 'announcement', 'album');

create table public.content_links (
  id uuid primary key default gen_random_uuid(),
  a_kind content_kind not null,
  a_id uuid not null,
  b_kind content_kind not null,
  b_id uuid not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint content_links_no_self_link check (not (a_kind = b_kind and a_id = b_id)),
  constraint content_links_unique unique (a_kind, a_id, b_kind, b_id)
);
create index content_links_a_idx on public.content_links (a_kind, a_id);
create index content_links_b_idx on public.content_links (b_kind, b_id);

-- Admin-only, like every other management table here -- this is cross-
-- reference metadata for the admin UI, never read on the public site.
alter table public.content_links enable row level security;
create policy "admin full access" on public.content_links for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Backfill existing event->post/album links from 0027's columns, in the
-- same canonical (alphabetical-by-kind) order contentLinks.js writes in:
-- 'album' < 'announcement' < 'event'.
insert into public.content_links (a_kind, a_id, b_kind, b_id)
select 'announcement', announcement_post_id, 'event', id
from public.calendar_events where announcement_post_id is not null;

insert into public.content_links (a_kind, a_id, b_kind, b_id)
select 'album', gallery_album_id, 'event', id
from public.calendar_events where gallery_album_id is not null;

alter table public.calendar_events drop column announcement_post_id;
alter table public.calendar_events drop column gallery_album_id;

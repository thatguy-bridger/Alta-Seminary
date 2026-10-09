-- Events become pages, too: each gets its own public page (/events/<slug>) built
-- from blocks, edited in the same page editor as announcements, and can opt in
-- to appearing in the announcements feed while it's upcoming. Purely additive --
-- every existing event keeps working exactly as before.
--
--   slug                  the event page's URL; permanent once created
--   draft_blocks          what the editor autosaves, same as pages/posts
--   published_blocks      what the public page renders. When empty, the page
--                         falls back to a default layout built from the live
--                         event data, so every published event has a page
--                         without anyone having to author one
--   draft_updated_at      same as pages/posts
--   published_at          when it went live; orders it in the announcements feed
--   show_in_announcements opt-in to the announcements feed while upcoming
alter table public.calendar_events
  add column slug text,
  add column draft_blocks jsonb not null default '[]'::jsonb,
  add column published_blocks jsonb not null default '[]'::jsonb,
  add column draft_updated_at timestamptz,
  add column published_at timestamptz,
  add column show_in_announcements boolean not null default false;

-- Backfill a unique slug from each title. "archive" is reserved for
-- /events/archive, so an event titled that gets "archive-event".
with base as (
  select id, created_at,
    case
      when slug_raw = 'archive' then 'archive-event'
      when slug_raw = '' then 'event'
      else slug_raw
    end as s
  from (
    select id, created_at,
      trim(both '-' from regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g')) as slug_raw
    from public.calendar_events
  ) t
), numbered as (
  select id, s, row_number() over (partition by s order by created_at, id) as rn from base
)
update public.calendar_events e
set slug = case when n.rn = 1 then n.s else n.s || '-' || n.rn end
from numbered n
where e.id = n.id;

alter table public.calendar_events alter column slug set not null;
create unique index calendar_events_slug_key on public.calendar_events (slug);

-- Already-published events went live when they were created, as far as the
-- feed's ordering is concerned.
update public.calendar_events set published_at = created_at where status = 'published' and published_at is null;

-- The public API (anon key) reads published events straight from this table
-- under RLS. Now that the table also holds DRAFT page content, narrow what
-- anon can see to the columns the public site uses -- draft_blocks and
-- draft_updated_at stay admin-only (blog_posts solves the same problem with a
-- view; column privileges do it here without changing how events are read).
revoke all on public.calendar_events from anon;
grant select (id, title, description, location, start_at, end_at, all_day, status,
              created_at, updated_at, slug, published_blocks, published_at, show_in_announcements)
  on public.calendar_events to anon;

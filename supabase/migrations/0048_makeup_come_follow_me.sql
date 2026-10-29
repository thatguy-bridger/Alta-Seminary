-- Come, Follow Me: the Church's weekly lesson, as a lesson type of its own.
--
-- A weekly lesson has the dates of its week (Monday to Sunday, both included). The student page shows the week that today falls in and
-- lets a student choose an earlier week they missed; weeks that have not begun are never offered. Both dates or neither, and a week
-- cannot end before it begins.

alter table public.makeup_sources drop constraint if exists makeup_sources_kind_check;
alter table public.makeup_sources add constraint makeup_sources_kind_check
  check (kind in ('scripture', 'video', 'audio', 'talk', 'lesson', 'podcast', 'proclamation', 'comefollowme'));

alter table public.makeup_sources add column if not exists week_start date;
alter table public.makeup_sources add column if not exists week_end date;
alter table public.makeup_sources drop constraint if exists makeup_sources_week_check;
alter table public.makeup_sources add constraint makeup_sources_week_check
  check ((week_start is null) = (week_end is null) and (week_end is null or week_end >= week_start));
create index if not exists makeup_sources_week_idx on public.makeup_sources (week_start) where week_start is not null;

-- What students may read. The new columns go on the end, so nothing that reads the view by name changes.
create or replace view public.public_makeup_sources as
  select id, kind, title, description, reference, body, embed_url, minutes, duration_seconds, transcript, author, series,
         thumbnail_url, guide_line, min_seconds, pauses, show_images, week_start, week_end
  from public.makeup_sources
  where active and public.makeup_work_open()
  order by sort_order, title;

create or replace view public.admin_makeup_lessons with (security_invoker = true) as
  select id, kind, title, description, reference, embed_url, minutes, active, sort_order, one_time, duration_seconds,
         author, series, origin_url, thumbnail_url, guide_line, min_seconds, pauses, created_at,
         coalesce(array_length(regexp_split_to_array(nullif(trim(body), ''), '\s+'), 1), 0) as body_words,
         coalesce(jsonb_array_length(transcript), 0) as transcript_lines,
         show_images, week_start, week_end
  from public.makeup_sources;

revoke all on public.admin_makeup_lessons from anon, public;
grant select on public.admin_makeup_lessons to authenticated;

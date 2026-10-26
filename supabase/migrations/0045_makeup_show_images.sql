-- Pictures are off unless a lesson turns them on.
-- show_images decides whether a lesson's page shows its picture and the painting at the top of each step.
-- Off for every lesson to begin with, so the normal lessons stay quiet.

alter table public.makeup_sources add column if not exists show_images boolean not null default false;

create or replace view public.public_makeup_sources as
  select id, kind, title, description, reference, body, embed_url, minutes, duration_seconds, transcript, author, series,
         thumbnail_url, guide_line, min_seconds, pauses, show_images
  from public.makeup_sources
  where active and public.makeup_work_open()
  order by sort_order, title;

create or replace view public.admin_makeup_lessons with (security_invoker = true) as
  select id, kind, title, description, reference, embed_url, minutes, active, sort_order, one_time, duration_seconds,
         author, series, origin_url, thumbnail_url, guide_line, min_seconds, pauses, created_at,
         coalesce(array_length(regexp_split_to_array(nullif(trim(body), ''), '\s+'), 1), 0) as body_words,
         coalesce(jsonb_array_length(transcript), 0) as transcript_lines,
         show_images
  from public.makeup_sources;

revoke all on public.admin_makeup_lessons from anon, public;
grant select on public.admin_makeup_lessons to authenticated;

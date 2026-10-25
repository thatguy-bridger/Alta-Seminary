-- A light list of lessons for the admin Lessons page: everything except the long text and the transcript,
-- plus how long each is (words, transcript lines), so the page can show cards and flag what needs attention
-- without downloading every transcript.
--
-- security_invoker: the view runs with the signed-in user's rights, so the admin-only row security on
-- makeup_sources applies. A visitor gets nothing, and no grant is given to them anyway.

create or replace view public.admin_makeup_lessons with (security_invoker = true) as
  select id, kind, title, description, reference, embed_url, minutes, active, sort_order, one_time, duration_seconds,
         author, series, origin_url, thumbnail_url, guide_line, min_seconds, pauses, created_at,
         coalesce(array_length(regexp_split_to_array(nullif(trim(body), ''), '\s+'), 1), 0) as body_words,
         coalesce(jsonb_array_length(transcript), 0) as transcript_lines
  from public.makeup_sources;

revoke all on public.admin_makeup_lessons from anon, public;
grant select on public.admin_makeup_lessons to authenticated;

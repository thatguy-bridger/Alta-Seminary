-- Exactly which parts of each recording or video a student played, and which they skipped, saved with their submission, so the
-- teacher sees the same green-and-red timeline the student did.
--
-- media_detail is a list with one entry per recording or video: { source_id, title, kind, duration, played, reached, seen, skipped }.
-- `seen` and `skipped` are lists of [from, to] seconds. It is all sent by the student's browser, so it is cleaned here: at most 8
-- lessons, at most 300 ranges in each list, and every number a whole number within a day. Anything else is dropped.

alter table public.makeup_submissions add column if not exists media_detail jsonb not null default '[]'::jsonb;

-- A number from a JSON value, or 0 if it is not one (so a damaged request cannot make the cast fail and lose the submission).
create or replace function public.makeup_json_num(j jsonb) returns numeric
language sql immutable set search_path to 'public'
as $$ select case when jsonb_typeof(j) = 'number' then (j #>> '{}')::numeric else 0 end $$;

-- A list of [from, to] pairs, cleaned: pairs of numbers only, whole seconds within a day, at most 300, in the order given.
create or replace function public.makeup_clean_ranges(r jsonb) returns jsonb
language sql immutable set search_path to 'public'
as $$
  select coalesce(jsonb_agg(jsonb_build_array(a, b) order by o), '[]'::jsonb)
  from (
    select o,
           least(greatest(floor((x ->> 0)::numeric), 0), 86400)::int as a,
           least(greatest(floor((x ->> 1)::numeric), 0), 86400)::int as b
    from jsonb_array_elements(case when jsonb_typeof(r) = 'array' then r else '[]'::jsonb end) with ordinality as t(x, o)
    where jsonb_typeof(x) = 'array' and jsonb_array_length(x) = 2 and jsonb_typeof(x -> 0) = 'number' and jsonb_typeof(x -> 1) = 'number'
    order by o limit 300
  ) q
$$;

drop function if exists public.submit_makeup(
  uuid, text, text, integer, uuid[], text, text, text, integer, text, text, integer, text, text, text, integer, integer, integer, integer, integer, integer, integer, jsonb, integer);

create or replace function public.submit_makeup(
  p_class_id uuid, p_code text, p_student_name text, p_days_total integer, p_source_ids uuid[], p_mode text,
  p_truth text, p_truth_ref text, p_truth_seconds integer, p_understanding text, p_response text, p_voice_seconds integer,
  p_commit_kind text, p_commitment text, p_blessing text, p_active_seconds integer, p_watched_seconds integer,
  p_source_seconds integer, p_paste_attempts integer, p_sudden_jumps integer, p_typed_chars integer, p_page_leaves integer,
  p_pause_answers jsonb default '[]'::jsonb, p_muted_seconds integer default 0, p_media_detail jsonb default '[]'::jsonb
) returns uuid
language plpgsql security definer set search_path to 'public'
as $function$
declare
  c public.makeup_classes;
  days int := least(greatest(coalesce(p_days_total, 1), 1), 4);
  used int;
  titles text[];
  pa jsonb := '[]'::jsonb;
  md jsonb := '[]'::jsonb;
  new_id uuid;
begin
  if not public.makeup_work_open() and auth.role() is distinct from 'authenticated' then
    raise exception 'Makeup Work is not open right now. Ask your teacher.';
  end if;
  select * into c from public.makeup_classes where id = p_class_id and active;
  if not found then raise exception 'Pick your class first.'; end if;
  if c.code is not null and c.code <> '' and lower(coalesce(p_code, '')) <> lower(c.code) then
    raise exception 'That class code is not right. Ask your teacher.';
  end if;
  if exists (select 1 from public.makeup_submissions
             where class_id = c.id and lower(student_name) = lower(trim(p_student_name)) and created_at > now() - interval '2 minutes') then
    raise exception 'That was just sent. Give it a moment.';
  end if;
  select coalesce(sum(days_total), 0) into used from public.makeup_submissions
    where class_id = c.id and lower(student_name) = lower(trim(p_student_name)) and created_at > now() - interval '7 days';
  if used + days > 7 then raise exception 'That is more than 7 makeups in a week. Finish these first, then come back.'; end if;
  select coalesce(array_agg(s.title order by o.ord), '{}') into titles
    from unnest(coalesce(p_source_ids, '{}')) with ordinality as o(id, ord)
    join public.makeup_sources s on s.id = o.id;
  -- Answers to pause questions: at most 20, each field trimmed to a sensible length, nothing else kept.
  if p_pause_answers is not null and jsonb_typeof(p_pause_answers) = 'array' then
    select coalesce(jsonb_agg(jsonb_build_object(
             'source_id', left(coalesce(e->>'source_id', ''), 64), 'lesson', left(coalesce(e->>'lesson', ''), 160), 'unit', left(coalesce(e->>'unit', ''), 12),
             'question', left(coalesce(e->>'question', ''), 500), 'at', left(coalesce(e->>'at', ''), 20), 'answer', left(coalesce(e->>'answer', ''), 1000))), '[]'::jsonb)
      into pa from (select e from jsonb_array_elements(p_pause_answers) as e
                    where jsonb_typeof(e) = 'object' and length(trim(coalesce(e->>'answer', ''))) > 0 limit 20) t;
  end if;
  -- What was played of each recording or video: at most 8 lessons, only the known fields, numbers made safe.
  if p_media_detail is not null and jsonb_typeof(p_media_detail) = 'array' then
    select coalesce(jsonb_agg(jsonb_build_object(
             'source_id', left(coalesce(e->>'source_id', ''), 64), 'title', left(coalesce(e->>'title', ''), 160), 'kind', left(coalesce(e->>'kind', ''), 12),
             'duration', least(greatest(public.makeup_json_num(e->'duration'), 0), 86400)::int,
             'played', least(greatest(floor(public.makeup_json_num(e->'played')), 0), 86400)::int,
             'reached', least(greatest(public.makeup_json_num(e->'reached'), 0), 86400)::int,
             'seen', public.makeup_clean_ranges(e->'seen'), 'skipped', public.makeup_clean_ranges(e->'skipped')) order by o), '[]'::jsonb)
      into md from (select e, o from jsonb_array_elements(p_media_detail) with ordinality as t(e, o)
                    where jsonb_typeof(e) = 'object' order by o limit 8) t;
  end if;
  insert into public.makeup_submissions (
    class_id, class_name, student_name, day_number, days_total, source_id, source_title, source_titles, mode,
    truth, truth_ref, truth_seconds, understanding, response, voice_seconds, commit_kind, commitment, blessing,
    active_seconds, watched_seconds, source_seconds, paste_attempts, sudden_jumps, typed_chars, page_leaves, pause_answers, muted_seconds, media_detail
  ) values (
    c.id, c.name, left(trim(p_student_name), 80), 1, days, p_source_ids[1], titles[1], titles, p_mode,
    left(p_truth, 1000), left(p_truth_ref, 200), least(greatest(p_truth_seconds, 0), 14400), left(p_understanding, 3000), left(p_response, 5000),
    greatest(coalesce(p_voice_seconds, 0), 0), p_commit_kind, left(trim(p_commitment), 500), left(p_blessing, 500),
    greatest(coalesce(p_active_seconds, 0), 0), greatest(coalesce(p_watched_seconds, 0), 0), greatest(coalesce(p_source_seconds, 0), 0),
    greatest(coalesce(p_paste_attempts, 0), 0), greatest(coalesce(p_sudden_jumps, 0), 0),
    greatest(coalesce(p_typed_chars, 0), 0), greatest(coalesce(p_page_leaves, 0), 0), pa,
    least(greatest(coalesce(p_muted_seconds, 0), 0), 86400), md
  ) returning id into new_id;
  return new_id;
end;
$function$;

grant execute on function public.submit_makeup(
  uuid, text, text, integer, uuid[], text, text, text, integer, text, text, integer, text, text, text, integer, integer, integer, integer, integer, integer, integer, jsonb, integer, jsonb)
  to anon, authenticated;

-- The two helpers are only for submit_makeup; nobody calls them directly.
revoke all on function public.makeup_json_num(jsonb) from public, anon, authenticated;
revoke all on function public.makeup_clean_ranges(jsonb) from public, anon, authenticated;

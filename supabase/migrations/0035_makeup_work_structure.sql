-- Makeup Work, round two. What the research showed (see docs/MAKEUP_WORK_RESEARCH.md):
--  * Seminary makeup work follows a pattern: find a truth, understand it, feel it, apply it.
--  * Missing several days is ONE comprehensive session, not a repeat per day: a submission
--    covers `days_total` days and can use several sources.
--  * Alta's current page limits students to 7 makeups per week.
alter table public.makeup_submissions
  add column truth text check (char_length(truth) <= 1000),
  add column truth_ref text check (char_length(truth_ref) <= 200),
  add column understanding text check (char_length(understanding) <= 3000),
  add column commit_kind text check (commit_kind in ('pray', 'serve', 'share', 'study')),
  add column blessing text check (char_length(blessing) <= 500),
  add column source_titles text[] not null default '{}';

-- A source can also be a self-guided lesson, a podcast, or a one-time deep study.
alter table public.makeup_sources drop constraint if exists makeup_sources_kind_check;
alter table public.makeup_sources add constraint makeup_sources_kind_check
  check (kind in ('scripture', 'video', 'audio', 'talk', 'lesson', 'podcast', 'proclamation'));
alter table public.makeup_sources add column one_time boolean not null default false;

-- The minutes a missed day is worth is a setting, not a constant (existing worksheets expect 30 to 60).
alter table public.site_settings add column if not exists makeup_minutes_per_day int not null default 30 check (makeup_minutes_per_day between 5 and 120);

drop function if exists public.submit_makeup(uuid, text, text, int, int, uuid, text, text, int, text, int, int, int, int, int);

create or replace function public.submit_makeup(
  p_class_id uuid, p_code text, p_student_name text, p_days_total int,
  p_source_ids uuid[], p_mode text, p_truth text, p_truth_ref text, p_understanding text, p_response text,
  p_voice_seconds int, p_commit_kind text, p_commitment text, p_blessing text,
  p_active_seconds int, p_paste_attempts int, p_sudden_jumps int, p_typed_chars int, p_page_leaves int
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  c public.makeup_classes;
  days int := least(greatest(coalesce(p_days_total, 1), 1), 4);
  used int;
  titles text[];
  new_id uuid;
begin
  select * into c from public.makeup_classes where id = p_class_id and active;
  if not found then raise exception 'Pick your class first.'; end if;
  if c.code is not null and c.code <> '' and lower(coalesce(p_code, '')) <> lower(c.code) then
    raise exception 'That class code is not right. Ask your teacher.';
  end if;
  if exists (select 1 from public.makeup_submissions
             where class_id = c.id and lower(student_name) = lower(trim(p_student_name)) and created_at > now() - interval '2 minutes') then
    raise exception 'That was just sent. Give it a moment.';
  end if;
  -- Alta's own rule: no more than 7 makeups (days) in a week.
  select coalesce(sum(days_total), 0) into used from public.makeup_submissions
    where class_id = c.id and lower(student_name) = lower(trim(p_student_name)) and created_at > now() - interval '7 days';
  if used + days > 7 then raise exception 'That is more than 7 makeups in a week. Finish these first, then come back.'; end if;
  select coalesce(array_agg(title order by array_position(p_source_ids, id)), '{}') into titles from public.makeup_sources where id = any(coalesce(p_source_ids, '{}'));
  insert into public.makeup_submissions (
    class_id, class_name, student_name, day_number, days_total, source_id, source_title, source_titles, mode,
    truth, truth_ref, understanding, response, voice_seconds, commit_kind, commitment, blessing,
    active_seconds, paste_attempts, sudden_jumps, typed_chars, page_leaves
  ) values (
    c.id, c.name, left(trim(p_student_name), 80), 1, days, p_source_ids[1], titles[1], titles, p_mode,
    left(p_truth, 1000), left(p_truth_ref, 200), left(p_understanding, 3000), left(p_response, 5000),
    greatest(coalesce(p_voice_seconds, 0), 0), p_commit_kind, left(trim(p_commitment), 500), left(p_blessing, 500),
    greatest(coalesce(p_active_seconds, 0), 0), greatest(coalesce(p_paste_attempts, 0), 0),
    greatest(coalesce(p_sudden_jumps, 0), 0), greatest(coalesce(p_typed_chars, 0), 0), greatest(coalesce(p_page_leaves, 0), 0)
  ) returning id into new_id;
  return new_id;
end;
$$;
grant execute on function public.submit_makeup to anon, authenticated;

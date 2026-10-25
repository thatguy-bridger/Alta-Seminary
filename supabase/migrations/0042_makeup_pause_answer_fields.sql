-- Pause answers also keep the lesson's title and whether the moment is a time or a paragraph, so the
-- teacher's email can say where each question appeared. Same function otherwise.

create or replace function public.submit_makeup(
  p_class_id uuid, p_code text, p_student_name text, p_days_total integer, p_source_ids uuid[], p_mode text,
  p_truth text, p_truth_ref text, p_truth_seconds integer, p_understanding text, p_response text, p_voice_seconds integer,
  p_commit_kind text, p_commitment text, p_blessing text, p_active_seconds integer, p_watched_seconds integer,
  p_source_seconds integer, p_paste_attempts integer, p_sudden_jumps integer, p_typed_chars integer, p_page_leaves integer,
  p_pause_answers jsonb default '[]'::jsonb
) returns uuid
language plpgsql security definer set search_path to 'public'
as $function$
declare
  c public.makeup_classes;
  days int := least(greatest(coalesce(p_days_total, 1), 1), 4);
  used int;
  titles text[];
  pa jsonb := '[]'::jsonb;
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
  insert into public.makeup_submissions (
    class_id, class_name, student_name, day_number, days_total, source_id, source_title, source_titles, mode,
    truth, truth_ref, truth_seconds, understanding, response, voice_seconds, commit_kind, commitment, blessing,
    active_seconds, watched_seconds, source_seconds, paste_attempts, sudden_jumps, typed_chars, page_leaves, pause_answers
  ) values (
    c.id, c.name, left(trim(p_student_name), 80), 1, days, p_source_ids[1], titles[1], titles, p_mode,
    left(p_truth, 1000), left(p_truth_ref, 200), least(greatest(p_truth_seconds, 0), 14400), left(p_understanding, 3000), left(p_response, 5000),
    greatest(coalesce(p_voice_seconds, 0), 0), p_commit_kind, left(trim(p_commitment), 500), left(p_blessing, 500),
    greatest(coalesce(p_active_seconds, 0), 0), greatest(coalesce(p_watched_seconds, 0), 0), greatest(coalesce(p_source_seconds, 0), 0),
    greatest(coalesce(p_paste_attempts, 0), 0), greatest(coalesce(p_sudden_jumps, 0), 0),
    greatest(coalesce(p_typed_chars, 0), 0), greatest(coalesce(p_page_leaves, 0), 0), pa
  ) returning id into new_id;
  return new_id;
end;
$function$;

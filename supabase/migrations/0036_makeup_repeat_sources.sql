-- A student may pick the same way to learn more than once (one pick per missed day),
-- so the list of source titles must keep repeats and keep the order they were picked in.
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
  select coalesce(sum(days_total), 0) into used from public.makeup_submissions
    where class_id = c.id and lower(student_name) = lower(trim(p_student_name)) and created_at > now() - interval '7 days';
  if used + days > 7 then raise exception 'That is more than 7 makeups in a week. Finish these first, then come back.'; end if;
  select coalesce(array_agg(s.title order by o.ord), '{}') into titles
    from unnest(coalesce(p_source_ids, '{}')) with ordinality as o(id, ord)
    join public.makeup_sources s on s.id = o.id;
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

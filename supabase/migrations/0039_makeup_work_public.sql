-- Makeup Work: opening it to students, email status, and review.
--
-- 1. The on/off switch (site_settings.makeup_work_enabled) was only a saved setting. The public
--    site could not read it (site_settings is admin-only), and nothing checked it. Now:
--      - makeup_work_open() lets anyone ask "is it open?" and nothing else about the settings
--      - while it is closed, the student-facing views are empty and submit_makeup() refuses
--        (signed-in admins can still test, so the admin test page keeps working)
-- 2. makeup_submissions gets the email result and the admin's review of each one.

create or replace function public.makeup_work_open()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select makeup_work_enabled from public.site_settings where id), false);
$$;
grant execute on function public.makeup_work_open() to anon, authenticated;

create or replace view public.public_makeup_classes as
  select id, name, ((code is not null) and (code <> '')) as requires_code
  from public.makeup_classes
  where active and public.makeup_work_open()
  order by sort_order, name;

create or replace view public.public_makeup_sources as
  select id, kind, title, description, reference, body, embed_url, minutes, duration_seconds, transcript, author, series
  from public.makeup_sources
  where active and public.makeup_work_open()
  order by sort_order, title;

alter table public.makeup_submissions
  add column if not exists email_error text,
  add column if not exists review_status text not null default 'new' check (review_status in ('new', 'accepted', 'redo')),
  add column if not exists review_note text,
  add column if not exists reviewed_at timestamptz;

create or replace function public.submit_makeup(
  p_class_id uuid, p_code text, p_student_name text, p_days_total integer, p_source_ids uuid[], p_mode text,
  p_truth text, p_truth_ref text, p_truth_seconds integer, p_understanding text, p_response text, p_voice_seconds integer,
  p_commit_kind text, p_commitment text, p_blessing text, p_active_seconds integer, p_watched_seconds integer,
  p_source_seconds integer, p_paste_attempts integer, p_sudden_jumps integer, p_typed_chars integer, p_page_leaves integer
) returns uuid
language plpgsql security definer set search_path to 'public'
as $function$
declare
  c public.makeup_classes;
  days int := least(greatest(coalesce(p_days_total, 1), 1), 4);
  used int;
  titles text[];
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
  insert into public.makeup_submissions (
    class_id, class_name, student_name, day_number, days_total, source_id, source_title, source_titles, mode,
    truth, truth_ref, truth_seconds, understanding, response, voice_seconds, commit_kind, commitment, blessing,
    active_seconds, watched_seconds, source_seconds, paste_attempts, sudden_jumps, typed_chars, page_leaves
  ) values (
    c.id, c.name, left(trim(p_student_name), 80), 1, days, p_source_ids[1], titles[1], titles, p_mode,
    left(p_truth, 1000), left(p_truth_ref, 200), least(greatest(p_truth_seconds, 0), 14400), left(p_understanding, 3000), left(p_response, 5000),
    greatest(coalesce(p_voice_seconds, 0), 0), p_commit_kind, left(trim(p_commitment), 500), left(p_blessing, 500),
    greatest(coalesce(p_active_seconds, 0), 0), greatest(coalesce(p_watched_seconds, 0), 0), greatest(coalesce(p_source_seconds, 0), 0),
    greatest(coalesce(p_paste_attempts, 0), 0), greatest(coalesce(p_sudden_jumps, 0), 0),
    greatest(coalesce(p_typed_chars, 0), 0), greatest(coalesce(p_page_leaves, 0), 0)
  ) returning id into new_id;
  return new_id;
end;
$function$;

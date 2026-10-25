-- Transcripts with timestamps for the videos and audio students learn from.
-- A transcript is also the captions for anyone who cannot hear it, so a video,
-- audio or podcast source cannot be shown to students without one (and its length).
alter table public.makeup_sources
  add column duration_seconds int check (duration_seconds between 1 and 14400),
  add column transcript jsonb check (transcript is null or jsonb_typeof(transcript) = 'array');

alter table public.makeup_sources add constraint makeup_sources_av_needs_transcript
  check (not active or kind not in ('video', 'audio', 'podcast') or (transcript is not null and jsonb_array_length(transcript) > 0 and duration_seconds is not null));

-- Students see transcripts (they are part of the lesson); append the new columns to the public view.
create or replace view public.public_makeup_sources with (security_invoker = false) as
  select id, kind, title, description, reference, body, embed_url, minutes, duration_seconds, transcript
  from public.makeup_sources where active order by sort_order, title;
grant select on public.public_makeup_sources to anon, authenticated;

-- Which moment a student cited for their truth, and how much of the media they actually played.
alter table public.makeup_submissions
  add column truth_seconds int check (truth_seconds is null or truth_seconds between 0 and 14400),
  add column watched_seconds int not null default 0 check (watched_seconds >= 0),
  add column source_seconds int not null default 0 check (source_seconds >= 0);

drop function if exists public.submit_makeup(uuid, text, text, int, uuid[], text, text, text, text, text, int, text, text, text, int, int, int, int, int);

create or replace function public.submit_makeup(
  p_class_id uuid, p_code text, p_student_name text, p_days_total int,
  p_source_ids uuid[], p_mode text, p_truth text, p_truth_ref text, p_truth_seconds int, p_understanding text, p_response text,
  p_voice_seconds int, p_commit_kind text, p_commitment text, p_blessing text,
  p_active_seconds int, p_watched_seconds int, p_source_seconds int,
  p_paste_attempts int, p_sudden_jumps int, p_typed_chars int, p_page_leaves int
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
$$;
grant execute on function public.submit_makeup to anon, authenticated;

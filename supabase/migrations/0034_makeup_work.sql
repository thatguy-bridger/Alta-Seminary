-- Makeup Work: the groundwork that every design of the journey shares.
-- Students never sign in. They submit through submit_makeup(), a function that
-- checks the class (and its optional code), caps lengths and throttles repeats.
-- Admins manage classes and the source library, and read submissions.

create table public.makeup_classes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  teacher_name text,
  teacher_email text not null,
  code text,                                  -- optional: students must enter it to submit
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.makeup_sources (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('scripture', 'video', 'audio', 'talk')),
  title text not null check (char_length(title) between 1 and 160),
  description text,
  reference text,                             -- e.g. "1 Nephi 3:7"
  body text,                                  -- text shown in the built-in reader
  embed_url text,                             -- an embeddable player address
  minutes int not null default 6 check (minutes between 1 and 120),
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.makeup_submissions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.makeup_classes(id) on delete set null,
  class_name text not null,
  student_name text not null check (char_length(student_name) between 1 and 80),
  day_number int not null default 1 check (day_number between 1 and 4),
  days_total int not null default 1 check (days_total between 1 and 4),
  source_id uuid references public.makeup_sources(id) on delete set null,
  source_title text,
  mode text not null check (mode in ('text', 'voice')),
  response text check (char_length(response) <= 5000),
  voice_seconds int not null default 0,
  commitment text not null check (char_length(commitment) between 1 and 500),
  active_seconds int not null default 0,
  paste_attempts int not null default 0,
  sudden_jumps int not null default 0,
  typed_chars int not null default 0,
  page_leaves int not null default 0,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);
create index makeup_submissions_created_idx on public.makeup_submissions (created_at desc);

alter table public.makeup_classes enable row level security;
alter table public.makeup_sources enable row level security;
alter table public.makeup_submissions enable row level security;

create policy "admin full access" on public.makeup_classes for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin full access" on public.makeup_sources for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin full access" on public.makeup_submissions for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- What the public journey may see: class names (never emails or codes) and active sources.
create view public.public_makeup_classes with (security_invoker = false) as
  select id, name, (code is not null and code <> '') as requires_code
  from public.makeup_classes where active order by sort_order, name;
create view public.public_makeup_sources with (security_invoker = false) as
  select id, kind, title, description, reference, body, embed_url, minutes
  from public.makeup_sources where active order by sort_order, title;
grant select on public.public_makeup_classes, public.public_makeup_sources to anon, authenticated;

-- The only way a student writes anything.
create or replace function public.submit_makeup(
  p_class_id uuid, p_code text, p_student_name text, p_day_number int, p_days_total int,
  p_source_id uuid, p_mode text, p_response text, p_voice_seconds int, p_commitment text,
  p_active_seconds int, p_paste_attempts int, p_sudden_jumps int, p_typed_chars int, p_page_leaves int
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  c public.makeup_classes;
  s public.makeup_sources;
  new_id uuid;
begin
  select * into c from public.makeup_classes where id = p_class_id and active;
  if not found then raise exception 'Pick your class first.'; end if;
  if c.code is not null and c.code <> '' and lower(coalesce(p_code, '')) <> lower(c.code) then
    raise exception 'That class code is not right. Ask your teacher.';
  end if;
  if exists (select 1 from public.makeup_submissions
             where class_id = c.id and lower(student_name) = lower(trim(p_student_name))
               and day_number = p_day_number and created_at > now() - interval '2 minutes') then
    raise exception 'That was just sent. Give it a moment.';
  end if;
  select * into s from public.makeup_sources where id = p_source_id;
  insert into public.makeup_submissions (
    class_id, class_name, student_name, day_number, days_total, source_id, source_title, mode, response,
    voice_seconds, commitment, active_seconds, paste_attempts, sudden_jumps, typed_chars, page_leaves
  ) values (
    c.id, c.name, left(trim(p_student_name), 80), least(greatest(p_day_number, 1), 4), least(greatest(p_days_total, 1), 4),
    s.id, s.title, p_mode, left(p_response, 5000),
    greatest(coalesce(p_voice_seconds, 0), 0), left(trim(p_commitment), 500), greatest(coalesce(p_active_seconds, 0), 0),
    greatest(coalesce(p_paste_attempts, 0), 0), greatest(coalesce(p_sudden_jumps, 0), 0),
    greatest(coalesce(p_typed_chars, 0), 0), greatest(coalesce(p_page_leaves, 0), 0)
  ) returning id into new_id;
  return new_id;
end;
$$;
grant execute on function public.submit_makeup to anon, authenticated;

-- Responses and effort data are only kept for a limited time (default 90 days;
-- change the number in the schedule below if the school decides otherwise).
create or replace function public.purge_makeup_submissions(retain_days int default 90) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.makeup_submissions where created_at < now() - make_interval(days => retain_days);
  get diagnostics n = row_count;
  return n;
end;
$$;
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('purge-makeup-submissions', '17 3 * * *', 'select public.purge_makeup_submissions(90)');
  end if;
end $$;

-- Functions are executable by everyone by default; the purge must not be (it is run by the schedule only).
revoke execute on function public.purge_makeup_submissions(int) from public, anon, authenticated;

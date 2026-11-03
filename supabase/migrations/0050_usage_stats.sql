-- Simple, anonymous usage statistics for the Diagnostics page: which pages are used most, typical paths, how far students get in
-- Makeup Work, how many visitors and how that changes over time.
--
-- What is stored per event: when, a random visitor code (made by the browser, kept on the device, no name or email), a random
-- visit code, which part of the site (site / makeup / admin), what kind (page view / step / action), a page path or event name,
-- and the page it came from. NOT stored: IP address, browser details, anything a student writes, or anything personal.
-- Browsers that ask not to be tracked (Do Not Track, Global Privacy Control) send nothing. Events are deleted after 13 months.

create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  visitor text not null,
  visit text not null,
  area text not null check (area in ('site', 'makeup', 'admin')),
  kind text not null check (kind in ('view', 'step', 'action')),
  name text not null,
  from_name text
);
create index if not exists usage_events_at_idx on public.usage_events (at desc);
create index if not exists usage_events_area_idx on public.usage_events (area, kind, name);
alter table public.usage_events enable row level security;
revoke all on public.usage_events from anon, public;
grant select on public.usage_events to authenticated;
drop policy if exists "admins read usage" on public.usage_events;
create policy "admins read usage" on public.usage_events for select to authenticated using (true);

-- The only way in: a list of events from a browser, cleaned. At most 20 a call and 60 a minute per visitor; anything odd is dropped.
create or replace function public.log_usage(p_events jsonb) returns void
language plpgsql security definer set search_path to 'public'
as $$
declare e jsonb; v text; s text; a text; k text; n text; f text; recent int;
begin
  if p_events is null or jsonb_typeof(p_events) <> 'array' then return; end if;
  for e in select x from jsonb_array_elements(p_events) with ordinality as t(x, o) where jsonb_typeof(x) = 'object' order by o limit 20 loop
    v := left(coalesce(e->>'v', ''), 40); s := left(coalesce(e->>'s', ''), 40);
    a := e->>'a'; k := e->>'k'; n := left(coalesce(e->>'n', ''), 120); f := nullif(left(coalesce(e->>'f', ''), 120), '');
    continue when v !~ '^[A-Za-z0-9_-]{8,40}$' or s !~ '^[A-Za-z0-9_-]{8,40}$';
    continue when a not in ('site', 'makeup', 'admin') or k not in ('view', 'step', 'action');
    continue when n !~ '^[A-Za-z0-9:_./+@-]{1,120}$' or (f is not null and f !~ '^[A-Za-z0-9:_./+@-]{1,120}$');
    select count(*) into recent from public.usage_events where visitor = v and at > now() - interval '1 minute';
    if recent >= 60 then return; end if;
    insert into public.usage_events (visitor, visit, area, kind, name, from_name) values (v, s, a, k, n, f);
  end loop;
end;
$$;
revoke all on function public.log_usage(jsonb) from public;
grant execute on function public.log_usage(jsonb) to anon, authenticated;

-- The numbers for one part of the site over the last p_days days. Admins only.
create or replace function public.admin_usage_summary(p_area text, p_days int default 30) returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare since timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 400)); out jsonb;
begin
  if auth.role() is distinct from 'authenticated' then raise exception 'Admins only.'; end if;
  with ev as (select * from public.usage_events where area = p_area and at >= since),
  vis as (select visitor, min(at) first_in_range, (select min(at) from public.usage_events u where u.visitor = ev.visitor) first_ever from ev group by visitor),
  firsts as (select distinct on (visit) visit, name from ev where kind = 'view' order by visit, at)
  select jsonb_build_object(
    'visitors', (select count(*) from vis),
    'returning', (select count(*) from vis where first_ever < since),
    'visits', (select count(distinct visit) from ev),
    'views', (select count(*) from ev where kind = 'view'),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', d::date, 'visitors', coalesce(c.visitors, 0), 'views', coalesce(c.views, 0)) order by d)
        from generate_series(since::date, now()::date, interval '1 day') d
        left join (select at::date as dy, count(distinct visitor) as visitors, count(*) filter (where kind = 'view') as views from ev group by at::date) c on c.dy = d::date), '[]'::jsonb),
    'top', coalesce((select jsonb_agg(r) from (select name, count(*) filter (where kind in ('view', 'action')) as count, count(distinct visitor) as visitors
        from ev where kind in ('view', 'action') group by name order by 2 desc, 1 limit 15) r), '[]'::jsonb),
    'entries', coalesce((select jsonb_agg(r) from (select name, count(*) as count from firsts group by name order by 2 desc, 1 limit 8) r), '[]'::jsonb),
    'paths', coalesce((select jsonb_agg(r) from (select from_name as "from", name as "to", count(*) as count from ev
        where kind = 'view' and from_name is not null and from_name <> name group by from_name, name order by 3 desc, 1, 2 limit 10) r), '[]'::jsonb),
    'steps', coalesce((select jsonb_agg(r) from (select name, count(distinct visit) as count from ev where kind = 'step' group by name order by 2 desc, 1) r), '[]'::jsonb)
  ) into out;
  return out;
end;
$$;
revoke all on function public.admin_usage_summary(text, int) from public, anon;
grant execute on function public.admin_usage_summary(text, int) to authenticated;

select cron.schedule('purge-usage-events', '41 3 * * *', $$ delete from public.usage_events where at < now() - interval '13 months' $$);

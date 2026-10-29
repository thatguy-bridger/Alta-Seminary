-- Two small clean-ups that make the project simpler to run, and to hand to someone else.
--
-- 1. Scheduled publishing runs INSIDE the database (pg_cron, 0025). A second copy of the same job ran from a GitHub Actions timer
--    that called an Edge Function. That second copy did nothing the first does not, and it tied the project to a GitHub repo name,
--    a GitHub secret and a hard-coded database address. It is retired (the workflow and the function's source are deleted from the
--    repo). The admin Diagnostics screen used to ask GitHub whether that timer had run; it now asks the database
--    (admin_sweep_status below).
--
-- 2. The sweep was running every 15 seconds and pg_cron keeps a log row for every run, forever: about 210,000 rows and 240 MB, which
--    was nearly the whole database and on course to reach the free plan's 500 MB limit. Publishing to the minute is plenty, so the
--    job now runs every minute, the old log is cleared, and a daily job keeps only the last two days of it.
--
--
-- (A leftover Vault secret from that old webhook, named deploy_webhook_secret, is also dead: nothing reads it. It is not deleted here;
-- an owner can delete it in the Supabase dashboard under Vault.)

-- 1. The status the Diagnostics screen shows. Admins only (any signed-in user is an admin here; public sign-up is off).
create or replace function public.admin_sweep_status()
returns table (job_active boolean, job_schedule text, last_run_at timestamptz, last_status text, runs_last_day bigint, failed_last_day bigint)
language plpgsql security definer set search_path to 'public', 'cron'
as $$
begin
  if auth.role() is distinct from 'authenticated' then raise exception 'Admins only.'; end if;
  return query
  select j.active, j.schedule,
         (select max(d.start_time) from cron.job_run_details d where d.jobid = j.jobid),
         (select d.status from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1),
         (select count(*) from cron.job_run_details d where d.jobid = j.jobid and d.start_time > now() - interval '1 day'),
         (select count(*) from cron.job_run_details d where d.jobid = j.jobid and d.start_time > now() - interval '1 day' and d.status = 'failed')
  from cron.job j where j.jobname = 'sweep-scheduled-content';
end;
$$;
revoke all on function public.admin_sweep_status() from public, anon;
grant execute on function public.admin_sweep_status() to authenticated;

-- 2. Every minute instead of every 15 seconds, the old log cleared, and a daily purge so it never grows back.
select cron.alter_job((select jobid from cron.job where jobname = 'sweep-scheduled-content'), schedule := '* * * * *');
truncate cron.job_run_details;
select cron.schedule('purge-cron-history', '23 3 * * *', $$ delete from cron.job_run_details where end_time < now() - interval '2 days' $$);

-- Calls the trigger-deploy Edge Function whenever a row lands in
-- publish_events (see log_publish_event() in 0001_init.sql), so
-- publishing content automatically rebuilds and redeploys the site.
--
-- This project's dashboard doesn't expose the Database Webhooks UI, so
-- this does the same thing directly via pg_net.
--
-- The webhook secret is NOT stored in this file — it lives in Supabase
-- Vault so it never appears in git history. One-time setup, run once in
-- the SQL editor (not part of this migration, do not commit the value):
--   select vault.create_secret(
--     '<same random value set as DEPLOY_WEBHOOK_SECRET in the
--       trigger-deploy Edge Function secrets>',
--     'deploy_webhook_secret'
--   );

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_deploy()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  webhook_secret text;
begin
  select decrypted_secret into webhook_secret
    from vault.decrypted_secrets
    where name = 'deploy_webhook_secret';

  if webhook_secret is null then
    -- Vault secret not set up yet; skip rather than fail the publish.
    return new;
  end if;

  perform net.http_post(
    url := 'https://huabopvggyiuljmgzhlq.supabase.co/functions/v1/trigger-deploy',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', webhook_secret
    ),
    body := '{}'::jsonb
  );
  return new;
end;
$$;

create trigger trg_notify_deploy
  after insert on public.publish_events
  for each row execute function public.notify_deploy();

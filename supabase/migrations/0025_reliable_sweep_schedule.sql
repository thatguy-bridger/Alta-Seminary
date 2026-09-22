-- GitHub Actions' `on: schedule` cron (.github/workflows/sweep-scheduled.yml)
-- is only advisory -- GitHub explicitly documents that scheduled workflows
-- can be delayed or dropped under load, especially on low-traffic repos.
-- Checked against this project's own change_log history: every historical
-- automatic unpublish DID eventually fire, but 1-2 hours after the
-- scheduled unpublish_at time, not within the intended 15 minutes -- which
-- reads as "doesn't work" to anyone testing it and checking a few minutes
-- later.
--
-- This adds a second, DB-native trigger for the same two jobs via pg_cron --
-- Postgres's own job scheduler, running on the database's clock instead of
-- a shared external queue. It's a direct SQL port of
-- supabase/functions/sweep-scheduled-content/index.ts's logic rather than a
-- pg_net call to that same Edge Function: calling out over HTTP would also
-- need the function's x-webhook-secret, and the value in Vault
-- (deploy_webhook_secret, from 0011 -- originally for a since-deleted
-- rebuild-trigger function) turned out NOT to match whatever the Edge
-- Function's own DEPLOY_WEBHOOK_SECRET actually is (a live test got back a
-- real 401 from the function). Doing the two updates directly here, in the
-- same transaction pg_cron already runs with full privileges, sidesteps
-- that secret entirely -- one less thing that can silently drift out of
-- sync between three separate places (GitHub secret / Vault / Edge
-- Function secret) again. The GitHub Actions workflow (and the Edge
-- Function it calls) are left in place as a redundant fallback.
create extension if not exists pg_cron;

select cron.schedule(
  'sweep-scheduled-content',
  '*/5 * * * *',
  $$
  update public.pages
    set published_blocks = draft_blocks, status = 'published', published_at = now(), publish_at = null
    where status = 'scheduled' and publish_at <= now();

  update public.pages
    set status = 'draft', unpublish_at = null
    where status = 'published' and unpublish_at is not null and unpublish_at <= now();

  update public.blog_posts
    set published_blocks = draft_blocks, status = 'published', published_at = now(), publish_at = null
    where status = 'scheduled' and publish_at <= now();

  update public.blog_posts
    set status = 'draft', unpublish_at = null
    where status = 'published' and unpublish_at is not null and unpublish_at <= now();
  $$
);

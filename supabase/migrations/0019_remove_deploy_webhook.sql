-- The site moved from GitHub Pages (needed a rebuild-and-redeploy trigger
-- on every publish) to Vercel server rendering (reads straight from the
-- database on each request -- nothing to trigger, ever). This trigger's
-- whole job was calling the now-deleted trigger-deploy Edge Function, which
-- no longer exists, so every publish was quietly failing this pg_net call
-- for no reason. publish_events itself is untouched -- still a useful
-- "when was this last published" signal (see the Diagnostics screen), just
-- nothing needs to react to a new row landing in it anymore.
drop trigger if exists trg_notify_deploy on public.publish_events;
drop function if exists public.notify_deploy();

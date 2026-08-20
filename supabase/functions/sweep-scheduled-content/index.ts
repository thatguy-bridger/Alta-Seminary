// Called on a cron schedule by .github/workflows/sweep-scheduled.yml (every
// 15 minutes). Two jobs, for both pages and blog_posts:
//   1. status='scheduled' rows whose publish_at has passed -> published,
//      using whatever draft_blocks looks like right now (same as a normal
//      manual Publish click, just deferred to this moment instead of when
//      the admin originally scheduled it).
//   2. status='published' rows whose unpublish_at has passed -> draft.
//      published_blocks is left alone so re-publishing later needs no rework.
// Both transitions are plain status updates, so the existing
// log_publish_event() trigger (0001_init.sql) already fires the normal
// publish webhook -> site rebuild for case 1, with zero new wiring needed.
//
// Required secrets (set via `supabase secrets set`):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (both auto-provided by Supabase)
//   DEPLOY_WEBHOOK_SECRET -- same shared secret trigger-deploy/report-deploy-status use
import { createClient } from 'npm:@supabase/supabase-js@2';

const TABLES = ['pages', 'blog_posts'];

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const expectedSecret = Deno.env.get('DEPLOY_WEBHOOK_SECRET');
  const providedSecret = req.headers.get('x-webhook-secret');
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const now = new Date().toISOString();
  let published = 0;
  let unpublished = 0;

  for (const table of TABLES) {
    const { data: due } = await admin
      .from(table)
      .select('id, draft_blocks')
      .eq('status', 'scheduled')
      .lte('publish_at', now);
    for (const row of due || []) {
      const { error } = await admin
        .from(table)
        .update({ published_blocks: row.draft_blocks, status: 'published', published_at: now, publish_at: null })
        .eq('id', row.id);
      if (!error) published++;
    }

    const { data: expired } = await admin
      .from(table)
      .select('id')
      .eq('status', 'published')
      .not('unpublish_at', 'is', null)
      .lte('unpublish_at', now);
    for (const row of expired || []) {
      const { error } = await admin
        .from(table)
        .update({ status: 'draft', unpublish_at: null })
        .eq('id', row.id);
      if (!error) unpublished++;
    }
  }

  return json({ published, unpublished }, 200);
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

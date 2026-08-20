// Called by deploy.yml's notify-failure job when a GitHub Actions run fails
// (after the build step's own retries are exhausted). Logs an 'error' entry
// into change_log so the failure surfaces in the admin History tab (Errors
// filter, and the unfiltered All view -- see 0013_deploy_error_log.sql)
// instead of silently living only in GitHub's own Actions log.
//
// Required secrets (set via `supabase secrets set`):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (both auto-provided by Supabase)
//   DEPLOY_WEBHOOK_SECRET -- same shared secret trigger-deploy uses
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const expectedSecret = Deno.env.get('DEPLOY_WEBHOOK_SECRET');
  const providedSecret = req.headers.get('x-webhook-secret');
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const runUrl = typeof body?.runUrl === 'string' ? body.runUrl : null;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { error } = await admin.from('change_log').insert({
    table_name: 'deploy',
    record_id: crypto.randomUUID(),
    record_label: 'Site deploy',
    action: 'error',
    after_data: runUrl ? { run_url: runUrl } : null,
    changed_by_name: 'GitHub Actions',
  });

  if (error) {
    console.error('Failed to log deploy failure:', error.message);
    return json({ error: 'Failed to log' }, 500);
  }
  return json({ success: true }, 200);
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

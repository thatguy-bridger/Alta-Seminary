// Called from the Diagnostics screen's "Force redeploy" button. Distinct
// from trigger-deploy (called by the publish_events DB trigger, gated by
// the shared DEPLOY_WEBHOOK_SECRET) -- a browser button can't safely hold
// that secret, so this checks the caller's real Supabase session instead,
// same pattern as invite-admin.
//
// Required secrets (set via `supabase secrets set`):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (both auto-provided by Supabase)
//   GITHUB_PAT -- same one trigger-deploy already uses
import { createClient } from 'npm:@supabase/supabase-js@2';

// Inlined rather than imported from ../_shared/cors.ts -- this function is
// deployed by pasting index.ts alone into the Supabase Dashboard's editor,
// which can't see a sibling file the way the CLI's full-folder deploy can
// ("Module not found ... _shared/cors.ts" otherwise).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GITHUB_OWNER = 'thatguy-bridger';
const GITHUB_REPO = 'Alta-Seminary';
const GITHUB_WORKFLOW = 'deploy.yml';
const GITHUB_REF = 'main';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Missing Authorization header' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const callerClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: callerData, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerData?.user) {
      return json({ error: 'Not authenticated' }, 401);
    }

    const githubPat = Deno.env.get('GITHUB_PAT');
    if (!githubPat) {
      console.error('GITHUB_PAT secret is not set');
      return json({ error: 'Server misconfigured' }, 500);
    }

    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${GITHUB_WORKFLOW}/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${githubPat}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({ ref: GITHUB_REF }),
      }
    );

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('GitHub dispatch failed:', res.status, body);
      return json({ error: 'Failed to trigger deploy' }, 502);
    }

    return json({ success: true }, 200);
  } catch (err) {
    console.error(err);
    return json({ error: 'Unexpected error' }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Called by a Supabase Database Webhook on public.publish_events (INSERT).
// Any row landing in publish_events means something just flipped to
// status='published' (see log_publish_event() in 0001_init.sql) — this
// function tells GitHub Actions to rebuild and redeploy the static site.
//
// Required secrets (set via `supabase secrets set`):
//   GITHUB_PAT            — fine-grained PAT scoped to this repo only,
//                           with "Actions: read and write" permission
//   DEPLOY_WEBHOOK_SECRET — shared secret; must match the header the
//                           Database Webhook is configured to send, so
//                           this endpoint can't be triggered by anyone
//                           who guesses the URL
const GITHUB_OWNER = 'thatguy-bridger';
const GITHUB_REPO = 'Alta-Seminary';
const GITHUB_WORKFLOW = 'deploy.yml';
const GITHUB_REF = 'main';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const expectedSecret = Deno.env.get('DEPLOY_WEBHOOK_SECRET');
  const providedSecret = req.headers.get('x-webhook-secret');
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const githubPat = Deno.env.get('GITHUB_PAT');
  if (!githubPat) {
    console.error('GITHUB_PAT secret is not set');
    return json({ error: 'Server misconfigured' }, 500);
  }

  const dispatchUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${GITHUB_WORKFLOW}/dispatches`;
  const res = await fetch(dispatchUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${githubPat}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ ref: GITHUB_REF }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('GitHub dispatch failed:', res.status, body);
    return json({ error: 'Failed to trigger deploy' }, 502);
  }

  return json({ success: true }, 200);
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

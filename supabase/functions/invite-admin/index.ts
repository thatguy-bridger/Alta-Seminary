// Invites a new admin by email. Called from the admin app's Team screen.
//
// Why this exists as an Edge Function rather than a direct client call:
// inviting a user requires Supabase's service-role key (supabase.auth.admin.*),
// which must never reach browser JS. This function verifies the caller is
// already an authenticated admin, then performs the invite server-side.
//
// Required secrets (set via `supabase secrets set`):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (both auto-provided by Supabase),
//   SITE_URL (e.g. https://altaseminary.com or the interim github.io URL)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

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
    const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:4321';

    // Verify the caller is an authenticated admin (any authenticated user qualifies — no super-admin tier).
    const callerClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: callerData, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerData?.user) {
      return json({ error: 'Not authenticated' }, 401);
    }
    const caller = callerData.user;

    const body = await req.json().catch(() => null);
    const email = body?.email?.trim().toLowerCase();
    const name = body?.name?.trim().replace(/\s+/g, ' ');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'A valid email is required' }, 400);
    }
    if (!name || name.split(' ').length < 2) {
      return json({ error: 'First and last name are required' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/admin/set-password`,
      data: { display_name: name },
    });
    if (inviteError) {
      return json({ error: inviteError.message }, 400);
    }

    const invitedUser = inviteData.user;
    // upsert, not insert: a DB trigger (0020_sync_admin_profiles.sql) also
    // creates a stub admin_profiles row the instant auth.admin.inviteUserByEmail
    // above inserts into auth.users, as a safety net for admins added any
    // other way (e.g. straight from the Supabase dashboard). Whichever one
    // runs first, this upsert still lands the invited_by this flow actually knows.
    const { error: profileError } = await admin.from('admin_profiles').upsert({
      id: invitedUser.id,
      email,
      display_name: name,
      invited_by: caller.id,
    });
    if (profileError) {
      // The invite already went out; log but don't fail the request over the profile row.
      console.error('admin_profiles insert failed:', profileError.message);
    }

    return json({ success: true, email }, 200);
  } catch (err) {
    console.error(err);
    return json({ error: 'Unexpected error sending the invite' }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

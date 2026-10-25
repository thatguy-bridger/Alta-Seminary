// @ts-nocheck -- runs on Supabase (Deno), not in the site build
// Emails a teacher when a makeup-work submission arrives. The logic is in notify.js (tested with the site).
//
// To turn it on (once):
//   1. Create a free Resend account (resend.com) and verify the address or domain you will send from.
//   2. In Supabase: Edge Functions, Secrets, add
//        RESEND_API_KEY   the key Resend gives you
//        MAKEUP_FROM      for example:  Alta Seminary <makeup@yourdomain.org>
//   That is all. Until then, submissions are still saved and the admin list says "Not emailed".
//
// The student's browser calls this with { submission_id } right after submitting. A signed-in admin
// can call it again from the admin list ("Send now"), or send themselves a test with { test: true }.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { notifySubmission, sendTestEmail } from './notify.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function send({ to, subject, text, html }) {
  const key = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('MAKEUP_FROM');
  if (!key || !from) return { ok: false, notConfigured: true, error: 'Email is not set up yet.' };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, text, html }),
  });
  if (res.ok) return { ok: true };
  const detail = (await res.text().catch(() => '')).slice(0, 200);
  return { ok: false, error: `The email service said no (${res.status}). ${detail}`.trim() };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const body = await req.json().catch(() => ({}));
  const db = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

  // A signed-in admin's token is a user token; the student's browser only has the public key, which is not a user.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  let admin = false, adminEmail = null;
  if (token) { const { data } = await db.auth.getUser(token); admin = !!data?.user; adminEmail = data?.user?.email ?? null; }

  // "Send me a test email" in the admin: only for a signed-in admin, only to their own address.
  if (body.test) return admin ? json(await sendTestEmail({ send, to: adminEmail })) : json({ status: 'forbidden' }, 403);

  return json(await notifySubmission({ db, send, submissionId: body.submission_id, admin }));
});

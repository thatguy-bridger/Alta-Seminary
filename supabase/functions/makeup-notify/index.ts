// @ts-nocheck -- runs on Supabase (Deno), not in the site build
// Emails a teacher when a makeup-work submission arrives. NOT DEPLOYED YET: it
// needs a sending service. To turn it on:
//   1. Create a free Resend account and verify the sending address/domain.
//   2. supabase secrets set RESEND_API_KEY=... MAKEUP_FROM="Alta Seminary <makeup@yourdomain>"
//   3. supabase functions deploy makeup-notify --no-verify-jwt
//   4. The journey calls it with { submission_id } right after submit_makeup().
// It is safe to expose: it only sends for a submission that has not been
// emailed yet, to the class's own teacher address, and marks it sent, so
// replaying the call does nothing. Message wording mirrors src/makeup/teacherEmail.js.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const { submission_id } = await req.json().catch(() => ({}));
  if (!submission_id) return new Response('Missing submission_id', { status: 400 });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: sub } = await db.from('makeup_submissions').select('*, makeup_classes(teacher_email, teacher_name)').eq('id', submission_id).maybeSingle();
  if (!sub || sub.notified_at) return new Response('Nothing to send', { status: 200 });
  const to = sub.makeup_classes?.teacher_email;
  if (!to) return new Response('No teacher address for this class', { status: 200 });

  const signal = sub.mode === 'voice' ? 'Spoken live'
    : (sub.paste_attempts || sub.sudden_jumps) ? 'Worth a conversation' : 'Looks typed live';
  const words = sub.mode === 'voice' ? `(Spoken response, ${mmss(sub.voice_seconds)})` : sub.response;
  const html = `<div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;line-height:1.5">
<p><strong>${esc(sub.student_name)}</strong> finished makeup work for ${esc(sub.class_name)}.</p>
<p style="color:#666">Day ${sub.day_number} of ${sub.days_total} · ${esc(sub.source_title)} · ${mmss(sub.active_seconds)} active</p>
<h3>What stood out to them</h3><p style="white-space:pre-wrap">${esc(words)}</p>
<h3>What they will do</h3><p>${esc(sub.commitment)}</p>
<p><strong>${signal}</strong> · ${sub.paste_attempts} paste attempts · ${sub.sudden_jumps} sudden jumps</p></div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: Deno.env.get('MAKEUP_FROM'), to, subject: `Makeup work from ${sub.student_name} (${sub.class_name})`, html }),
  });
  if (!res.ok) return new Response('Email failed', { status: 502 });
  await db.from('makeup_submissions').update({ notified_at: new Date().toISOString() }).eq('id', submission_id);
  return new Response('Sent', { status: 200 });
});

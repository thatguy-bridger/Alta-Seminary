// Emails a teacher about one makeup-work submission.
// Plain JavaScript with everything it needs passed in (the database and the sender), so the
// site's tests exercise exactly the code the Supabase function runs (see index.ts).
//
// Who may ask:
//   - the student's own browser, right after submitting: only for a submission that is under
//     15 minutes old and has not been emailed yet
//   - a signed-in admin ("Send now" in the admin): any submission, including a resend
// The recipient always comes from the class's own teacher address in the database, never from the request.
import { composeTeacherEmail } from './teacherEmail.js';

export const STUDENT_WINDOW_MS = 15 * 60 * 1000;

async function fail(db, id, message, status) {
  await db.from('makeup_submissions').update({ email_error: message }).eq('id', id);
  return { status, error: message };
}

export async function notifySubmission({ db, send, submissionId, admin = false, now = Date.now() }) {
  if (!submissionId || typeof submissionId !== 'string') return { status: 'bad-request' };
  const { data: sub } = await db.from('makeup_submissions').select('*').eq('id', submissionId).maybeSingle();
  if (!sub) return { status: 'not-found' };
  if (sub.notified_at && !admin) return { status: 'already-sent' };
  if (!admin && now - new Date(sub.created_at).getTime() > STUDENT_WINDOW_MS) return { status: 'too-old' };

  const { data: cls } = sub.class_id ? await db.from('makeup_classes').select('teacher_email').eq('id', sub.class_id).maybeSingle() : { data: null };
  const to = (cls?.teacher_email || '').trim();
  if (!to) return fail(db, sub.id, 'This class has no teacher email address.', 'no-teacher');

  const mail = composeTeacherEmail(sub);
  const result = await send({ to, subject: mail.subject, text: mail.text, html: mail.html });
  if (!result.ok) return fail(db, sub.id, result.error || 'The email could not be sent.', result.notConfigured ? 'not-configured' : 'failed');

  await db.from('makeup_submissions').update({ notified_at: new Date(now).toISOString(), email_error: null }).eq('id', sub.id);
  return { status: 'sent' };
}

// A short message so an admin can check that email works before any student needs it. Only ever sent to the admin's own address.
export async function sendTestEmail({ send, to }) {
  if (!to) return { status: 'no-address' };
  const text = 'This is a test from the Alta Seminary admin. If you can read it, teacher emails are working.';
  const result = await send({ to, subject: 'Makeup Work: test email', text, html: `<p>${text}</p>` });
  if (result.ok) return { status: 'sent', to };
  return { status: result.notConfigured ? 'not-configured' : 'failed', error: result.error };
}

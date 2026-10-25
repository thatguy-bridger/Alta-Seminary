import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createFakeSupabase } from '../test/fakeSupabase.js';
import { notifySubmission, sendTestEmail, STUDENT_WINDOW_MS } from '../../supabase/functions/makeup-notify/notify.js';

const NOW = Date.parse('2026-10-25T12:00:00Z');
const sub = (over = {}) => ({
  id: 's1', class_id: 'c1', class_name: 'Period 2', student_name: 'Maya', days_total: 2, source_titles: ['Come Home'], mode: 'text',
  truth: 'If we come home, then He will meet us.', truth_ref: 'Come Home · 3:12', understanding: 'It could help someone who feels far away.',
  response: 'Peace. Because I felt it.', commit_kind: 'serve', commitment: 'Serve my brother', blessing: 'be kinder',
  active_seconds: 600, paste_attempts: 0, sudden_jumps: 0, typed_chars: 300, page_leaves: 0, watched_seconds: 0, source_seconds: 0,
  created_at: new Date(NOW - 60_000).toISOString(), notified_at: null, ...over,
});
const setup = ({ submission = sub(), teacher = 'teacher@example.org', send } = {}) => {
  const db = createFakeSupabase({ tables: { makeup_submissions: submission ? [submission] : [], makeup_classes: [{ id: 'c1', teacher_email: teacher }] } });
  return { db, send: send || vi.fn(async () => ({ ok: true })) };
};
const updates = (db) => db.log.filter((x) => x.op === 'update').map((x) => x.payload);

describe('emailing the teacher', () => {
  it('sends the teacher the submission, to the class\'s own address, and marks it sent', async () => {
    const { db, send } = setup();
    const out = await notifySubmission({ db, send, submissionId: 's1', now: NOW });
    expect(out.status).toBe('sent');
    const mail = send.mock.calls[0][0];
    expect(mail.to).toBe('teacher@example.org');
    expect(mail.subject).toBe('Makeup work from Maya (Period 2)');
    expect(mail.html).toContain('If we come home');
    expect(updates(db)).toEqual([{ notified_at: new Date(NOW).toISOString(), email_error: null }]);
  });

  it('does not send the same submission twice when a student\'s browser asks again', async () => {
    const { db, send } = setup({ submission: sub({ notified_at: '2026-10-25T11:59:30Z' }) });
    expect((await notifySubmission({ db, send, submissionId: 's1', now: NOW })).status).toBe('already-sent');
    expect(send).not.toHaveBeenCalled();
  });

  it('lets a signed-in admin send it again', async () => {
    const { db, send } = setup({ submission: sub({ notified_at: '2026-10-25T11:59:30Z' }) });
    expect((await notifySubmission({ db, send, submissionId: 's1', admin: true, now: NOW })).status).toBe('sent');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('will not let a student\'s browser trigger an email for an old submission', async () => {
    const old = sub({ created_at: new Date(NOW - STUDENT_WINDOW_MS - 1000).toISOString() });
    const { db, send } = setup({ submission: old });
    expect((await notifySubmission({ db, send, submissionId: 's1', now: NOW })).status).toBe('too-old');
    expect(send).not.toHaveBeenCalled();
    expect((await notifySubmission({ db, send, submissionId: 's1', admin: true, now: NOW })).status).toBe('sent');   // an admin still can
  });

  it('records why, and sends nothing, when the class has no teacher address', async () => {
    const { db, send } = setup({ teacher: '  ' });
    const out = await notifySubmission({ db, send, submissionId: 's1', now: NOW });
    expect(out.status).toBe('no-teacher');
    expect(send).not.toHaveBeenCalled();
    expect(updates(db)).toEqual([{ email_error: 'This class has no teacher email address.' }]);
  });

  it('records the reason when the email service refuses, and does not mark it sent', async () => {
    const { db } = setup();
    const send = vi.fn(async () => ({ ok: false, error: 'The email service said no (403).' }));
    const out = await notifySubmission({ db, send, submissionId: 's1', now: NOW });
    expect(out).toEqual({ status: 'failed', error: 'The email service said no (403).' });
    expect(updates(db)).toEqual([{ email_error: 'The email service said no (403).' }]);
  });

  it('says so plainly when email has not been set up yet', async () => {
    const { db } = setup();
    const send = vi.fn(async () => ({ ok: false, notConfigured: true, error: 'Email is not set up yet.' }));
    expect((await notifySubmission({ db, send, submissionId: 's1', now: NOW })).status).toBe('not-configured');
    expect(updates(db)).toEqual([{ email_error: 'Email is not set up yet.' }]);
  });

  it('does nothing for an unknown or missing id', async () => {
    const { db, send } = setup({ submission: null });
    expect((await notifySubmission({ db, send, submissionId: 'nope', now: NOW })).status).toBe('not-found');
    expect((await notifySubmission({ db, send, submissionId: undefined, now: NOW })).status).toBe('bad-request');
    expect((await notifySubmission({ db, send, submissionId: { $ne: 1 }, now: NOW })).status).toBe('bad-request');
    expect(send).not.toHaveBeenCalled();
  });
});

describe('the test email', () => {
  it('goes only to the address it is given, and says plainly how it went', async () => {
    const send = vi.fn(async () => ({ ok: true }));
    expect(await sendTestEmail({ send, to: 'admin@example.org' })).toEqual({ status: 'sent', to: 'admin@example.org' });
    expect(send.mock.calls[0][0]).toMatchObject({ to: 'admin@example.org', subject: 'Makeup Work: test email' });
    expect((await sendTestEmail({ send, to: '' })).status).toBe('no-address');
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('reports "not set up" and failures', async () => {
    expect(await sendTestEmail({ send: async () => ({ ok: false, notConfigured: true, error: 'Email is not set up yet.' }), to: 'a@b.co' })).toEqual({ status: 'not-configured', error: 'Email is not set up yet.' });
    expect((await sendTestEmail({ send: async () => ({ ok: false, error: 'nope' }), to: 'a@b.co' })).status).toBe('failed');
  });
});

describe('the Supabase function\'s copy of the email wording', () => {
  // The function is deployed on its own, so it carries copies of these two files. They must never drift from the site's.
  for (const file of ['effort.js', 'teacherEmail.js']) {
    it(`${file} is identical to the site's`, () => {
      const site = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
      const fn = readFileSync(new URL(`../../supabase/functions/makeup-notify/${file}`, import.meta.url), 'utf8');
      expect(fn).toBe(site);
    });
  }
});

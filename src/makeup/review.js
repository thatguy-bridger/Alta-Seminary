import { analyzeEffort, formatDuration } from './effort.js';

// The admin's view of submissions: which to show, how each is doing, and what the spreadsheet holds.
// Pure functions, so they can be tested without a screen.

export const REVIEW = { new: 'New', accepted: 'Accepted', redo: 'Needs redo' };
export const reviewOf = (s) => s.review_status || 'new';

export function filterSubmissions(subs, { cls = '', status = '' } = {}) {
  return subs.filter((s) => (!cls || s.class_name === cls) && (!status || reviewOf(s) === status));
}

// The same signal the teacher's email shows, including whether video and audio were really played.
export const effortOf = (s) => analyzeEffort({
  mode: s.mode, text: s.response, voiceSeconds: s.voice_seconds,
  stats: { pastes: s.paste_attempts, jumps: s.sudden_jumps, activeMs: (s.active_seconds || 0) * 1000, typedChars: s.typed_chars, leaves: s.page_leaves, watchedSeconds: s.watched_seconds, sourceSeconds: s.source_seconds },
});

export const learnedBy = (s) => (s.source_titles?.length ? s.source_titles.join('; ') : s.source_title) || 'a lesson';

// "Emailed 3:12 PM" / "Not emailed" and why.
export function emailState(s) {
  if (s.notified_at) return { sent: true, text: `Emailed ${new Date(s.notified_at).toLocaleString()}` };
  return { sent: false, text: s.email_error ? `Not emailed: ${s.email_error}` : 'Not emailed yet' };
}

// What to tell the admin after "Send now" or "Send me a test email".
export function emailMessage(status, detail) {
  switch (status) {
    case 'sent': return 'Sent.';
    case 'not-configured': return 'Email is not set up yet. Follow the steps under "Email to teachers" in this card.';
    case 'no-teacher': return 'That class has no teacher email address. Add one under Classes.';
    case 'no-address': return 'Your admin account has no email address to send the test to.';
    case 'not-found': return 'That submission no longer exists.';
    case 'forbidden': return 'Sign in again, then try once more.';
    case 'failed': return `The email service refused it.${detail ? ` ${detail}` : ''}`;
    default: return `Could not send${detail ? `: ${detail}` : '.'}`;
  }
}

const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
export function submissionsCsv(subs) {
  const head = ['When', 'Student', 'Class', 'Days covered', 'Learned by', 'Truth', 'Where', 'Understanding', 'Why it matters', 'Spoken', 'Commitment', 'Blessing', 'Active time', 'Signal', 'Review', 'Review note', 'Emailed'];
  const lines = subs.map((s) => [
    new Date(s.created_at).toLocaleString(), s.student_name, s.class_name, s.days_total, learnedBy(s), s.truth, s.truth_ref, s.understanding, s.response,
    s.mode === 'voice' ? `Yes (${formatDuration(s.voice_seconds || 0)})` : 'No', s.commitment, s.blessing, formatDuration(s.active_seconds || 0), effortOf(s).label,
    REVIEW[reviewOf(s)], s.review_note, s.notified_at ? 'Yes' : 'No',
  ].map(q).join(','));
  return [head.map(q).join(','), ...lines].join('\n');
}

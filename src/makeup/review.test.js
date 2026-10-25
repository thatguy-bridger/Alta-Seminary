import { describe, it, expect } from 'vitest';
import { filterSubmissions, reviewOf, effortOf, emailState, emailMessage, submissionsCsv, learnedBy, pauseLines, REVIEW } from './review.js';

const sub = (over = {}) => ({
  id: 'a', student_name: 'Maya', class_name: 'Period 2', created_at: '2026-10-25T15:00:00Z', days_total: 2, source_titles: ['Come Home', 'Alma 5'], mode: 'text',
  truth: 'If we come home, then He meets us.', truth_ref: 'Come Home · 3:12', understanding: 'It helps.', response: 'Peace. "Because" I felt it,\nreally.',
  commit_kind: 'serve', commitment: 'Serve my brother', blessing: 'be kinder', active_seconds: 754, paste_attempts: 0, sudden_jumps: 0, typed_chars: 300, page_leaves: 0,
  watched_seconds: 0, source_seconds: 0, notified_at: null, email_error: null, review_status: 'new', review_note: null, ...over,
});

describe('review helpers', () => {
  it('filters by class and by review status, and treats a missing status as new', () => {
    const subs = [sub({ id: '1' }), sub({ id: '2', class_name: 'Period 3', review_status: 'accepted' }), sub({ id: '3', review_status: undefined }), sub({ id: '4', review_status: 'redo' })];
    expect(filterSubmissions(subs).map((s) => s.id)).toEqual(['1', '2', '3', '4']);
    expect(filterSubmissions(subs, { cls: 'Period 3' }).map((s) => s.id)).toEqual(['2']);
    expect(filterSubmissions(subs, { status: 'new' }).map((s) => s.id)).toEqual(['1', '3']);
    expect(filterSubmissions(subs, { cls: 'Period 2', status: 'redo' }).map((s) => s.id)).toEqual(['4']);
    expect(reviewOf({})).toBe('new');
  });

  it('shows the same signal as the teacher email, including video and audio that was skipped through', () => {
    expect(effortOf(sub()).label).toBe('Looks typed live');
    const skipped = effortOf(sub({ watched_seconds: 30, source_seconds: 600 }));
    expect(skipped.ok).toBe(false);
    expect(skipped.reasons.join(' ')).toContain('played only 0:30 of the 10:00');
  });

  it('says whether the teacher was emailed, and why not', () => {
    expect(emailState(sub({ notified_at: '2026-10-25T15:01:00Z' })).sent).toBe(true);
    expect(emailState(sub())).toEqual({ sent: false, text: 'Not emailed yet' });
    expect(emailState(sub({ email_error: 'Email is not set up yet.' })).text).toBe('Not emailed: Email is not set up yet.');
  });

  it('explains each result of sending in plain words', () => {
    expect(emailMessage('sent')).toBe('Sent.');
    expect(emailMessage('not-configured')).toContain('not set up');
    expect(emailMessage('no-teacher')).toContain('no teacher email address');
    expect(emailMessage('failed', 'The email service said no (403).')).toContain('(403)');
    expect(emailMessage('error', 'offline')).toBe('Could not send: offline');
    expect(emailMessage('')).toBe('Could not send.');
  });

  it('lists what a student learned by', () => {
    expect(learnedBy(sub())).toBe('Come Home; Alma 5');
    expect(learnedBy(sub({ source_titles: [], source_title: 'A verse' }))).toBe('A verse');
    expect(learnedBy(sub({ source_titles: null, source_title: null }))).toBe('a lesson');
  });
});

describe('the spreadsheet', () => {
  it('has a header, one row per submission, review and email columns, and survives commas, quotes and new lines', () => {
    const csv = submissionsCsv([sub({ review_status: 'redo', review_note: 'Add a "real" example', notified_at: 'x' })]);
    const [head, ...rows] = csv.split(/\n(?=")/);
    expect(head).toContain('"Review","Review note","Emailed"');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain('"Peace. ""Because"" I felt it,\nreally."');
    expect(rows[0]).toContain('"Needs redo","Add a ""real"" example","Yes"');
    expect(rows[0]).toContain('"12:34"');                      // active time
  });

  it('marks spoken answers', () => {
    expect(submissionsCsv([sub({ mode: 'voice', voice_seconds: 42 })])).toContain('"Yes (0:42)"');
    expect(submissionsCsv([sub()])).toContain('"No"');
  });

  it('is just the header when there is nothing', () => {
    expect(submissionsCsv([]).split('\n')).toHaveLength(1);
    expect(Object.keys(REVIEW)).toEqual(['new', 'accepted', 'redo']);
  });
});

describe('answers to pause questions', () => {
  const answers = [{ lesson: 'Come Home', unit: 'seconds', at: '95', question: 'What stood out?', answer: 'The part about coming back' }, { lesson: 'Alma 5', unit: 'paragraph', at: '2', question: 'Why?', answer: 'Because it changes us' }, { question: 'Blank', answer: '  ' }, null];
  it('lists them with where each question appeared, skipping empty ones', () => {
    expect(pauseLines(sub({ pause_answers: answers }))).toEqual([
      { question: 'What stood out?', answer: 'The part about coming back', lesson: 'Come Home', where: 'at 1:35' },
      { question: 'Why?', answer: 'Because it changes us', lesson: 'Alma 5', where: 'after paragraph 2' },
    ]);
    expect(pauseLines(sub())).toEqual([]);
    expect(pauseLines(sub({ pause_answers: 'junk' }))).toEqual([]);
  });
  it('puts them in the spreadsheet', () => {
    const csv = submissionsCsv([sub({ pause_answers: answers })]);
    expect(csv).toContain('"Questions while studying"');
    expect(csv).toContain('What stood out? (at 1:35): The part about coming back | Why? (after paragraph 2): Because it changes us');
  });
});

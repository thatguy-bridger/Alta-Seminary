import { describe, it, expect } from 'vitest';
import { composeTeacherEmail } from './teacherEmail.js';
import { buildSubmission } from './submission.js';
import { initialState } from './journey.js';
import { submissionsCsv, playbackOf } from './review.js';
import { playbackLines, mediaDetail, COLORS } from './playback.js';

const base = {
  student_name: 'Maya', class_name: 'Period 2', days_total: 1, source_titles: ['A talk'], mode: 'text', truth: 'If we act then He helps', truth_ref: 'A talk · 2:41',
  understanding: 'It helps.', response: 'Peace.', commit_kind: 'serve', commitment: 'Serve my brother', blessing: 'be kinder', active_seconds: 600,
  paste_attempts: 0, sudden_jumps: 0, typed_chars: 300, page_leaves: 0, watched_seconds: 0, source_seconds: 0, created_at: '2026-10-25T15:00:00Z',
};
const detail = (over = {}) => ({ source_id: 'a1', title: 'A talk', kind: 'audio', duration: 600, played: 192, reached: 300, seen: [[0, 64], [100, 189], [195, 300]], skipped: [[65, 100], [190, 195]], ...over });

describe('the teacher email: what they played', () => {
  it('says, for each recording or video, what was played and exactly which parts were skipped', () => {
    const m = composeTeacherEmail({ ...base, media_detail: [detail()] });
    expect(m.text).toContain('What they played:');
    expect(m.text).toContain('- A talk (audio): Played 3:12 of 10:00. Skipped 0:40 in 2 parts: 1:05 to 1:40, 3:10 to 3:15.');
  });

  it('draws the same bar as the student saw: green, red and grey in proportion, with a key', () => {
    const { html } = composeTeacherEmail({ ...base, media_detail: [detail()] });
    const cells = [...html.matchAll(/<td width="([\d.]+)%" bgcolor="(#[0-9a-f]{6})"/g)].map((c) => [c[2], Number(c[1])]);
    expect(cells.map((c) => c[0])).toEqual([COLORS.played, COLORS.skipped, COLORS.played, COLORS.skipped, COLORS.played, '#d9d9de']);
    expect(cells[1][1]).toBeCloseTo((35 / 600) * 100, 1);                                      // 1:05 to 1:40 is 35 of 600 seconds
    expect(cells.reduce((n, c) => n + c[1], 0)).toBeCloseTo(100, 0);                           // the pieces make the whole
    expect(html).toContain('played &nbsp;');
    expect(html).toContain('skipped &nbsp;');
    expect(html).toContain('<strong>A talk</strong>');
  });

  it('says so when nothing was skipped, and shows one green bar', () => {
    const m = composeTeacherEmail({ ...base, media_detail: [detail({ duration: 60, played: 60, reached: 60, seen: [[0, 59]], skipped: [] })] });
    expect(m.text).toContain('Played 1:00 of 1:00. Nothing skipped.');
    expect([...m.html.matchAll(/<td width="([\d.]+)%" bgcolor="(#[0-9a-f]{6})"/g)].map((c) => c[2])).toEqual([COLORS.played]);
  });

  it('lists every recording and video, in order', () => {
    const m = composeTeacherEmail({ ...base, media_detail: [detail({ title: 'First' }), detail({ title: 'Second', kind: 'video', skipped: [] , seen: [[0, 300]] })] });
    expect(m.text.indexOf('- First')).toBeGreaterThan(-1);
    expect(m.text.indexOf('- Second (video)')).toBeGreaterThan(m.text.indexOf('- First'));
  });

  it('works the skipped parts out from what was played, so they cannot be hidden', () => {
    const lying = detail({ skipped: [] });                                                      // claims nothing was skipped
    const m = composeTeacherEmail({ ...base, media_detail: [lying] });
    expect(m.text).toContain('Skipped 0:40 in 2 parts: 1:05 to 1:40, 3:10 to 3:15.');
  });

  it('is left out when there is nothing to show, and the rest of the email is unchanged', () => {
    const plain = composeTeacherEmail(base);
    expect(plain.text).not.toContain('What they played');
    expect(plain.html).not.toContain('What they played');
    expect(composeTeacherEmail({ ...base, media_detail: [] }).text).toBe(plain.text);
    expect(composeTeacherEmail({ ...base, media_detail: null }).text).toBe(plain.text);
    expect(composeTeacherEmail({ ...base, media_detail: 'junk' }).text).toBe(plain.text);
    expect(composeTeacherEmail({ ...base, media_detail: [null, 5, 'x', { title: 'No length' }, { title: 'Zero', duration: 0 }] }).text).toBe(plain.text);
  });

  it('cannot be used to put markup in the email', () => {
    const m = composeTeacherEmail({ ...base, media_detail: [detail({ title: '<script>alert(1)</script>', kind: '"><img src=x>' })] });
    expect(m.html).not.toContain('<script>');
    expect(m.html).not.toContain('<img src=x>');
    expect(m.html).toContain('&lt;script&gt;');
  });
});

describe('the submission', () => {
  const classes = [{ id: 'c1', name: 'Period 2' }];
  const sources = [{ id: 's1', title: 'A talk' }];
  const S = { ...initialState(), name: 'Maya', cls: 'c1', days: 1, sourceIds: ['s1'], truth: 'If we act then He helps', where: 'A talk · 2:41', understanding: 'It helps.', text: 'I felt calm', inv: 'serve', commit: 'help my brother', bless: 'be kinder' };
  const stats = { pastes: 0, jumps: 0, activeMs: 1000, typedChars: 10, leaves: 0 };

  it('carries the playback detail to the database and to the email preview, the same in both', () => {
    const md = [mediaDetail({ id: 's1', title: 'A talk', kind: 'audio', duration: 600, seen: [[0, 64], [100, 189]], reached: 189.5, played: 155 })];
    const { rpc, row } = buildSubmission({ S, classes, sources, stats, mediaDetail: md });
    expect(rpc.p_media_detail).toEqual(md);
    expect(row.media_detail).toEqual(md);
    expect(composeTeacherEmail(row).text).toContain('Skipped 0:35 in 1 part: 1:05 to 1:40.');
  });

  it('sends an empty list when nothing was played', () => {
    const { rpc, row } = buildSubmission({ S, classes, sources, stats });
    expect(rpc.p_media_detail).toEqual([]);
    expect(row.media_detail).toEqual([]);
  });
});

describe('the spreadsheet and the review list', () => {
  it('has a column for what they played, with the skipped parts', () => {
    const csv = submissionsCsv([{ ...base, id: 'a', media_detail: [detail()] }]);
    const [head, line] = csv.split('\n');
    expect(head).toContain('"What they played"');
    expect(line).toContain('A talk: Played 3:12 of 10:00. Skipped 0:40 in 2 parts: 1:05 to 1:40, 3:10 to 3:15.');
  });

  it('is empty for a submission with no playback, and keeps its other columns in place', () => {
    const [head, line] = submissionsCsv([{ ...base, id: 'a' }]).split('\n');
    const cols = (t) => t.split('","').length;
    expect(cols(line)).toBe(cols(head));
    expect(playbackOf({ ...base })).toEqual([]);
  });

  it('reads playback the same way everywhere', () => {
    const [one] = playbackLines([detail()]);
    expect(one).toMatchObject({ title: 'A talk', kind: 'audio', duration: 600, played: 192, skipped: [[65, 100], [190, 195]] });
    expect(playbackOf({ media_detail: [detail()] })).toEqual([one]);
  });
});

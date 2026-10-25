import { describe, it, expect } from 'vitest';
import { buildSubmission } from './submission.js';
import { initialState } from './journey.js';
import { composeTeacherEmail } from './teacherEmail.js';

const classes = [{ id: 'c1', name: 'Period 2' }];
const sources = [{ id: 's1', title: 'A talk' }, { id: 's2', title: 'A verse' }];
const S = { ...initialState(), name: ' Maya ', cls: 'c1', days: 2, sourceIds: ['s1', 's2'], truth: ' If we act then He prepares a way ', where: 'A talk · 2:41', whereSeconds: 161,
  understanding: 'It helps.', word: 'Peace', text: 'I felt calm', inv: 'serve', commit: 'my brother with reading', bless: 'be kinder' };

describe('buildSubmission', () => {
  const stats = { pastes: 1, jumps: 0, activeMs: 120000, typedChars: 80, leaves: 2 };
  const { rpc, row } = buildSubmission({ S, classes, sources, stats, mediaTotals: { watched: 200, source: 300, readSeconds: 40 }, code: '' });
  it('maps state to the database arguments', () => {
    expect(rpc).toMatchObject({ p_class_id: 'c1', p_student_name: 'Maya', p_days_total: 2, p_source_ids: ['s1', 's2'], p_truth: 'If we act then He prepares a way', p_truth_seconds: 161, p_commit_kind: 'serve', p_code: null });
    expect(rpc.p_response).toBe('Peace. I felt calm');
    expect(rpc.p_commitment).toBe('This week I will help my brother with reading');
    expect(rpc.p_active_seconds).toBe(120 + 200 + 40);
    expect(rpc.p_watched_seconds).toBe(200);
    expect(rpc.p_source_seconds).toBe(300);
    expect(rpc.p_paste_attempts).toBe(1);
  });
  it('gives the teacher email exactly what is saved', () => {
    expect(row.source_titles).toEqual(['A talk', 'A verse']);
    const m = composeTeacherEmail(row);
    expect(m.text).toContain('Covers 2 days');
    expect(m.text).toContain('A talk, A verse');
    expect(m.text).toContain('played 3:20 of 5:00');
    expect(m.text).toContain('paste attempt');
  });
  it('is at least one day even if days was never set', () => {
    expect(buildSubmission({ S: { ...S, days: 0 }, classes, sources, stats }).rpc.p_days_total).toBe(1);
  });
});

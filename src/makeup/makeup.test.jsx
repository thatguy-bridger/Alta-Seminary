// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { renderInBrowser } from '../test/render.js';
import { initialState, canAdvance, advance, daysCovered, sourcesNeeded, wordsNeeded, estimateMinutes, RULES, STEPS } from './journey.js';
import { analyzeEffort } from './effort.js';
import { composeTeacherEmail } from './teacherEmail.js';
import { useEffortTracker } from './useEffortTracker.js';

describe('journey rules', () => {
  it('grows one journey with the days missed, instead of repeating it', () => {
    expect(daysCovered(7)).toBe(RULES.maxSessions);
    expect(estimateMinutes(2)).toBe(60);
    expect(daysCovered(0)).toBe(0);
    expect([1, 2, 3, 4].map(sourcesNeeded)).toEqual([1, 2, 3, 3]);
    expect(wordsNeeded(3)).toBe(RULES.minWords + 2 * RULES.extraWordsPerSource);
  });
  it('gates each step with the right condition', () => {
    let s = initialState();
    expect(canAdvance(s)).toBe(false);
    s = { ...s, name: 'Maya', cls: 'Period 2', days: 1 };
    expect(canAdvance(s)).toBe(false);              // still settling
    s = advance({ ...s, settled: true });
    expect(STEPS[s.step]).toBe('choose');
    expect(advance(s)).toBe(s);                     // no source yet
    s = { ...s, days: 2 };
    expect(advance({ ...s, sourceIds: ['a'] }).step).toBe(1);  // two days missed means two sources
    s = advance({ ...s, sourceIds: ['a', 'b'] });
    s = advance({ ...s, learned: true });
    expect(STEPS[s.step]).toBe('truth');
    expect(canAdvance({ ...s, truth: 'too short', where: '1 Nephi 3:7' })).toBe(false);
    expect(canAdvance({ ...s, truth: 'If we obey then the Lord will prepare a way', where: '' })).toBe(false);
    s = advance({ ...s, truth: 'If we obey then the Lord will prepare a way', where: '1 Nephi 3:7' });
    expect(STEPS[s.step]).toBe('understand');
    const eight = Array(wordsNeeded(2)).fill('word').join(' ');
    expect(canAdvance({ ...s, understanding: eight, text: 'short' })).toBe(false);
    expect(canAdvance({ ...s, understanding: eight, text: eight })).toBe(true);
    expect(canAdvance({ ...s, mode: 'voice', voiceSeconds: 10 })).toBe(false);  // two sources: longer than the base 10s
    expect(canAdvance({ ...s, mode: 'voice', voiceSeconds: 15 })).toBe(true);
    s = advance({ ...s, understanding: eight, text: eight });
    expect(STEPS[s.step]).toBe('commit');
    expect(canAdvance({ ...s, inv: 'serve', commit: 'help my brother', bless: 'short' })).toBe(false);
    expect(canAdvance({ ...s, inv: '', commit: 'help my brother', bless: 'make me kinder' })).toBe(false);
    expect(canAdvance({ ...s, inv: 'serve', commit: 'help my brother', bless: 'make me kinder' })).toBe(true);
  });
});

describe('analyzeEffort', () => {
  it('reads a clean typed response as fine', () => {
    expect(analyzeEffort({ text: 'x'.repeat(100), stats: { typedChars: 100, activeMs: 40000 } }).ok).toBe(true);
  });
  it('flags pastes, jumps, speed and little typing, in plain words', () => {
    const e = analyzeEffort({ text: 'x'.repeat(200), stats: { pastes: 2, jumps: 1, typedChars: 20, activeMs: 1000, leaves: 5 } });
    expect(e.ok).toBe(false);
    expect(e.label).toBe('Worth a conversation');
    expect(e.reasons.join(' ')).toMatch(/paste attempts/);
    expect(e.reasons.join(' ')).toMatch(/left the page 5 times/);
  });
  it('treats a recording as spoken live', () => {
    expect(analyzeEffort({ mode: 'voice', voiceSeconds: 20 }).label).toBe('Spoken live');
  });
});

describe('composeTeacherEmail', () => {
  const sub = { student_name: 'Maya <b>', class_name: 'Period 2', days_total: 2, source_title: 'Faith in action', source_titles: ['Faith in action', 'Two talks'], mode: 'text', truth: 'If we listen then we learn', truth_ref: '1 Nephi 3:7', understanding: 'It helps with stress.', response: 'It made me think.', commit_kind: 'serve', commitment: 'Call my grandma', blessing: 'make me kinder', active_seconds: 300, paste_attempts: 0, sudden_jumps: 0, typed_chars: 40, page_leaves: 0 };
  it('reads like a note, with the signal', () => {
    const m = composeTeacherEmail(sub);
    expect(m.subject).toBe('Makeup work from Maya <b> (Period 2)');
    expect(m.text).toContain('Covers 2 days');
    expect(m.text).toContain('Faith in action, Two talks');
    expect(m.text).toContain('Call my grandma');
    expect(m.text).toContain('If we listen then we learn');
    expect(m.text).toContain('make me kinder');
    expect(m.text).toContain('Looks typed live');
  });
  it('escapes student-entered text in the HTML', () => {
    const m = composeTeacherEmail(sub);
    expect(m.html).toContain('Maya &lt;b&gt;');
    expect(m.html).not.toContain('<b>');
  });
  it('shows voice responses as such', () => {
    expect(composeTeacherEmail({ ...sub, mode: 'voice', voice_seconds: 42 }).text).toContain('Spoken response, 0:42');
  });
});

describe('useEffortTracker', () => {
  let mounted;
  afterEach(async () => { await mounted?.unmount(); document.body.innerHTML = ''; });
  it('blocks paste/drop, counts them, and tracks jumps and typed characters', async () => {
    let tracker; const blocked = [];
    function Box() { tracker = useEffortTracker({ onBlocked: (k) => blocked.push(k) }); return <textarea {...tracker.props} defaultValue="" />; }
    mounted = await renderInBrowser(<Box />);
    const ta = mounted.container.querySelector('textarea');
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    ta.dispatchEvent(paste);
    expect(paste.defaultPrevented).toBe(true);
    const menu = new Event('contextmenu', { bubbles: true, cancelable: true });
    ta.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
    expect(tracker.snapshot().pastes).toBe(1);   // a right-click is blocked but is not a paste attempt
    expect(blocked).toEqual(['paste', 'menu']);
  });
});

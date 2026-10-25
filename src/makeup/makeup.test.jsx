// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { renderInBrowser } from '../test/render.js';
import { initialState, canAdvance, advance, nextDay, sessionsFor, estimateMinutes, RULES, STEPS } from './journey.js';
import { analyzeEffort } from './effort.js';
import { composeTeacherEmail } from './teacherEmail.js';
import { useEffortTracker } from './useEffortTracker.js';

describe('journey rules', () => {
  it('caps sessions and estimates time', () => {
    expect(sessionsFor(7)).toBe(RULES.maxSessions);
    expect(estimateMinutes(2)).toBe(30);
    expect(sessionsFor(0)).toBe(0);
  });
  it('gates each step with the right condition', () => {
    let s = initialState();
    expect(canAdvance(s)).toBe(false);
    s = { ...s, name: 'Maya', cls: 'Period 2', days: 1 };
    expect(canAdvance(s)).toBe(false);              // still settling
    s = advance({ ...s, settled: true });
    expect(STEPS[s.step]).toBe('choose');
    expect(advance(s)).toBe(s);                     // no source yet
    s = advance({ ...s, sourceId: 'x' });
    s = advance({ ...s, learned: true });
    expect(STEPS[s.step]).toBe('reflect');
    expect(canAdvance({ ...s, text: 'too short' })).toBe(false);
    expect(canAdvance({ ...s, text: Array(RULES.minWords).fill('word').join(' ') })).toBe(true);
    expect(canAdvance({ ...s, mode: 'voice', voiceSeconds: RULES.minVoiceSeconds - 1 })).toBe(false);
    expect(canAdvance({ ...s, mode: 'voice', voiceSeconds: RULES.minVoiceSeconds })).toBe(true);
  });
  it('starts the next day at "choose" and keeps who they are', () => {
    const s = initialState({ name: 'Maya', cls: 'Period 2', days: 2, day: 1, step: 5 });
    const n = nextDay(s);
    expect(n).toMatchObject({ name: 'Maya', cls: 'Period 2', days: 2, day: 2, step: 1, settled: true, text: '' });
    expect(nextDay(n)).toBe(n); // no day 3 owed
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
  const sub = { student_name: 'Maya <b>', class_name: 'Period 2', day_number: 1, days_total: 2, source_title: 'Faith in action', mode: 'text', response: 'It made me think.', commitment: 'Call my grandma', active_seconds: 300, paste_attempts: 0, sudden_jumps: 0, typed_chars: 40, page_leaves: 0 };
  it('reads like a note, with the signal', () => {
    const m = composeTeacherEmail(sub);
    expect(m.subject).toBe('Makeup work from Maya <b> (Period 2)');
    expect(m.text).toContain('Day 1 of 2');
    expect(m.text).toContain('Call my grandma');
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

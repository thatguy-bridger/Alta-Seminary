import { describe, it, expect } from 'vitest';
import { analyzeEffort } from './effort.js';

const typed = { mode: 'text', text: 'short', stats: { typedChars: 200, activeMs: 120000 } };
const withSound = (watchedSeconds, sourceSeconds, mutedSeconds, extra = {}) => analyzeEffort({ ...typed, ...extra, stats: { ...typed.stats, watchedSeconds, sourceSeconds, mutedSeconds, ...(extra.stats || {}) } });

describe('the signal when the player\'s sound was off', () => {
  it('flags it as worth a conversation when the sound was off for most of what was played', () => {
    const e = withSound(600, 700, 420);
    expect(e.ok).toBe(false);
    expect(e.label).toBe('Worth a conversation');
    expect(e.reasons).toEqual(["the player's sound was off for 7:00 of the 10:00 played (they may have followed the transcript instead)"]);
  });

  it('flags it at exactly half, and not below it', () => {
    expect(withSound(600, 700, 300).ok).toBe(false);
    expect(withSound(600, 700, 299).ok).toBe(true);
  });

  it('does not flag a brief mute, but may mention a short one', () => {
    expect(withSound(100, 120, 25).ok).toBe(true);                                       // under 30 seconds: not worth raising even if it is most of a short clip
    const mild = withSound(600, 700, 90);
    expect(mild.ok).toBe(true);
    expect(mild.label).toBe('Looks typed live');                                         // the score is untouched...
    expect(mild.reasons).toEqual(['Steady typing, nothing pasted.', "The player's sound was off for 1:30 of the 10:00 played."]);   // ...but it is noted
    expect(withSound(600, 700, 9).reasons).toEqual(['Steady typing, nothing pasted.']);  // a few seconds is not mentioned
  });

  it('says nothing when the sound was on, or when nothing was played', () => {
    expect(withSound(600, 700, 0).reasons).toEqual(['Steady typing, nothing pasted.']);
    expect(withSound(0, 0, 0).reasons).toEqual(['Steady typing, nothing pasted.']);
    expect(analyzeEffort({ ...typed, stats: typed.stats }).ok).toBe(true);               // old submissions that never recorded it
  });

  it('adds to other reasons instead of replacing them', () => {
    const e = withSound(600, 700, 420, { stats: { pastes: 2 } });
    expect(e.ok).toBe(false);
    expect(e.reasons[0]).toContain('2 paste attempts');
    expect(e.reasons.some((r) => r.includes('sound was off'))).toBe(true);
    const skipped = withSound(100, 700, 80);
    expect(skipped.reasons).toEqual(expect.arrayContaining([expect.stringContaining('played only 1:40'), expect.stringContaining('sound was off for 1:20')]));
  });

  it('counts for a spoken answer too', () => {
    const base = { mode: 'voice', voiceSeconds: 40 };
    const quiet = analyzeEffort({ ...base, stats: { watchedSeconds: 600, sourceSeconds: 700, mutedSeconds: 500 } });
    expect(quiet.ok).toBe(false);
    expect(quiet.reasons).toEqual([expect.stringContaining('sound was off for 8:20')]);
    const mild = analyzeEffort({ ...base, stats: { watchedSeconds: 600, sourceSeconds: 700, mutedSeconds: 60 } });
    expect(mild.ok).toBe(true);
    expect(mild.label).toBe('Spoken live');
    expect(mild.reasons[1]).toContain("The player's sound was off for 1:00");
    expect(analyzeEffort({ ...base, stats: { watchedSeconds: 600, sourceSeconds: 700 } }).reasons).toHaveLength(1);
  });
});

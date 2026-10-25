import { describe, it, expect } from 'vitest';
import { createPlayedTracker } from './playedTracker.js';

describe('createPlayedTracker', () => {
  it('counts seconds played in order', () => {
    const t = createPlayedTracker();
    for (let s = 0; s <= 10; s += 0.5) t.tick(s, true);
    expect(t.count()).toBeGreaterThanOrEqual(9);
    expect(t.count()).toBeLessThanOrEqual(11);
  });
  it('earns nothing for a jump, and nothing while paused', () => {
    const t = createPlayedTracker();
    t.tick(1, true); t.tick(1.5, true);
    const before = t.count();
    t.tick(100, true);          // scrubbed far ahead
    t.tick(101, false);         // paused
    t.tick(102, false);
    expect(t.count()).toBe(before);
  });
  it('does not count a replayed part twice', () => {
    const t = createPlayedTracker();
    for (let s = 0; s <= 5; s += 0.5) t.tick(s, true);
    const once = t.count();
    t.tick(0, false);
    for (let s = 0; s <= 5; s += 0.5) t.tick(s, true);
    expect(t.count()).toBe(once);
  });
  it('ignores bad times', () => {
    const t = createPlayedTracker();
    expect(t.tick(NaN, true)).toBe(0);
  });
});

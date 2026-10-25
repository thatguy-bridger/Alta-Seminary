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

describe('seconds played with the sound off', () => {
  it('counts the played seconds that had the sound off', () => {
    const t = createPlayedTracker();
    for (let s = 0; s <= 10; s += 0.5) t.tick(s, true, true);       // ten seconds, muted
    for (let s = 10.5; s <= 20; s += 0.5) t.tick(s, true, false);   // ten more, sound on
    expect(t.count()).toBeGreaterThanOrEqual(19);
    expect(t.mutedCount()).toBeGreaterThanOrEqual(9);
    expect(t.mutedCount()).toBeLessThanOrEqual(11);
  });
  it('does not count a pause, a jump, or a talk with the sound on', () => {
    const t = createPlayedTracker();
    t.tick(1, true, true); t.tick(1.5, true, true);
    const before = t.mutedCount();
    t.tick(50, true, true);                                          // scrubbed ahead: earns nothing
    t.tick(51, false, true);                                         // paused
    expect(t.mutedCount()).toBe(before);
    const loud = createPlayedTracker();
    for (let s = 0; s <= 10; s += 0.5) loud.tick(s, true, false);
    expect(loud.mutedCount()).toBe(0);
  });
  it('forgives a part that was muted the first time and replayed with the sound on', () => {
    const t = createPlayedTracker();
    for (let s = 0; s <= 6; s += 0.5) t.tick(s, true, true);
    expect(t.mutedCount()).toBeGreaterThan(4);
    t.tick(0, false);
    for (let s = 0; s <= 6; s += 0.5) t.tick(s, true, false);
    expect(t.mutedCount()).toBe(0);
  });
  it('clears on reset', () => {
    const t = createPlayedTracker();
    for (let s = 0; s <= 4; s += 0.5) t.tick(s, true, true);
    t.reset();
    expect(t.mutedCount()).toBe(0);
  });
});

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

describe('how far the playhead has been', () => {
  const play = (t, from, to, step = 0.25) => { for (let s = from; s <= to; s += step) t.tick(s, true); };

  it('knows the furthest point reached, played or not', () => {
    const t = createPlayedTracker();
    expect(t.reachedAt()).toBe(0);
    play(t, 0, 10);
    expect(t.reachedAt()).toBe(10);
    t.tick(95, false);                                   // scrubbed far ahead and paused there
    expect(t.reachedAt()).toBe(95);
    t.tick(20, false);                                   // and back again: it has still been to 95
    expect(t.reachedAt()).toBe(95);
  });

  it('a small jump leaves a small gap: only what was really played is seen', () => {
    const t = createPlayedTracker();
    play(t, 0, 10);                                      // seconds 0 to 10
    play(t, 14, 20);                                     // a jump of four seconds, then on
    const { seen, reached } = t.export();
    expect(seen).toEqual([[0, 10], [14, 20]]);           // 11, 12 and 13 were never played
    expect(reached).toBe(20);
  });

  it('keeps what was reached through a close and reopen, and never less than what was played', () => {
    const a = createPlayedTracker();
    play(a, 0, 30); a.tick(200, false);
    const b = createPlayedTracker(); b.restore(a.export());
    expect(b.reachedAt()).toBe(200);
    const c = createPlayedTracker(); c.restore({ seen: [[0, 50]], reached: 3 });   // a save that does not add up
    expect(c.reachedAt()).toBe(50);
    const d = createPlayedTracker(); d.restore({ seen: [[0, 5]] });                // from before this was saved
    expect(d.reachedAt()).toBe(5);
    d.reset();
    expect(d.reachedAt()).toBe(0);
  });

  it('ignores a time that is not a number', () => {
    const t = createPlayedTracker();
    t.tick(NaN, true); t.tick(undefined, false); t.tick(Infinity, true);
    expect(t.reachedAt()).toBe(0);                       // none of those is a place in the recording
  });
});

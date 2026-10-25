// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { glideTo, easeInOutCubic, prefersReducedMotion } from './glide.js';

// A scroll box and a clock the test controls, so an animation can be stepped through frame by frame.
function rig() {
  const box = { scrollTop: 0, scrollHeight: 1000, clientHeight: 200 };
  let t = 0, next = 1; const queue = new Map();
  const api = { raf: (f) => { const id = next++; queue.set(id, f); return id; }, caf: (id) => queue.delete(id), now: () => t };
  const frame = (ms) => { t += ms; const fs = [...queue.values()]; queue.clear(); fs.forEach((f) => f()); };
  return { box, api, frame, pending: () => queue.size };
}

describe('the eased scroll', () => {
  it('starts and ends gently, and never goes backwards', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
    expect(easeInOutCubic(0.1)).toBeLessThan(0.1);           // slow at the start
    expect(easeInOutCubic(0.9)).toBeGreaterThan(0.9);        // and slow again at the end
    let prev = -1; for (let i = 0; i <= 20; i++) { const v = easeInOutCubic(i / 20); expect(v).toBeGreaterThanOrEqual(prev); prev = v; }
  });

  it('glides to the target over the time asked, in many small steps', () => {
    const { box, api, frame } = rig();
    glideTo(box, 400, { ms: 1000, ...api });
    const seen = [];
    for (let i = 0; i < 10; i++) { frame(100); seen.push(box.scrollTop); }
    expect(seen.every((v, i) => i === 0 || v >= seen[i - 1])).toBe(true);
    expect(seen[0]).toBeGreaterThan(0);
    expect(seen[0]).toBeLessThan(40);                         // a slow start, not a jump
    expect(box.scrollTop).toBe(400);
  });

  it('stops animating once it arrives', () => {
    const { box, api, frame, pending } = rig();
    glideTo(box, 100, { ms: 200, ...api });
    frame(100); frame(100); frame(100);
    expect(box.scrollTop).toBe(100);
    expect(pending()).toBe(0);
  });

  it('a new glide replaces one still going, starting from where the box is now', () => {
    const { box, api, frame } = rig();
    glideTo(box, 500, { ms: 1000, ...api });
    frame(500);
    const mid = box.scrollTop;
    expect(mid).toBeGreaterThan(0);
    glideTo(box, 0, { ms: 1000, ...api });
    frame(1000);
    expect(box.scrollTop).toBe(0);
    expect(mid).toBeGreaterThan(box.scrollTop);
  });

  it('does not scroll past either end', () => {
    const { box, api, frame } = rig();
    glideTo(box, 5000, { ms: 100, ...api }); frame(200);
    expect(box.scrollTop).toBe(800);                          // 1000 tall, 200 showing
    glideTo(box, -300, { ms: 100, ...api }); frame(200);
    expect(box.scrollTop).toBe(0);
  });

  it('jumps straight there for people who asked for less motion, and ignores a tiny move', () => {
    const { box, api, pending } = rig();
    glideTo(box, 300, { reduced: true, ...api });
    expect(box.scrollTop).toBe(300);
    expect(pending()).toBe(0);
    glideTo(box, 300.4, { ...api });
    expect(pending()).toBe(0);
    expect(() => glideTo(null, 10)).not.toThrow();
  });

  it('reads the reduced-motion setting from the browser', () => {
    const real = window.matchMedia;
    window.matchMedia = () => ({ matches: true });
    expect(prefersReducedMotion()).toBe(true);
    window.matchMedia = () => ({ matches: false });
    expect(prefersReducedMotion()).toBe(false);
    window.matchMedia = real;
  });
});

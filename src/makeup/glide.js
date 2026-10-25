// A slow, eased scroll, so the transcript flows from one line to the next instead of jumping.
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);

// Scrolls `box` to `to` over `ms`. A new glide replaces one still going. `raf`, `caf` and `now` can be swapped for tests.
export function glideTo(box, to, { ms = 1100, reduced = false, raf = (f) => requestAnimationFrame(f), caf = (id) => cancelAnimationFrame(id), now = () => performance.now() } = {}) {
  if (!box) return;
  if (box.__glide) { caf(box.__glide); box.__glide = 0; }
  const max = Math.max(0, box.scrollHeight - box.clientHeight);
  const target = Math.min(max, Math.max(0, to));
  const from = box.scrollTop;
  const dist = target - from;
  if (Math.abs(dist) < 1) return;
  if (reduced || ms <= 0) { box.scrollTop = target; return; }
  const t0 = now();
  const step = () => {
    const k = Math.min(1, (now() - t0) / ms);
    box.scrollTop = from + dist * easeInOutCubic(k);
    box.__glide = k < 1 ? raf(step) : 0;
  };
  box.__glide = raf(step);
}

// Lets go of a glide in progress (the student has taken over the scrolling).
export function stopGlide(box, caf = (id) => cancelAnimationFrame(id)) { if (box && box.__glide) { caf(box.__glide); box.__glide = 0; } }

export const prefersReducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

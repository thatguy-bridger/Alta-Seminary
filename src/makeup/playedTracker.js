// Counts how many different seconds of a video/audio were actually PLAYED.
// Scrubbing ahead does not count, pausing does not count, and replaying a part
// does not count twice. Feed it the player's time on a steady tick, and whether its sound was off.
// It also counts how many of those seconds were played with the sound off; replaying one with the sound on clears it.
export function createPlayedTracker() {
  const seen = new Set();
  const quiet = new Set();
  let last = null;
  let reached = 0;   // the furthest the playhead has been, even if it only jumped there: what lies before it and was never played was skipped
  return {
    tick(time, playing, muted = false) {
      if (Number.isFinite(time) && time > reached) reached = time;
      if (!playing || !Number.isFinite(time)) { last = null; return seen.size; }
      // contiguous playback: a normal forward step. Anything else is a jump (a seek) and earns nothing.
      if (last !== null && time >= last && time - last <= 1.5) {
        const sec = Math.floor(time);
        seen.add(sec);
        if (muted) quiet.add(sec); else quiet.delete(sec);
      }
      last = time;
      return seen.size;
    },
    count: () => seen.size,
    mutedCount: () => quiet.size,
    reset() { seen.clear(); quiet.clear(); last = null; reached = 0; },
    reachedAt: () => reached,
    // Saved with the student's progress, and put back when they return: which seconds were played, as compact ranges.
    // (The count alone would let a replay of the same part earn more time after a close and reopen.)
    export: () => ({ seen: toRanges(seen), quiet: toRanges(quiet), reached }),
    restore(saved = {}) {
      seen.clear(); quiet.clear(); last = null;
      fromRanges(saved.seen).forEach((s) => seen.add(s));
      reached = Math.max(Number.isFinite(saved.reached) && saved.reached > 0 ? Math.min(saved.reached, MAX_SECONDS) : 0, seen.size ? Math.max(...seen) : 0);
      fromRanges(saved.quiet).forEach((s) => { if (seen.has(s)) quiet.add(s); });   // a muted second was also a played one
      return seen.size;
    },
  };
}

const MAX_SECONDS = 24 * 3600;   // nothing here is longer than a day; stops a damaged save from allocating endlessly

// [3, 4, 5, 9] -> [[3, 5], [9, 9]]
export function toRanges(set) {
  const sorted = [...set].filter(Number.isInteger).sort((a, b) => a - b);
  const out = [];
  for (const s of sorted) {
    const tail = out[out.length - 1];
    if (tail && s === tail[1] + 1) tail[1] = s; else out.push([s, s]);
  }
  return out;
}

// The other way round, forgiving of anything odd (it may have come from storage someone else edited).
export function fromRanges(ranges) {
  const out = [];
  if (!Array.isArray(ranges)) return out;
  for (const r of ranges.slice(0, 5000)) {
    if (!Array.isArray(r) || !Number.isInteger(r[0]) || !Number.isInteger(r[1])) continue;
    const a = Math.max(0, r[0]), b = Math.min(MAX_SECONDS, r[1]);
    for (let s = a; s <= b && out.length < MAX_SECONDS; s++) out.push(s);
  }
  return out;
}

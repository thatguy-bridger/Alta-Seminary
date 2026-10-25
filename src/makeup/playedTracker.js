// Counts how many different seconds of a video/audio were actually PLAYED.
// Scrubbing ahead does not count, pausing does not count, and replaying a part
// does not count twice. Feed it the player's time on a steady tick, and whether its sound was off.
// It also counts how many of those seconds were played with the sound off; replaying one with the sound on clears it.
export function createPlayedTracker() {
  const seen = new Set();
  const quiet = new Set();
  let last = null;
  return {
    tick(time, playing, muted = false) {
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
    reset() { seen.clear(); quiet.clear(); last = null; },
  };
}

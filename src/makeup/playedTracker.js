// Counts how many different seconds of a video/audio were actually PLAYED.
// Scrubbing ahead does not count, pausing does not count, and replaying a part
// does not count twice. Feed it the player's time on a steady tick.
export function createPlayedTracker() {
  const seen = new Set();
  let last = null;
  return {
    tick(time, playing) {
      if (!playing || !Number.isFinite(time)) { last = null; return seen.size; }
      // contiguous playback: a normal forward step. Anything else is a jump (a seek) and earns nothing.
      if (last !== null && time >= last && time - last <= 1.5) seen.add(Math.floor(time));
      last = time;
      return seen.size;
    },
    count: () => seen.size,
    reset() { seen.clear(); last = null; },
  };
}

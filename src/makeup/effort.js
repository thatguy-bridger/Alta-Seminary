// Turns raw "how was this written" numbers into a calm, plain-language signal
// for the teacher. Never an accusation: it says what was seen and suggests a
// conversation when something looks off. Used by the teacher email, the admin
// list, and the student's "what your teacher receives" screen.
const FAST_CHARS_PER_SECOND = 10; // sustained typing faster than this is unusual
const WATCHED_ENOUGH = 0.75;     // played at least this much of the video/audio
const SOUND_OFF_SHARE = 0.5;     // flagged when the player's sound was off for at least this share of what was played...
const SOUND_OFF_MIN_SECONDS = 30; // ...and for at least this long (a brief mute is not worth raising)
const SOUND_NOTE_MIN_SECONDS = 10; // shorter than the flag, it is still mentioned once it reaches this

const sentence = (s) => `${s.charAt(0).toUpperCase()}${s.slice(1)}.`;

export function analyzeEffort({ mode = 'text', text = '', voiceSeconds = 0, stats = {} } = {}) {
  const { pastes = 0, jumps = 0, activeMs = 0, typedChars = 0, leaves = 0, watchedSeconds = 0, sourceSeconds = 0, mutedSeconds = 0 } = stats;
  // Did they actually play the video or audio, or skip through it? (Scrubbing past a part does not count as played.)
  const skipped = sourceSeconds > 0 && watchedSeconds / sourceSeconds < WATCHED_ENOUGH;
  const skipNote = `played only ${formatDuration(watchedSeconds)} of the ${formatDuration(sourceSeconds)} of video and audio`;
  // Was the player's sound off? (Only the player can be seen: the computer's speakers and headphones cannot.)
  const soundFlag = watchedSeconds > 0 && mutedSeconds >= SOUND_OFF_MIN_SECONDS && mutedSeconds / watchedSeconds >= SOUND_OFF_SHARE;
  const soundNote = mutedSeconds >= SOUND_NOTE_MIN_SECONDS
    ? `the player's sound was off for ${formatDuration(mutedSeconds)} of the ${formatDuration(watchedSeconds)} played${soundFlag ? ' (they may have followed the transcript instead)' : ''}` : '';
  if (mode === 'voice') {
    const flags = [skipped && skipNote, soundFlag && soundNote].filter(Boolean);
    if (flags.length) return { ok: false, label: 'Worth a conversation', reasons: flags };
    return { ok: true, label: 'Spoken live', reasons: [`Spoken aloud for ${formatDuration(voiceSeconds)} and written down by the student's browser.`, ...(soundNote ? [sentence(soundNote)] : [])] };
  }
  const reasons = [];
  if (pastes > 0) reasons.push(`${pastes} paste attempt${pastes > 1 ? 's' : ''} (blocked)`);
  if (jumps > 0) reasons.push(`${jumps} sudden jump${jumps > 1 ? 's' : ''} of text appearing at once`);
  const seconds = activeMs / 1000;
  if (typedChars >= 60 && seconds > 0 && typedChars / seconds > FAST_CHARS_PER_SECOND) reasons.push('typing speed was unusually fast');
  if (typedChars < Math.min(text.length, 200) * 0.5 && text.length >= 60) reasons.push('much of the text did not come from typing');
  if (leaves >= 4) reasons.push(`left the page ${leaves} times while writing`);
  if (skipped) reasons.push(skipNote);
  if (soundFlag) reasons.push(soundNote);
  if (!reasons.length) return { ok: true, label: 'Looks typed live', reasons: ['Steady typing, nothing pasted.', ...(soundNote ? [sentence(soundNote)] : [])] };
  return { ok: false, label: 'Worth a conversation', reasons };
}

export const formatDuration = (s) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;

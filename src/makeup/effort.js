// Turns raw "how was this written" numbers into a calm, plain-language signal
// for the teacher. Never an accusation: it says what was seen and suggests a
// conversation when something looks off. Used by the teacher email, the admin
// list, and the student's "what your teacher receives" screen.
const FAST_CHARS_PER_SECOND = 10; // sustained typing faster than this is unusual

export function analyzeEffort({ mode = 'text', text = '', voiceSeconds = 0, stats = {} } = {}) {
  const { pastes = 0, jumps = 0, activeMs = 0, typedChars = 0, leaves = 0 } = stats;
  if (mode === 'voice') {
    return { ok: true, label: 'Spoken live', reasons: [`Recorded in the student's own voice (${voiceSeconds}s).`] };
  }
  const reasons = [];
  if (pastes > 0) reasons.push(`${pastes} paste attempt${pastes > 1 ? 's' : ''} (blocked)`);
  if (jumps > 0) reasons.push(`${jumps} sudden jump${jumps > 1 ? 's' : ''} of text appearing at once`);
  const seconds = activeMs / 1000;
  if (typedChars >= 60 && seconds > 0 && typedChars / seconds > FAST_CHARS_PER_SECOND) reasons.push('typing speed was unusually fast');
  if (typedChars < Math.min(text.length, 200) * 0.5 && text.length >= 60) reasons.push('much of the text did not come from typing');
  if (leaves >= 4) reasons.push(`left the page ${leaves} times while writing`);
  if (!reasons.length) return { ok: true, label: 'Looks typed live', reasons: ['Steady typing, nothing pasted.'] };
  return { ok: false, label: 'Worth a conversation', reasons };
}

export const formatDuration = (s) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;

// The Makeup Work journey as plain data and rules, independent of how it looks.
// Every design direction (see docs/prototypes/makeup-work-concepts.html) is a
// skin over this: same steps, same rules, same numbers.
export const STEPS = ['begin', 'choose', 'learn', 'reflect', 'commit', 'done'];

export const RULES = {
  minutesPerDay: 15,      // suggested time per missed day
  maxSessions: 4,         // "4 or more days" is treated as this many sessions
  settleSeconds: 3,       // the quiet moment before "I'm ready" unlocks
  minWords: 12,           // written reflection
  minVoiceSeconds: 5,     // spoken reflection
  minCommitChars: 8,
  jumpChars: 25,          // this many characters appearing at once counts as a "sudden jump"
};

export function initialState(over = {}) {
  return {
    step: 0, day: 1, name: '', cls: '', days: 0, sourceId: '',
    mode: 'text', text: '', voiceSeconds: 0, commit: '',
    settled: false, learned: false,
    stats: { pastes: 0, jumps: 0, activeMs: 0, typedChars: 0, leaves: 0 },
    ...over,
  };
}

export const sessionsFor = (days) => Math.min(Math.max(0, days | 0), RULES.maxSessions);
export const estimateMinutes = (days) => sessionsFor(days) * RULES.minutesPerDay;
export const wordCount = (t) => ((t || '').trim().match(/\S+/g) || []).length;

// Can the student leave the current step? One rule per step, used by both the
// button state and the server-side check.
export function canAdvance(s) {
  switch (STEPS[s.step]) {
    case 'begin': return !!(s.name.trim() && s.cls && s.days > 0 && s.settled);
    case 'choose': return !!s.sourceId;
    case 'learn': return !!s.learned;
    case 'reflect': return s.mode === 'voice' ? s.voiceSeconds >= RULES.minVoiceSeconds : wordCount(s.text) >= RULES.minWords;
    case 'commit': return s.commit.trim().length >= RULES.minCommitChars;
    default: return false;
  }
}

export function advance(s) {
  return canAdvance(s) ? { ...s, step: Math.min(STEPS.length - 1, s.step + 1) } : s;
}

// More days owed: start the next session at the "choose" step, keeping who they are.
export function nextDay(s) {
  if (s.day >= sessionsFor(s.days)) return s;
  return initialState({ name: s.name, cls: s.cls, days: s.days, day: s.day + 1, step: 1, settled: true });
}

export const isLastDay = (s) => s.day >= sessionsFor(s.days);

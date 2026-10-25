// The Makeup Work journey as plain data and rules, independent of how it looks.
// Every design direction (see docs/prototypes/makeup-work-concepts.html) is a
// skin over this: same steps, same rules, same numbers.
// Follows the pattern seminary worksheets already use: read the content, find a
// truth, understand it, feel it, apply it.
export const STEPS = ['begin', 'choose', 'learn', 'truth', 'understand', 'commit', 'done'];

export const RULES = {
  minutesPerDay: 30,      // suggested time per missed day (existing seminary worksheets expect 30 to 60)
  maxSessions: 4,         // "4 or more days" is treated as 4
  maxSources: 3,          // most ways-to-learn in one journey
  extraWordsPerSource: 4, // each extra source asks a little more of each written answer
  extraVoicePerSource: 5,
  settleSeconds: 3,       // the quiet moment before "I'm ready" unlocks
  minTruthWords: 6,       // the truth they found
  minWhereChars: 3,       // where they found it (verse, talk, time)
  minWords: 8,            // each of the two written answers in "understand"
  minVoiceSeconds: 10,    // spoken answer to both questions
  minBlessChars: 8,
  minCommitChars: 8,
  jumpChars: 25,          // this many characters appearing at once counts as a "sudden jump"
};

export function initialState(over = {}) {
  return {
    step: 0, learnIndex: 0, name: '', cls: '', days: 0, sourceIds: [],
    mode: 'text', truth: '', where: '', understanding: '', text: '', voiceSeconds: 0, inv: '', commit: '', bless: '',
    settled: false, learned: false,
    stats: { pastes: 0, jumps: 0, activeMs: 0, typedChars: 0, leaves: 0 },
    ...over,
  };
}

// Missing several days is ONE journey that grows, not a repeat per day: one more
// way to learn per missed day (up to maxSources), and slightly longer answers.
export const daysCovered = (days) => Math.min(Math.max(0, days | 0), RULES.maxSessions);
export const sourcesNeeded = (days) => Math.min(Math.max(daysCovered(days), 1), RULES.maxSources);
export const wordsNeeded = (days) => RULES.minWords + RULES.extraWordsPerSource * (sourcesNeeded(days) - 1);
export const voiceSecondsNeeded = (days) => RULES.minVoiceSeconds + RULES.extraVoicePerSource * (sourcesNeeded(days) - 1);
export const estimateMinutes = (days) => daysCovered(days) * RULES.minutesPerDay;
export const wordCount = (t) => ((t || '').trim().match(/\S+/g) || []).length;

// Can the student leave the current step? One rule per step, used by both the
// button state and the server-side check.
export function canAdvance(s) {
  switch (STEPS[s.step]) {
    case 'begin': return !!(s.name.trim() && s.cls && s.days > 0 && s.settled);
    case 'choose': return s.sourceIds.length === sourcesNeeded(s.days);
    case 'learn': return !!s.learned;
    case 'truth': return wordCount(s.truth) >= RULES.minTruthWords && s.where.trim().length >= RULES.minWhereChars;
    case 'understand': return s.mode === 'voice'
      ? s.voiceSeconds >= voiceSecondsNeeded(s.days)
      : wordCount(s.understanding) >= wordsNeeded(s.days) && wordCount(s.text) >= wordsNeeded(s.days);
    case 'commit': return !!s.inv && s.commit.trim().length >= RULES.minCommitChars && s.bless.trim().length >= RULES.minBlessChars;
    default: return false;
  }
}

export function advance(s) {
  return canAdvance(s) ? { ...s, step: Math.min(STEPS.length - 1, s.step + 1) } : s;
}

// Wording and options for the journey. Starter drafts for the school to edit.
export const GROUPS = {
  read: { label: 'Read', kinds: ['scripture', 'lesson'], desc: 'A scripture and a short thought.', icon: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
    listen: ['Look for a word that repeats.', 'Notice what the person is willing to do.', 'Ask: what does this promise?'] },
  watch: { label: 'Watch', kinds: ['video'], desc: 'A short video.', icon: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5l5 2.5-5 2.5z"/>',
    listen: ['Watch for the moment a choice is made.', 'Notice how the people feel.', 'Ask: when have I felt that?'] },
  listen: { label: 'Listen', kinds: ['audio', 'podcast'], desc: 'Audio to close your eyes for.', icon: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
    listen: ['Listen for one sentence to remember.', 'Notice when your mind goes quiet.', 'Ask: what is being invited of me?'] },
  talks: { label: 'Conference', kinds: ['talk'], desc: 'A conference talk or article.', icon: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    listen: ['Find the idea the speaker returns to.', 'Notice a sentence written for you.', 'Ask: what does this ask of me?'] },
  study: { label: 'Deep study', kinds: ['proclamation'], desc: 'An in-depth study, once.', icon: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
    listen: ['Take it one paragraph at a time.', 'Notice what is repeated.', 'Ask: what would change if I lived this?'] },
};

export const groupOf = (kind) => Object.keys(GROUPS).find((g) => GROUPS[g].kinds.includes(kind));
export const AV_KINDS = ['video', 'audio', 'podcast'];

export const WORDS = ['Peace', 'Courage', 'Gratitude', 'Hope', 'Wonder', 'Humility', 'Doubt', 'Love', 'Conviction'];
export const STARTERS = ['I felt closest to God when…', 'Something I did not expect was…', 'I want to remember that…'];
export const STYLES = ['open', 'word', 'sentence'];
export const FEEL_HEAD = { open: 'Tell about a time you felt this was true, or one you hope for.', word: 'Pick a word for how this feels, then say why.', sentence: 'Finish the thought.' };

export const INVITES = [
  { k: 'pray', t: 'Pray', d: 'Talk with God about it.', start: 'This week I will pray about', icon: '<path d="M12 21c-4-3-7-6.2-7-10a7 7 0 0 1 14 0c0 3.8-3 7-7 10z"/><path d="M12 8v6M9 11h6"/>' },
  { k: 'serve', t: 'Serve', d: 'Do something for someone.', start: 'This week I will help', icon: '<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/>' },
  { k: 'share', t: 'Share', d: 'Tell someone what you learned.', start: 'This week I will tell', icon: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 11l7.6-4M8.2 13l7.6 4"/>' },
  { k: 'study', t: 'Study', d: 'Look deeper on your own.', start: 'This week I will study', icon: '<path d="M12 6C10 4.5 7 4 3 4v14c4 0 7 .5 9 2 2-1.5 5-2 9-2V4c-4 0-7 .5-9 2z"/><path d="M12 6v14"/>' },
];
export const CLOSERS = ['The morning is yours.', 'You showed up. That matters.', 'Thank you for taking the time.'];
export const PASS_ON = 'I just spent a few quiet minutes studying at Alta Seminary online. It was calm and good. Want to try it with me?';

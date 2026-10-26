import { describe, it, expect } from 'vitest';
import { PROGRESS_KEY, KEEP_DAYS, readProgress, writeProgress, clearProgress, hasProgress, learnKey } from './progress.js';
import { initialState } from './journey.js';
import { createPlayedTracker, toRanges, fromRanges } from './playedTracker.js';

const memory = (start = {}) => { const m = { ...start }; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, _m: m }; };
const NOW = Date.UTC(2026, 9, 25, 12);
const classes = [{ id: 'c1' }, { id: 'c2' }];
const sources = [{ id: 's1' }, { id: 's2' }, { id: 's3' }];
const base = (over = {}) => ({ ...initialState(), step: 3, name: 'Maya', cls: 'c1', days: 1, settled: true, learned: true, sourceIds: ['s1'], picks: ['read'], truth: 'If we act then He helps', ...over });
const saved = (data = {}, extra = {}) => ({ [PROGRESS_KEY]: JSON.stringify({ v: 1, savedAt: NOW - 60_000, S: base(), ...data, ...extra }) });
const read = (store, over = {}) => readProgress(store, { now: NOW, classes, sources, ...over });

describe('saving and reading a place', () => {
  it('gives back what was written, and nothing was changed on the way', () => {
    const store = memory();
    const S = base({ truth: 'A truth I found', understanding: 'In my words' });
    expect(writeProgress(store, { S, notes: 'remember: ask Dad', cites: [{ sourceId: 's1', title: 'T', seconds: 41 }], pauseAnswers: { k: 'my answer' }, pauseDrafts: { j: 'half a' },
      tracker: { stats: { pastes: 1, typedChars: 90 }, prevLen: { truth: 16 } }, totals: { watched: 30, source: 60, readSeconds: 5, muted: 2 }, voiceParts: { under: 4, feel: 3 } }, { now: NOW - 1000 })).toBe(true);
    const back = read(store);
    expect(back.S).toMatchObject({ step: 3, name: 'Maya', truth: 'A truth I found', understanding: 'In my words', sourceIds: ['s1'], learned: true });
    expect(back.notes).toBe('remember: ask Dad');
    expect(back.cites).toEqual([{ sourceId: 's1', title: 'T', seconds: 41 }]);
    expect(back.pauseAnswers).toEqual({ k: 'my answer' });
    expect(back.pauseDrafts).toEqual({ j: 'half a' });
    expect(back.tracker).toEqual({ stats: { pastes: 1, typedChars: 90 }, prevLen: { truth: 16 } });
    expect(back.totals).toEqual({ watched: 30, source: 60, readSeconds: 5, muted: 2 });
    expect(back.voiceParts).toEqual({ under: 4, feel: 3 });
  });

  it('knows nothing when nothing was saved, or the storage is broken', () => {
    expect(read(memory())).toBeNull();
    expect(read({ getItem: () => { throw new Error('blocked'); } })).toBeNull();
    expect(read(null)).toBeNull();
    expect(writeProgress({ setItem: () => { throw new Error('full'); } }, { S: base() })).toBe(false);   // does not throw: the journey carries on
    expect(writeProgress(null, { S: base() })).toBe(false);
    expect(() => clearProgress(null)).not.toThrow();
  });

  it('lets go of anything it cannot trust', () => {
    expect(read(memory({ [PROGRESS_KEY]: '{not json' }))).toBeNull();
    expect(read(memory({ [PROGRESS_KEY]: '[]' }))).toBeNull();
    expect(read(memory(saved({}, { v: 2 })))).toBeNull();                                      // a different layout
    expect(read(memory(saved({}, { savedAt: 'yesterday' })))).toBeNull();
    expect(read(memory(saved({}, { savedAt: NOW + 3 * 86400_000 })))).toBeNull();              // from a clock that was wrong
    expect(read(memory(saved({}, { savedAt: NOW - (KEEP_DAYS + 1) * 86400_000 })))).toBeNull(); // too old
    expect(read(memory(saved({}, { savedAt: NOW - (KEEP_DAYS - 1) * 86400_000 })))).not.toBeNull();
  });

  it('is not fooled by edited storage: wrong types become safe values and a finished journey is never revived', () => {
    const back = read(memory(saved({ S: { step: '3', name: { x: 1 }, cls: 'c1', days: -4, learned: 'yes', settled: 1, mode: 'shout', truth: 42, sourceIds: 'oops', step_: 9 }, notes: 7, cites: 'no', pauseAnswers: { a: 5, b: 'ok' } })));
    expect(back).toBeNull();                                                                   // step as a string and nothing else usable: no place to return to
    const b2 = read(memory(saved({ S: { step: 99, name: 'Ana', cls: 'c1', days: 2, learned: 'yes', settled: 1, mode: 'shout', truth: 42, sourceIds: 'oops' }, notes: 7, cites: 'no', pauseAnswers: { a: 5, b: 'ok' } })));
    expect(b2.S.step).toBe(5);                                                                 // the last step that can be saved: never "done"
    expect(b2.S.learned).toBe(false);
    expect(b2.S.settled).toBe(false);
    expect(b2.S.mode).toBe('text');
    expect(b2.S.truth).toBe('');
    expect(b2.S.sourceIds).toEqual([]);
    expect(b2.notes).toBe('');
    expect(b2.cites).toEqual([]);
    expect(b2.pauseAnswers).toEqual({ b: 'ok' });
  });

  it('keeps notes and a name even when that is all there is, and nothing for a page that was only opened', () => {
    expect(hasProgress(initialState(), '')).toBe(false);
    expect(hasProgress(initialState(), '   ')).toBe(false);
    expect(hasProgress(initialState(), 'a note')).toBe(true);
    expect(hasProgress({ ...initialState(), name: 'Maya' })).toBe(true);
    expect(hasProgress({ ...initialState(), days: 2 })).toBe(true);
    expect(hasProgress({ ...initialState(), step: 1 })).toBe(true);
    expect(read(memory(saved({ S: initialState(), notes: '' })))).toBeNull();
  });
});

describe('fitting a saved place to what exists now', () => {
  it('sends the student to choose again if a lesson they picked is gone, and keeps the rest', () => {
    const back = read(memory(saved({ S: base({ step: 4, sourceIds: ['gone'], truth: 'My truth', learnIndex: 0 }), learn: { key: learnKey(0, 'gone'), played: 40, seen: [[0, 39]] }, totals: { watched: 40, source: 60, readSeconds: 0, muted: 0 } })));
    expect(back.S.step).toBe(1);                                                               // back to choosing
    expect(back.S.sourceIds).toEqual([]);
    expect(back.S.learned).toBe(false);
    expect(back.S.truth).toBe('My truth');                                                     // what they wrote is not thrown away
    expect(back.learn).toBeNull();
    expect(back.totals).toEqual({ watched: 0, source: 0, readSeconds: 0, muted: 0 });
  });

  it('starts at the beginning if their class is gone', () => {
    const back = read(memory(saved({ S: base({ step: 4, cls: 'old-class' }) })));
    expect(back.S.step).toBe(0);
    expect(back.S.cls).toBe('');
    expect(back.S.name).toBe('Maya');
  });

  it('ignores the place in a lesson that is not the one they are on', () => {
    const wrong = read(memory(saved({ S: base({ step: 2, learned: false, sourceIds: ['s1'] }), learn: { key: learnKey(0, 's2'), played: 20, seen: [[0, 19]] } })));
    expect(wrong.learn).toBeNull();
    const right = read(memory(saved({ S: base({ step: 2, learned: false, sourceIds: ['s1'] }), learn: { key: learnKey(0, 's1'), played: 20, duration: 60, readSeconds: 0, mutedPlayed: 0, time: 20.5, seen: [[0, 19]], quiet: [] } })));
    expect(right.learn).toMatchObject({ key: '0:s1', played: 20, time: 20.5, seen: [[0, 19]] });
  });

  it('asks for as many lessons as the days they missed, or chooses again', () => {
    const back = read(memory(saved({ S: base({ step: 3, days: 2, sourceIds: ['s1'] }) })));    // two days need two lessons
    expect(back.S.sourceIds).toEqual([]);
    expect(back.S.step).toBe(1);
  });

  it('counts a save made as the page was hidden as the page being closed, not as leaving it', () => {
    expect(read(memory(saved({}, { hidden: true }))).closed).toBe(true);
    expect(read(memory(saved({}, { hidden: false }))).closed).toBe(false);
    expect(read(memory(saved({})))).toMatchObject({ closed: false });
  });

  it('clears', () => {
    const store = memory(saved());
    clearProgress(store);
    expect(read(store)).toBeNull();
  });
});

describe('remembering which seconds were played', () => {
  it('packs seconds into ranges and unpacks them again', () => {
    expect(toRanges(new Set([3, 4, 5, 9, 11, 12]))).toEqual([[3, 5], [9, 9], [11, 12]]);
    expect(fromRanges([[3, 5], [9, 9]])).toEqual([3, 4, 5, 9]);
    expect([...new Set(fromRanges([[1, 3], 'x', [2], [-5, 1], [1.5, 2], null]))].sort()).toEqual([0, 1, 2, 3]);   // junk skipped, a negative start clamped
    expect(fromRanges('nope')).toEqual([]);
    expect(fromRanges([[0, 1e12]]).length).toBeLessThanOrEqual(24 * 3600 + 1);               // a damaged save cannot allocate without end
  });

  it('puts the played seconds back, so a replay after reopening still earns nothing twice', () => {
    const a = createPlayedTracker();
    for (let t = 0; t <= 20; t += 0.5) a.tick(t, true);
    const before = a.count();
    expect(before).toBe(21);
    const b = createPlayedTracker();
    expect(b.restore(a.export())).toBe(before);
    for (let t = 5; t <= 20; t += 0.5) b.tick(t, true);                                        // listen to the same part again
    expect(b.count()).toBe(before);
    for (let t = 20.5; t <= 30; t += 0.5) b.tick(t, true);                                     // new part: counts
    expect(b.count()).toBe(31);
  });

  it('keeps which of those were played with the sound off, and clears them again when replayed with sound', () => {
    const a = createPlayedTracker();
    for (let t = 0; t <= 10; t += 0.5) a.tick(t, true, true);
    const b = createPlayedTracker(); b.restore(a.export());
    expect(b.mutedCount()).toBe(11);
    for (let t = 0; t <= 4; t += 0.5) b.tick(t, true, false);
    expect(b.mutedCount()).toBe(6);                                                            // seconds 5..10 are still quiet
  });

  it('ignores a "quiet" second that was never played', () => {
    const t = createPlayedTracker();
    t.restore({ seen: [[0, 5]], quiet: [[3, 9]] });
    expect(t.count()).toBe(6);
    expect(t.mutedCount()).toBe(3);                                                            // 3, 4, 5
  });
});

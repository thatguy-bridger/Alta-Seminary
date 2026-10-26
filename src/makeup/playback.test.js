import { describe, it, expect } from 'vitest';
import { clock, skippedRanges, skippedTotal, describeRanges, mediaDetail, timelineParts, summarize, skipStart } from './playback.js';

describe('what was skipped', () => {
  it('is nothing when it was played straight through', () => {
    expect(skippedRanges([[0, 59]], 60, 60)).toEqual([]);
    expect(skippedRanges([[0, 100]], 100.4, 600)).toEqual([]);
  });

  it('is the part jumped over, however small', () => {
    expect(skippedRanges([[0, 10], [14, 20]], 20.5, 600)).toEqual([[11, 14]]);              // a jump of a few seconds
    expect(skippedRanges([[0, 10], [12, 20]], 20.5, 600)).toEqual([[11, 12]]);              // a single second
    expect(skippedRanges([[0, 10], [14, 20], [40, 50]], 50.1, 600)).toEqual([[11, 14], [21, 40]]);
  });

  it('counts the start when playing began somewhere else', () => {
    expect(skippedRanges([[30, 40]], 40.2, 600)).toEqual([[0, 30]]);
  });

  it('counts a jump with nothing played after it, up to where the playhead is', () => {
    expect(skippedRanges([[0, 20]], 90, 600)).toEqual([[21, 90]]);                            // scrubbed ahead and stopped
    expect(skippedRanges([], 90, 600)).toEqual([[0, 90]]);
  });

  it('does not count what has not been reached, nor the second being played right now', () => {
    expect(skippedRanges([[0, 20]], 20.9, 600)).toEqual([]);                                  // still on second 20
    expect(skippedRanges([[0, 20]], 21.0, 600)).toEqual([]);
    expect(skippedRanges([], 0, 600)).toEqual([]);                                            // nothing yet
    expect(skippedRanges([[0, 20]], 700, 600)).toEqual([[21, 600]]);                          // never beyond the end
  });

  it('is not fooled by ranges out of order, overlapping, or damaged', () => {
    expect(skippedRanges([[14, 20], [0, 10], [5, 12]], 20.2, 600)).toEqual([[13, 14]]);
    expect(skippedRanges([[0, 10], 'x', null, [5], [9, 3], [NaN, 4]], 10.2, 600)).toEqual([]);
    expect(skippedRanges('nope', 5.5, 600)).toEqual([[0, 5]]);
    expect(skippedRanges(undefined, 3.5, 600)).toEqual([[0, 3]]);
  });

  it('adds up and reads aloud', () => {
    const gaps = [[65, 100], [190, 195], [300, 301]];
    expect(skippedTotal(gaps)).toBe(41);
    expect(describeRanges(gaps)).toBe('1:05 to 1:40, 3:10 to 3:15, 5:00 to 5:01');
    expect(describeRanges(Array.from({ length: 9 }, (_, i) => [i * 10, i * 10 + 2]))).toBe('0:00 to 0:02, 0:10 to 0:12, 0:20 to 0:22, 0:30 to 0:32, 0:40 to 0:42, 0:50 to 0:52 and 3 more');
    expect(skippedTotal(undefined)).toBe(0);
    expect(describeRanges(null)).toBe('');
    expect(clock(3725)).toBe('1:02:05');
    expect(clock(NaN)).toBe('0:00');
  });
});

describe('the timeline', () => {
  it('lays the whole length out as played, skipped and not yet reached', () => {
    expect(timelineParts([[0, 9], [14, 19]], 20.4, 60)).toEqual([
      { kind: 'played', from: 0, to: 10 }, { kind: 'skipped', from: 10, to: 14 }, { kind: 'played', from: 14, to: 20 }, { kind: 'ahead', from: 20, to: 60 },
    ]);
  });

  it('is all "ahead" before anything happens, and all played at the end', () => {
    expect(timelineParts([], 0, 30)).toEqual([{ kind: 'ahead', from: 0, to: 30 }]);
    expect(timelineParts([[0, 29]], 30, 30)).toEqual([{ kind: 'played', from: 0, to: 30 }]);
  });

  it('shows a jump to the end as a long skipped stretch', () => {
    expect(timelineParts([[0, 4]], 60, 60)).toEqual([{ kind: 'played', from: 0, to: 5 }, { kind: 'skipped', from: 5, to: 60 }]);
  });

  it('always covers exactly the length, whatever it is given', () => {
    for (const [seen, reached, d] of [[[[0, 500]], 900, 60], [[[-5, 3]], 2, 10], [[], 5, 10], [[[3, 1]], 5, 10]]) {
      const parts = timelineParts(seen, reached, d);
      expect(parts[0].from).toBe(0);
      expect(parts[parts.length - 1].to).toBe(d);
      parts.slice(1).forEach((p, i) => expect(p.from).toBe(parts[i].to));                   // no gaps, no overlaps
    }
    expect(timelineParts([[0, 5]], 5, 0)).toEqual([]);                                     // length unknown: nothing to draw
  });
});

describe('what the teacher is given', () => {
  it('packs one lesson with the parts that were skipped', () => {
    const d = mediaDetail({ id: 's1', title: 'A talk', kind: 'audio', duration: 600, seen: [[0, 10], [14, 20]], reached: 20.6, played: 18 });
    expect(d).toEqual({ source_id: 's1', title: 'A talk', kind: 'audio', duration: 600, played: 18, reached: 21, seen: [[0, 10], [14, 20]], skipped: [[11, 14]] });
  });

  it('copes with a lesson of unknown length or damaged numbers', () => {
    const d = mediaDetail({ id: 7, title: null, kind: undefined, duration: NaN, seen: 'x', reached: -4, played: 'lots' });
    expect(d).toMatchObject({ source_id: '7', title: '', kind: '', duration: 0, played: 0, reached: 0, seen: [], skipped: [] });
  });

  it('says it in words', () => {
    expect(summarize({ duration: 600, played: 192, skipped: [] })).toBe('Played 3:12 of 10:00.');
    expect(summarize({ duration: 600, played: 192, skipped: [[65, 100], [190, 195]] })).toBe('Played 3:12 of 10:00. Skipped 0:40 in 2 parts: 1:05 to 1:40, 3:10 to 3:15.');
    expect(summarize({ duration: 600, played: 5, skipped: [[1, 2]] })).toBe('Played 0:05 of 10:00. Skipped 0:01 in 1 part: 0:01 to 0:02.');
  });
});

describe('where tapping a skipped part starts', () => {
  const lines = [{ start: 0, end: 20 }, { start: 20, end: 55 }, { start: 55, end: 70 }, { start: 70, end: 85 }, { start: 85, end: 110 }];

  it('is the start of the line the red begins in, even when the skip began partway through it', () => {
    expect(skipStart(lines, 61, 95)).toBe(55);                                  // skipped from 1:01, in the line that starts at 0:55
    expect(skipStart(lines, 30, 40)).toBe(20);
  });

  it('is that line\'s start exactly when the red begins on a line', () => {
    expect(skipStart(lines, 70, 90)).toBe(70);
    expect(skipStart(lines, 0, 5)).toBe(0);
  });

  it('is the first of the lines when the red covers several', () => {
    expect(skipStart(lines, 25, 100)).toBe(20);
  });

  it('does not count a line that finished before the red began', () => {
    expect(skipStart(lines, 55, 60)).toBe(55);                                  // the line before ends at 55 exactly: it is not part of the red
    expect(skipStart(lines, 20, 21)).toBe(20);
  });

  it('is the red\'s own start when no line touches it (a quiet stretch)', () => {
    const gappy = [{ start: 0, end: 10 }, { start: 30, end: 40 }];
    expect(skipStart(gappy, 12, 28)).toBe(12);
    expect(skipStart(gappy, 45, 60)).toBe(45);                                  // after the last line
  });

  it('copes with lines out of order, or with no end, and with no transcript at all', () => {
    expect(skipStart([{ start: 55 }, { start: 0 }, { start: 20 }], 30, 40)).toBe(20);   // a line with no end lasts until the next begins
    expect(skipStart([{ start: 0 }, { start: 20 }], 25, 30)).toBe(20);
    expect(skipStart(undefined, 7, 9)).toBe(7);
    expect(skipStart([], 7, 9)).toBe(7);
    expect(skipStart([null, { start: 'x' }, { text: 'no time' }], 7, 9)).toBe(7);
  });
});

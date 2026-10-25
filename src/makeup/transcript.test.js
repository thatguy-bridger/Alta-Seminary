import { describe, it, expect } from 'vitest';
import { parseTime, formatTimestamp, timestampRef, parseTranscript, normalizeSegments, activeIndex, coverage, checkTranscript, playedFraction, transcriptText } from './transcript.js';

describe('times', () => {
  it('reads the formats captions use', () => {
    expect(parseTime('00:01:02.500')).toBe(62.5);
    expect(parseTime('01:02.500')).toBe(62.5);
    expect(parseTime('1:02,5')).toBe(62.5);
    expect(parseTime('1:02:03')).toBe(3723);
    expect(parseTime('nope')).toBeNull();
    expect(parseTime('00:99')).toBeNull();
  });
  it('writes them for people', () => {
    expect(formatTimestamp(0)).toBe('0:00');
    expect(formatTimestamp(161)).toBe('2:41');
    expect(formatTimestamp(3723)).toBe('1:02:03');
    expect(timestampRef('Faith in action', 161)).toBe('Faith in action · 2:41');
  });
});

describe('parseTranscript', () => {
  const vtt = `WEBVTT

NOTE a comment

intro
00:00:01.000 --> 00:00:04.000 align:start
<v Speaker>Hello &amp; welcome.

00:00:04.500 --> 00:00:08.000
Second line
wraps here.
`;
  it('reads WebVTT: identifiers, settings, speaker tags, entities, wrapped lines', () => {
    const { segments, errors } = parseTranscript(vtt);
    expect(errors).toEqual([]);
    expect(segments).toEqual([{ start: 1, end: 4, text: 'Hello & welcome.' }, { start: 4.5, end: 8, text: 'Second line wraps here.' }]);
  });
  it('reads SRT (numbered cues, comma milliseconds)', () => {
    const { segments } = parseTranscript('1\n00:00:00,500 --> 00:00:02,000\nOne\n\n2\n00:00:02,000 --> 00:00:03,250\nTwo');
    expect(segments.map((s) => [s.start, s.end, s.text])).toEqual([[0.5, 2, 'One'], [2, 3.25, 'Two']]);
  });
  it('refuses plain text rather than guessing at times', () => {
    const r = parseTranscript('Just some words with no times.');
    expect(r.segments).toEqual([]);
    expect(r.errors[0]).toMatch(/No timestamps/);
  });
  it('reports a bad time but keeps the good lines', () => {
    const r = parseTranscript('00:00:01.000 --> 00:00:02.000\nGood\n\n99:99:99 --> 00:00:09.000\nBad');
    expect(r.segments).toHaveLength(1);
    expect(r.errors[0]).toMatch(/Could not read the time/);
  });
});

describe('segments', () => {
  it('sorts, drops empties, and fixes an end before the start', () => {
    const s = normalizeSegments([{ start: 5, end: 6, text: 'b' }, { start: 1, end: 0, text: 'a' }, { start: 2, end: 3, text: '  ' }, { start: -1, end: 2, text: 'neg' }]);
    expect(s.map((x) => x.text)).toEqual(['a', 'b']);
    expect(s[0].end).toBeGreaterThan(s[0].start);
  });
  const segs = [{ start: 0, end: 4, text: 'a' }, { start: 5, end: 9, text: 'b' }, { start: 20, end: 24, text: 'c' }];
  it('finds the line being spoken, keeping the last lit through a short gap', () => {
    expect(activeIndex(segs, 2)).toBe(0);
    expect(activeIndex(segs, 4.8)).toBe(0);   // 0.8s gap
    expect(activeIndex(segs, 6)).toBe(1);
    expect(activeIndex(segs, 15)).toBe(-1);   // long silence
    expect(activeIndex(segs, 21)).toBe(2);
    expect(activeIndex(segs, -1)).toBe(-1);
  });
  it('joins text for search and accessibility', () => expect(transcriptText(segs)).toBe('a b c'));
});

describe('checkTranscript', () => {
  const seg = (a, b) => ({ start: a, end: b, text: 'x' });
  it('requires lines and a duration', () => {
    expect(checkTranscript([], 100).ok).toBe(false);
    expect(checkTranscript([seg(0, 5)], 0).ok).toBe(false);
  });
  it('rejects a transcript that runs past the end', () => expect(checkTranscript([seg(0, 5), seg(500, 505)], 100).ok).toBe(false));
  it('warns, but allows, when a lot is missing', () => {
    const r = checkTranscript([seg(0, 20)], 100);
    expect(r.ok).toBe(true);
    expect(r.warnings[0]).toMatch(/20%/);
  });
  it('is quiet when it covers the media', () => {
    const r = checkTranscript([seg(0, 50), seg(50, 100)], 100);
    expect(r.ok && r.warnings.length === 0).toBe(true);
    expect(coverage([seg(0, 100)], 100)).toBe(1);
  });
});

it('counts only what was played', () => {
  expect(playedFraction(30, 120)).toBe(0.25);
  expect(playedFraction(500, 120)).toBe(1);
  expect(playedFraction(5, 0)).toBe(0);
});

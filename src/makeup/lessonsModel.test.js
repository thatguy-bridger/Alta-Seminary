import { describe, it, expect } from 'vitest';
import {
  KINDS, kindInfo, isTextKind, collectionOf, compareCollections, needsAttention, typeTabs, collectionsFor, filterLessons, sectionsFor,
  blankLesson, draftFromRow, validateLesson, rowFromDraft, isDirty, parseLength, NO_COLLECTION,
} from './lessonsModel.js';
import { parseTranscript, segmentsToVtt } from './transcript.js';

const L = (over = {}) => ({ id: over.id || Math.random().toString(36).slice(2), kind: 'scripture', title: 'A', series: 'Book of Mormon', active: true, sort_order: 0, body_words: 300, transcript_lines: 0, ...over });
const LIB = [
  L({ id: 's1', title: 'Alma 5', series: 'Book of Mormon' }), L({ id: 's2', title: 'Genesis 1', series: 'Old Testament' }), L({ id: 's3', title: 'D&C 4', series: 'Doctrine and Covenants' }),
  L({ id: 's4', title: 'John 3', series: 'New Testament' }),
  L({ id: 't1', kind: 'talk', title: 'Old talk', series: 'April 2025 general conference' }), L({ id: 't2', kind: 'talk', title: 'New talk', series: 'April 2026 general conference', author: 'Elder Test' }),
  L({ id: 't3', kind: 'talk', title: 'Mid talk', series: 'October 2025 general conference' }),
  L({ id: 'v1', kind: 'video', title: 'A video', series: 'April 2026 general conference', embed_url: 'https://youtu.be/OJ2pLI0tZvY', transcript_lines: 150, duration_seconds: 600, body_words: 0, active: false }),
  L({ id: 'v2', kind: 'video', title: 'Bare video', series: null, embed_url: '', transcript_lines: 0, duration_seconds: null, body_words: 0 }),
  L({ id: 'p1', kind: 'proclamation', title: 'The Family', series: 'Proclamations' }),
];

describe('categories', () => {
  it('lists the types that exist, in a fixed order, with counts', () => {
    const tabs = typeTabs(LIB);
    expect(tabs.map((t) => t.label)).toEqual(['All', 'Scripture', 'Conference talk', 'Video', 'Proclamation']);
    expect(tabs.map((t) => t.count)).toEqual([10, 4, 3, 2, 1]);
    expect(KINDS.map((k) => k.value)).toEqual(['scripture', 'talk', 'video', 'audio', 'proclamation', 'lesson', 'podcast']);
    expect(kindInfo('nope').label).toBe('nope');
    expect(isTextKind('talk')).toBe(true);
    expect(isTextKind('video')).toBe(false);
  });

  it('puts the standard works in their usual order, conferences newest first, and "no collection" last', () => {
    expect(collectionsFor(LIB, 'scripture').map((c) => c.name)).toEqual(['Old Testament', 'New Testament', 'Book of Mormon', 'Doctrine and Covenants']);
    expect(collectionsFor(LIB, 'talk').map((c) => c.name)).toEqual(['April 2026 general conference', 'October 2025 general conference', 'April 2025 general conference']);
    expect(collectionsFor(LIB, 'video').map((c) => c.name)).toEqual(['April 2026 general conference', NO_COLLECTION]);
    expect(collectionsFor(LIB, 'video')[0].count).toBe(1);
    expect(compareCollections('Zebra', 'Apple')).toBeGreaterThan(0);
    expect(collectionOf({ series: '  ' })).toBe(NO_COLLECTION);
  });

  it('builds sections in order: by type, then collection, then lesson order', () => {
    const sections = sectionsFor([L({ id: 'x', title: 'B', sort_order: 2 }), L({ id: 'y', title: 'A', sort_order: 2 }), L({ id: 'z', title: 'Z', sort_order: 1 }), ...LIB.slice(4, 6)]);
    expect(sections.map((s) => `${s.kind}:${s.name}`)).toEqual(['scripture:Book of Mormon', 'talk:April 2026 general conference', 'talk:April 2025 general conference']);
    expect(sections[0].lessons.map((l) => l.id)).toEqual(['z', 'y', 'x']);      // sort order, then title
  });
});

describe('finding lessons', () => {
  it('filters by type, collection, status and a search word', () => {
    expect(filterLessons(LIB, { kind: 'talk' }).map((l) => l.id)).toEqual(['t1', 't2', 't3']);
    expect(filterLessons(LIB, { kind: 'talk', collection: 'April 2026 general conference' }).map((l) => l.id)).toEqual(['t2']);
    expect(filterLessons(LIB, { status: 'hidden' }).map((l) => l.id)).toEqual(['v1']);
    expect(filterLessons(LIB, { status: 'shown', kind: 'video' }).map((l) => l.id)).toEqual(['v2']);
    expect(filterLessons(LIB, { q: 'elder test' }).map((l) => l.id)).toEqual(['t2']);
    expect(filterLessons(LIB, { q: 'conference talk' }).length).toBe(3);                   // searches the type's name too
    expect(filterLessons(LIB, { q: '  ALMA ' }).map((l) => l.id)).toEqual(['s1']);
    expect(filterLessons(LIB, { kind: 'video', collection: NO_COLLECTION }).map((l) => l.id)).toEqual(['v2']);
  });

  it('flags what needs attention, in plain words', () => {
    expect(needsAttention(LIB[0])).toEqual([]);
    expect(needsAttention(LIB[7])).toEqual([]);                                         // v1 is complete (just hidden)
    expect(needsAttention(LIB[8])).toEqual(['Needs an address', 'Needs a transcript', 'Needs a length']);
    expect(needsAttention({ kind: 'audio', embed_url: 'https://vimeo.com/1', transcript_lines: 5, duration_seconds: 60 })).toEqual(['Address cannot be played']);
    expect(needsAttention({ kind: 'talk', body_words: 0 })).toEqual(['Needs text']);
    expect(needsAttention({ kind: 'scripture', body_words: 0, reference: 'Alma 5' })).toEqual([]);   // a reading assignment needs no text
    expect(filterLessons(LIB, { status: 'attention' }).map((l) => l.id)).toEqual(['v2']);
  });
});

describe('editing a lesson', () => {
  const video = () => ({ id: 'v', kind: 'video', title: 'A talk', embed_url: 'https://youtu.be/OJ2pLI0tZvY', duration_seconds: 600, minutes: 12, active: true, one_time: false,
    transcript_lines: 150, pauses: [{ at: 95, question: 'What stood out?' }], min_seconds: 300, guide_line: 'Notice the story.', thumbnail_url: null, series: 'April 2026 general conference', author: 'Elder Test' });
  const verse = () => ({ id: 's', kind: 'scripture', title: 'Alma 5', body: 'One.\n\nTwo.\n\nThree.', reference: 'Alma 5', minutes: 8, active: true, pauses: [{ at: 2, question: 'Why?' }], min_seconds: null });

  it('turns a row into what the editor shows, and back', () => {
    const d = draftFromRow(video(), 150);
    expect(d).toMatchObject({ duration_text: '10:00', min_mode: 'custom', min_seconds: '300', pauses: [{ at: '1:35', question: 'What stood out?' }], transcript_lines: 150 });
    const row = rowFromDraft(d);
    expect(row).toMatchObject({ kind: 'video', title: 'A talk', embed_url: 'https://youtu.be/OJ2pLI0tZvY', duration_seconds: 600, min_seconds: 300, active: true, body: null, pauses: [{ at: 95, question: 'What stood out?' }] });
    expect('transcript' in row).toBe(false);                                            // untouched transcript is not rewritten
    expect(draftFromRow(verse()).pauses).toEqual([{ at: '2', question: 'Why?' }]);
    expect(draftFromRow(verse()).min_mode).toBe('auto');
    expect(rowFromDraft(draftFromRow(verse())).min_seconds).toBeNull();
  });

  it('keeps pictures off unless the lesson turns them on, and carries the choice both ways', () => {
    expect(draftFromRow(verse()).show_images).toBe(false);                               // a lesson from before the switch existed
    expect(draftFromRow({ ...verse(), show_images: null }).show_images).toBe(false);
    expect(draftFromRow({ ...verse(), show_images: true }).show_images).toBe(true);
    expect(rowFromDraft(draftFromRow(verse())).show_images).toBe(false);
    expect(rowFromDraft(draftFromRow({ ...verse(), show_images: true })).show_images).toBe(true);
    expect(rowFromDraft({ ...draftFromRow(verse()), show_images: true }).show_images).toBe(true);
    expect(blankLesson('talk').show_images).toBe(false);                                 // a new lesson starts plain
  });

  it('knows when nothing has changed', () => {
    const d = draftFromRow(video(), 150);
    expect(isDirty(d, { ...d, transcript_lines: 99 })).toBe(false);
    expect(isDirty(d, { ...d, title: 'Another' })).toBe(true);
  });

  it('needs a title, sensible minutes, a safe picture address, a short guiding line, and whole seconds', () => {
    const e = (over) => validateLesson({ ...draftFromRow(verse()), ...over }).errors;
    expect(e({ title: '  ' }).title).toBeTruthy();
    expect(e({ minutes: 0 }).minutes).toBeTruthy();
    expect(e({ thumbnail_url: 'javascript:alert(1)' }).thumbnail_url).toBeTruthy();
    expect(e({ thumbnail_url: 'https://example.org/a.jpg' }).thumbnail_url).toBeUndefined();
    expect(e({ guide_line: 'x'.repeat(201) }).guide_line).toBeTruthy();
    expect(e({ min_mode: 'custom', min_seconds: '1.5' }).min_seconds).toBeTruthy();
    expect(e({ min_mode: 'custom', min_seconds: '90' }).min_seconds).toBeUndefined();
    expect(validateLesson(draftFromRow(verse())).ok).toBe(true);
  });

  it('holds a video back from students until it can be played and read along', () => {
    const v = validateLesson({ ...draftFromRow(video(), 150), embed_url: '', duration_text: '', transcript_lines: 0 });
    expect(v.canShow).toBe(false);
    expect(v.showBlockers).toEqual(['it needs a YouTube link or audio address', 'it needs a transcript', 'it needs a length']);
    expect(validateLesson(draftFromRow(video(), 150)).canShow).toBe(true);
    expect(validateLesson({ ...draftFromRow(video(), 150), embed_url: 'https://vimeo.com/1' }).errors.embed_url).toContain('YouTube');
    expect(validateLesson({ ...draftFromRow(verse()), body: '', reference: '' }).canShow).toBe(false);
    expect(validateLesson({ ...draftFromRow(verse()), body: '' }).canShow).toBe(true);        // a scripture with a reference is a reading assignment
  });

  it('never saves a lesson as shown when it is not ready', () => {
    const d = { ...draftFromRow(video(), 150), embed_url: '' };
    expect(rowFromDraft(d).active).toBe(false);
  });

  it('checks an edited transcript against the length, and saves it only when it was edited', () => {
    const d = draftFromRow(video(), 150);
    const bad = validateLesson({ ...d, transcript_raw: 'just some words with no times' });
    expect(bad.errors.transcript).toBeTruthy();
    const long = validateLesson({ ...d, duration_text: '0:10', transcript_raw: 'WEBVTT\n\n00:00:50.000 --> 00:00:55.000\nWay past the end' });
    expect(long.errors.transcript).toContain('past the end');
    const good = { ...d, transcript_raw: 'WEBVTT\n\n00:00:01.000 --> 00:00:05.000\nHello there.' };
    expect(validateLesson(good).ok).toBe(true);
    expect(rowFromDraft(good, { transcript: [{ start: 1, end: 5, text: 'Hello there.' }] }).transcript).toHaveLength(1);
  });

  it('explains pause question problems in plain words', () => {
    const p = (pauses, base = draftFromRow(video(), 150)) => validateLesson({ ...base, pauses }).errors.pauses;
    expect(p([{ at: '1:35', question: 'Fine?' }])).toBeUndefined();
    expect(p([{ at: '1:35', question: '' }])).toBe('Every question needs its words.');
    expect(p([{ at: 'soon', question: 'When?' }])).toContain('like 2:30');
    expect(p([{ at: '15:00', question: 'Too late?' }])).toContain('inside the lesson');
    expect(p([{ at: '1:00', question: 'A?' }, { at: '1:00', question: 'B?' }])).toContain('same place');
    expect(p(Array.from({ length: 7 }, (_, i) => ({ at: String(i + 1), question: `Q${i}` })))).toContain('up to 6');
    expect(p([{ at: '', question: '' }])).toBeUndefined();                                       // an empty row is just ignored
    const text = draftFromRow(verse());
    expect(p([{ at: '9', question: 'Which?' }], text)).toContain('paragraph that exists');
    expect(p([{ at: 'a', question: 'Which?' }], text)).toContain('which paragraph');
    expect(p([{ at: '3', question: 'Which?' }], text)).toBeUndefined();
  });

  it('starts a new lesson as a hidden draft', () => {
    expect(blankLesson()).toMatchObject({ kind: 'scripture', active: false, title: '', pauses: [], min_mode: 'auto', transcript_lines: 0 });
    expect(blankLesson('video').kind).toBe('video');
    expect(validateLesson(blankLesson()).errors.title).toBeTruthy();
  });

  it('reads lengths as m:ss or seconds', () => {
    expect(parseLength('12:40')).toBe(760);
    expect(parseLength('95')).toBe(95);
    expect(parseLength('')).toBeNull();
    expect(parseLength('soon')).toBeNull();
  });
});

describe('transcripts as text', () => {
  it('writes a transcript out as WebVTT that reads back the same', () => {
    const segs = [{ start: 0.63, end: 3.27, text: 'My dear brothers and sisters,' }, { start: 3600.5, end: 3605, text: 'An hour in.' }];
    const vtt = segmentsToVtt(segs);
    expect(vtt.startsWith('WEBVTT\n\n00:00:00.630 --> 00:00:03.270\nMy dear')).toBe(true);
    const back = parseTranscript(vtt);
    expect(back.errors).toEqual([]);
    expect(back.segments.map((s) => [s.start, s.end, s.text])).toEqual(segs.map((s) => [s.start, s.end, s.text]));
    expect(segmentsToVtt([])).toBe('WEBVTT\n\n\n');
  });
});

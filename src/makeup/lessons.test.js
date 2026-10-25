import { describe, it, expect } from 'vitest';
import { PAINTINGS, paintingFor, thumbnailFor, isSafeImageUrl, hashString, paintingCredit, paintingById } from './thumbnails.js';
import { splitParagraphs, cleanPauses, pauseKey, isAnswered, allAnswered, nextDuePause, answersPayload, pauseWhere, PAUSE_MAX } from './pauses.js';
import { readFileSync, existsSync } from 'node:fs';
import { byline } from './byline.js';

describe('thumbnails', () => {
  it('uses the picture an admin chose first', () => {
    expect(thumbnailFor({ id: 'a', thumbnail_url: 'https://example.org/x.jpg', embed_url: 'https://youtu.be/OJ2pLI0tZvY' })).toEqual({ src: 'https://example.org/x.jpg', source: 'custom' });
    expect(thumbnailFor({ id: 'a', thumbnail_url: '  /uploads/mine.webp ' }).src).toBe('/uploads/mine.webp');
    expect(thumbnailFor({ id: 'a', thumbnail_url: 'https://www.churchofjesuschrist.org/imgs/abc/full/%21480%2C/0/default' }).source).toBe('church');
    const chosen = thumbnailFor({ id: 'a', thumbnail_url: '/makeup/thumbs/sermon-bloch.webp' });                 // a painting an admin picked
    expect(chosen.source).toBe('painting');
    expect(chosen.painting.title).toBe('Sermon on the Mount');
  });

  it('uses a YouTube video\'s own picture, then a painting', () => {
    expect(thumbnailFor({ id: 'a', embed_url: 'https://www.youtube.com/watch?v=OJ2pLI0tZvY' })).toEqual({ src: 'https://i.ytimg.com/vi/OJ2pLI0tZvY/hqdefault.jpg', source: 'youtube' });
    const t = thumbnailFor({ id: 'a', kind: 'scripture' });
    expect(t.source).toBe('painting');
    expect(t.src).toBe(t.painting.src);
  });

  it('gives a lesson the same painting every time, and spreads the library over the whole set', () => {
    expect(thumbnailFor({ id: 'same' }).src).toBe(thumbnailFor({ id: 'same' }).src);
    const used = new Set(Array.from({ length: 200 }, (_, i) => paintingFor(`lesson-${i}`).id));
    expect(used.size).toBe(PAINTINGS.length);
    expect(hashString('x')).toBe(hashString('x'));
  });

  it('ignores an unsafe picture address instead of putting it in the page', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'http://insecure.example/x.jpg', '//host/x.jpg', 'not a url']) {
      expect(isSafeImageUrl(bad)).toBe(false);
      expect(thumbnailFor({ id: 'a', thumbnail_url: bad }).source).toBe('painting');
    }
    expect(isSafeImageUrl('https://www.churchofjesuschrist.org/imgs/x/full/%21320%2C/0/default')).toBe(true);
  });

  it('every painting has a file, credit and description', () => {
    for (const p of PAINTINGS) {
      expect(existsSync(new URL(`../../public${p.src}`, import.meta.url)), p.id).toBe(true);
      expect(readFileSync(new URL(`../../public${p.src}`, import.meta.url)).subarray(0, 4).toString()).toBe('RIFF');   // a real webp
      expect(p.alt.length).toBeGreaterThan(20);
      expect(paintingCredit(p)).toContain(p.artist);
    }
    expect(paintingById('sermon-bloch').title).toBe('Sermon on the Mount');
    expect(paintingById('nope')).toBeNull();
  });
});

describe('pause questions', () => {
  it('splits text into paragraphs, using line breaks when a scripture has no blank lines', () => {
    expect(splitParagraphs('One.\n\nTwo.\n\n\nThree.')).toEqual(['One.', 'Two.', 'Three.']);
    expect(splitParagraphs('1 In the beginning\n2 And God said')).toEqual(['1 In the beginning', '2 And God said']);
    expect(splitParagraphs('')).toEqual([]);
    expect(splitParagraphs(null)).toEqual([]);
  });

  it('cleans a list: no empty questions, nothing past the end, none at the same moment, in order', () => {
    const raw = [{ at: 120, question: ' Second? ' }, { at: 30, question: 'First?' }, { at: 30, question: 'Duplicate moment' }, { at: 500, question: 'Past the end' }, { at: 60, question: '   ' }, { at: 'x', question: 'Bad time' }, { at: 0, question: 'Too early' }, null];
    expect(cleanPauses(raw, { lengthSeconds: 300 })).toEqual([{ at: 30, question: 'First?' }, { at: 120, question: 'Second?' }]);
    expect(cleanPauses([{ at: 2.9, question: 'After 2' }, { at: 9, question: 'Too far' }, { at: 0, question: 'None' }], { text: true, paragraphs: 5 })).toEqual([{ at: 2, question: 'After 2' }]);
    expect(cleanPauses('nonsense')).toEqual([]);
    expect(cleanPauses(Array.from({ length: 20 }, (_, i) => ({ at: i + 1, question: `Q${i}` }))).length).toBe(PAUSE_MAX);
  });

  it('counts an answer only when it is a few words', () => {
    const k = pauseKey('L1', { at: 30 });
    expect(k).toBe('L1@30');
    expect(isAnswered({ [k]: 'yes' }, k)).toBe(false);
    expect(isAnswered({ [k]: 'It made me think' }, k)).toBe(true);
    expect(isAnswered(undefined, k)).toBe(false);
  });

  it('shows the next question once its moment has been reached, even if the student skipped past it', () => {
    const pauses = [{ at: 30, question: 'A?' }, { at: 90, question: 'B?' }];
    expect(nextDuePause('L1', pauses, 10, {})).toBeNull();
    expect(nextDuePause('L1', pauses, 31, {})).toEqual(pauses[0]);
    expect(nextDuePause('L1', pauses, 200, {})).toEqual(pauses[0]);                        // jumped to the end: still asked, in order
    const done = { 'L1@30': 'It made me think' };
    expect(nextDuePause('L1', pauses, 200, done)).toEqual(pauses[1]);
    expect(nextDuePause('L1', pauses, 200, { ...done, 'L1@90': 'Because it matters' })).toBeNull();
  });

  it('knows when every question is answered', () => {
    const pauses = [{ at: 1, question: 'A?' }];
    expect(allAnswered('L', pauses, {})).toBe(false);
    expect(allAnswered('L', pauses, { 'L@1': 'a few words here' })).toBe(true);
    expect(allAnswered('L', [], {})).toBe(true);
  });

  it('sends the answered questions with the submission, in lesson order, with their question and moment', () => {
    const lessons = [{ id: 'A', title: 'A talk', kind: 'video', pauses: [{ at: 30, question: 'First?' }, { at: 90, question: 'Second?' }] }, { id: 'B', title: 'A verse', kind: 'scripture', pauses: [{ at: 2, question: 'Third?' }] }, { id: 'C' }];
    const answers = { 'A@90': '  Because it matters  ', 'B@2': 'It is about hope', 'A@30': 'no' };
    expect(answersPayload(lessons, answers)).toEqual([
      { source_id: 'A', lesson: 'A talk', unit: 'seconds', question: 'Second?', at: 90, answer: 'Because it matters' },
      { source_id: 'B', lesson: 'A verse', unit: 'paragraph', question: 'Third?', at: 2, answer: 'It is about hope' },
    ]);
  });

  it('describes where a question appears', () => {
    const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    expect(pauseWhere(true, 3, fmt)).toBe('after paragraph 3');
    expect(pauseWhere(false, 95, fmt)).toBe('at 1:35');
  });
});

describe('the byline', () => {
  it('says who and where, without repeating a speaker\'s name', () => {
    expect(byline({ author: 'Clark G. Gilbert', reference: 'Clark G. Gilbert, April 2026 general conference' })).toBe('Clark G. Gilbert, April 2026 general conference');
    expect(byline({ author: 'Elder Test', reference: '1 Nephi 3:7' })).toBe('Elder Test · 1 Nephi 3:7');
    expect(byline({ reference: 'Alma 5' })).toBe('Alma 5');
    expect(byline({ author: 'Elder Test' })).toBe('Elder Test');
    expect(byline({})).toBe('');
    expect(byline(null)).toBe('');
  });
});

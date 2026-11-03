import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { findRefs, refLabel, bookNamed, churchUri, BOOKS } from './scriptureRefs.js';
import { parseChapter } from './churchChapter.js';

const refs = (t) => findRefs(t).filter((p) => p.ref).map((p) => p.ref);

describe('finding references', () => {
  it('finds a chapter and verse, and leaves the words around it alone', () => {
    const parts = findRefs('Read Ezekiel 4:22 and think.');
    expect(parts.map((p) => p.text).join('')).toBe('Read Ezekiel 4:22 and think.');
    expect(parts.find((p) => p.ref)).toEqual({ text: 'Ezekiel 4:22', ref: { book: 'Ezekiel', chapter: 4, from: 22, to: 22 } });
  });
  it('finds ranges written with a hyphen, en dash or em dash, and whole chapters', () => {
    expect(refs('Alma 5:14-15')[0]).toMatchObject({ book: 'Alma', chapter: 5, from: 14, to: 15 });
    expect(refs('Alma 5:14–15')[0]).toMatchObject({ from: 14, to: 15 });
    expect(refs('Alma 5:14—15')[0]).toMatchObject({ from: 14, to: 15 });
    expect(refs('see Alma 5.')[0]).toEqual({ book: 'Alma', chapter: 5, from: null, to: null });
  });
  it('knows numbered books, D&C, and other spellings', () => {
    expect(refs('1 Nephi 3:7')[0].book).toBe('1 Nephi');
    expect(refs('2 Ne. 2:25')[0].book).toBe('2 Nephi');
    expect(refs('D&C 88:118')[0]).toMatchObject({ book: 'D&C', chapter: 88, from: 118 });
    expect(refs('Doctrine and Covenants 1:38')[0].book).toBe('D&C');
    expect(refs('Psalms 23')[0].book).toBe('Psalm');
    expect(refs('Joseph Smith—History 1:17')[0].book).toBe('Joseph Smith—History');
    expect(refs('1 John 4:8')[0].book).toBe('1 John');
    expect(refs('John 3:16')[0].book).toBe('John');
  });
  it('finds several in one line, and none in ordinary text', () => {
    expect(refs('Compare Alma 32:21 with Ether 12:6, then Hebrews 11:1.').map(refLabel)).toEqual(['Alma 32:21', 'Ether 12:6', 'Hebrews 11:1']);
    expect(refs('Chapter 4 of the book, in 2026, John said hello.')).toEqual([]);
    expect(refs('Johnson 3 and Marker 4')).toEqual([]);
    expect(findRefs('')).toEqual([{ text: '' }]);
    expect(findRefs(null)).toEqual([{ text: '' }]);
  });
  it('does not match inside a longer word or number', () => {
    expect(refs('Mormon 9:9')[0].book).toBe('Mormon');
    expect(refs('1Alma 5')).toEqual([]);
    expect(refs('Alma 5000')).toEqual([]);
  });
  it('reads a range backwards as one verse, and labels references', () => {
    expect(refs('Alma 5:15-14')[0]).toMatchObject({ from: 15, to: 15 });
    expect(refLabel({ book: 'Alma', chapter: 5, from: 14, to: 15 })).toBe('Alma 5:14–15');
    expect(refLabel({ book: 'Alma', chapter: 5, from: 14, to: 14 })).toBe('Alma 5:14');
    expect(refLabel({ book: 'Alma', chapter: 5, from: null, to: null })).toBe('Alma 5');
  });
});

describe('the Church addresses', () => {
  it('has every book once, with a Church address, and maps names to chapters', () => {
    expect(BOOKS.length).toBe(86);
    expect(new Set(BOOKS.map((b) => b.path)).size).toBe(86);
    expect(churchUri('Ezekiel', 4)).toBe('/scriptures/ot/ezek/4');
    expect(churchUri('D&C', 88)).toBe('/scriptures/dc-testament/dc/88');
    expect(churchUri('Joseph Smith—History', 1)).toBe('/scriptures/pgp/js-h/1');
    expect(churchUri('Nonsense', 1)).toBeNull();
    expect(churchUri('Alma', 0)).toBeNull();
    expect(churchUri('Alma', 'x')).toBeNull();
    expect(bookNamed('  alma ')?.name).toBe('Alma');
  });
});

describe('reading the Church chapter page', () => {
  const html = '<p class="verse" data-aid="1" data-eng-ref="4:21" id="p21"><span class="verse-number">21 </span>Then <a class="study-note-ref" href="#n"><sup class="marker" data-value="a"></sup>said he</a> &amp; spoke.</p><p class="title">Not a verse</p><p class="verse" data-eng-ref="4:22" id="p22"><span class="verse-number">22&nbsp;</span>And he&#8217;s <b>there</b>.</p>';
  it('gives plain verses with their numbers, notes and numbers stripped', () => {
    expect(parseChapter(html)).toEqual([{ n: 21, text: 'Then said he & spoke.' }, { n: 22, text: 'And he’s there.' }]);
  });
  it('copes with nothing, and with pages with no verses', () => {
    expect(parseChapter('')).toEqual([]);
    expect(parseChapter(null)).toEqual([]);
    expect(parseChapter('<p>nothing</p>')).toEqual([]);
  });
});

describe("the server function's copies", () => {
  for (const f of ['scriptureRefs.js', 'churchChapter.js']) {
    it(`${f} is identical to the site's`, () => {
      expect(readFileSync(new URL(`../../supabase/functions/scripture-text/${f}`, import.meta.url), 'utf8')).toBe(readFileSync(new URL(`./${f}`, import.meta.url), 'utf8'));
    });
  }
});

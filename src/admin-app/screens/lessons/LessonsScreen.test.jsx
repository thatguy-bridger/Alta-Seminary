// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderInBrowser } from '../../../test/render.js';
import { createLessonsDb } from '../../../test/fakeLessonsDb.js';

const h = vi.hoisted(() => ({ client: null }));
vi.mock('../../../lib/supabase/browser-client', () => ({ get supabaseBrowser() { return h.client; } }));
import { LessonsScreen } from './LessonsScreen.jsx';

const SEGS = [{ start: 1, end: 5, text: 'Hello there.' }, { start: 6, end: 12, text: 'More words.' }];
const text = (id, title, series, extra = {}) => ({ id, kind: 'scripture', title, series, body: 'Some words to read here and now.', minutes: 6, active: true, sort_order: 10, reference: title, ...extra });
const talk = (i) => ({ id: `t${i}`, kind: 'talk', title: `Talk ${String(i).padStart(2, '0')}`, series: 'April 2026 general conference', author: `Elder ${i}`, body: 'Words.', minutes: 12, active: true, sort_order: 1000 + i, thumbnail_url: 'https://www.churchofjesuschrist.org/imgs/abc/full/%21480%2C/0/default' });
const SOURCES = [
  text('s1', 'Alma 5', 'Book of Mormon'), text('s2', 'Genesis 1', 'Old Testament'), text('s3', 'John 3', 'New Testament', { active: false }),
  ...Array.from({ length: 14 }, (_, i) => talk(i + 1)),
  { id: 'v1', kind: 'video', title: 'A good video', series: 'April 2026 general conference', embed_url: 'https://www.youtube.com/watch?v=OJ2pLI0tZvY', duration_seconds: 600, transcript: SEGS, active: false, minutes: 12, sort_order: 6001, pauses: [{ at: 30, question: 'Why?' }] },
  { id: 'v2', kind: 'video', title: 'An unfinished video', series: null, embed_url: null, duration_seconds: null, transcript: null, active: false, minutes: 6, sort_order: 6002 },
  { id: 'p1', kind: 'proclamation', title: 'The Family', series: 'Proclamations', body: 'We proclaim.', one_time: true, active: true, sort_order: 3001 },
];

let mounted;
const tick = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const act = (fn) => React.act(async () => { await fn(); });
const btn = (t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === t);
const tab = (t) => [...document.querySelectorAll('.ls-tab')].find((b) => b.textContent.startsWith(t));
const cards = () => [...document.querySelectorAll('.ls-card')];
const titles = () => cards().map((c) => c.querySelector('.ls-title').textContent);
const card = (title) => cards().find((c) => c.querySelector('.ls-title').textContent === title);
const setVal = async (el, value) => { const proto = { SELECT: HTMLSelectElement, TEXTAREA: HTMLTextAreaElement }[el.tagName] || HTMLInputElement; Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, value); await act(async () => { el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); }); };
const field = (label) => { const l = [...document.querySelectorAll('label')].find((x) => x.textContent.trim().startsWith(label)); return l.htmlFor ? document.getElementById(l.htmlFor) : l.querySelector('input, textarea, select'); };

let db;
async function render(sources = SOURCES) {
  db = createLessonsDb({ sources });
  h.client = db;
  mounted = await renderInBrowser(<LessonsScreen />); await act(() => tick(60));
}
beforeEach(() => { window.scrollTo = () => {}; window.history.replaceState({}, '', '/admin/makeup-work/lessons'); });
afterEach(async () => { await mounted?.unmount(); document.body.innerHTML = ''; vi.restoreAllMocks(); });

describe('the lessons page', () => {
  it('says how many lessons there are, how many are shown, and how many need attention', async () => {
    await render();
    expect(document.body.textContent).toContain(`${SOURCES.length} lessons, 17 shown to students, 1 need attention`);
  });

  it('has a tab for each type, with counts, in a fixed order', async () => {
    await render();
    expect([...document.querySelectorAll('.ls-tab')].map((b) => b.textContent)).toEqual(['All lessons 20', 'Scriptures 3', 'Conference talks 14', 'Videos 2', 'Proclamations 1']);
  });

  it('shows a card for each lesson with its type, picture and name, and marks hidden ones', async () => {
    await render();
    await act(() => tab('Scriptures').click());
    expect(titles()).toEqual(['Genesis 1', 'John 3', 'Alma 5']);                         // the standard works in their usual order
    const c = card('John 3');
    expect(c.querySelector('.ls-badge.type').textContent).toBe('Scripture');
    expect(c.querySelector('.ls-badge.state').textContent).toBe('Hidden');
    expect(c.querySelector('img').getAttribute('src')).toMatch(/^\/makeup\/thumbs\//);   // a painting, since scriptures have no picture of their own
    expect(card('Alma 5').querySelector('.ls-badge.state')).toBeNull();
    await act(() => tab('Videos').click());
    expect(card('A good video').querySelector('img').getAttribute('src')).toBe('https://i.ytimg.com/vi/OJ2pLI0tZvY/hqdefault.jpg');
    await act(() => tab('Conference talks').click());
    expect(cards()[0].querySelector('img').getAttribute('src')).toContain('churchofjesuschrist.org/imgs');
  });

  it('shows what is special about a lesson at a glance', async () => {
    await render();
    await act(() => tab('Videos').click());
    const tags = [...card('A good video').querySelectorAll('.ls-tag')].map((t) => t.textContent);
    expect(tags).toContain('10:00');
    expect(tags).toContain('1 question');
    await act(() => tab('Proclamations').click());
    expect([...card('The Family').querySelectorAll('.ls-tag')].map((t) => t.textContent)).toContain('Once per student');
  });

  it('groups a type into its collections and lets you pick one', async () => {
    await render();
    await act(() => tab('Scriptures').click());
    expect([...document.querySelectorAll('.ls-chipbtn')].map((b) => b.textContent)).toEqual(['All collections', 'Old Testament (1)', 'New Testament (1)', 'Book of Mormon (1)']);
    expect([...document.querySelectorAll('.ls-sechead h3')].map((h3) => h3.textContent)).toEqual(['Old Testament', 'New Testament', 'Book of Mormon']);
    await act(() => [...document.querySelectorAll('.ls-chipbtn')].find((b) => b.textContent.startsWith('New Testament')).click());
    expect(titles()).toEqual(['John 3']);
  });

  it('names the type in each section when looking at everything', async () => {
    await render();
    const heads = [...document.querySelectorAll('.ls-sechead h3')].map((h3) => h3.textContent);
    expect(heads[0]).toBe('Scriptures: Old Testament');
    expect(heads).toContain('Proclamations: Proclamations');
  });

  it('searches titles, speakers and types', async () => {
    await render();
    await setVal(field('Search lessons'), 'elder 7');
    expect(titles()).toEqual(['Talk 07']);
    await setVal(field('Search lessons'), 'alma');
    expect(titles()).toEqual(['Alma 5']);
    await setVal(field('Search lessons'), 'zzzz');
    expect(document.body.textContent).toContain('No lessons match');
    await act(() => btn('Clear filters').click());
    expect(cards().length).toBeGreaterThan(5);
  });

  it('filters by what is shown, hidden, or needs attention', async () => {
    await render();
    await setVal(field('Show'), 'attention');
    expect(titles()).toEqual(['An unfinished video']);
    expect([...card('An unfinished video').querySelectorAll('.ls-tag.warn')].map((t) => t.textContent)).toEqual(['Needs an address', 'Needs a transcript', 'Needs a length']);
    await setVal(field('Show'), 'hidden');
    expect(titles().sort()).toEqual(['A good video', 'An unfinished video', 'John 3'].sort());
  });

  it('shows the first few lessons of a big collection, and the rest on request', async () => {
    await render();
    await act(() => tab('Conference talks').click());
    expect(cards().length).toBe(12);
    await act(() => btn('Show all 14').click());
    expect(cards().length).toBe(14);
  });

  it('shows or hides a lesson, and will not show one that is not finished', async () => {
    await render();
    await act(() => tab('Scriptures').click());
    const sw = card('John 3').querySelector('input[type=checkbox]');
    expect(sw.checked).toBe(false);
    await act(() => sw.click());
    expect(db.tables.makeup_sources.find((r) => r.id === 's3').active).toBe(true);
    await act(() => tab('Videos').click());
    expect(card('An unfinished video').querySelector('input[type=checkbox]').disabled).toBe(true);
    expect(card('A good video').querySelector('input[type=checkbox]').disabled).toBe(false);
  });

  it('can show or hide a whole collection, skipping lessons that are not finished', async () => {
    await render();
    await act(() => tab('Videos').click());
    await act(() => [...document.querySelectorAll('.ls-sechead')].find((s) => s.textContent.includes('April 2026')).querySelectorAll('button')[0].click());   // Show all
    expect(db.tables.makeup_sources.find((r) => r.id === 'v1').active).toBe(true);
    expect(db.tables.makeup_sources.find((r) => r.id === 'v2').active).toBe(false);          // not in that collection anyway
    await act(() => tab('Scriptures').click());
    await act(() => [...document.querySelectorAll('.ls-sechead')].find((s) => s.textContent.includes('Old Testament')).querySelectorAll('button')[1].click());   // Hide all
    expect(db.tables.makeup_sources.find((r) => r.id === 's2').active).toBe(false);
    expect(document.body.textContent).toContain('Hiding 1 lesson.');
  });

  it('a bulk "Show all" leaves unfinished lessons hidden', async () => {
    await render([text('a', 'A', 'Misc'), { id: 'b', kind: 'video', title: 'B', series: 'Misc', active: false, embed_url: null }, { id: 'c', kind: 'video', title: 'C', series: 'Misc', active: false, embed_url: 'https://youtu.be/OJ2pLI0tZvY', duration_seconds: 60, transcript: [{ start: 1, end: 3, text: 'Hi' }] }]);
    await act(() => [...document.querySelectorAll('.ls-sechead')].find((s) => s.textContent.startsWith('Videos')).querySelectorAll('button')[0].click());   // Show all
    expect(db.tables.makeup_sources.find((r) => r.id === 'c').active).toBe(true);                      // the finished one is shown
    expect(db.tables.makeup_sources.find((r) => r.id === 'b').active).toBe(false);                     // the unfinished one is not
    expect(document.body.textContent).toContain('Showing 1 lesson.');
  });

  it('opens a lesson to edit it, and the page address says which', async () => {
    await render();
    await act(() => card('Alma 5').querySelector('.ls-thumb').click());
    await act(() => tick(60));
    expect(document.body.textContent).toContain('← All lessons');
    expect(field('Title').value).toBe('Alma 5');
    expect(window.location.search).toBe('?edit=s1');
  });

  it('opens straight into a lesson from the page address, or a new lesson', async () => {
    window.history.replaceState({}, '', '/admin/makeup-work/lessons?edit=s2');
    await render();
    await act(() => tick(60));
    expect(field('Title').value).toBe('Genesis 1');
    await mounted.unmount(); document.body.innerHTML = '';
    window.history.replaceState({}, '', '/admin/makeup-work/lessons?new=1');
    await render();
    expect(document.querySelector('h2').textContent).toBe('New lesson');
  });

  it('starts a new lesson of the type being looked at', async () => {
    await render();
    await act(() => tab('Videos').click());
    await act(() => btn('+ New lesson').click());
    expect(field('Type').value).toBe('video');
  });

  it('says so when there are no lessons yet', async () => {
    await render([]);
    expect(document.body.textContent).toContain('No lessons yet');
  });
});

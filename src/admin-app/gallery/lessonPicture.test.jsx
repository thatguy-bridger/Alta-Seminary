// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { renderInBrowser } from '../../test/render.js';
import { createGalleryDb, BASE } from '../../test/fakeGalleryDb.js';

const h = vi.hoisted(() => ({ client: null }));
vi.mock('../../lib/supabase/browser-client', () => ({ get supabaseBrowser() { return h.client; } }));
import { registerLessonPicture } from './lessonPicture.js';
import { PicturePicker, pictureValueFor } from '../screens/lessons/PicturePicker.jsx';

const tick = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const act = (fn) => React.act(async () => { await fn(); });
let mounted;
afterEach(async () => { await mounted?.unmount(); document.body.innerHTML = ''; vi.restoreAllMocks(); });

describe('remembering the picture a lesson shows', () => {
  const churchUrl = 'https://www.churchofjesuschrist.org/imgs/abc!480,/full/!480,/0/default';

  it('adds the Church\'s picture for a talk, credited, linked to the talk', async () => {
    const db = createGalleryDb();
    expect(await registerLessonPicture(db, { id: 'L1', kind: 'talk', title: 'Forsake Not Your Own Mercy', thumbnail_url: churchUrl, origin_url: 'https://www.churchofjesuschrist.org/talk' })).toEqual({ added: true });
    expect(db.tables.media_library[0]).toMatchObject({
      url: churchUrl, origin: 'linked', title: 'Forsake Not Your Own Mercy', credit: 'The Church of Jesus Christ of Latter-day Saints',
      license: 'Linked from churchofjesuschrist.org, not copied.', source_url: 'https://www.churchofjesuschrist.org/talk', tags: ['lesson', 'church', 'linked'],
    });
    expect(db.tables.media_library[0].description).toContain('Forsake Not Your Own Mercy');
  });

  it('adds YouTube\'s picture for a video that has none of its own', async () => {
    const db = createGalleryDb();
    await registerLessonPicture(db, { id: 'V1', kind: 'video', title: 'A talk', embed_url: 'https://www.youtube.com/watch?v=OJ2pLI0tZvY', thumbnail_url: null });
    expect(db.tables.media_library[0]).toMatchObject({ url: 'https://i.ytimg.com/vi/OJ2pLI0tZvY/hqdefault.jpg', origin: 'linked', credit: 'YouTube', source_url: 'https://www.youtube.com/watch?v=OJ2pLI0tZvY' });
    expect(db.tables.media_library[0].tags).toEqual(['lesson', 'video', 'youtube', 'linked']);
  });

  it('adds an address pasted in by an admin, without claiming whose it is', async () => {
    const db = createGalleryDb();
    await registerLessonPicture(db, { id: 'L2', kind: 'scripture', title: 'Alma 5', thumbnail_url: 'https://example.org/pic.jpg' });
    expect(db.tables.media_library[0]).toMatchObject({ url: 'https://example.org/pic.jpg', origin: 'linked', credit: '', tags: ['lesson', 'linked'], license: 'Linked from another website, not copied.' });
  });

  it('adds nothing for a painting that comes with the site, or a picture already in the library, and never twice', async () => {
    const db = createGalleryDb({ images: [{ url: `${BASE}makeup/mine.webp`, title: 'Mine', storage_path: 'makeup/mine.webp' }] });
    expect(await registerLessonPicture(db, { id: 'L3', title: 'x', thumbnail_url: '/makeup/thumbs/sermon-bloch.webp' })).toEqual({ added: false });
    expect(await registerLessonPicture(db, { id: 'L4', title: 'x', thumbnail_url: null })).toEqual({ added: false });         // an automatic painting
    expect(await registerLessonPicture(db, { id: 'L5', title: 'x', thumbnail_url: `${BASE}makeup/mine.webp` })).toEqual({ added: false });
    await registerLessonPicture(db, { id: 'L6', title: 'x', thumbnail_url: 'https://example.org/p.jpg' });
    await registerLessonPicture(db, { id: 'L6', title: 'x', thumbnail_url: 'https://example.org/p.jpg' });
    expect(db.tables.media_library).toHaveLength(2);
  });

  it('never throws if the library cannot be reached', async () => {
    const db = createGalleryDb({ fail: { 'media_library.insert': 'nope' } });
    expect(await registerLessonPicture(db, { id: 'L7', title: 'x', thumbnail_url: 'https://example.org/p.jpg' })).toEqual({ added: false });
  });
});

describe('choosing a lesson picture from the gallery', () => {
  it('keeps one of the site\'s lesson paintings as its own path, and anything else by its address', () => {
    const painting = { origin: 'site', source_url: '/makeup/thumbs/sermon-bloch.webp' };
    expect(pictureValueFor(`${BASE}site/makeup/thumbs/sermon-bloch.webp`, painting)).toBe('/makeup/thumbs/sermon-bloch.webp');
    expect(pictureValueFor(`${BASE}site/makeup/art/begin.webp`, { origin: 'site', source_url: '/makeup/art/begin.webp' })).toBe(`${BASE}site/makeup/art/begin.webp`);
    expect(pictureValueFor(`${BASE}pages/a.webp`, { origin: 'uploaded', source_url: null })).toBe(`${BASE}pages/a.webp`);
    expect(pictureValueFor('https://www.churchofjesuschrist.org/x', { origin: 'linked', source_url: 'https://www.churchofjesuschrist.org/talk' })).toBe('https://www.churchofjesuschrist.org/x');
    expect(pictureValueFor('https://x/y', undefined)).toBe('https://x/y');
    expect(pictureValueFor('https://x/y', { origin: 'uploaded', source_url: '/makeup/thumbs/x.webp' })).toBe('https://x/y');      // only an image that came with the site counts
  });

  const IMAGES = [
    { title: 'Old chapel', url: `${BASE}pages/chapel.webp`, storage_path: 'pages/chapel.webp', created_at: '2026-10-04T00:00:00Z' },
    { title: 'Sermon on the Mount, Bloch', origin: 'site', url: `${BASE}site/makeup/thumbs/sermon-bloch.webp`, storage_path: 'site/makeup/thumbs/sermon-bloch.webp', source_url: '/makeup/thumbs/sermon-bloch.webp', created_at: '2026-10-03T00:00:00Z' },
    { title: 'Begin banner', origin: 'site', url: `${BASE}site/makeup/art/begin.webp`, storage_path: 'site/makeup/art/begin.webp', source_url: '/makeup/art/begin.webp', created_at: '2026-10-02T00:00:00Z' },
  ];
  async function openGallery(images = IMAGES) {
    const db = h.client = createGalleryDb({ images });
    const onChange = vi.fn();
    mounted = await renderInBrowser(<PicturePicker lesson={{ id: 'L1', kind: 'scripture', title: 'Alma 5', thumbnail_url: '' }} onChange={onChange} />);
    await act(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Choose from the gallery').click());
    await act(() => tick(80));
    return { db, onChange };
  }
  const tile = (name) => document.querySelector(`[role="dialog"] button[aria-label="Use ${name}"]`);

  it('has a button that opens the gallery, with nothing chosen until something is picked', async () => {
    const { onChange } = await openGallery();
    expect(document.querySelector('[role="dialog"]').getAttribute('aria-label')).toBe('Choose a picture from the gallery');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('uses the address of an uploaded picture, and closes', async () => {
    const { onChange } = await openGallery();
    await act(() => tile('Old chapel').click());
    expect(onChange).toHaveBeenCalledWith(`${BASE}pages/chapel.webp`);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('keeps a lesson painting as its own path, so it is still shown as a painting with its credit', async () => {
    const { onChange } = await openGallery();
    await act(() => tile('Sermon on the Mount, Bloch').click());
    expect(onChange).toHaveBeenCalledWith('/makeup/thumbs/sermon-bloch.webp');
  });

  it('uses the address of a banner painting, which is not one of the lesson paintings', async () => {
    const { onChange } = await openGallery();
    await act(() => tile('Begin banner').click());
    expect(onChange).toHaveBeenCalledWith(`${BASE}site/makeup/art/begin.webp`);
  });
});

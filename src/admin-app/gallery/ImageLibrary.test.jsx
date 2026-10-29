// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderInBrowser } from '../../test/render.js';
import { createGalleryDb, BASE } from '../../test/fakeGalleryDb.js';
import { ConfirmProvider } from '../ConfirmProvider.jsx';

const h = vi.hoisted(() => ({ uploads: [], prepared: [] }));
vi.mock('../imageUpload.js', () => ({
  uploadImageFile: vi.fn(async (file) => { h.uploads.push(file); if (file.name === 'bad.png') throw new Error('not an image'); return `https://x/${file.name}`; }),
  prepareImageFile: vi.fn(async (file) => { h.prepared.push(file); return { blob: { size: 5555 }, width: 800, height: 450 }; }),
}));
import { ImageLibrary } from './ImageLibrary.jsx';

let mounted, db;
const tick = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const act = (fn) => React.act(async () => { await fn(); });
const btn = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
const cards = () => [...document.querySelectorAll('.gl-card')];
const titles = () => cards().map((c) => c.querySelector('.gl-title').textContent);
const status = () => document.querySelector('.gl [role="status"]')?.textContent || '';
const dialog = () => document.querySelector('[role="dialog"]');
const setVal = async (el, value) => {
  const proto = { SELECT: HTMLSelectElement, TEXTAREA: HTMLTextAreaElement }[el.tagName] || HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, value);
  await act(async () => { el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); });
};
const field = (label) => { const l = [...dialog().querySelectorAll('label')].find((x) => x.textContent.trim().startsWith(label)); return document.getElementById(l.htmlFor); };
const search = async (text) => { await setVal(document.querySelector('[aria-label="Search pictures"]'), text); await act(() => tick(380)); };
const select = (label) => document.querySelector(`select[aria-label="${label}"]`);
// the question that was just asked is the topmost dialog (the picture's own dialog is beneath it, and may have a button with the same label)
const confirmBtn = (text) => [...[...document.querySelectorAll('.dialog')].pop().querySelectorAll('button')].find((b) => b.textContent.trim() === text);

const IMAGES = [
  { title: 'Sermon on the Mount, Carl Heinrich Bloch, 1877', tags: ['painting', 'bloch'], origin: 'site', url: `${BASE}site/sermon.webp`, storage_path: 'site/sermon.webp', source_url: '/makeup/thumbs/sermon-bloch.webp', width: 640, height: 360, size_bytes: 26688, credit: 'Carl Heinrich Bloch. Public domain.', created_at: '2026-10-02T00:00:00Z' },
  { title: 'Photo of Maya', alt_text: 'Maya smiling', tags: ['directory', 'council'], url: `${BASE}directory/maya.webp`, storage_path: 'directory/maya.webp', width: 400, height: 400, size_bytes: 30000, created_at: '2026-10-03T00:00:00Z' },
  { title: 'Old chapel', description: 'A stone chapel in winter', tags: ['page'], url: `${BASE}pages/chapel.webp`, storage_path: 'pages/chapel.webp', width: 1200, height: 800, size_bytes: 90000, created_at: '2026-10-04T00:00:00Z' },
  { title: 'Alma 5 talk picture', tags: ['church', 'talk'], origin: 'linked', url: 'https://www.churchofjesuschrist.org/img/alma5', source_url: 'https://www.churchofjesuschrist.org/talk', credit: 'The Church', created_at: '2026-10-05T00:00:00Z' },
  { title: 'Photo old logo', tags: ['site'], url: `${BASE}site/logo.png`, storage_path: 'site/logo.png', origin: 'site', created_at: '2026-10-01T00:00:00Z' },
];
const USAGE = [
  { media_id: 'img-2', area: 'directory', detail: 'Photo', ref_id: 'D1', ref_slug: null, label: 'Maya' },
  { media_id: 'img-3', area: 'page', detail: 'Image on the page', ref_id: 'P1', ref_slug: 'about', label: 'About us' },
  { media_id: 'img-3', area: 'post', detail: 'Cover image', ref_id: 'B1', ref_slug: 'welcome', label: 'Welcome back' },
  { media_id: 'img-1', area: 'lesson', detail: 'Lesson picture', ref_id: 'L1', ref_slug: null, label: 'Alma 5' },
];

async function render(opts = {}) {
  db = createGalleryDb({ images: IMAGES, usage: USAGE, ...opts });
  mounted = await renderInBrowser(<ConfirmProvider><ImageLibrary db={db} /></ConfirmProvider>);
  await act(() => tick(60));
}
beforeEach(() => { h.uploads.length = 0; h.prepared.length = 0; navigator.clipboard = { writeText: vi.fn(async () => {}) }; });
afterEach(async () => { await mounted?.unmount(); document.body.innerHTML = ''; vi.restoreAllMocks(); });

describe('the library', () => {
  it('shows every picture, newest first, with its title, where it came from, whether it is used, and how big it is', async () => {
    await render();
    expect(titles()).toEqual(['Alma 5 talk picture', 'Old chapel', 'Photo of Maya', 'Sermon on the Mount, Carl Heinrich Bloch, 1877', 'Photo old logo']);
    expect(status()).toBe('5 pictures in the library');
    const chapel = cards()[1];
    expect(chapel.textContent).toContain('Uploaded');
    expect(chapel.textContent).toContain('Used in 2 places');
    expect(chapel.textContent).toContain('1200 × 800 · 88 KB');
    expect(cards()[0].textContent).toContain('Linked');
    expect(cards()[0].textContent).toContain('Not used');
    expect(cards()[3].textContent).toContain('Comes with the site');
    expect(cards()[0].querySelector('img').getAttribute('src')).toBe('https://www.churchofjesuschrist.org/img/alma5');
  });

  it('says so when there is nothing yet, or the search fails', async () => {
    db = createGalleryDb();
    mounted = await renderInBrowser(<ConfirmProvider><ImageLibrary db={db} /></ConfirmProvider>); await act(() => tick(60));
    expect(document.body.textContent).toContain('No pictures yet.');
    await mounted.unmount(); document.body.innerHTML = '';
    db = createGalleryDb({ images: IMAGES, fail: { rpc: 'permission denied' } });
    mounted = await renderInBrowser(<ConfirmProvider><ImageLibrary db={db} /></ConfirmProvider>); await act(() => tick(60));
    expect(document.querySelector('[role="alert"]').textContent).toBe("Couldn't load the pictures: permission denied");
    expect(cards()).toHaveLength(0);
  });
});

describe('searching', () => {
  it('finds pictures by the start of a word anywhere in what is known about them, after a short pause in typing', async () => {
    await render();
    await setVal(document.querySelector('[aria-label="Search pictures"]'), 'bloc');
    expect(db.log.filter((l) => l.op === 'search_media_library')).toHaveLength(1);                        // not yet: still typing
    await act(() => tick(380));
    expect(titles()).toEqual(['Sermon on the Mount, Carl Heinrich Bloch, 1877']);
    expect(status()).toBe('1 picture match');
    await search('winter');                                                                                // a word that is only in a description
    expect(titles()).toEqual(['Old chapel']);
    await search('smil');                                                                                  // ...or in the alt text
    expect(titles()).toEqual(['Photo of Maya']);
    await search('church');                                                                                // ...or a tag
    expect(titles()).toEqual(['Alma 5 talk picture']);
  });

  it('searches once for a quick burst of typing, not for every letter', async () => {
    await render();
    const before = db.log.filter((l) => l.op === 'search_media_library').length;
    for (const t of ['c', 'ch', 'chu', 'chur']) await setVal(document.querySelector('[aria-label="Search pictures"]'), t);
    await act(() => tick(380));
    expect(db.log.filter((l) => l.op === 'search_media_library').length - before).toBe(1);
    expect(db.log.filter((l) => l.op === 'search_media_library').pop().args.p_query).toBe('chur');
  });

  it('says when nothing matches, and Clear brings everything back', async () => {
    await render();
    await search('zzzz');
    expect(cards()).toHaveLength(0);
    expect(document.body.textContent).toContain('No picture matches that.');
    expect(status()).toBe('0 pictures match');
    await act(() => btn('Clear').click()); await act(() => tick(380));
    expect(cards()).toHaveLength(5);
    expect(document.querySelector('[aria-label="Search pictures"]').value).toBe('');
    expect(btn('Clear')).toBeUndefined();                                                                  // nothing to clear now
  });

  it('narrows by tag (listed with how many), by where it came from, and by where it is used', async () => {
    await render();
    const tagOptions = [...select('Tag').options].map((o) => o.textContent);
    expect(tagOptions[0]).toBe('All tags');
    expect(tagOptions).toContain('painting (1)');
    expect(tagOptions).toContain('site (1)');
    await setVal(select('Tag'), 'directory'); await act(() => tick(60));
    expect(titles()).toEqual(['Photo of Maya']);
    await setVal(select('Tag'), '');
    await setVal(select('Where it came from'), 'linked'); await act(() => tick(60));
    expect(titles()).toEqual(['Alma 5 talk picture']);
    await setVal(select('Where it came from'), '');
    await setVal(select('Where it is used'), 'unused'); await act(() => tick(60));
    expect(titles()).toEqual(['Alma 5 talk picture', 'Photo old logo']);
    await setVal(select('Where it is used'), 'used'); await act(() => tick(60));
    expect(titles()).toEqual(['Old chapel', 'Photo of Maya', 'Sermon on the Mount, Carl Heinrich Bloch, 1877']);
    await setVal(select('Where it is used'), 'lesson'); await act(() => tick(60));
    expect(titles()).toEqual(['Sermon on the Mount, Carl Heinrich Bloch, 1877']);
    await setVal(select('Where it is used'), 'post'); await act(() => tick(60));
    expect(titles()).toEqual(['Old chapel']);
  });

  it('combines a word with filters', async () => {
    await render();
    await setVal(select('Where it is used'), 'used');
    await search('photo');
    expect(titles()).toEqual(['Photo of Maya']);                                                           // "Photo old logo" is not used
  });

  it('shows pictures a page at a time, and the rest on request, with no repeats', async () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ url: `${BASE}m/${i}.webp`, storage_path: `m/${i}.webp`, title: `Picture ${String(i).padStart(2, '0')}`, created_at: `2026-09-01T00:${String(i).padStart(2, '0')}:00Z` }));
    await render({ images: many, usage: [] });
    expect(cards()).toHaveLength(48);
    expect(btn('Show more (2 left)')).toBeTruthy();
    await act(() => btn('Show more (2 left)').click()); await act(() => tick(60));
    expect(cards()).toHaveLength(50);
    expect(new Set(titles()).size).toBe(50);
    expect(btn('Show more (0 left)')).toBeUndefined();
    expect(document.body.textContent).not.toContain('Show more');
  });

  it('never lets a slow, older search replace a newer answer', async () => {
    await render();
    const real = db.rpc;
    let release;
    db.rpc = async (name, args) => {
      if (args.p_query === 'maya') { await new Promise((r) => { release = r; }); }                        // the first search is slow
      return real(name, args);
    };
    await setVal(document.querySelector('[aria-label="Search pictures"]'), 'maya'); await act(() => tick(380));
    await setVal(document.querySelector('[aria-label="Search pictures"]'), 'chapel'); await act(() => tick(380));
    expect(titles()).toEqual(['Old chapel']);
    await act(async () => { release(); await tick(30); });                                                // the slow one finally answers
    expect(titles()).toEqual(['Old chapel']);                                                              // and is ignored
  });
});

describe('one picture', () => {
  const open = async (title) => { await act(() => cards().find((c) => c.querySelector('.gl-title').textContent === title).click()); await act(() => tick(60)); };

  it('opens with what is known, and where it is used, linked to where it can be changed', async () => {
    await render();
    await open('Old chapel');
    expect(dialog().getAttribute('aria-label')).toBe('Old chapel');
    expect(field('Title').value).toBe('Old chapel');
    expect(field('Description').value).toBe('A stone chapel in winter');
    expect(field('Tags').value).toBe('page');
    expect(dialog().textContent).toContain('Used in 2 places');
    expect(dialog().textContent).toContain('1200 × 800 · 88 KB');
    const links = [...dialog().querySelectorAll('.gl-usage a')];
    expect(links.map((a) => a.textContent)).toEqual(['About us', 'Welcome back']);
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/admin/pages/edit?slug=about', '/admin/posts/edit?slug=welcome']);
    expect(dialog().querySelector('.gl-usage').textContent).toContain('Pages');
    expect(dialog().querySelector('.gl-usage').textContent).toContain('Announcements');
    expect(dialog().querySelector('input[readonly]').value).toBe(`${BASE}pages/chapel.webp`);
    await act(() => btn('Close').click());
    expect(dialog()).toBeNull();
  });

  it('says when nothing uses it, and for a link, where it came from', async () => {
    await render();
    await open('Alma 5 talk picture');
    expect(dialog().textContent).toContain('Nothing uses this picture yet.');
    expect(dialog().textContent).toContain('Linked from another website, not copied.');
    expect(dialog().querySelector('a[href="https://www.churchofjesuschrist.org/talk"]')).not.toBeNull();
    expect(btn('Remove this link')).toBeTruthy();
    expect(btn('Replace the picture')).toBeUndefined();                                                    // it is not ours to replace
  });

  it('saves the title, alt text, description, tags, credit and permission, and the list shows the change', async () => {
    await render();
    await open('Old chapel');
    expect(btn('Save').disabled).toBe(true);                                                               // nothing has changed
    await setVal(field('Title'), 'The old chapel in winter');
    await setVal(field('Alt text'), 'A stone chapel with snow on its roof');
    await setVal(field('Tags'), 'Chapel, winter, page');
    await setVal(field('Credit'), 'Maya');
    await setVal(field('Permission or licence'), 'Taken by us');
    expect(btn('Save').disabled).toBe(false);
    await act(() => btn('Save').click()); await act(() => tick(60));
    expect(db.tables.media_library.find((r) => r.url === `${BASE}pages/chapel.webp`)).toMatchObject({
      title: 'The old chapel in winter', alt_text: 'A stone chapel with snow on its roof', tags: ['chapel', 'page', 'winter'], credit: 'Maya', license: 'Taken by us',
    });
    expect(dialog().textContent).toContain('Saved.');
    expect(btn('Save').disabled).toBe(true);
    await act(() => btn('Close').click());
    expect(titles()).toContain('The old chapel in winter');
    expect([...select('Tag').options].map((o) => o.value)).toContain('chapel');                           // the new tag can be filtered on
    await search('snow');
    expect(titles()).toEqual(['The old chapel in winter']);                                                // and the new words can be searched
  });

  it('will not save what is too long, and says which field', async () => {
    await render();
    await open('Old chapel');
    await setVal(field('Title'), 'x'.repeat(201));
    expect(dialog().textContent).toContain('Keep this to 200 characters or fewer');
    expect(btn('Save').disabled).toBe(true);
    await setVal(field('Title'), 'x'.repeat(200));
    expect(btn('Save').disabled).toBe(false);
  });

  it('keeps what was typed and says so when the save fails', async () => {
    await render({ fail: { 'media_library.update': 'row level security' } });
    await open('Old chapel');
    await setVal(field('Title'), 'Changed');
    await act(() => btn('Save').click()); await act(() => tick(60));
    expect(dialog().textContent).toContain("Couldn't save: row level security");
    expect(field('Title').value).toBe('Changed');
    expect(btn('Save').disabled).toBe(false);
  });

  it('suggests tags used elsewhere, and adds one when it is tapped', async () => {
    await render();
    await open('Old chapel');
    const chips = [...dialog().querySelectorAll('[aria-label="Tags used elsewhere"] button')].map((b) => b.textContent);
    expect(chips).toContain('painting');
    expect(chips).not.toContain('page');                                                                   // already on this picture
    await act(() => [...dialog().querySelectorAll('[aria-label="Tags used elsewhere"] button')].find((b) => b.textContent === 'painting').click());
    expect(field('Tags').value).toBe('page, painting');
  });

  it('copies the address', async () => {
    await render();
    await open('Old chapel');
    await act(() => btn('Copy').click());
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${BASE}pages/chapel.webp`);
    expect(dialog().textContent).toContain('Address copied.');
  });
});

describe('removing a picture', () => {
  const open = async (title) => { await act(() => cards().find((c) => c.querySelector('.gl-title').textContent === title).click()); await act(() => tick(60)); };

  it('is not possible while anything uses it, and says what to do', async () => {
    await render();
    await open('Old chapel');
    expect(btn('Delete').disabled).toBe(true);
    expect(dialog().textContent).toContain('To delete this picture, first stop using it in the places above.');
    expect(db.files.size).toBe(0);
  });

  it('asks first, and then deletes the file and the entry of a picture nothing uses', async () => {
    await render();
    db.files.set('site/logo.png', { blob: {} });
    await open('Photo old logo');
    expect(btn('Delete').disabled).toBe(false);
    await act(() => btn('Delete').click()); await act(() => tick(30));
    expect(document.body.textContent).toContain('The picture file is deleted and cannot be brought back.');
    await act(() => confirmBtn('Cancel').click()); await act(() => tick(30));
    expect(db.tables.media_library).toHaveLength(5);                                                       // cancelled: nothing happened
    await act(() => btn('Delete').click()); await act(() => tick(30));
    await act(() => confirmBtn('Delete').click()); await act(() => tick(60));
    expect(db.files.has('site/logo.png')).toBe(false);
    expect(db.tables.media_library.map((r) => r.title)).not.toContain('Photo old logo');
    expect(titles()).not.toContain('Photo old logo');
    expect(dialog()).toBeNull();
    expect(status()).toBe('4 pictures in the library');
  });

  it('removes only the link for a picture on another website', async () => {
    await render();
    await open('Alma 5 talk picture');
    await act(() => btn('Remove this link').click()); await act(() => tick(30));
    expect(document.body.textContent).toContain('Nothing changes on the other website.');
    await act(() => confirmBtn('Remove').click()); await act(() => tick(60));
    expect(db.log.some((l) => l.op === 'remove')).toBe(false);
    expect(titles()).not.toContain('Alma 5 talk picture');
  });

  it('reports a failure and keeps the picture in the list', async () => {
    await render({ fail: { 'storage.remove': 'storage is down' } });
    await open('Photo old logo');
    await act(() => btn('Delete').click()); await act(() => tick(30));
    await act(() => confirmBtn('Delete').click()); await act(() => tick(60));
    expect(dialog().textContent).toContain("Couldn't remove it: storage is down");
    expect(titles()).toContain('Photo old logo');
  });
});

describe('replacing the picture itself', () => {
  const open = async (title) => { await act(() => cards().find((c) => c.querySelector('.gl-title').textContent === title).click()); await act(() => tick(60)); };
  const choose = async (name = 'new.jpg') => {
    const input = dialog().querySelector('input[type="file"]');
    Object.defineProperty(input, 'files', { configurable: true, value: [{ name, type: 'image/jpeg' }] });
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); await tick(40); });
  };

  it('warns first when the picture is used, naming where, and does nothing if cancelled', async () => {
    await render();
    await open('Old chapel');
    await act(() => btn('Replace the picture').click());
    await choose();
    expect(document.body.textContent).toContain('This picture is used in 2 places (About us, Welcome back).');
    expect(document.body.textContent).toContain('in all of them right away');
    await act(() => confirmBtn('Cancel').click()); await act(() => tick(40));
    expect(db.files.size).toBe(0);
    expect(db.tables.media_library.find((r) => r.title === 'Old chapel').width).toBe(1200);
  });

  it('stores the new picture at the same address once confirmed, and records its new size', async () => {
    await render();
    await open('Old chapel');
    await choose();
    await act(() => confirmBtn('Replace it').click()); await act(() => tick(80));
    expect(db.files.get('pages/chapel.webp')).toMatchObject({ upsert: true, contentType: 'image/webp' });
    const row = db.tables.media_library.find((r) => r.title === 'Old chapel');
    expect(row).toMatchObject({ url: `${BASE}pages/chapel.webp`, width: 800, height: 450, size_bytes: 5555 });
    expect(dialog().textContent).toContain('Replaced. The new picture is in place everywhere this one was used.');
    expect(dialog().querySelector('img').getAttribute('src')).toMatch(/pages\/chapel\.webp\?v=\d+/);       // the preview reloads
    await act(() => btn('Close').click());
    expect(cards().find((c) => c.querySelector('.gl-title').textContent === 'Old chapel').textContent).toContain('800 × 450');
  });

  it('does not ask when nothing uses it', async () => {
    await render({ usage: [] });
    await open('Old chapel');
    await choose();
    expect(document.body.textContent).not.toContain('Replace this picture everywhere?');
    expect(db.files.get('pages/chapel.webp')).toBeTruthy();
  });

  it('is only offered for a picture of ours that can be replaced in place', async () => {
    await render();
    await open('Photo old logo');                                                                          // a .png
    expect(btn('Replace the picture')).toBeUndefined();
  });

  it('reports a failure and leaves the picture as it was', async () => {
    await render({ fail: { 'storage.upload': 'file too large' }, usage: [] });
    await open('Old chapel');
    await choose();
    expect(dialog().textContent).toContain("Couldn't replace it: file too large");
    expect(db.tables.media_library.find((r) => r.title === 'Old chapel').width).toBe(1200);
  });
});

describe('adding pictures', () => {
  const pick = async (files) => {
    const input = document.querySelector('input[aria-label="Choose pictures to add"]');
    Object.defineProperty(input, 'files', { configurable: true, value: files });
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); await tick(80); });
  };

  it('uploads each picture to the library and says how many were added', async () => {
    await render();
    await pick([{ name: 'a.jpg', type: 'image/jpeg' }, { name: 'b.jpg', type: 'image/jpeg' }]);
    expect(h.uploads.map((f) => f.name)).toEqual(['a.jpg', 'b.jpg']);
    expect(status()).toBe('Added 2 pictures. Open one to describe it.');
  });

  it('says which could not be added, and still adds the rest', async () => {
    await render();
    await pick([{ name: 'a.jpg', type: 'image/jpeg' }, { name: 'bad.png', type: 'image/png' }]);
    expect(status()).toBe('Added 1 picture. Open one to describe it. bad.png: not an image');
    expect(document.querySelector('.gl [role="status"]').style.color).toContain('error');
  });

  it('reloads the list afterwards, from the start', async () => {
    await render();
    const before = db.log.filter((l) => l.op === 'search_media_library').length;
    await pick([{ name: 'a.jpg', type: 'image/jpeg' }]);
    await act(() => tick(60));
    expect(db.log.filter((l) => l.op === 'search_media_library').length).toBeGreaterThan(before);
  });
});

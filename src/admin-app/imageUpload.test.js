import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { createGalleryDb, BASE } from '../test/fakeGalleryDb.js';

const h = vi.hoisted(() => ({ client: null }));
vi.mock('../lib/supabase/browser-client', () => ({ get supabaseBrowser() { return h.client; } }));
import { uploadImageBlob, uploadImageFile, defaultImageMeta, blobSize } from './imageUpload.js';

const blob = (size = 4000) => ({ size, type: 'image/webp' });
const rows = (db) => db.tables.media_library;
const upserts = (db) => db.log.filter((l) => l.table === 'media_library' && l.op === 'upsert');

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); delete globalThis.createImageBitmap; });

describe('every upload lands in the image library', () => {
  it('puts the file in the images bucket and registers it, with what is known about it', async () => {
    const db = h.client = createGalleryDb();
    const url = await uploadImageBlob(blob(4321), 'pages/abc', { width: 800, height: 450 });
    const path = [...db.files.keys()][0];
    expect(path).toMatch(/^pages\/abc\/[0-9a-f-]{36}\.webp$/);
    expect(db.files.get(path).contentType).toBe('image/webp');
    expect(url).toBe(BASE + path);
    expect(rows(db)).toHaveLength(1);
    expect(rows(db)[0]).toMatchObject({
      url, storage_path: path, origin: 'uploaded', uploaded_by: 'user-1', mime_type: 'image/webp', size_bytes: 4321, width: 800, height: 450,
      title: 'Page image', tags: ['page'], alt_text: '', credit: '',
    });
  });

  it('waits for the registration, so the image is findable the moment the upload finishes', async () => {
    const db = h.client = createGalleryDb();
    await uploadImageBlob(blob(), 'directory/council', { width: 1, height: 1 });
    expect(rows(db)).toHaveLength(1);                                                                   // already there when it returned
    expect([...rows(db)[0].tags].sort()).toEqual(['council', 'directory']);                             // (the database keeps tags in alphabetical order)
  });

  it('lets the caller say what the picture is', async () => {
    const db = h.client = createGalleryDb();
    await uploadImageBlob(blob(), 'pages/abc', { width: 10, height: 10, title: 'The old chapel', alt_text: 'A stone chapel in snow', credit: 'Maya', tags: ['Winter', 'page'] });
    expect(rows(db)[0]).toMatchObject({ title: 'The old chapel', alt_text: 'A stone chapel in snow', credit: 'Maya' });
    expect([...rows(db)[0].tags].sort()).toEqual(['page', 'winter']);                                  // lower case, and "page" is not repeated
  });

  it('fills in the details of the entry the database already made, instead of adding a second', async () => {
    const db = h.client = createGalleryDb({ registerUploads: true });                                   // the bucket trigger registers it first
    const url = await uploadImageBlob(blob(777), 'posts/xyz', { width: 640, height: 360 });
    expect(rows(db)).toHaveLength(1);
    expect(rows(db)[0]).toMatchObject({ url, title: 'Announcement image', tags: ['announcement'], width: 640, height: 360, size_bytes: 777 });
    expect(upserts(db)).toHaveLength(1);
  });

  it('registers an upload made by someone the database cannot name, without an uploader', async () => {
    const db = h.client = createGalleryDb({ user: null });
    await uploadImageBlob(blob(), 'misc', { width: 1, height: 1 });
    expect(rows(db)[0].uploaded_by).toBeNull();
  });

  it('never fails an upload because the library could not be told: the picture is already live', async () => {
    const db = h.client = createGalleryDb({ fail: { 'media_library.upsert': 'row level security' } });
    const url = await uploadImageBlob(blob(), 'pages/abc', { width: 1, height: 1 });
    expect(url).toBe(BASE + [...db.files.keys()][0]);
    expect(console.error).toHaveBeenCalledWith('image library registration failed:', 'row level security');
    const down = h.client = createGalleryDb();
    down.auth.getUser = async () => { throw new Error('network'); };
    expect(await uploadImageBlob(blob(), 'pages/abc', { width: 1, height: 1 })).toMatch(/^https:/);
  });

  it('fails, and registers nothing, when the file itself could not be uploaded', async () => {
    const db = h.client = createGalleryDb({ fail: { 'storage.upload': 'file too large' } });
    await expect(uploadImageBlob(blob(), 'pages/abc')).rejects.toMatchObject({ message: 'file too large' });
    expect(rows(db)).toHaveLength(0);
  });

  it('reads the size from the picture when the caller has no size, if the browser can', async () => {
    const db = h.client = createGalleryDb();
    globalThis.createImageBitmap = vi.fn(async () => ({ width: 1200, height: 675, close: vi.fn() }));
    await uploadImageBlob(blob(), 'pages/abc');
    expect(rows(db)[0]).toMatchObject({ width: 1200, height: 675 });
    expect(await blobSize(blob())).toEqual({ width: 1200, height: 675 });
    globalThis.createImageBitmap = vi.fn(async () => { throw new Error('cannot decode'); });
    expect(await blobSize(blob())).toBeNull();
    delete globalThis.createImageBitmap;
    expect(await blobSize(blob())).toBeNull();
    const db2 = h.client = createGalleryDb();
    await uploadImageBlob(blob(), 'pages/abc');
    expect(rows(db2)[0]).toMatchObject({ width: null, height: null });                                  // missing is fine: it is only information
  });

  it('only accepts pictures when given a file', async () => {
    const db = h.client = createGalleryDb();
    await expect(uploadImageFile({ type: 'application/pdf' }, 'pages/abc')).rejects.toThrow('Please choose an image file.');
    await expect(uploadImageFile(null)).rejects.toThrow('Please choose an image file.');
    expect(db.files.size).toBe(0);
    expect(rows(db)).toHaveLength(0);
  });
});

describe('what an upload is called before anyone describes it', () => {
  it('comes from where in the site it was put', () => {
    expect(defaultImageMeta('pages/abc')).toEqual({ title: 'Page image', tags: ['page'] });
    expect(defaultImageMeta('posts/abc')).toEqual({ title: 'Announcement image', tags: ['announcement'] });
    expect(defaultImageMeta('blog_posts/abc')).toEqual({ title: 'Announcement image', tags: ['announcement'] });
    expect(defaultImageMeta('events/abc')).toEqual({ title: 'Event image', tags: ['event'] });
    expect(defaultImageMeta('directory/council')).toEqual({ title: 'Directory photo', tags: ['directory', 'council'] });
    expect(defaultImageMeta('directory')).toEqual({ title: 'Directory photo', tags: ['directory'] });
    expect(defaultImageMeta('gallery/unsorted')).toEqual({ title: 'Album photo', tags: ['gallery'] });
    expect(defaultImageMeta('makeup')).toEqual({ title: 'Lesson picture', tags: ['lesson'] });
    expect(defaultImageMeta('site/chrome')).toEqual({ title: 'Site image', tags: ['site'] });
    expect(defaultImageMeta('misc')).toEqual({ title: 'Uploaded image', tags: ['uploaded'] });
    expect(defaultImageMeta()).toEqual({ title: 'Uploaded image', tags: ['uploaded'] });
  });
});

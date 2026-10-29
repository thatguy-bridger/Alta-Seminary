import { describe, it, expect } from 'vitest';
import { createGalleryDb, BASE } from '../../test/fakeGalleryDb.js';
import {
  parseTags, tagsText, validateDraft, draftFromImage, rowFromDraft, sameDraft, imageName, fileSizeLabel, factsLine, usageLabel, usageHref, groupUsage,
  searchImages, loadTags, loadUsage, saveDescription, deleteImage, canReplaceFile, replaceImageFile, ensureInLibrary, PAGE_SIZE, LIMITS,
} from './imageLibrary.js';

const img = (over = {}) => ({ url: `${BASE}pages/a/x.webp`, storage_path: 'pages/a/x.webp', title: 'Garden at dawn', ...over });
const blob = (n = 1200) => ({ size: n });

describe('describing an image', () => {
  it('turns what is typed into tags: lower case, no blanks or repeats, alphabetical, short, at most twenty', () => {
    expect(parseTags('  Painting, Bloch ,, painting; Savior\nGarden ')).toEqual(['bloch', 'garden', 'painting', 'savior']);
    expect(parseTags('')).toEqual([]);
    expect(parseTags(null)).toEqual([]);
    expect(parseTags('x'.repeat(60))).toEqual(['x'.repeat(LIMITS.tag)]);
    expect(parseTags(Array.from({ length: 30 }, (_, i) => `t${String(i).padStart(2, '0')}`).join(','))).toHaveLength(LIMITS.tags);
    expect(tagsText(['a', 'b'])).toBe('a, b');
    expect(tagsText(undefined)).toBe('');
  });

  it('keeps what is typed and what is saved the same shape, and knows when nothing changed', () => {
    const item = { title: 'Dawn', alt_text: 'A garden at dawn', description: '', tags: ['garden', 'painting'], credit: 'Bloch', license: 'Public domain' };
    const d = draftFromImage(item);
    expect(d).toEqual({ title: 'Dawn', alt_text: 'A garden at dawn', description: '', tagsText: 'garden, painting', credit: 'Bloch', license: 'Public domain' });
    expect(rowFromDraft({ ...d, title: '  Dawn  ', tagsText: 'Painting, garden' })).toEqual(item);
    expect(sameDraft(d, { ...d, title: ' Dawn ', tagsText: 'painting,garden' })).toBe(true);        // only spacing and order differ
    expect(sameDraft(d, { ...d, credit: 'Hofmann' })).toBe(false);
    expect(draftFromImage({})).toEqual({ title: '', alt_text: '', description: '', tagsText: '', credit: '', license: '' });
  });

  it('says what is too long before the database has to, and counts tags the way it will', () => {
    const ok = draftFromImage({ title: 'Fine' });
    expect(validateDraft(ok)).toEqual({ ok: true, errors: {} });
    const bad = validateDraft({ ...ok, title: 'x'.repeat(LIMITS.title + 1), alt_text: 'y'.repeat(LIMITS.alt_text + 1) });
    expect(bad.ok).toBe(false);
    expect(Object.keys(bad.errors).sort()).toEqual(['alt_text', 'title']);
    expect(bad.errors.title).toContain('200');
    expect(validateDraft({ ...ok, tagsText: 'z'.repeat(41) }).errors.tagsText).toContain('40');
    const many = Array.from({ length: 21 }, (_, i) => `tag${i}`).join(', ');
    expect(validateDraft({ ...ok, tagsText: many }).errors.tagsText).toContain('20');
    expect(validateDraft({ ...ok, tagsText: 'Alpha, alpha, ALPHA' }).ok).toBe(true);                // repeats are one tag
    expect(validateDraft({ ...ok, title: 'x'.repeat(LIMITS.title) }).ok).toBe(true);                 // exactly at the limit
  });

  it('names an image, says how big it is, and how much it is used', () => {
    expect(imageName({ title: 'Dawn' })).toBe('Dawn');
    expect(imageName({ title: '' })).toBe('Untitled image');
    expect(fileSizeLabel(512)).toBe('512 B');
    expect(fileSizeLabel(26688)).toBe('26 KB');
    expect(fileSizeLabel(1572864)).toBe('1.5 MB');
    expect(fileSizeLabel(null)).toBe('');
    expect(fileSizeLabel(-1)).toBe('');
    expect(factsLine({ width: 640, height: 360, size_bytes: 26688 })).toBe('640 × 360 · 26 KB');
    expect(factsLine({ size_bytes: 26688 })).toBe('26 KB');
    expect(factsLine({})).toBe('');
    expect(usageLabel(0)).toBe('Not used anywhere yet');
    expect(usageLabel(1)).toBe('Used in 1 place');
    expect(usageLabel(3)).toBe('Used in 3 places');
  });
});

describe('where an image is used', () => {
  const rows = [
    { area: 'lesson', detail: 'Lesson picture', ref_id: 'L1', ref_slug: null, label: 'Alma 5' },
    { area: 'page', detail: 'Image on the page', ref_id: 'P1', ref_slug: 'about-us', label: 'About us' },
    { area: 'page', detail: 'Social share image', ref_id: 'P2', ref_slug: 'home', label: 'Home' },
    { area: 'post', detail: 'Cover image', ref_id: 'B1', ref_slug: 'welcome back', label: 'Welcome back' },
    { area: 'directory', detail: 'Photo', ref_id: 'D1', ref_slug: null, label: 'Maya' },
    { area: 'site', detail: 'Site header or footer', ref_id: 'site', ref_slug: null, label: 'Site header and footer' },
  ];

  it('links to where each use can be edited', () => {
    expect(usageHref(rows[1])).toBe('/admin/pages/edit?slug=about-us');
    expect(usageHref(rows[3])).toBe('/admin/posts/edit?slug=welcome%20back');
    expect(usageHref({ area: 'event', ref_slug: 'bbq' })).toBe('/admin/events/edit?slug=bbq');
    expect(usageHref(rows[0])).toBe('/admin/makeup-work/lessons?edit=L1');
    expect(usageHref(rows[4])).toBe('/admin/directory');
    expect(usageHref({ area: 'gallery' })).toBe('/admin/gallery');
    expect(usageHref(rows[5])).toBe('/admin/site-chrome');
    expect(usageHref({ area: 'unknown' })).toBe('/admin');
  });

  it('groups the uses by part of the site, in a fixed order, leaving out parts that do not use it', () => {
    const groups = groupUsage(rows);
    expect(groups.map((g) => g.label)).toEqual(['Pages', 'Announcements', 'Directory', 'Makeup lessons', 'Site header and footer']);
    expect(groups[0].places.map((p) => `${p.label} (${p.detail})`)).toEqual(['About us (Image on the page)', 'Home (Social share image)']);
    expect(groups[0].places[0].href).toBe('/admin/pages/edit?slug=about-us');
    expect(groupUsage([])).toEqual([]);
    expect(groupUsage(null)).toEqual([]);
    expect(groupUsage([{ area: 'page', ref_id: 'x', detail: '', label: '' }])[0].places[0].label).toBe('(untitled)');
  });
});

describe('searching', () => {
  const library = () => createGalleryDb({
    images: [
      { title: 'Sermon on the Mount, Carl Heinrich Bloch, 1877', tags: ['painting', 'bloch'], origin: 'site', url: `${BASE}site/a.webp`, created_at: '2026-10-02T00:00:00Z' },
      { title: 'Christ in Gethsemane, Heinrich Hofmann', tags: ['painting', 'hofmann'], origin: 'site', url: `${BASE}site/b.webp`, created_at: '2026-10-03T00:00:00Z' },
      { title: 'Photo of Maya', tags: ['directory', 'council'], url: `${BASE}directory/c.webp`, created_at: '2026-10-04T00:00:00Z' },
      { title: 'Talk picture', description: 'The picture the Church shows for a talk by Elder Bloch', origin: 'linked', tags: ['church', 'talk'], url: 'https://www.churchofjesuschrist.org/x', created_at: '2026-10-05T00:00:00Z' },
    ],
    usage: [{ media_id: 'img-3', area: 'directory', detail: 'Photo', ref_id: 'D1', label: 'Maya' }],
  });

  it('finds an image by the start of any word, in its title, tags or description', async () => {
    const db = library();
    expect((await searchImages(db, { query: 'bloc' })).items.map((i) => i.title)).toEqual(['Sermon on the Mount, Carl Heinrich Bloch, 1877', 'Talk picture']);   // the title match ranks above the description match
    expect((await searchImages(db, { query: 'gethsem' })).items).toHaveLength(1);
    expect((await searchImages(db, { query: 'council' })).items).toHaveLength(1);
    expect((await searchImages(db, { query: 'zzz' })).items).toEqual([]);
  });

  it('wants every word to match, and ignores case and punctuation', async () => {
    const db = library();
    expect((await searchImages(db, { query: 'HEINRICH painting' })).total).toBe(2);
    expect((await searchImages(db, { query: 'heinrich bloch' })).total).toBe(1);
    expect((await searchImages(db, { query: '  Bloch!! ' })).total).toBe(2);
    expect((await searchImages(db, { query: '' })).total).toBe(4);
    expect((await searchImages(db, { query: '   ' })).total).toBe(4);
  });

  it('narrows by tag, where it came from, and whether it is used, and says how many there are in all', async () => {
    const db = library();
    expect((await searchImages(db, { tag: 'painting' })).total).toBe(2);
    expect((await searchImages(db, { origin: 'linked' })).items.map((i) => i.title)).toEqual(['Talk picture']);
    expect((await searchImages(db, { use: 'used' })).items.map((i) => i.title)).toEqual(['Photo of Maya']);
    expect((await searchImages(db, { use: 'unused' })).total).toBe(3);
    expect((await searchImages(db, { area: 'directory' })).total).toBe(1);
    expect((await searchImages(db, { area: 'lesson' })).total).toBe(0);
    expect((await searchImages(db, { query: 'bloch', tag: 'painting', origin: 'site' })).total).toBe(1);
  });

  it('newest first when nothing was typed, with the use count on each, and in pages', async () => {
    const db = library();
    const first = await searchImages(db, {});
    expect(first.items.map((i) => i.title)).toEqual(['Talk picture', 'Photo of Maya', 'Christ in Gethsemane, Heinrich Hofmann', 'Sermon on the Mount, Carl Heinrich Bloch, 1877']);
    expect(first.items.find((i) => i.title === 'Photo of Maya').usage_count).toBe(1);
    expect('total_count' in first.items[0]).toBe(false);
    const many = createGalleryDb({ images: Array.from({ length: PAGE_SIZE + 5 }, (_, i) => ({ url: `${BASE}${i}.webp`, title: `Image ${i}`, created_at: `2026-10-01T00:${String(i).padStart(2, '0')}:00Z` })) });
    const one = await searchImages(many, { page: 0 });
    const two = await searchImages(many, { page: 1 });
    expect(one.items).toHaveLength(PAGE_SIZE);
    expect(two.items).toHaveLength(5);
    expect(one.total).toBe(PAGE_SIZE + 5);
    expect(new Set([...one.items, ...two.items].map((i) => i.id)).size).toBe(PAGE_SIZE + 5);          // no repeats across pages
    expect(many.log.filter((l) => l.op === 'search_media_library').map((l) => l.args.p_offset)).toEqual([0, PAGE_SIZE]);
  });

  it('sends no filter at all for an empty one, and reports a failure instead of throwing', async () => {
    const db = library();
    await searchImages(db, { query: ' x ', tag: '', origin: '', use: '', area: '' });
    expect(db.log.find((l) => l.table === 'rpc').args).toEqual({ p_query: 'x', p_tag: null, p_origin: null, p_use: null, p_area: null, p_limit: PAGE_SIZE, p_offset: 0 });
    const broken = createGalleryDb({ fail: { rpc: 'permission denied' } });
    expect(await searchImages(broken, {})).toEqual({ items: [], total: 0, error: 'permission denied' });
  });

  it('lists the tags with how many images carry each, most used first', async () => {
    const tags = await loadTags(library());
    expect(tags[0]).toEqual({ tag: 'painting', n: 2 });
    expect(tags.map((t) => t.tag)).toContain('council');
    expect(await loadTags(createGalleryDb())).toEqual([]);
  });
});

describe('saving what is known about an image', () => {
  it('writes only the descriptive fields, tidied, to that one image', async () => {
    const db = createGalleryDb({ images: [img(), img({ url: `${BASE}other.webp`, title: 'Other' })] });
    const { error } = await saveDescription(db, 'img-1', { title: ' Dawn ', alt_text: 'A garden', description: '', tagsText: 'Garden, garden, Painting', credit: ' Bloch ', license: '' });
    expect(error).toBe('');
    const update = db.log.find((l) => l.op === 'update');
    expect(update.payload).toEqual({ title: 'Dawn', alt_text: 'A garden', description: '', tags: ['garden', 'painting'], credit: 'Bloch', license: '' });
    expect(update.ids).toEqual(['img-1']);
    expect(Object.keys(update.payload)).not.toContain('url');                                         // an image's address is never part of a save
    expect(db.tables.media_library[1].title).toBe('Other');
  });

  it('reports a failure', async () => {
    const db = createGalleryDb({ images: [img()], fail: { 'media_library.update': 'row level security' } });
    expect((await saveDescription(db, 'img-1', draftFromImage({ title: 'x' }))).error).toBe('row level security');
  });
});

describe('removing an image', () => {
  const used = [{ media_id: 'img-1', area: 'page', detail: 'Image on the page', ref_id: 'P1', ref_slug: 'about', label: 'About' }];

  it('refuses while anything uses it, and removes nothing', async () => {
    const db = createGalleryDb({ images: [img()], usage: used });
    db.files.set('pages/a/x.webp', { blob: blob() });
    const result = await deleteImage(db, db.tables.media_library[0]);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('It is used in 1 place, so it cannot be removed.');
    expect(result.usage).toHaveLength(1);
    expect(db.files.has('pages/a/x.webp')).toBe(true);
    expect(db.tables.media_library).toHaveLength(1);
  });

  it('removes the file and the entry when nothing uses it', async () => {
    const db = createGalleryDb({ images: [img(), img({ url: `${BASE}keep.webp`, storage_path: 'keep.webp' })] });
    db.files.set('pages/a/x.webp', { blob: blob() });
    expect((await deleteImage(db, db.tables.media_library[0])).ok).toBe(true);
    expect(db.files.has('pages/a/x.webp')).toBe(false);
    expect(db.tables.media_library.map((r) => r.storage_path)).toEqual(['keep.webp']);
    expect(db.log.some((l) => l.op === 'remove' && l.paths[0] === 'pages/a/x.webp')).toBe(true);
  });

  it('removes only the entry for a link, since there is no file of ours', async () => {
    const db = createGalleryDb({ images: [{ url: 'https://example.org/a.jpg', origin: 'linked', title: 'Elsewhere' }] });
    expect((await deleteImage(db, db.tables.media_library[0])).ok).toBe(true);
    expect(db.log.some((l) => l.op === 'remove')).toBe(false);
    expect(db.tables.media_library).toHaveLength(0);
  });

  it('checks again at the moment of removing, in case it has been put to use since the screen was opened', async () => {
    const db = createGalleryDb({ images: [img()] });
    const stale = { ...db.tables.media_library[0] };                      // the screen thought it was unused
    db.usage.push(used[0]);                                                // ...and then a page started using it
    expect((await deleteImage(db, stale)).ok).toBe(false);
    expect(db.tables.media_library).toHaveLength(1);
  });

  it('keeps the entry if the file could not be removed, and reports why', async () => {
    const db = createGalleryDb({ images: [img()], fail: { 'storage.remove': 'storage is down' } });
    expect(await deleteImage(db, db.tables.media_library[0])).toEqual({ ok: false, error: 'storage is down' });
    expect(db.tables.media_library).toHaveLength(1);
  });

  it('will not remove anything if it cannot tell whether it is used', async () => {
    const db = createGalleryDb({ images: [img()] });
    const real = db.from;
    db.from = (t) => (t === 'media_library_usage' ? { select: () => ({ eq: async () => ({ data: null, error: { message: 'could not check' } }) }) } : real(t));
    expect(await deleteImage(db, db.tables.media_library[0])).toEqual({ ok: false, error: 'could not check' });
    expect(db.tables.media_library).toHaveLength(1);
  });

  it('loads where an image is used', async () => {
    const db = createGalleryDb({ images: [img()], usage: used });
    expect((await loadUsage(db, 'img-1')).rows).toHaveLength(1);
    expect((await loadUsage(db, 'img-9')).rows).toEqual([]);
  });
});

describe('replacing the picture itself', () => {
  it('only a hosted .webp picture can be replaced in place', () => {
    expect(canReplaceFile({ origin: 'uploaded', storage_path: 'a/b.webp' })).toBe(true);
    expect(canReplaceFile({ origin: 'site', storage_path: 'site/x.WEBP' })).toBe(true);
    expect(canReplaceFile({ origin: 'site', storage_path: 'site/og-default.png' })).toBe(false);
    expect(canReplaceFile({ origin: 'linked', storage_path: null })).toBe(false);
    expect(canReplaceFile({ origin: 'linked', storage_path: 'a.webp' })).toBe(false);
    expect(canReplaceFile({ origin: 'uploaded' })).toBe(false);
  });

  it('stores the new picture at the same address, and records its new size', async () => {
    const db = createGalleryDb({ images: [img({ width: 100, height: 100, size_bytes: 10 })] });
    const result = await replaceImageFile(db, db.tables.media_library[0], blob(4321), { width: 800, height: 450 });
    expect(result.ok).toBe(true);
    expect(db.files.get('pages/a/x.webp')).toMatchObject({ contentType: 'image/webp', upsert: true });     // the same path, overwritten
    expect(db.tables.media_library[0]).toMatchObject({ url: `${BASE}pages/a/x.webp`, width: 800, height: 450, size_bytes: 4321, mime_type: 'image/webp' });   // the address never changes
    expect(db.tables.media_library).toHaveLength(1);
  });

  it('refuses what cannot be replaced in place, and reports an upload that failed without touching the entry', async () => {
    const link = createGalleryDb({ images: [{ url: 'https://example.org/a.jpg', origin: 'linked' }] });
    expect((await replaceImageFile(link, link.tables.media_library[0], blob())).ok).toBe(false);
    expect(link.files.size).toBe(0);
    const db = createGalleryDb({ images: [img({ width: 100 })], fail: { 'storage.upload': 'too large' } });
    expect(await replaceImageFile(db, db.tables.media_library[0], blob(), { width: 5, height: 5 })).toEqual({ ok: false, error: 'too large' });
    expect(db.tables.media_library[0].width).toBe(100);
  });
});

describe('remembering a linked picture', () => {
  it('adds an address from another website once, described as linked', async () => {
    const db = createGalleryDb();
    expect(await ensureInLibrary(db, 'https://example.org/pic.jpg', { title: 'A talk', credit: 'Example', source_url: 'https://example.org/talk' })).toEqual({ added: true });
    expect(db.tables.media_library).toHaveLength(1);
    expect(db.tables.media_library[0]).toMatchObject({ url: 'https://example.org/pic.jpg', origin: 'linked', title: 'A talk', credit: 'Example', source_url: 'https://example.org/talk', tags: ['linked'] });
    expect(await ensureInLibrary(db, 'https://example.org/pic.jpg')).toEqual({ added: false });              // already known
    expect(db.tables.media_library).toHaveLength(1);
  });

  it('leaves our own paths, hosted pictures and anything odd alone', async () => {
    const db = createGalleryDb();
    for (const url of ['/makeup/thumbs/x.webp', '', null, undefined, 'javascript:alert(1)', 'http://example.org/a.jpg', 'not a url']) expect(await ensureInLibrary(db, url)).toEqual({ added: false });
    expect(db.tables.media_library).toHaveLength(0);
  });

  it('never throws, whatever goes wrong', async () => {
    const broken = createGalleryDb({ fail: { 'media_library.insert': 'nope' } });
    expect(await ensureInLibrary(broken, 'https://example.org/a.jpg')).toEqual({ added: false });
    expect(await ensureInLibrary({ from: () => { throw new Error('boom'); } }, 'https://example.org/a.jpg')).toEqual({ added: false });
  });
});

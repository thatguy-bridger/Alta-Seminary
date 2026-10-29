// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { renderInBrowser } from '../test/render.js';
import { createGalleryDb, BASE } from '../test/fakeGalleryDb.js';
import { MediaLibraryPicker } from './MediaLibraryPicker.jsx';

let mounted, db, onSelect, onClose;
const tick = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const act = (fn) => React.act(async () => { await fn(); });
const setVal = async (el, value) => {
  const proto = el.tagName === 'SELECT' ? HTMLSelectElement : HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, value);
  await act(async () => { el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); });
};
const tiles = () => [...document.querySelectorAll('[role="dialog"] button[aria-label^="Use "]')];
const names = () => tiles().map((t) => t.getAttribute('aria-label').replace('Use ', ''));
const searches = () => db.log.filter((l) => l.op === 'search_media_library');

const IMAGES = [
  { title: 'Sermon on the Mount', tags: ['painting', 'bloch'], origin: 'site', url: `${BASE}site/a.webp`, credit: 'Carl Heinrich Bloch. Public domain.', created_at: '2026-10-02T00:00:00Z' },
  { title: 'Photo of Maya', tags: ['directory'], url: `${BASE}directory/b.webp`, created_at: '2026-10-03T00:00:00Z' },
  { title: '', url: `${BASE}misc/c.webp`, created_at: '2026-10-04T00:00:00Z' },
  { title: 'Talk picture', tags: ['church'], origin: 'linked', url: 'https://www.churchofjesuschrist.org/x', created_at: '2026-10-05T00:00:00Z' },
];

async function render(props = {}, opts = {}) {
  db = createGalleryDb({ images: IMAGES, ...opts });
  onSelect = vi.fn(); onClose = vi.fn();
  mounted = await renderInBrowser(<MediaLibraryPicker open db={db} onClose={onClose} onSelect={onSelect} {...props} />);
  await act(() => tick(60));
}
afterEach(async () => { await mounted?.unmount(); document.body.innerHTML = ''; vi.restoreAllMocks(); });

describe('choosing an existing image', () => {
  it('asks the library for nothing until it is opened, and shows the pictures once it is', async () => {
    db = createGalleryDb({ images: IMAGES });
    mounted = await renderInBrowser(<MediaLibraryPicker open={false} db={db} onClose={() => {}} onSelect={() => {}} />);
    await act(() => tick(60));
    expect(searches()).toHaveLength(0);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => { mounted.container.innerHTML = ''; });
  });

  it('lists the library newest first, by title, and gives the picked one back with its address and its details', async () => {
    await render();
    expect(names()).toEqual(['Talk picture', 'Untitled image', 'Photo of Maya', 'Sermon on the Mount']);
    expect(tiles()[0].querySelector('img').getAttribute('src')).toBe('https://www.churchofjesuschrist.org/x');
    await act(() => tiles()[3].click());
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toBe(`${BASE}site/a.webp`);
    expect(onSelect.mock.calls[0][1]).toMatchObject({ title: 'Sermon on the Mount', origin: 'site', credit: 'Carl Heinrich Bloch. Public domain.' });
  });

  it('shows the title and credit when hovering a picture', async () => {
    await render();
    expect(tiles()[3].getAttribute('title')).toBe('Sermon on the Mount — Carl Heinrich Bloch. Public domain.');
    expect(tiles()[2].getAttribute('title')).toBe('Photo of Maya');
  });

  it('searches as you type, after a pause, in everything known about the pictures', async () => {
    await render();
    await setVal(document.querySelector('[aria-label="Search pictures"]'), 'bloc');
    await act(() => tick(380));
    expect(names()).toEqual(['Sermon on the Mount']);
    await setVal(document.querySelector('[aria-label="Search pictures"]'), 'nothing like it');
    await act(() => tick(380));
    expect(tiles()).toHaveLength(0);
    expect(document.querySelector('[role="dialog"]').textContent).toContain('No picture matches that.');
  });

  it('narrows by tag and by where it came from', async () => {
    await render();
    expect([...document.querySelector('select[aria-label="Tag"]').options].map((o) => o.textContent)).toEqual(['All tags', 'bloch (1)', 'church (1)', 'directory (1)', 'painting (1)']);
    await setVal(document.querySelector('select[aria-label="Tag"]'), 'church'); await act(() => tick(60));
    expect(names()).toEqual(['Talk picture']);
    await setVal(document.querySelector('select[aria-label="Tag"]'), '');
    await setVal(document.querySelector('select[aria-label="Where it came from"]'), 'site'); await act(() => tick(60));
    expect(names()).toEqual(['Sermon on the Mount']);
  });

  it('can start on one tag, for a caller that wants paintings, say', async () => {
    await render({ initialTag: 'painting' });
    expect(names()).toEqual(['Sermon on the Mount']);
    expect(document.querySelector('select[aria-label="Tag"]').value).toBe('painting');
    expect(searches()[searches().length - 1].args.p_tag).toBe('painting');
  });

  it('says so when the library is empty, or cannot be read', async () => {
    await render({}, { images: [] });
    expect(document.querySelector('[role="dialog"]').textContent).toContain("No images uploaded yet -- upload one first and it'll show up here next time.");
    await mounted.unmount(); document.body.innerHTML = '';
    await render({}, { fail: { rpc: 'permission denied' } });
    expect(document.querySelector('[role="alert"]').textContent).toBe("Couldn't load the pictures: permission denied");
  });

  it('shows more on request', async () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ url: `${BASE}m/${i}.webp`, title: `Picture ${String(i).padStart(2, '0')}`, created_at: `2026-09-01T00:${String(i).padStart(2, '0')}:00Z` }));
    await render({}, { images: many });
    expect(tiles()).toHaveLength(48);
    await act(() => [...document.querySelectorAll('button')].find((b) => b.textContent.startsWith('Show more')).click()); await act(() => tick(60));
    expect(tiles()).toHaveLength(50);
  });

  it('closes, and uses a title of the caller\'s choosing', async () => {
    await render({ title: 'Choose a picture from the gallery' });
    expect(document.querySelector('[role="dialog"]').getAttribute('aria-label')).toBe('Choose a picture from the gallery');
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(onClose).toHaveBeenCalled();
  });
});

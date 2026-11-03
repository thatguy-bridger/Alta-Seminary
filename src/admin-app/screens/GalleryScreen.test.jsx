// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { renderInBrowser } from '../../test/render.js';
import { createGalleryDb, BASE } from '../../test/fakeGalleryDb.js';
import { ConfirmProvider } from '../ConfirmProvider.jsx';

const h = vi.hoisted(() => ({ client: null }));
vi.mock('../../lib/supabase/browser-client', () => ({ get supabaseBrowser() { return h.client; } }));
import { GalleryScreen } from './GalleryScreen.jsx';

let mounted;
const tick = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const act = (fn) => React.act(async () => { await fn(); });
const tab = (text) => [...document.querySelectorAll('.tab')].find((b) => b.textContent.trim() === text);

async function render() {
  window.scrollTo = () => {};
  h.client = createGalleryDb({ images: [{ title: 'Old chapel', url: `${BASE}pages/chapel.webp`, storage_path: 'pages/chapel.webp', tags: ['page'] }] });
  mounted = await renderInBrowser(<ConfirmProvider><GalleryScreen /></ConfirmProvider>);
  await act(() => tick(80));
}
afterEach(async () => { await mounted?.unmount(); document.body.innerHTML = ''; vi.restoreAllMocks(); });

describe('the Gallery page', () => {
  it('opens on the image library, with every picture and the search box', async () => {
    await render();
    expect(document.body.textContent).toContain('Gallery');
    expect([...document.querySelectorAll('.tab')].map((b) => b.textContent.trim())).toEqual(['Image library', 'Photo albums', 'Where images are used']);
    expect(tab('Image library').className).toContain('active');
    expect(document.querySelector('[aria-label="Search pictures"]')).not.toBeNull();
    expect(document.querySelectorAll('.gl-card')).toHaveLength(1);
    expect(document.body.textContent).not.toContain('Organize photos into albums');
  });

  it('still has the photo albums and the where-images-are-used views, one tab away', async () => {
    await render();
    await act(() => tab('Photo albums').click()); await act(() => tick(60));
    expect(tab('Photo albums').className).toContain('active');
    expect(document.body.textContent).toContain('Organize photos into albums');
    expect(document.querySelector('[aria-label="Search pictures"]')).toBeNull();
    await act(() => tab('Where images are used').click()); await act(() => tick(60));
    expect(document.body.textContent).toContain('grouped by where it\'s used');
    await act(() => tab('Image library').click()); await act(() => tick(60));
    expect(document.querySelectorAll('.gl-card')).toHaveLength(1);
  });
});

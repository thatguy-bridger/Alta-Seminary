// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { renderInBrowser } from '../test/render.js';
import { DirectoryTeaserBlock, cardSnippet } from './DirectoryTeaserBlock.jsx';

const person = (over = {}) => ({
  id: 'p1', name: 'Matt Bardsley', photo_url: 'https://x/m.webp', bio: 'I have been teaching seminary for over 20 years.',
  extra_fields: { role: 'Seminary Principal', email: 'matt@example.org' }, ...over,
});

let mounted;
afterEach(async () => { await mounted?.unmount(); document.body.innerHTML = ''; });

describe('cardSnippet', () => {
  it('is the bio followed by the other details (email, phone, ...)', () => {
    expect(cardSnippet(person())).toBe('I have been teaching seminary for over 20 years. · matt@example.org');
  });

  it('leaves out the role (it has its own line) and the removed "term" field', () => {
    const s = cardSnippet(person({ extra_fields: { role: 'Teacher', term: '2026-27', email: 'a@b.c' } }));
    expect(s).not.toContain('Teacher');
    expect(s).not.toContain('2026-27');
    expect(s).toContain('a@b.c');
  });

  it('still works for someone with no bio, just contact details', () => {
    expect(cardSnippet(person({ bio: '', extra_fields: { role: 'Admin Assistant', email: 'k@b.c' } }))).toBe('k@b.c');
  });

  it('copes with no extra fields at all', () => {
    expect(cardSnippet({ id: 'x', name: 'N', bio: 'Hi', extra_fields: null })).toBe('Hi');
  });
});

describe('DirectoryTeaserBlock cards', () => {
  const card = () => mounted.container.querySelector('a[data-person-open]');

  it('puts the role/title at the very top of the card, above the photo and name, in the accent red', async () => {
    mounted = await renderInBrowser(<DirectoryTeaserBlock sourceType="staff" items={[person()]} />);
    const parts = [...card().children];
    expect(parts[0].textContent).toBe('Seminary Principal');
    expect(parts[0].style.color).toBe('var(--text-link)');
    expect(parts[1].tagName).toBe('IMG');
    expect(parts[2].textContent).toBe('Matt Bardsley');
  });

  it('puts the role first even for someone without a photo', async () => {
    mounted = await renderInBrowser(<DirectoryTeaserBlock sourceType="staff" items={[person({ photo_url: null })]} />);
    const parts = [...card().children];
    expect(parts[0].textContent).toBe('Seminary Principal');
    expect(parts[1].textContent).toBe('Matt Bardsley');
  });

  it('shows no role line when there is no role', async () => {
    mounted = await renderInBrowser(<DirectoryTeaserBlock sourceType="staff" items={[person({ extra_fields: {} })]} />);
    expect(card().children[0].tagName).toBe('IMG');
  });

  it('gives the bio room for about five lines, not three', async () => {
    mounted = await renderInBrowser(<DirectoryTeaserBlock sourceType="staff" items={[person()]} />);
    expect(mounted.container.querySelector('p').style.maxHeight).toBe('7.5em');
  });

  it('never shows "term" on a card, even if a value is still stored', async () => {
    mounted = await renderInBrowser(<DirectoryTeaserBlock sourceType="council" items={[person({ extra_fields: { term: '2026-27' } })]} />);
    expect(mounted.container.textContent).not.toContain('2026-27');
  });

  it('still opens the preview when the role line is clicked (it is part of the card)', async () => {
    mounted = await renderInBrowser(<DirectoryTeaserBlock sourceType="staff" items={[person()]} />);
    card().children[0].click();
    expect(new URL(window.location.href).searchParams.get('person')).toBe('p1');
  });
});

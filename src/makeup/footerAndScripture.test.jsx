// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderInBrowser } from '../test/render.js';
import { MakeupJourney } from './MakeupJourney.jsx';
import { SAMPLE_CLASSES } from './sampleContent.js';
import { chapterFromLibrary, fetchChapter, forgetChapters } from './scriptureLoader.js';

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
window.matchMedia ??= globalThis.matchMedia;
globalThis.URL.createObjectURL ??= () => 'blob:sample';
window.SVGElement.prototype.getTotalLength ??= () => 100;
window.SVGElement.prototype.getPointAtLength ??= () => ({ x: 0, y: 0 });
window.HTMLMediaElement.prototype.play = () => Promise.resolve();
window.HTMLMediaElement.prototype.pause = () => {};

const READING = { id: 'L1', kind: 'scripture', title: 'A reading', reference: 'Ezekiel 3', body: 'Think about Ezekiel 4:17 slowly.\n\nThen Alma 5:14-15, and D&C 88.', minutes: 4, min_seconds: 30,
  pauses: [{ at: 1, question: 'What does Ezekiel 4:2 teach you?' }] };
const TALK = { id: 'A1', kind: 'audio', title: 'A talk', embed_url: 'https://example.org/talk.mp3', duration_seconds: 60, minutes: 3,
  transcript: [{ start: 0, end: 30, text: 'Read Alma 32:21 first.' }, { start: 30, end: 60, text: 'Then more.' }] };
const VERSES = { reference: 'Ezekiel 4', verses: Array.from({ length: 17 }, (_, i) => ({ n: i + 1, text: `Verse ${i + 1} text.` })) };

let mounted;
beforeEach(() => { forgetChapters(); });
afterEach(async () => { await mounted?.unmount(); document.body.innerHTML = ''; vi.restoreAllMocks(); vi.unstubAllEnvs(); });
const tick = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const act = (fn) => React.act(async () => { await fn(); });
const btn = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
const refs = () => [...document.querySelectorAll('.mw-ref')];
async function start(lessons, props = {}) {
  mounted = await renderInBrowser(<MakeupJourney classes={SAMPLE_CLASSES} sources={lessons} onSubmit={vi.fn(async () => ({ ok: true }))} skipTools startAtLesson={lessons[0].id} {...props} />);
  await act(() => tick(40));
}

describe('the footer that is always there', () => {
  it('has the notes button on every screen, from the first', async () => {
    mounted = await renderInBrowser(<MakeupJourney classes={SAMPLE_CLASSES} sources={[READING]} onSubmit={async () => ({ ok: true })} />);
    await act(() => tick(30));
    expect(document.querySelector('.mw-foot .mw-notesbtn')).not.toBeNull();
    expect(document.querySelector('.mw-tbar .mw-notesbtn')).toBeNull();                       // no longer up in the header
    expect(document.querySelector('.mw-foot-slot').children.length).toBe(0);                  // nothing to time yet
  });

  it('shows a reading\'s time bar in the footer, not in the lesson', async () => {
    await start([READING]);
    expect(document.querySelector('.mw-foot .mw-stay .mw-meter')).not.toBeNull();
    expect(document.querySelector('.mw-card .mw-stay')).toBeNull();
    expect(document.querySelector('.mw-foot').textContent).toContain('Read slowly');
  });

  it('shows a recording\'s timeline and time bar in the footer, and the notes button with them', async () => {
    await start([TALK]);
    expect(document.querySelector('.mw-foot .mw-tl')).not.toBeNull();
    expect(document.querySelector('.mw-foot .mw-stay .mw-meter')).not.toBeNull();
    expect(document.querySelector('.mw-foot .mw-notesbtn')).not.toBeNull();
    expect(document.querySelector('.mw-card .mw-tl')).toBeNull();
  });

  it('takes the time bar away again when the lesson is left, and keeps the notes', async () => {
    await start([READING]);
    await act(() => btn('Skip step').click()); await act(() => tick(60));
    expect(document.querySelector('.mw-foot .mw-meter')).toBeNull();
    expect(document.querySelector('.mw-foot .mw-notesbtn')).not.toBeNull();
  });

  it('keeps the notes panel above the footer, and the notes working from it', async () => {
    await start([READING]);
    await act(() => document.querySelector('.mw-foot .mw-notesbtn').click());
    expect(document.querySelector('#mw-notes')).not.toBeNull();
    expect(document.querySelector('.mw-foot .mw-notesbtn').getAttribute('aria-expanded')).toBe('true');
  });
});

describe('scripture references in a lesson', () => {
  it('become buttons in the reading, the pause question and the transcript, and leave the words as they were', async () => {
    await start([READING], { loadScripture: async () => VERSES });
    expect(refs().map((b) => b.textContent)).toEqual(['Ezekiel 4:17', 'Ezekiel 4:2', 'Alma 5:14-15', 'D&C 88']);   // the question sits right after the first paragraph
    expect(document.querySelector('.mw-reader p').textContent).toBe('Think about Ezekiel 4:17 slowly.');
    expect(refs()[0].getAttribute('aria-label')).toBe('Open Ezekiel 4:17');
    await mounted.unmount(); document.body.innerHTML = '';
    await start([TALK], { loadScripture: async () => VERSES });
    expect(refs().map((b) => b.textContent)).toEqual(['Alma 32:21']);
    expect(document.querySelector('.mw-line .x').textContent).toBe('Read Alma 32:21 first.');
  });

  it('open the chapter in a pop-up with the verse asked for marked', async () => {
    const load = vi.fn(async () => VERSES);
    await start([READING], { loadScripture: load });
    await act(() => refs()[0].click()); await act(() => tick(60));
    expect(load).toHaveBeenCalledWith('Ezekiel', 4);
    const dlg = document.querySelector('.mw-scrip[role="dialog"]');
    expect(dlg.getAttribute('aria-label')).toBe('Ezekiel 4:17');
    expect(dlg.querySelector('h3').textContent).toBe('Ezekiel 4:17');
    expect([...dlg.querySelectorAll('.mw-sv.on')].map((p) => p.querySelector('b').textContent)).toEqual(['17']);
    expect(dlg.querySelectorAll('.mw-sv').length).toBe(17);                                   // the whole chapter is there to read around it
  });

  it('mark every verse of a range', async () => {
    await start([READING], { loadScripture: async () => ({ reference: 'Alma 5', verses: Array.from({ length: 20 }, (_, i) => ({ n: i + 1, text: `v${i + 1}` })) }) });
    await act(() => refs()[2].click()); await act(() => tick(60));
    expect([...document.querySelectorAll('.mw-sv.on b')].map((b) => b.textContent)).toEqual(['14', '15']);
  });

  it('open a whole chapter with nothing marked when no verse was named', async () => {
    await start([READING], { loadScripture: async () => ({ reference: 'D&C 88', verses: [{ n: 1, text: 'one' }, { n: 2, text: 'two' }] }) });
    await act(() => refs()[3].click()); await act(() => tick(60));
    expect(document.querySelector('.mw-scrip h3').textContent).toBe('D&C 88');
    expect(document.querySelectorAll('.mw-sv.on').length).toBe(0);
  });

  it('say so plainly when the verse is not in the chapter, and still show the chapter', async () => {
    const short = { reference: 'Ezekiel 4', verses: VERSES.verses };
    await start([{ ...READING, body: 'Look at Ezekiel 4:22 now.' }], { loadScripture: async () => short });
    await act(() => refs()[0].click()); await act(() => tick(60));
    expect(document.querySelector('.mw-scrip').textContent).toContain('Ezekiel 4 has 17 verses, so verse 22 is not there. Here is the chapter.');
    expect(document.querySelectorAll('.mw-sv').length).toBe(17);
    expect(document.querySelectorAll('.mw-sv.on').length).toBe(0);
  });

  it('shows that it is opening, and shows an error if the chapter cannot be got', async () => {
    let fail;
    await start([READING], { loadScripture: () => new Promise((_, rej) => { fail = rej; }) });
    await act(() => refs()[0].click());
    expect(document.querySelector('.mw-scrip').textContent).toContain('Opening…');
    await act(async () => { fail(new Error('That chapter could not be found.')); await tick(30); });
    expect(document.querySelector('.mw-scrip [role="alert"]').textContent).toBe('That chapter could not be found.');
  });

  it('close with the button, Escape, or a tap outside, and put the focus back on the link', async () => {
    await start([READING], { loadScripture: async () => VERSES });
    const link = refs()[0];
    const open = async () => { await act(() => link.click()); await act(() => tick(50)); };
    await open();
    expect(document.activeElement.getAttribute('aria-label')).toBe('Close');
    await act(() => document.querySelector('.mw-scrip .mw-notes-x').click());
    expect(document.querySelector('.mw-scrip')).toBeNull();
    expect(document.activeElement).toBe(link);
    await open();
    await act(async () => { document.querySelector('.mw-scrip').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(document.querySelector('.mw-scrip')).toBeNull();
    await open();
    await act(async () => { document.querySelector('.mw-scrim').dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
    expect(document.querySelector('.mw-scrip')).toBeNull();
  });

  it('do not close when the text inside is tapped', async () => {
    await start([READING], { loadScripture: async () => VERSES });
    await act(() => refs()[0].click()); await act(() => tick(50));
    await act(async () => { document.querySelector('.mw-sv').dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
    expect(document.querySelector('.mw-scrip')).not.toBeNull();
  });

  it('can be followed from one reference to another without closing in between', async () => {
    const load = vi.fn(async (book) => ({ reference: book, verses: [{ n: 1, text: 'x' }] }));
    await start([READING], { loadScripture: load });
    await act(() => refs()[0].click()); await act(() => tick(40));
    await act(() => document.querySelector('.mw-scrip .mw-notes-x').click());
    await act(() => refs()[2].click()); await act(() => tick(40));
    expect(document.querySelector('.mw-scrip h3').textContent).toBe('Alma 5:14–15');
    expect(load.mock.calls.map((c) => c.join(' '))).toEqual(['Ezekiel 4', 'Alma 5']);
  });

  it('does not make a recording jump when a reference in its transcript is tapped, and the recording stays', async () => {
    await start([TALK], { loadScripture: async () => ({ reference: 'Alma 32', verses: [{ n: 21, text: 'faith' }] }) });
    const audio = document.querySelector('audio');
    let t = 0; Object.defineProperty(audio, 'currentTime', { get: () => t, set: (v) => { t = v; }, configurable: true });
    await act(() => refs()[0].click()); await act(() => tick(40));
    expect(t).toBe(0);                                                                        // the click did not reach the line
    expect(document.querySelector('.mw-scrip')).not.toBeNull();
    expect(document.querySelector('audio')).toBe(audio);                                      // and the recording is still there, not remounted
  });

  it('are plain text where nothing can open them (a preview with no pop-up)', async () => {
    const { Linked } = await import('./ScriptureLinks.jsx');
    const box = await renderInBrowser(<p><Linked text="See Alma 5:14." /></p>);
    expect(box.container.querySelector('.mw-ref')).toBeNull();
    expect(box.container.textContent).toBe('See Alma 5:14.');
    await box.unmount();
  });
});

describe('getting a chapter', () => {
  const lib = [{ kind: 'scripture', reference: 'Alma 5', body: '1  Yea, I say.\n2  And now behold.\nnot a verse line\n3  Thus.' }];

  it('uses a chapter already in the library, with no network', async () => {
    expect(chapterFromLibrary(lib, 'Alma', 5)).toEqual([{ n: 1, text: 'Yea, I say.' }, { n: 2, text: 'And now behold.' }, { n: 3, text: 'Thus.' }]);
    expect(chapterFromLibrary(lib, 'Alma', 6)).toBeNull();
    expect(chapterFromLibrary([{ kind: 'talk', reference: 'Alma 5', body: '1 x' }], 'Alma', 5)).toBeNull();
    const fetcher = vi.fn();
    expect(await fetchChapter('Alma', 5, { sources: lib, fetcher })).toMatchObject({ reference: 'Alma 5' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('asks the server function for anything else, once, and remembers it', async () => {
    vi.stubEnv('PUBLIC_SUPABASE_URL', 'https://x.supabase.co'); vi.stubEnv('PUBLIC_SUPABASE_ANON_KEY', 'anon');
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => VERSES }));
    const a = await fetchChapter('Ezekiel', 4, { fetcher });
    const b = await fetchChapter('ezekiel', 4, { fetcher });
    expect(a).toEqual(VERSES); expect(b).toEqual(VERSES);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe('https://x.supabase.co/functions/v1/scripture-text');
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ book: 'Ezekiel', chapter: 4 });
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer anon');
  });

  it('says why when it cannot', async () => {
    vi.stubEnv('PUBLIC_SUPABASE_URL', 'https://x.supabase.co'); vi.stubEnv('PUBLIC_SUPABASE_ANON_KEY', 'anon');
    await expect(fetchChapter('Nonsense', 1, { fetcher: vi.fn() })).rejects.toThrow('not a scripture reference');
    await expect(fetchChapter('Ezekiel', 999, { fetcher: async () => ({ ok: false, json: async () => ({ error: 'That chapter could not be found.' }) }) })).rejects.toThrow('could not be found');
    await expect(fetchChapter('Job', 1, { fetcher: async () => ({ ok: true, json: async () => ({}) }) })).rejects.toThrow('could not be loaded');
    vi.stubEnv('PUBLIC_SUPABASE_URL', '');
    await expect(fetchChapter('Job', 2, { fetcher: vi.fn() })).rejects.toThrow('not available here');
  });
});

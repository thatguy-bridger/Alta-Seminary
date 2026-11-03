import { describe, it, expect, vi } from 'vitest';
import { cleanPath, optedOut, createTracker, browserSend } from './usage.js';

const mem = () => { const m = {}; return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = String(v); }, _m: m }; };
const nav = (over = {}) => ({ doNotTrack: null, globalPrivacyControl: false, webdriver: false, ...over });

describe('paths', () => {
  it('keeps only the path: no query, no hash, no trailing slash', () => {
    expect(cleanPath('/events/spring?utm=1#top')).toBe('/events/spring');
    expect(cleanPath('/about/')).toBe('/about');
    expect(cleanPath('')).toBe('/');
    expect(cleanPath('about')).toBe('/about');
  });
  it('never lets an id or odd character through', () => {
    expect(cleanPath('/admin/lessons/3f2504e0-4f89-11d3-9a0c-0305e82c3301')).toBe('/admin/lessons/:id');
    expect(cleanPath('/x/abcdefghijklmnopqrstuvwxyz0123')).toBe('/x/:id');
    expect(cleanPath('/a b/<script>')).toBe('/a-b/-script-');
    expect(cleanPath('/' + 'ab-'.repeat(100)).length).toBe(120);
  });
});

describe('who is counted', () => {
  it('nobody who asks not to be tracked, or who is an automated browser', () => {
    expect(optedOut(nav({ doNotTrack: '1' }))).toBe(true);
    expect(optedOut(nav({ globalPrivacyControl: true }))).toBe(true);
    expect(optedOut(nav({ webdriver: true }))).toBe(true);
    expect(optedOut(nav())).toBe(false);
    const send = vi.fn();
    const t = createTracker({ area: 'site', send, storage: mem(), nav: nav({ doNotTrack: '1' }) });
    t.view('/'); t.step('x'); t.action('y'); t.flush();
    expect(send).not.toHaveBeenCalled();
    expect(t.off).toBe(true);
  });
});

describe('the tracker', () => {
  const make = (extra = {}) => { const send = vi.fn(); const storage = mem(); const jobs = []; const t = createTracker({ area: 'site', send, storage, session: 'visit-abc-123', nav: nav(), later: (fn) => { jobs.push(fn); return jobs.length; }, ...extra }); return { t, send, storage, jobs }; };

  it('makes a random code once, keeps it on the device, and uses the same one next time', () => {
    const a = make(); a.t.view('/'); a.t.flush();
    const v = a.storage._m['alta-visitor'];
    expect(v).toMatch(/^[a-z0-9]{8,40}$/);
    const b = createTracker({ area: 'site', send: vi.fn(), storage: a.storage, session: 'x-visit-1234', nav: nav() }); b.view('/'); b.flush();
    expect(a.storage._m['alta-visitor']).toBe(v);
  });

  it('sends small batches: after a moment, or at once when there are many', () => {
    const { t, send, jobs } = make();
    t.view('/about', '/'); t.step('learn');
    expect(send).not.toHaveBeenCalled();
    jobs[0]();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toEqual([
      expect.objectContaining({ a: 'site', k: 'view', n: '/about', f: '/', s: 'visit-abc-123' }),
      expect.objectContaining({ k: 'step', n: 'learn' }),
    ]);
    for (let i = 0; i < 15; i++) t.action('x' + i);
    expect(send).toHaveBeenCalledTimes(2);                                                     // the fifteenth goes straight out
  });

  it('sends only what the database keeps: codes, area, kind, name, and the page before', () => {
    const { t, send } = make(); t.view('/events?name=Maya', '/about?x=1'); t.flush();
    expect(Object.keys(send.mock.calls[0][0][0]).sort()).toEqual(['a', 'f', 'k', 'n', 's', 'v']);
    expect(send.mock.calls[0][0][0]).toMatchObject({ n: '/events', f: '/about' });             // no query, so no name
  });

  it('cleans event names, and never breaks the page if sending fails', () => {
    const { t, send } = make({ send: vi.fn(() => { throw new Error('offline'); }) });
    t.action('Lesson: Scripture!'); expect(() => t.flush()).not.toThrow();
    const ok = make(); ok.t.action('Lesson: Scripture!'); ok.t.flush();
    expect(ok.send.mock.calls[0][0][0].n).toBe('lesson:-scripture-');
  });

  it('still works with no storage (a new code each time)', () => {
    const { t, send } = make({ storage: { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } } });
    expect(() => { t.view('/'); t.flush(); }).not.toThrow();
    expect(send.mock.calls[0][0][0].v).toMatch(/^[a-z0-9]{8,40}$/);
  });
});

describe('the real sender', () => {
  it('posts the events to the database function with the public key, and never throws', async () => {
    const fetcher = vi.fn(async () => ({}));
    await browserSend('https://x.supabase.co', 'anon', fetcher)([{ v: 'a' }]);
    expect(fetcher.mock.calls[0][0]).toBe('https://x.supabase.co/rest/v1/rpc/log_usage');
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'POST', keepalive: true });
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ p_events: [{ v: 'a' }] });
    await expect(browserSend('u', 'k', () => Promise.reject(new Error('x')))([])).resolves.toBeUndefined();
  });
});

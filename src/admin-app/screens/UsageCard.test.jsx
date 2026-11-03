// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { renderInBrowser } from '../../test/render.js';
import { summarizeUsage, trendText, prettyName } from './usageModel.js';

const h = vi.hoisted(() => ({ client: null }));
vi.mock('../../lib/supabase/browser-client', () => ({ get supabaseBrowser() { return h.client; } }));
import { UsageCard } from './UsageCard.jsx';

const DAILY = (xs) => xs.map((v, i) => ({ day: `2026-10-${String(i + 1).padStart(2, '0')}`, visitors: v, views: v * 2 }));
const DATA = { visitors: 40, returning: 10, visits: 55, views: 130, daily: DAILY([2, 3, 4, 5, 8, 9, 10, 12]),
  top: [{ name: '/about', count: 50, visitors: 30 }, { name: '/', count: 40, visitors: 35 }], entries: [{ name: '/', count: 30 }], paths: [{ from: '/', to: '/about', count: 20 }],
  steps: [{ name: 'learn', count: 20 }, { name: 'begin', count: 40 }, { name: 'done', count: 8 }, { name: 'bogus', count: 99 }] };

describe('the usage numbers', () => {
  it('make tiles, a funnel in journey order, and tidy names', () => {
    const m = summarizeUsage(DATA, 'makeup');
    expect(m.tiles.map((t) => [t.label, t.value])).toEqual([['Visitors', 40], ['Visits', 55], ['Steps taken', 68], ['Came back', '25%']]);
    expect(m.funnel).toEqual([{ name: 'Started', count: 40, share: 100 }, { name: 'Studied a lesson', count: 20, share: 50 }, { name: 'Finished', count: 8, share: 20 }]);
    expect(prettyName('notes', 'makeup')).toBe('Opened their notes');
    expect(prettyName('lesson:audio', 'makeup')).toBe('Studied a recording');
    expect(prettyName('lesson:comefollowme', 'makeup')).toBe('Studied a Come, Follow Me lesson');
    expect(prettyName('lesson:mystery', 'makeup')).toBe('Studied a mystery lesson');
    expect(prettyName('/about', 'site')).toBe('/about');
    expect(summarizeUsage(DATA, 'site').tiles[2]).toEqual({ label: 'Page views', value: 130 });
  });
  it('say which way things are going, only when there is enough to say', () => {
    expect(trendText(DAILY([1, 1, 1]))).toBe('Not enough days yet to show a trend.');
    expect(trendText(DAILY([2, 3, 8, 12]))).toBe('Visitors are up 300% in the second half of this period.');
    expect(trendText(DAILY([12, 8, 3, 2]))).toBe('Visitors are down 75% in the second half of this period.');
    expect(trendText(DAILY([5, 5, 5, 5]))).toBe('Visitors are steady across this period.');
    expect(trendText(DAILY([0, 0, 0, 0]))).toBe('No visitors in this period yet.');
    expect(trendText(DAILY([0, 0, 3, 4]))).toContain('started coming');
  });
  it('cope with nothing, or with an odd answer', () => {
    expect(summarizeUsage(null, 'site').empty).toBe(true);
    expect(summarizeUsage([], 'site').empty).toBe(true);
    expect(summarizeUsage({ visitors: 0, returning: 0 }, 'site').tiles[3].value).toBe('0%');
  });
});

let mounted;
afterEach(async () => { await mounted?.unmount(); document.body.innerHTML = ''; });
const tick = (ms = 40) => new Promise((r) => setTimeout(r, ms));
async function open(answer) { h.client = { rpc: vi.fn(async () => answer) }; mounted = await renderInBrowser(<UsageCard />); await React.act(async () => { await tick(); }); }

describe('the Usage card', () => {
  it('asks for the public site over 30 days, shows the numbers, and says what is and is not collected', async () => {
    await open({ data: DATA, error: null });
    expect(h.client.rpc).toHaveBeenCalledWith('admin_usage_summary', { p_area: 'site', p_days: 30 });
    expect(document.body.textContent).toContain('Visitors');
    expect(document.body.textContent).toContain('/about');
    expect(document.body.textContent).toContain('Where visits start');
    expect(document.body.textContent).toContain('Usual paths');
    expect(document.body.textContent).toContain('No names, emails or IP addresses');
    expect(document.body.textContent).toContain('13 months');
    expect(document.querySelectorAll('svg[aria-label="Visitors each day"] rect').length).toBe(8);
  });
  it('changes the part of the site and the range, and asks again', async () => {
    await open({ data: DATA, error: null });
    await React.act(async () => { [...document.querySelectorAll('button')].find((b) => b.textContent === 'Makeup Work').click(); await tick(); });
    expect(h.client.rpc).toHaveBeenLastCalledWith('admin_usage_summary', { p_area: 'makeup', p_days: 30 });
    await React.act(async () => { [...document.querySelectorAll('button')].find((b) => b.textContent === '90 days').click(); await tick(); });
    expect(h.client.rpc).toHaveBeenLastCalledWith('admin_usage_summary', { p_area: 'makeup', p_days: 90 });
    expect(document.body.textContent).toContain('How far students get');
    expect(document.body.textContent).toContain('Finished');
  });
  it('says so when there is nothing yet, and when it cannot read the numbers', async () => {
    await open({ data: { visitors: 0, views: 0, daily: [], steps: [] }, error: null });
    expect(document.body.textContent).toContain('Nothing counted here yet');
    await mounted.unmount(); document.body.innerHTML = '';
    await open({ data: null, error: { message: 'Admins only.' } });
    expect(document.querySelector('[role="alert"]').textContent).toContain('Admins only.');
  });
});

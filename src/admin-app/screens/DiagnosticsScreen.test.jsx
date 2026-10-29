// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderInBrowser } from '../../test/render.js';

const h = vi.hoisted(() => ({ client: null }));
vi.mock('../../lib/supabase/browser-client', () => ({ get supabaseBrowser() { return h.client; } }));
import { DiagnosticsScreen, sweepCheck, SWEEP_STALE_MS } from './DiagnosticsScreen.jsx';

const NOW = Date.UTC(2026, 9, 28, 12, 0, 0);
const row = (over = {}) => ({ job_active: true, job_schedule: '* * * * *', last_run_at: new Date(NOW - 30_000).toISOString(), last_status: 'succeeded', runs_last_day: 1440, failed_last_day: 0, ...over });

describe('the scheduled-publish check', () => {
  it('is healthy when the job ran a moment ago and nothing failed', () => {
    expect(sweepCheck(row(), NOW)).toEqual({ status: 'ok', detail: 'Last ran 30 seconds ago. 1440 runs in the last day, none failed.' });
  });

  it('says it is not set up when the database has no such job', () => {
    expect(sweepCheck(undefined, NOW)).toMatchObject({ status: 'error', detail: expect.stringContaining('not set up') });
    expect(sweepCheck(null, NOW).status).toBe('error');
  });

  it('is broken when the job is switched off, or its last run failed', () => {
    expect(sweepCheck(row({ job_active: false }), NOW)).toMatchObject({ status: 'error', detail: expect.stringContaining('switched off') });
    expect(sweepCheck(row({ last_status: 'failed' }), NOW)).toMatchObject({ status: 'error', detail: 'Last ran 30 seconds ago. That run failed.' });
  });

  it('needs attention when it has gone quiet, however recently it last worked', () => {
    const quiet = row({ last_run_at: new Date(NOW - SWEEP_STALE_MS - 60_000).toISOString() });
    expect(sweepCheck(quiet, NOW)).toMatchObject({ status: 'warn', detail: 'Last ran 11 minutes ago. It should run every minute.' });
    expect(sweepCheck(row({ last_run_at: new Date(NOW - SWEEP_STALE_MS + 60_000).toISOString() }), NOW).status).toBe('ok');   // not yet stale
    expect(sweepCheck(row({ last_run_at: new Date(NOW - 3 * 3600_000).toISOString() }), NOW).detail).toContain('3 hours ago');
    expect(sweepCheck(row({ last_run_at: new Date(NOW - 5 * 86400_000).toISOString() }), NOW).detail).toContain('5 days ago');
  });

  it('needs attention when some runs failed in the last day, even if the latest worked', () => {
    expect(sweepCheck(row({ failed_last_day: 3 }), NOW)).toMatchObject({ status: 'warn', detail: 'Last ran 30 seconds ago. 3 of 1440 runs in the last day failed.' });
  });

  it('has not run yet when there is no run at all', () => {
    expect(sweepCheck(row({ last_run_at: null, last_status: null }), NOW)).toMatchObject({ status: 'warn', detail: expect.stringContaining('not run yet') });
  });

  it('copes with numbers that arrive as text, as large counts can', () => {
    expect(sweepCheck(row({ runs_last_day: '1440', failed_last_day: '0' }), NOW).status).toBe('ok');
  });
});

// A stand-in for the database client: every query is a chain that ends in the same empty answer, and the scheduler's answer is the test's.
function client(rpcAnswer) {
  const chain = new Proxy({}, { get: (_t, prop) => (prop === 'then' ? (ok) => ok({ data: [], count: 0, error: null }) : prop === 'maybeSingle' ? async () => ({ data: null, error: null }) : () => chain) });
  return { from: () => chain, rpc: vi.fn(async () => rpcAnswer) };
}

let mounted, fetched;
beforeEach(() => { fetched = []; globalThis.fetch = vi.fn(async (url) => { fetched.push(String(url)); return { ok: true, status: 200, json: async () => [] }; }); });
afterEach(async () => { await mounted?.unmount(); document.body.innerHTML = ''; vi.restoreAllMocks(); });
const tick = (ms = 60) => new Promise((r) => setTimeout(r, ms));
async function open(answer) {
  h.client = client(answer);
  mounted = await renderInBrowser(<DiagnosticsScreen />);
  await React.act(async () => { await tick(); });
}
const sweepCard = () => [...document.querySelectorAll('span')].find((s) => s.textContent === 'Scheduled-publish sweep').closest('div').parentElement;

describe('the Diagnostics screen', () => {
  it('asks the database about the scheduled-publish job, and shows what it says', async () => {
    await open({ data: [row({ last_run_at: new Date().toISOString() })], error: null });
    expect(h.client.rpc).toHaveBeenCalledWith('admin_sweep_status');
    expect(sweepCard().textContent).toContain('Healthy');
    expect(sweepCard().textContent).toContain('none failed');
  });

  it('never asks GitHub anything: the job does not depend on a repository any more', async () => {
    await open({ data: [row()], error: null });
    expect(fetched.filter((u) => /github/i.test(u))).toEqual([]);
    expect(document.body.textContent).not.toMatch(/GitHub/);
  });

  it('shows a broken job as broken', async () => {
    await open({ data: [row({ last_status: 'failed' })], error: null });
    expect(sweepCard().textContent).toContain('Broken');
    expect(sweepCard().textContent).toContain('That run failed');
  });

  it('says so, instead of failing quietly, when the scheduler cannot be read', async () => {
    await open({ data: null, error: { message: 'Admins only.' } });
    expect(sweepCard().textContent).toContain('Broken');
    expect(sweepCard().textContent).toContain("Couldn't read the scheduler: Admins only.");
  });

  it('shows a missing job as broken', async () => {
    await open({ data: [], error: null });
    expect(sweepCard().textContent).toContain('not set up');
  });
});

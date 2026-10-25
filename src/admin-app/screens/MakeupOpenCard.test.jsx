// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { renderInBrowser } from '../../test/render.js';
import { createFakeSupabase } from '../../test/fakeSupabase.js';

const h = vi.hoisted(() => ({ client: null }));
vi.mock('../../lib/supabase/browser-client', () => ({ get supabaseBrowser() { return h.client; } }));
import { MakeupOpenCard } from './MakeupOpenCard.jsx';

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const btn = (text) => [...document.querySelectorAll('button, a')].find((b) => b.textContent.trim() === text);
const LINK = () => `${window.location.origin}/makeup-work/start`;

let mounted, setEnabled, flash, invoke;
async function render(props = {}, { updateError = null, reply = { data: { status: 'sent', to: 'admin@example.org' }, error: null } } = {}) {
  const base = createFakeSupabase({ errors: updateError ? { site_settings: updateError } : {} });
  invoke = vi.fn(async () => reply);
  h.client = { ...base, functions: { invoke } };
  setEnabled = vi.fn(); flash = vi.fn();
  mounted = await renderInBrowser(<MakeupOpenCard enabled={false} setEnabled={setEnabled} activeClasses={1} shownLessons={206} flash={flash} msg="" {...props} />); await tick();
}
afterEach(async () => { await mounted?.unmount(); document.body.innerHTML = ''; vi.restoreAllMocks(); });

describe('the Makeup Work switch card', () => {
  it('says what students will see while it is off, and shows no link', async () => {
    await render();
    expect(document.body.textContent).toContain('Makeup Work is not open right now');
    expect(document.body.textContent).not.toContain(LINK());
  });

  it('shows the student link when on, and can copy it', async () => {
    await render({ enabled: true });
    expect(document.querySelector('code').textContent).toBe(LINK());
    expect(btn('Open it').getAttribute('href')).toBe(LINK());
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    btn('Copy link').click(); await tick();
    expect(writeText).toHaveBeenCalledWith(LINK());
    expect(flash).toHaveBeenCalledWith('Link copied.');
  });

  it('saves the switch to the setting, and puts it back if saving fails', async () => {
    await render();
    document.querySelector('input[type=checkbox]').click(); await tick();
    expect(setEnabled).toHaveBeenCalledWith(true);
    expect(h.client.log).toEqual([{ table: 'site_settings', op: 'update', payload: { makeup_work_enabled: true } }]);
    await mounted.unmount(); document.body.innerHTML = '';
    await render({}, { updateError: 'permission denied' });
    document.querySelector('input[type=checkbox]').click(); await tick();
    expect(setEnabled).toHaveBeenLastCalledWith(false);
    expect(flash).toHaveBeenCalledWith("Couldn't save: permission denied");
  });

  it('warns when students could not start yet (no class, or no lessons)', async () => {
    await render({ enabled: true, activeClasses: 0 });
    expect(document.body.textContent).toContain('Add at least one class');
    expect(document.body.textContent).toContain('Students cannot start until both are ready');
    await mounted.unmount(); document.body.innerHTML = '';
    await render({ enabled: true, activeClasses: 2, shownLessons: 0 });
    expect(document.body.textContent).toContain('No lessons are shown to students yet');
    await mounted.unmount(); document.body.innerHTML = '';
    await render({ enabled: true });
    expect(document.body.textContent).toContain('✓ 1 active class');
    expect(document.body.textContent).toContain('✓ 206 lessons shown to students');
    expect(document.body.textContent).not.toContain('Students cannot start');
  });

  it('sends a test email to the signed-in admin and says where it went', async () => {
    await render();
    btn('Send me a test email').click(); await tick();
    expect(invoke).toHaveBeenCalledWith('makeup-notify', { body: { test: true } });
    expect(document.body.textContent).toContain('Sent to admin@example.org');
  });

  it('points to the setup steps when email is not set up yet', async () => {
    await render({}, { reply: { data: { status: 'not-configured', error: 'Email is not set up yet.' }, error: null } });
    btn('Send me a test email').click(); await tick();
    expect(document.body.textContent).toContain('Email is not set up yet');
    expect(document.body.textContent).toContain('RESEND_API_KEY');
  });
});

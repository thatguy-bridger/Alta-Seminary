import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeSupabase } from '../test/fakeSupabase.js';

const h = vi.hoisted(() => ({ client: null }));
vi.mock('../lib/supabase/browser-client', () => ({ get supabaseBrowser() { return h.client; } }));

import { createEventWithExtras } from './crossCreate.js';

const patch = {
  title: 'Fall Fireside', description: 'Hot cocoa', location: 'Chapel', all_day: false, status: 'draft',
  start_at: '2026-10-30T18:30:00.000Z', end_at: '2026-10-30T19:30:00.000Z', show_in_announcements: true,
};
const ops = (table, op) => h.client.log.filter((l) => l.table === table && l.op === op);

beforeEach(() => { h.client = createFakeSupabase(); });

describe('createEventWithExtras (creating an event)', () => {
  it('creates the event with a page URL slug and keeps the announcements setting', async () => {
    const { event } = await createEventWithExtras(patch);
    const [insert] = ops('calendar_events', 'insert');
    expect(insert.payload).toMatchObject({ title: 'Fall Fireside', slug: 'fall-fireside', show_in_announcements: true, status: 'draft' });
    expect(event.slug).toBe('fall-fireside');
  });

  it('creates nothing else unless asked', async () => {
    await createEventWithExtras(patch, {});
    expect(ops('gallery_albums', 'insert')).toHaveLength(0);
    expect(ops('blog_posts', 'insert')).toHaveLength(0);
    expect(ops('content_links', 'upsert')).toHaveLength(0);
  });

  it('never creates an announcement -- the event is its own announcement page now', async () => {
    await createEventWithExtras(patch, { announcement: true, album: true });
    expect(ops('blog_posts', 'insert')).toHaveLength(0);
  });

  it('creates a linked draft album named for the event when asked', async () => {
    const { event } = await createEventWithExtras(patch, { album: true });
    expect(ops('gallery_albums', 'insert')[0].payload).toMatchObject({ name: 'Fall Fireside Photos', status: 'draft' });
    expect(ops('content_links', 'upsert')[0].payload).toMatchObject({ a_kind: 'album', b_kind: 'event', b_id: event.id });
  });

  it('inserts the event before anything that links to it', async () => {
    await createEventWithExtras(patch, { album: true });
    const order = h.client.log.map((l) => `${l.table}:${l.op}`);
    expect(order.indexOf('calendar_events:insert')).toBeLessThan(order.indexOf('content_links:upsert'));
  });

  it("won't give an event the reserved 'archive' slug (that URL is the archive page)", async () => {
    const { event } = await createEventWithExtras({ ...patch, title: 'Archive' });
    expect(event.slug).toBe('archive-event');
  });
});

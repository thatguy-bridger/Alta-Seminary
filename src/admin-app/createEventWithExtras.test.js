import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeSupabase } from '../test/fakeSupabase.js';

const h = vi.hoisted(() => ({ client: null }));
vi.mock('../lib/supabase/browser-client', () => ({ get supabaseBrowser() { return h.client; } }));

import { createEventWithExtras } from './crossCreate.js';

const patch = {
  title: 'Fall Fireside', description: 'Hot cocoa', location: 'Chapel', all_day: false, status: 'draft',
  start_at: '2026-10-30T18:30:00.000Z', end_at: '2026-10-30T19:30:00.000Z',
};
const ops = (table, op) => h.client.log.filter((l) => l.table === table && l.op === op);

beforeEach(() => { h.client = createFakeSupabase(); });

describe('createEventWithExtras (the new-event "also create…" flow)', () => {
  it('creates only the event when nothing is ticked', async () => {
    const { event, redirect } = await createEventWithExtras(patch, {});
    expect(event.title).toBe('Fall Fireside');
    expect(redirect).toBeNull();
    expect(ops('calendar_events', 'insert')).toHaveLength(1);
    expect(ops('blog_posts', 'insert')).toHaveLength(0);
    expect(ops('gallery_albums', 'insert')).toHaveLength(0);
    expect(ops('content_links', 'upsert')).toHaveLength(0);
  });

  it('creates a linked announcement that expires with the event, and heads to its editor', async () => {
    const { event, redirect } = await createEventWithExtras(patch, { announcement: true });
    const [post] = ops('blog_posts', 'insert');
    expect(post.payload).toMatchObject({ title: 'Fall Fireside', status: 'draft', unpublish_at: patch.end_at });
    expect(post.payload.draft_blocks[0]).toMatchObject({ type: 'hero', props: { heading: 'Fall Fireside' } });
    // linked to THIS event, stored in canonical order (announcement < event)
    expect(ops('content_links', 'upsert')[0].payload).toEqual({
      a_kind: 'announcement', a_id: 'blog_posts-2', b_kind: 'event', b_id: event.id,
    });
    expect(redirect).toMatch(/^\/admin\/posts\/edit\?slug=fall-fireside&schedule=1$/);
  });

  it('creates a linked draft album and stays put (nothing to edit yet)', async () => {
    const { event, redirect } = await createEventWithExtras(patch, { album: true });
    expect(ops('gallery_albums', 'insert')[0].payload).toMatchObject({ name: 'Fall Fireside Photos', status: 'draft' });
    expect(ops('content_links', 'upsert')[0].payload).toMatchObject({ a_kind: 'album', b_kind: 'event', b_id: event.id });
    expect(redirect).toBeNull();
  });

  it('creates both, links both to the event, and goes to the announcement', async () => {
    const { event, redirect } = await createEventWithExtras(patch, { announcement: true, album: true });
    const links = ops('content_links', 'upsert').map((l) => l.payload);
    expect(links).toHaveLength(2);
    expect(links.every((l) => l.b_kind === 'event' && l.b_id === event.id)).toBe(true);
    expect(links.map((l) => l.a_kind).sort()).toEqual(['album', 'announcement']);
    expect(redirect).toContain('/admin/posts/edit');
  });

  it('inserts the event before anything that links to it', async () => {
    await createEventWithExtras(patch, { announcement: true, album: true });
    const order = h.client.log.map((l) => `${l.table}:${l.op}`);
    expect(order[0]).toBe('calendar_events:insert');
    expect(order.indexOf('calendar_events:insert')).toBeLessThan(order.indexOf('content_links:upsert'));
  });
});

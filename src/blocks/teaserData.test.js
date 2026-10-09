import { describe, it, expect, vi } from 'vitest';
import { createFakeSupabase } from '../test/fakeSupabase.js';
import { attachEventLinks } from './teaserData.js';

const events = [{ id: 'e1', title: 'One' }, { id: 'e2', title: 'Two' }, { id: 'e3', title: 'Three' }];

describe('attachEventLinks', () => {
  it('attaches each event its own announcement and album', async () => {
    const client = createFakeSupabase({ tables: { public_event_links: [
      { event_id: 'e1', kind: 'announcement', target_id: 'p1', slug: 'one-post', title: 'One' },
      { event_id: 'e1', kind: 'album', target_id: 'a1', slug: null, title: 'One Photos' },
      { event_id: 'e2', kind: 'announcement', target_id: 'p2', slug: 'two-post', title: 'Two' },
    ] } });
    const result = await attachEventLinks(client, events);
    expect(result[0].links).toEqual({ announcement: { slug: 'one-post', title: 'One' }, album: { id: 'a1', title: 'One Photos' } });
    expect(result[1].links).toEqual({ announcement: { slug: 'two-post', title: 'Two' } });
    expect(result[2].links).toEqual({}); // e3 has nothing linked
  });

  it('keeps the first of a kind when several are linked', async () => {
    const client = createFakeSupabase({ tables: { public_event_links: [
      { event_id: 'e1', kind: 'announcement', target_id: 'p1', slug: 'first', title: 'First' },
      { event_id: 'e1', kind: 'announcement', target_id: 'p2', slug: 'second', title: 'Second' },
    ] } });
    expect((await attachEventLinks(client, events))[0].links.announcement.slug).toBe('first');
  });

  it('returns the events untouched if the links query fails -- never loses the events', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const client = createFakeSupabase({ errors: { public_event_links: 'view missing' } });
    expect(await attachEventLinks(client, events)).toBe(events);
    spy.mockRestore();
  });

  it('does not query at all for an empty list', async () => {
    const client = createFakeSupabase();
    const spy = vi.spyOn(client, 'from');
    expect(await attachEventLinks(client, [])).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });
});

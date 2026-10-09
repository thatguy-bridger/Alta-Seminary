import { describe, it, expect } from 'vitest';
import { draftToEventPatch, emptyEvent } from './EventDialog.jsx';

const base = { title: '  Fall Fireside ', description: '', location: '', all_day: false, start_at: '2026-10-30T12:30', end_at: '',
  status: 'draft', show_in_announcements: true };

describe('draftToEventPatch (what gets saved)', () => {
  it('trims and normalizes: blank optional fields become null', () => {
    const p = draftToEventPatch(base);
    expect(p).toMatchObject({ title: 'Fall Fireside', description: null, location: null, end_at: null, status: 'draft' });
  });

  it('carries the "Show in announcements" switch', () => {
    expect(draftToEventPatch(base).show_in_announcements).toBe(true);
    expect(draftToEventPatch({ ...base, show_in_announcements: false }).show_in_announcements).toBe(false);
  });

  it('new events default to being shown in announcements', () => {
    expect(emptyEvent().show_in_announcements).toBe(true);
    expect(emptyEvent().status).toBe('draft');
  });

  it('stamps a go-live time when first published, and never resets it on later edits', () => {
    const first = draftToEventPatch({ ...base, status: 'published' });
    expect(first.published_at).toBeTruthy();
    const later = draftToEventPatch({ ...base, status: 'published', published_at: '2026-10-01T00:00:00Z' });
    expect(later).not.toHaveProperty('published_at'); // left alone, so the feed order is stable
  });

  it('does not touch published_at for a draft', () => {
    expect(draftToEventPatch(base)).not.toHaveProperty('published_at');
  });

  it('publishes a customized page along with the event, so the public page shows what was built', () => {
    const blocks = [{ id: 'b1', type: 'rich-text' }];
    expect(draftToEventPatch({ ...base, status: 'published', draft_blocks: blocks, published_blocks: [] }).published_blocks).toEqual(blocks);
  });

  it('does not overwrite already-published page content, or invent content for a page never customized', () => {
    const live = [{ id: 'live' }];
    expect(draftToEventPatch({ ...base, status: 'published', draft_blocks: [{ id: 'new' }], published_blocks: live })).not.toHaveProperty('published_blocks');
    expect(draftToEventPatch({ ...base, status: 'published', draft_blocks: [], published_blocks: [] })).not.toHaveProperty('published_blocks');
  });
});

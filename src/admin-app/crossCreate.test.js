import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseDateTimeFromText, buildCrossCreateDraft, CROSS_CREATE_TARGETS } from './crossCreate.js';

afterEach(() => vi.useRealTimers());

describe('parseDateTimeFromText (smart date parsing)', () => {
  it('reads a month-name date with year and a time', () => {
    const r = parseDateTimeFromText('Fall Fireside -- September 22, 2026 at 7pm');
    expect(r.allDay).toBe(false);
    expect([r.date.getFullYear(), r.date.getMonth(), r.date.getDate(), r.date.getHours()]).toEqual([2026, 8, 22, 19]);
  });

  it('reads minutes and AM/PM correctly (12am, 12:30pm)', () => {
    expect(parseDateTimeFromText('Oct 3 at 12:30pm').date.getHours()).toBe(12);
    expect(parseDateTimeFromText('Oct 3 at 12:30pm').date.getMinutes()).toBe(30);
    expect(parseDateTimeFromText('Oct 3 at 12am').date.getHours()).toBe(0);
  });

  it('treats a date with no time as all-day', () => {
    expect(parseDateTimeFromText('Open house on October 9').allDay).toBe(true);
  });

  it('reads slash dates, with and without a year', () => {
    const full = parseDateTimeFromText('see you 10/9/2026').date;
    expect([full.getFullYear(), full.getMonth(), full.getDate()]).toEqual([2026, 9, 9]);
    const short = parseDateTimeFromText('on 10/9/26').date;
    expect(short.getFullYear()).toBe(2026);
  });

  it('assumes next year for a month/day that has clearly already passed', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 20)); // Oct 20, 2026
    expect(parseDateTimeFromText('Sept 22').date.getFullYear()).toBe(2027);
    expect(parseDateTimeFromText('December 5').date.getFullYear()).toBe(2026);
  });

  it('gives up cleanly when there is nothing date-like (so the admin is asked)', () => {
    expect(parseDateTimeFromText('Come join us for pizza')).toBeNull();
    expect(parseDateTimeFromText('')).toBeNull();
    expect(parseDateTimeFromText(null)).toBeNull();
    expect(parseDateTimeFromText('Room 13/45')).toBeNull(); // month 13 is not a month
  });
});

describe('buildCrossCreateDraft', () => {
  const event = { id: 'e1', title: 'Junior Soda Social', location: 'Assembly Room', all_day: false,
    start_at: '2026-10-30T18:30:00Z', end_at: '2026-10-30T19:30:00Z' };

  it('event -> announcement: prefilled, auto-expires at the event end, nothing missing', () => {
    const { draft, missing } = buildCrossCreateDraft('event', event, 'announcement');
    expect(missing).toEqual([]);
    expect(draft.title).toBe('Junior Soda Social');
    expect(draft.unpublish_at).toBe(event.end_at);
    // Public text is written in the seminary's time zone (Utah), whatever the admin's browser is set to.
    expect(draft.heroSubheading).toBe('October 30, 2026, 12:30 PM · Assembly Room');
    expect(draft.status).toBe('draft');
  });

  it('event -> announcement: falls back to the start time when there is no end', () => {
    const { draft } = buildCrossCreateDraft('event', { ...event, end_at: null }, 'announcement');
    expect(draft.unpublish_at).toBe(event.start_at);
  });

  it('event -> album: named after the event, as a draft', () => {
    const { draft, missing } = buildCrossCreateDraft('event', event, 'album');
    expect(draft).toEqual({ name: 'Junior Soda Social Photos', status: 'draft' });
    expect(missing).toEqual([]);
  });

  it('announcement -> event: pulls the date out of the text when it can', () => {
    const post = { id: 'p1', title: 'Fall Fireside', excerpt: 'Join us on October 9 at 7pm in the chapel.' };
    const { draft, missing } = buildCrossCreateDraft('announcement', post, 'event');
    expect(missing).toEqual([]);
    expect(draft.start_at).toMatch(/-10-09T19:00$/);
    expect(draft.all_day).toBe(false);
    expect(draft.description).toBe('Join us on October 9 at 7pm in the chapel.');
  });

  it('announcement -> event: asks for the start date when the text has none', () => {
    const post = { id: 'p1', title: 'Welcome back', excerpt: 'We are glad you are here.' };
    const { draft, missing } = buildCrossCreateDraft('announcement', post, 'event');
    expect(missing).toEqual(['start_at']);
    expect(draft.start_at).toBe('');
  });

  it('album -> event reads the album name, and asks when there is no date', () => {
    expect(buildCrossCreateDraft('album', { id: 'a1', name: 'Tailgate Party 2026' }, 'event').missing).toEqual(['start_at']);
  });

  it('every kind can create both of the others, and never itself', () => {
    for (const [kind, targets] of Object.entries(CROSS_CREATE_TARGETS)) {
      expect(targets).not.toContain(kind);
      expect(targets).toHaveLength(2);
    }
  });
});

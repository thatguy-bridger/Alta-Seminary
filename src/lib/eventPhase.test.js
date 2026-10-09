import { describe, it, expect } from 'vitest';
import { eventEnd, eventPhase, isPast, isAnnounced } from './eventPhase.js';

const at = (iso) => new Date(iso);
// 12:30 PM Utah (MDT) on Oct 9, 2026
const timed = { start_at: '2026-10-09T18:30:00Z', end_at: '2026-10-09T19:30:00Z', all_day: false };

describe('eventPhase', () => {
  it('is upcoming before the start, live during, past after the end', () => {
    expect(eventPhase(timed, at('2026-10-09T18:29:59Z'))).toBe('upcoming');
    expect(eventPhase(timed, at('2026-10-09T18:30:00Z'))).toBe('live');
    expect(eventPhase(timed, at('2026-10-09T19:29:59Z'))).toBe('live');
    expect(eventPhase(timed, at('2026-10-09T19:30:00Z'))).toBe('past');
  });

  it('gives a timed event with no end time a default length instead of ending it instantly', () => {
    const noEnd = { ...timed, end_at: null };
    expect(eventEnd(noEnd).toISOString()).toBe('2026-10-09T21:30:00.000Z'); // start + 3h
    expect(eventPhase(noEnd, at('2026-10-09T20:00:00Z'))).toBe('live');
    expect(eventPhase(noEnd, at('2026-10-09T21:30:01Z'))).toBe('past');
  });

  it('runs an all-day event through the whole day, not until its midnight start', () => {
    const allDay = { start_at: '2026-10-09T06:00:00Z', end_at: null, all_day: true }; // Oct 9 00:00 Utah
    expect(eventPhase(allDay, at('2026-10-09T20:00:00Z'))).toBe('live');   // that afternoon
    expect(eventPhase(allDay, at('2026-10-10T05:59:00Z'))).toBe('live');   // just before midnight Utah
    expect(eventPhase(allDay, at('2026-10-10T06:00:00Z'))).toBe('past');
  });

  it('includes the last day of a multi-day all-day event', () => {
    const camp = { start_at: '2026-10-09T06:00:00Z', end_at: '2026-10-11T06:00:00Z', all_day: true }; // Oct 9 - Oct 11
    expect(eventPhase(camp, at('2026-10-11T20:00:00Z'))).toBe('live');
    expect(eventPhase(camp, at('2026-10-12T06:00:00Z'))).toBe('past');
  });

  it('isPast is just the past phase', () => {
    expect(isPast(timed, at('2026-11-01T00:00:00Z'))).toBe(true);
    expect(isPast(timed, at('2026-10-01T00:00:00Z'))).toBe(false);
  });
});

describe('isAnnounced (what the announcements feed shows)', () => {
  const upcoming = { ...timed, status: 'published', show_in_announcements: true };
  const before = at('2026-10-01T00:00:00Z');

  it('shows a published, opted-in event that has not ended', () => {
    expect(isAnnounced(upcoming, before)).toBe(true);
    expect(isAnnounced(upcoming, at('2026-10-09T19:00:00Z'))).toBe(true); // still happening
  });

  it('drops it the moment the event is over', () => {
    expect(isAnnounced(upcoming, at('2026-10-09T19:30:00Z'))).toBe(false);
  });

  it('needs the toggle on AND the event published', () => {
    expect(isAnnounced({ ...upcoming, show_in_announcements: false }, before)).toBe(false);
    expect(isAnnounced({ ...upcoming, status: 'draft' }, before)).toBe(false);
  });
});

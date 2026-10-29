import { describe, it, expect } from 'vitest';
import { parseDay, dayNumber, dayFromNumber, todayLocal, hasWeek, weekLabel, isCurrentWeek, weeksUpTo, currentWeek, chooseWeeks, weekOptions, isWeekly } from './weeks.js';

// Four consecutive weeks, Monday to Sunday, the first beginning in December.
const week = (id, start, end, extra = {}) => ({ id, kind: 'comefollowme', title: `Week ${id}`, reference: `Ref ${id}`, week_start: start, week_end: end, ...extra });
const W1 = week('w1', '2025-12-29', '2026-01-04');
const W2 = week('w2', '2026-01-05', '2026-01-11');
const W3 = week('w3', '2026-01-12', '2026-01-18');
const W4 = week('w4', '2026-01-19', '2026-01-25');
const ALL = [W3, W1, W4, W2, { id: 'other', kind: 'scripture', title: 'Not a week' }];       // in no order, with something else among them

describe('days', () => {
  it('reads real calendar dates and nothing else', () => {
    expect(parseDay('2026-01-05')).toEqual({ y: 2026, m: 1, d: 5 });
    for (const bad of ['2026-02-30', '2026-13-01', '2026-1-5', '01/05/2026', '', null, undefined, 20260105, '2026-01-05T00:00']) expect(parseDay(bad), String(bad)).toBeNull();
    expect(parseDay('2024-02-29')).not.toBeNull();                                  // a leap day
    expect(parseDay('2026-02-29')).toBeNull();
  });

  it('counts whole days, across months and years, with no time zone in it', () => {
    expect(dayNumber('2026-01-05') - dayNumber('2025-12-29')).toBe(7);
    expect(dayNumber('2026-03-01') - dayNumber('2026-02-28')).toBe(1);
    expect(dayNumber('2025-12-31') - dayNumber('2025-12-30')).toBe(1);
    expect(Number.isNaN(dayNumber('nope'))).toBe(true);
    expect(dayFromNumber(dayNumber('2026-10-28'))).toBe('2026-10-28');
  });

  it("is today on the student's own calendar", () => {
    expect(todayLocal(new Date(2026, 9, 28, 23, 59))).toBe('2026-10-28');           // late in the evening is still the 28th
    expect(todayLocal(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
    expect(todayLocal(new Date(2026, 11, 3))).toBe('2026-12-03');                    // padded
  });
});

describe('what a week is', () => {
  it('is a Come, Follow Me lesson with both dates, and the end is not before the start', () => {
    expect(isWeekly(W1)).toBe(true);
    expect(isWeekly({ kind: 'scripture' })).toBe(false);
    expect(hasWeek(W1)).toBe(true);
    expect(hasWeek({ ...W1, week_end: null })).toBe(false);
    expect(hasWeek({ ...W1, week_start: '' })).toBe(false);
    expect(hasWeek({ ...W1, week_end: '2025-12-28' })).toBe(false);                  // ends before it begins
    expect(hasWeek({ ...W1, week_start: '2026-02-30' })).toBe(false);
    expect(hasWeek(null)).toBe(false);
    expect(hasWeek({ ...W1, week_end: W1.week_start })).toBe(true);                  // a one-day week is allowed
  });

  it('is written the way the Church writes it', () => {
    expect(weekLabel(W2)).toBe('January 5–11');
    expect(weekLabel(W1)).toBe('December 29–January 4');                            // across a month
    expect(weekLabel(week('x', '2026-08-31', '2026-09-06'))).toBe('August 31–September 6');
    expect(weekLabel({ ...W1, week_end: null })).toBe('');
  });

  it('knows which lesson today falls in, on the first day, the last day, and the days between', () => {
    expect(isCurrentWeek(W2, '2026-01-05')).toBe(true);
    expect(isCurrentWeek(W2, '2026-01-08')).toBe(true);
    expect(isCurrentWeek(W2, '2026-01-11')).toBe(true);
    expect(isCurrentWeek(W2, '2026-01-04')).toBe(false);
    expect(isCurrentWeek(W2, '2026-01-12')).toBe(false);
    expect(isCurrentWeek({ ...W2, week_start: null }, '2026-01-08')).toBe(false);
  });
});

describe('which weeks a student can choose from', () => {
  it('is every week that has begun, newest first, and never one still to come', () => {
    expect(weeksUpTo(ALL, '2026-01-14').map((l) => l.id)).toEqual(['w3', 'w2', 'w1']);   // w4 begins on the 19th
    expect(weeksUpTo(ALL, '2026-01-19').map((l) => l.id)).toEqual(['w4', 'w3', 'w2', 'w1']);   // it can be chosen on its first day
    expect(weeksUpTo(ALL, '2026-01-18').map((l) => l.id)).toEqual(['w3', 'w2', 'w1']);          // and not the day before
  });

  it('has the first week alone before the course begins, so there is always something to show', () => {
    expect(weeksUpTo(ALL, '2025-11-01').map((l) => l.id)).toEqual(['w1']);
  });

  it('keeps the last week available after the course has ended', () => {
    expect(weeksUpTo(ALL, '2027-03-01').map((l) => l.id)).toEqual(['w4', 'w3', 'w2', 'w1']);
    expect(currentWeek(ALL, '2027-03-01').id).toBe('w4');
  });

  it('ignores lessons with no usable dates, and works with none at all', () => {
    expect(weeksUpTo([...ALL, { ...W2, id: 'nodate', week_start: null, week_end: null }], '2026-01-14').map((l) => l.id)).toEqual(['w3', 'w2', 'w1']);
    expect(weeksUpTo([], '2026-01-14')).toEqual([]);
    expect(currentWeek([], '2026-01-14')).toBeNull();
    expect(weeksUpTo(undefined, '2026-01-14')).toEqual([]);
  });

  it('is this week first: the week today falls in', () => {
    expect(currentWeek(ALL, '2026-01-07').id).toBe('w2');
    expect(currentWeek(ALL, '2026-01-12').id).toBe('w3');                              // the first day of a week is already that week
    expect(currentWeek(ALL, '2026-01-11').id).toBe('w2');                              // and the last day is still the old one
  });
});

describe('which lessons a journey gets', () => {
  const ids = (n, opts) => chooseWeeks(ALL, n, { day: '2026-01-22', ...opts });

  it('is this week for one pick', () => {
    expect(ids(1)).toEqual(['w4']);
  });

  it('is the chosen week instead, when the student chose an earlier one', () => {
    expect(ids(1, { weekId: 'w2' })).toEqual(['w2']);
  });

  it('goes back a week at a time for more picks: this week, then the week before it, and so on', () => {
    expect(ids(3)).toEqual(['w4', 'w3', 'w2']);
    expect(ids(2, { weekId: 'w3' })).toEqual(['w3', 'w2']);
  });

  it('turns to later weeks that have begun when it runs out of earlier ones, and does not repeat while there is another', () => {
    expect(ids(4, { weekId: 'w2' })).toEqual(['w2', 'w1', 'w3', 'w4']);                 // earlier first, then the nearest later ones
    expect(new Set(ids(4)).size).toBe(4);
  });

  it('only repeats a week when there are more picks than weeks', () => {
    expect(ids(5)).toEqual(['w4', 'w3', 'w2', 'w1', 'w4']);
    expect(chooseWeeks([W1], 3, { day: '2026-01-01' })).toEqual(['w1', 'w1', 'w1']);
  });

  it('ignores a chosen week that is not there (removed, or not begun yet) and gives this week', () => {
    expect(ids(1, { weekId: 'gone' })).toEqual(['w4']);
    expect(chooseWeeks(ALL, 1, { day: '2026-01-14', weekId: 'w4' })).toEqual(['w3']);   // w4 has not begun on the 14th
  });

  it('is nothing when there are no weeks or no picks', () => {
    expect(chooseWeeks([], 2, { day: '2026-01-22' })).toEqual([]);
    expect(ids(0)).toEqual([]);
  });
});

describe('what the student sees in the list', () => {
  it('is each week that has begun, newest first, with a label, marking this week', () => {
    const opts = weekOptions(ALL, '2026-01-14');
    expect(opts.map((o) => o.label)).toEqual(['January 12–18 (this week)', 'January 5–11', 'December 29–January 4']);
    expect(opts.map((o) => o.current)).toEqual([true, false, false]);
    expect(opts[0]).toMatchObject({ id: 'w3', title: 'Week w3', reference: 'Ref w3' });
  });

  it('has no "this week" once the course is over, but still the weeks', () => {
    const opts = weekOptions(ALL, '2027-03-01');
    expect(opts).toHaveLength(4);
    expect(opts.some((o) => o.current)).toBe(false);
  });
});

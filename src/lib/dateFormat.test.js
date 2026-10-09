import { describe, it, expect, afterEach } from 'vitest';
import { formatSiteDate, formatSiteTime } from './dateFormat.js';

// 18:30 UTC is 12:30 PM in Utah during daylight time (UTC-6)...
const OCT_9_NOON_UTAH = '2026-10-09T18:30:00Z';
// ...and 19:30 UTC is 12:30 PM during standard time (UTC-7).
const DEC_1_NOON_UTAH = '2026-12-01T19:30:00Z';

describe('site date formatting', () => {
  const originalTz = process.env.TZ;
  afterEach(() => { process.env.TZ = originalTz; });

  it('formats in the seminary time zone, including across daylight saving', () => {
    expect(formatSiteDate(OCT_9_NOON_UTAH)).toBe('Oct 9');
    expect(formatSiteTime(OCT_9_NOON_UTAH)).toBe('12:30 PM');
    expect(formatSiteTime(DEC_1_NOON_UTAH)).toBe('12:30 PM');
  });

  it('puts a late-evening UTC time on the correct Utah calendar day', () => {
    // 02:00 UTC on Oct 10 is still the evening of Oct 9 in Utah.
    expect(formatSiteDate('2026-10-10T02:00:00Z')).toBe('Oct 9');
  });

  // The regression this module exists for: the server renders in UTC and a
  // visitor's browser in their own zone. If output depended on the runtime
  // zone, the two would differ and React would throw hydration error #418.
  it('gives identical text no matter what time zone the code runs in', () => {
    const results = ['UTC', 'America/Denver', 'America/Los_Angeles', 'Asia/Tokyo'].map((tz) => {
      process.env.TZ = tz;
      return [formatSiteDate(OCT_9_NOON_UTAH), formatSiteTime(OCT_9_NOON_UTAH),
        formatSiteDate(OCT_9_NOON_UTAH, { month: 'long', day: 'numeric', year: 'numeric' })].join('|');
    });
    expect(new Set(results).size).toBe(1);
    expect(results[0]).toBe('Oct 9|12:30 PM|October 9, 2026');
  });

  it('supports custom options', () => {
    expect(formatSiteDate(OCT_9_NOON_UTAH, { month: 'short', day: 'numeric', year: 'numeric' })).toBe('Oct 9, 2026');
  });
});

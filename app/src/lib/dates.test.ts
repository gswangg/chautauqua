import { describe, expect, it } from 'vitest';
import {
  dateInputToMs,
  daysAgo,
  daysUntil,
  epochDayIndex,
  formatDate,
  formatDateOnly,
  formatDateTime,
  formatDateTimeInZone,
  formatDayInput,
  formatDayLabel,
  formatRelative,
  formatRelativeDays,
  msToDateInput,
  parseDayInput,
} from './dates';
import { dayLabelEndInstant } from '../../../src/lib/timezone';

describe('msToDateInput', () => {
  it('returns empty string for null', () => {
    expect(msToDateInput(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(msToDateInput(undefined)).toBe('');
  });

  it('returns empty string for NaN', () => {
    expect(msToDateInput(NaN)).toBe('');
  });

  it('formats a valid timestamp as yyyy-mm-dd', () => {
    const ms = Date.UTC(2026, 0, 15);
    expect(msToDateInput(ms)).toBe('2026-01-15');
  });
});

describe('dateInputToMs', () => {
  it('returns null for empty string', () => {
    expect(dateInputToMs('')).toBeNull();
  });

  it('parses a valid yyyy-mm-dd value', () => {
    expect(dateInputToMs('2026-01-15')).toBe(Date.UTC(2026, 0, 15));
  });

  it('throws for an invalid value', () => {
    expect(() => dateInputToMs('not-a-date')).toThrow();
  });
});

describe('formatDate', () => {
  it('returns em dash for null', () => {
    expect(formatDate(null)).toBe('—');
  });

  it('returns em dash for undefined', () => {
    expect(formatDate(undefined)).toBe('—');
  });

  it('returns em dash for NaN', () => {
    expect(formatDate(NaN)).toBe('—');
  });

  it('formats a valid timestamp as "<D> <Mon>" when in the current year', () => {
    const now = new Date();
    const ms = new Date(now.getFullYear(), 0, 15).getTime();
    expect(formatDate(ms)).toBe('15 Jan');
  });

  it('appends the year when the date falls outside the current year', () => {
    const pastYear = new Date().getFullYear() - 3;
    const ms = new Date(pastYear, 1, 19).getTime();
    expect(formatDate(ms)).toBe(`19 Feb ${pastYear}`);
  });
});

describe('formatDateOnly', () => {
  it('returns em dash for null', () => {
    expect(formatDateOnly(null)).toBe('—');
  });

  it('returns em dash for undefined', () => {
    expect(formatDateOnly(undefined)).toBe('—');
  });

  it('returns em dash for NaN', () => {
    expect(formatDateOnly(NaN)).toBe('—');
  });

  it('renders the entered calendar date regardless of local timezone', () => {
    const ms = Date.UTC(2027, 4, 25); // 2027-05-25T00:00:00.000Z
    expect(formatDateOnly(ms)).toBe('25 May 2027');
  });
});

describe('formatDateTime', () => {
  it('returns em dash for null', () => {
    expect(formatDateTime(null)).toBe('—');
  });

  it('returns em dash for undefined', () => {
    expect(formatDateTime(undefined)).toBe('—');
  });

  it('returns em dash for NaN', () => {
    expect(formatDateTime(NaN)).toBe('—');
  });

  it('returns em dash for an invalid date value', () => {
    expect(formatDateTime(new Date('x').getTime())).toBe('—');
  });

  it('formats a valid timestamp as "<D> <Mon>, HH:MM" (24-hour)', () => {
    const ms = new Date(2026, 0, 15, 13, 30).getTime();
    expect(formatDateTime(ms)).toBe('15 Jan, 13:30');
  });

  it('pads single-digit hours and minutes', () => {
    const ms = new Date(2026, 0, 5, 9, 5).getTime();
    expect(formatDateTime(ms)).toBe('5 Jan, 09:05');
  });
});

describe('formatRelative', () => {
  const now = new Date(2026, 5, 15, 12, 0, 0).getTime();

  it('returns em dash for null/undefined/NaN', () => {
    expect(formatRelative(null, now)).toBe('—');
    expect(formatRelative(undefined, now)).toBe('—');
    expect(formatRelative(NaN, now)).toBe('—');
  });

  it('returns "just now" for under a minute', () => {
    expect(formatRelative(now - 30_000, now)).toBe('just now');
  });

  it('returns "N minutes ago" under an hour', () => {
    expect(formatRelative(now - 5 * 60_000, now)).toBe('5 minutes ago');
    expect(formatRelative(now - 1 * 60_000, now)).toBe('1 minute ago');
  });

  it('returns "N hours ago" under a day', () => {
    expect(formatRelative(now - 3 * 3_600_000, now)).toBe('3 hours ago');
    expect(formatRelative(now - 1 * 3_600_000, now)).toBe('1 hour ago');
  });

  it('returns "N days ago" up to 7 days', () => {
    expect(formatRelative(now - 2 * 86_400_000, now)).toBe('2 days ago');
    expect(formatRelative(now - 6 * 86_400_000, now)).toBe('6 days ago');
  });

  it('falls back to formatDate past 7 days', () => {
    const ms = now - 8 * 86_400_000;
    expect(formatRelative(ms, now)).toBe(formatDate(ms));
  });
});

describe('formatDayLabel', () => {
  it('returns em dash for null/undefined/empty', () => {
    expect(formatDayLabel(null)).toBe('—');
    expect(formatDayLabel(undefined)).toBe('—');
    expect(formatDayLabel('')).toBe('—');
  });

  it('returns em dash for a value that is not YYYY-MM-DD', () => {
    expect(formatDayLabel('not-a-date')).toBe('—');
    expect(formatDayLabel('2026-06-01T00:00:00.000Z')).toBe('—');
  });

  it('formats a calendar date as "Weekday D Mon"', () => {
    expect(formatDayLabel('2026-06-01')).toBe('Mon 1 Jun');
  });

  it('reads the literal calendar date regardless of ambient timezone (never shifts via a UTC-instant reinterpretation)', () => {
    // 2027-05-12 is a Wednesday.
    expect(formatDayLabel('2027-05-12')).toBe('Wed 12 May');
  });
});

describe('daysUntil', () => {
  // DEC-831: the ONE days-until reader -- pins the fix for the w40 finding
  // where overview/rows.ts's raw Math.round vs CallForPapersPanel/
  // ReviewerQueue's Math.ceil-through-tz answered 17 vs 19 for one deadline
  // whose true answer was 18.
  const TODAY_LABEL = Date.UTC(2027, 0, 1);
  const TODAY_END = dayLabelEndInstant(TODAY_LABEL, 'UTC');

  it('returns 18 for a close date 18 calendar days ahead in the event zone', () => {
    const closeLabel = TODAY_LABEL + 18 * 86_400_000;
    expect(daysUntil(closeLabel, 'UTC', TODAY_END)).toBe(18);
  });

  it('returns 0 for a same-day close, never a negative', () => {
    expect(daysUntil(TODAY_LABEL, 'UTC', TODAY_END)).toBe(0);
    // Well past the close day's end -- clamped to 0, not negative.
    expect(daysUntil(TODAY_LABEL, 'UTC', TODAY_END + 5 * 86_400_000)).toBe(0);
  });
});

describe('daysAgo', () => {
  // DEC-831 amendment (wave 54): the ONE 'how many days ago' reader --
  // daysUntil's mirror. Four hand-rolled formulas (Math.floor, Math.round
  // x2, Math.ceil) previously answered the same "days ago" question
  // differently for the same instant.
  const NOW = Date.UTC(2027, 0, 19);

  it('returns whole days elapsed, floored', () => {
    expect(daysAgo(NOW - 6 * 86_400_000, NOW)).toBe(6);
    expect(daysAgo(NOW - 6 * 86_400_000 - 1, NOW)).toBe(6);
    expect(daysAgo(NOW - 6 * 86_400_000 - 86_400_000 + 1, NOW)).toBe(6);
  });

  it('clamps to 0 for a future or just-now instant, never negative', () => {
    expect(daysAgo(NOW, NOW)).toBe(0);
    expect(daysAgo(NOW + 86_400_000, NOW)).toBe(0);
  });
});

describe('formatRelativeDays', () => {
  it('calls through daysAgo\'s floor convention', () => {
    const now = Date.UTC(2027, 0, 19);
    expect(formatRelativeDays(now, now)).toBe('today');
    expect(formatRelativeDays(now - 86_400_000, now)).toBe('yesterday');
    expect(formatRelativeDays(now - 3 * 86_400_000, now)).toBe('3 days ago');
  });
});

describe('epochDayIndex', () => {
  it('increases by exactly 1 per whole calendar day in the given zone', () => {
    const day1 = Date.UTC(2027, 0, 19, 12);
    const day2 = day1 + 86_400_000;
    expect(epochDayIndex(day2, 'UTC') - epochDayIndex(day1, 'UTC')).toBe(1);
  });

  it('reads the same instant differently across zones near a day boundary', () => {
    // 23:30 UTC on Jan 18 is already Jan 19 in a UTC+1 zone.
    const lateEveningUtc = Date.UTC(2027, 0, 18, 23, 30);
    expect(epochDayIndex(lateEveningUtc, 'UTC')).toBe(epochDayIndex(Date.UTC(2027, 0, 18), 'UTC'));
    expect(epochDayIndex(lateEveningUtc, 'Europe/Paris')).toBe(epochDayIndex(Date.UTC(2027, 0, 19), 'UTC'));
  });
});

describe('formatDateTimeInZone', () => {
  it('formats a fixed instant in a given IANA zone', () => {
    const iso = '2026-01-15T13:30:00.000Z';
    expect(formatDateTimeInZone(iso, 'America/Los_Angeles')).toBe('15 Jan 2026, 05:30');
  });
});

describe('formatDayInput (DEC-146 amendment)', () => {
  it('formats a yyyy-mm-dd string as "D Mon YYYY"', () => {
    expect(formatDayInput('2028-05-11')).toBe('11 May 2028');
  });

  it('returns empty string for empty input', () => {
    expect(formatDayInput('')).toBe('');
  });

  it('returns empty string for an invalid calendar date', () => {
    expect(formatDayInput('2028-02-30')).toBe('');
  });

  it('returns empty string for a malformed string', () => {
    expect(formatDayInput('05/11/2028')).toBe('');
  });
});

describe('parseDayInput (DEC-146 amendment)', () => {
  it('parses "11 May 2028"', () => {
    expect(parseDayInput('11 May 2028')).toBe('2028-05-11');
  });

  it('parses "11 may 2028" (lowercase month)', () => {
    expect(parseDayInput('11 may 2028')).toBe('2028-05-11');
  });

  it('parses "2028-05-11" (the wire format itself)', () => {
    expect(parseDayInput('2028-05-11')).toBe('2028-05-11');
  });

  it('rejects an empty string', () => {
    expect(parseDayInput('')).toBeNull();
  });

  it('rejects garbage text', () => {
    expect(parseDayInput('not a date')).toBeNull();
  });

  it('rejects a US-locale slash format', () => {
    expect(parseDayInput('05/11/2028')).toBeNull();
  });

  it('rejects an out-of-range calendar date', () => {
    expect(parseDayInput('30 Feb 2028')).toBeNull();
  });

  it('rejects an unknown month name', () => {
    expect(parseDayInput('11 Zzz 2028')).toBeNull();
  });

  it('parses "May 1, 2027" (month-first with comma)', () => {
    expect(parseDayInput('May 1, 2027')).toBe('2027-05-01');
  });

  it('parses "May 1 2027" (month-first without comma)', () => {
    expect(parseDayInput('May 1 2027')).toBe('2027-05-01');
  });

  it('parses "Sep 01 2026" (month-first, zero-padded day)', () => {
    expect(parseDayInput('Sep 01 2026')).toBe('2026-09-01');
  });

  it('parses "december 25, 2029" (month-first, lowercase full month name)', () => {
    expect(parseDayInput('december 25, 2029')).toBe('2029-12-25');
  });

  it('rejects a month-first out-of-range calendar date', () => {
    expect(parseDayInput('Feb 30, 2028')).toBeNull();
  });

  it('still rejects an all-numeric slash form as ambiguous', () => {
    expect(parseDayInput('05/01/2028')).toBeNull();
  });
});

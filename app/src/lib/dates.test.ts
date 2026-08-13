import { describe, expect, it } from 'vitest';
import {
  dateInputToMs,
  formatDate,
  formatDateOnly,
  formatDateTime,
  formatDateTimeInZone,
  formatDayLabel,
  formatRelative,
  msToDateInput,
} from './dates';

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

describe('formatDateTimeInZone', () => {
  it('formats a fixed instant in a given IANA zone', () => {
    const iso = '2026-01-15T13:30:00.000Z';
    expect(formatDateTimeInZone(iso, 'America/Los_Angeles')).toBe('15 Jan 2026, 05:30');
  });
});

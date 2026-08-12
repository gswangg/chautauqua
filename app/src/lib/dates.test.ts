import { describe, expect, it } from 'vitest';
import { dateInputToMs, formatDate, formatDateOnly, formatDateTime, formatDateTimeInZone, msToDateInput } from './dates';

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

  it('formats a valid timestamp', () => {
    const ms = Date.UTC(2026, 0, 15);
    expect(formatDate(ms)).toBe(new Date(ms).toLocaleDateString());
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
    const expected = new Intl.DateTimeFormat(undefined, {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).format(new Date(ms));
    expect(formatDateOnly(ms)).toBe(expected);
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

  it('formats a valid timestamp matching toLocaleString', () => {
    const ms = Date.UTC(2026, 0, 15, 13, 30);
    expect(formatDateTime(ms)).toBe(new Date(ms).toLocaleString());
  });
});

describe('formatDateTimeInZone', () => {
  it('formats a fixed instant in a given IANA zone', () => {
    const iso = '2026-01-15T13:30:00.000Z';
    const expected = new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/Los_Angeles',
    });
    expect(formatDateTimeInZone(iso, 'America/Los_Angeles')).toBe(expected);
  });
});

import { describe, expect, it } from 'vitest';
import { dateInputToMs, formatDate, msToDateInput } from './dates';

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

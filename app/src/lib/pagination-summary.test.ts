import { describe, expect, it } from 'vitest';
import { paginationSummary } from './pagination-summary';

describe('paginationSummary (DEC-906 wave-9 amendment)', () => {
  it('total === 0 returns "Showing 0 of 0", never a 0–0 range', () => {
    expect(paginationSummary(1, 50, 0)).toBe('Showing 0 of 0');
  });

  it('first page of a full result set', () => {
    expect(paginationSummary(1, 50, 340)).toBe('Showing 1–50 of 340');
  });

  it('last, partial page', () => {
    expect(paginationSummary(7, 50, 340)).toBe('Showing 301–340 of 340');
  });

  it('shownOnPage override drives the end when the actual row count, not perPage, determines it', () => {
    // page 2 of a 25-per-page grid where only 3 rows actually rendered on
    // this page (e.g. a trailing partial page short of a full perPage).
    expect(paginationSummary(2, 25, 28, 3)).toBe('Showing 26–28 of 28');
  });

  it('renders a real U+2013 EN DASH codepoint, never an ASCII hyphen or an &ndash; entity', () => {
    const result = paginationSummary(1, 10, 25);
    expect(result).toContain('–');
    expect(result).not.toContain('-');
    expect(result).not.toContain('&ndash;');
  });
});

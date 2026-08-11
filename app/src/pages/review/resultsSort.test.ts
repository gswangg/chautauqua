import { describe, expect, it } from 'vitest';
import { sortResultsRows, sortValueForColumn } from './resultsSort';
import type { SortableResultsRow } from './resultsSort';

const rows: SortableResultsRow[] = [
  {
    ref: 'B-2',
    average: 3,
    count: 2,
    perCriterion: { quality: 3 },
    perDropdown: { length: { counts: { short: 1, long: 1 }, modal: 'short' } },
  },
  {
    ref: 'A-1',
    average: 5,
    count: 1,
    perCriterion: { quality: 5 },
    perDropdown: { length: { counts: { short: 0, long: 3 }, modal: 'long' } },
  },
  {
    ref: 'C-3',
    average: 4,
    count: 5,
    perCriterion: { quality: 4 },
    perDropdown: { length: { counts: {}, modal: null } },
  },
];

describe('sortValueForColumn', () => {
  it('reads ref as the string itself', () => {
    expect(sortValueForColumn(rows[0]!, { column: 'ref' })).toBe('B-2');
  });

  it('reads average and count directly', () => {
    expect(sortValueForColumn(rows[0]!, { column: 'average' })).toBe(3);
    expect(sortValueForColumn(rows[0]!, { column: 'count' })).toBe(2);
  });

  it('reads a rating column from perCriterion, defaulting to 0 when absent', () => {
    expect(sortValueForColumn(rows[0]!, { column: 'rating', criterionId: 'quality' })).toBe(3);
    expect(sortValueForColumn(rows[0]!, { column: 'rating', criterionId: 'missing' })).toBe(0);
  });

  it('reads a dropdown column as the modal option count, 0 when there is no modal', () => {
    expect(sortValueForColumn(rows[0]!, { column: 'dropdown', criterionId: 'length' })).toBe(1);
    expect(sortValueForColumn(rows[1]!, { column: 'dropdown', criterionId: 'length' })).toBe(3);
    expect(sortValueForColumn(rows[2]!, { column: 'dropdown', criterionId: 'length' })).toBe(0);
  });
});

describe('sortResultsRows', () => {
  it('sorts by ref ascending/descending as a string', () => {
    expect(sortResultsRows(rows, { column: 'ref' }, 'asc').map((r) => r.ref)).toEqual(['A-1', 'B-2', 'C-3']);
    expect(sortResultsRows(rows, { column: 'ref' }, 'desc').map((r) => r.ref)).toEqual(['C-3', 'B-2', 'A-1']);
  });

  it('sorts by average and count numerically', () => {
    expect(sortResultsRows(rows, { column: 'average' }, 'asc').map((r) => r.ref)).toEqual(['B-2', 'C-3', 'A-1']);
    expect(sortResultsRows(rows, { column: 'count' }, 'desc').map((r) => r.ref)).toEqual(['C-3', 'B-2', 'A-1']);
  });

  it('sorts by a rating criterion column', () => {
    expect(sortResultsRows(rows, { column: 'rating', criterionId: 'quality' }, 'asc').map((r) => r.ref)).toEqual([
      'B-2',
      'C-3',
      'A-1',
    ]);
  });

  it('sorts by a dropdown criterion column using the modal count', () => {
    expect(sortResultsRows(rows, { column: 'dropdown', criterionId: 'length' }, 'asc').map((r) => r.ref)).toEqual([
      'C-3',
      'B-2',
      'A-1',
    ]);
  });

  it('does not mutate the input array', () => {
    const copy = [...rows];
    sortResultsRows(rows, { column: 'average' }, 'asc');
    expect(rows).toEqual(copy);
  });

  it('keeps tied rows in their original relative order regardless of direction', () => {
    const tied: SortableResultsRow[] = [
      { ref: 'X', average: 1, count: 0, perCriterion: {}, perDropdown: {} },
      { ref: 'Y', average: 1, count: 0, perCriterion: {}, perDropdown: {} },
      { ref: 'Z', average: 1, count: 0, perCriterion: {}, perDropdown: {} },
    ];
    expect(sortResultsRows(tied, { column: 'average' }, 'asc').map((r) => r.ref)).toEqual(['X', 'Y', 'Z']);
    expect(sortResultsRows(tied, { column: 'average' }, 'desc').map((r) => r.ref)).toEqual(['X', 'Y', 'Z']);
  });
});

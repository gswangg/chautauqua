// DEC-241: client-side sort toggles for the results table (results are one
// bounded plan's rows, not a paginated table, so sorting happens entirely in
// the browser against the already-loaded rows). Pure, DOM-free so it's
// testable without a component render.

export type SortDirection = 'asc' | 'desc';

/** The minimal row shape the sort helper needs -- matches ResultsRow. */
export interface SortableResultsRow {
  ref: string;
  average: number;
  count: number;
  perCriterion: Record<string, number>;
  perDropdown: Record<string, { counts: Record<string, number>; modal: string | null }>;
}

export type ResultsSortKey =
  | { column: 'ref' }
  | { column: 'average' }
  | { column: 'count' }
  | { column: 'rating'; criterionId: string }
  | { column: 'dropdown'; criterionId: string };

/**
 * Extracts the comparable value for a column: Ref sorts as a string; average
 * and # Evaluations sort as their own numbers; a rating-criterion column
 * sorts by its perCriterion mean (0 when absent -- mirrors the table's '—'
 * display, which reads a missing entry as 0); a dropdown-criterion column
 * sorts by its modal option's count (the number rendered as 'modal xN'), 0
 * when there's no modal (no evaluations yet).
 */
export function sortValueForColumn(row: SortableResultsRow, key: ResultsSortKey): number | string {
  switch (key.column) {
    case 'ref':
      return row.ref;
    case 'average':
      return row.average;
    case 'count':
      return row.count;
    case 'rating':
      return row.perCriterion[key.criterionId] ?? 0;
    case 'dropdown': {
      const agg = row.perDropdown[key.criterionId];
      if (!agg || agg.modal === null) return 0;
      return agg.counts[agg.modal] ?? 0;
    }
  }
}

function compareValues(a: number | string, b: number | string): number {
  if (typeof a === 'string' && typeof b === 'string') {
    if (a === b) return 0;
    return a < b ? -1 : 1;
  }
  return (a as number) - (b as number);
}

/**
 * Sorts a copy of `rows` by the given column/direction. Ties keep their
 * original relative order (Array.prototype.sort is stable, and negating the
 * comparator for 'desc' preserves that -- 0 stays 0 either way) so a
 * direction toggle never reshuffles equal rows.
 */
export function sortResultsRows<T extends SortableResultsRow>(
  rows: T[],
  key: ResultsSortKey,
  direction: SortDirection,
): T[] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => sign * compareValues(sortValueForColumn(a, key), sortValueForColumn(b, key)));
}

// Evaluation domain core (SPEC J4), pure module (DEC-002): no node:/cloudflare/
// drizzle imports, plain interfaces only — testable under plain vitest.
//
// Split out of the former monolithic src/domain/evaluation.ts (contention
// decomposition, no behavior change) -- see src/domain/evaluation.ts for
// the re-export barrel.

export interface ResultsRowInput {
  submissionId: string;
  average: number;
  count: number;
}

/**
 * Producer results table rows: sorted by average score descending, then by
 * count descending as a tiebreaker (more-rated submissions rank higher when
 * averages tie).
 */
export function buildResultsRows<T extends ResultsRowInput>(subs: T[]): T[] {
  return [...subs].sort((a, b) => {
    if (a.average !== b.average) return b.average - a.average;
    if (a.count !== b.count) return b.count - a.count;
    return 0;
  });
}

/**
 * Stamps each row with its SCORE rank -- its standing in the ranked order
 * buildResultsRows produces (average desc, then count desc) -- so the
 * table's Rank column stays tied to the score and not to whatever order the
 * reader has currently sorted the rows into. Toggling a column sort
 * ascending must reorder the rows without renumbering them 1..N top-down.
 *
 * Standard competition ranking: rows equal on BOTH ranking keys share a
 * rank, and the next distinct row takes the position it actually occupies
 * (1, 2, 2, 4). Input MUST already be in buildResultsRows order.
 */
export function assignScoreRanks<T extends ResultsRowInput>(ranked: T[]): (T & { rank: number })[] {
  let lastRank = 0;
  let lastAverage: number | null = null;
  let lastCount: number | null = null;
  return ranked.map((row, index) => {
    if (lastAverage === null || row.average !== lastAverage || row.count !== lastCount) {
      lastRank = index + 1;
      lastAverage = row.average;
      lastCount = row.count;
    }
    return { ...row, rank: lastRank };
  });
}

// DEC-345: results-table column sort, moved verbatim from the former SPA
// module app/src/pages/review/resultsSort.ts into pure core so the
// GET /api/v1/plans/:id/results route can sort server-side over the WHOLE
// ranked set before paging (DEC-341's paging-without-sorting bug class).

export type SortDirection = "asc" | "desc";

/** The minimal row shape the sort helper needs -- matches ResultsRow. */
export interface SortableResultsRow {
  ref: string;
  // DEC-345 addition (beyond the resultsSort.ts port): the results route's
  // ?sort= param also accepts 'title', for a server-side title sort.
  title?: string;
  average: number;
  count: number;
  perCriterion: Record<string, number>;
  perDropdown: Record<string, { counts: Record<string, number>; modal: string | null }>;
}

export type ResultsSortKey =
  | { column: "ref" }
  | { column: "title" }
  | { column: "average" }
  | { column: "count" }
  | { column: "rating"; criterionId: string }
  | { column: "dropdown"; criterionId: string };

/**
 * Extracts the comparable value for a column: Ref/Title sort as strings;
 * average and # Evaluations sort as their own numbers; a rating-criterion
 * column sorts by its perCriterion mean (0 when absent -- mirrors the
 * table's '—' display, which reads a missing entry as 0); a
 * dropdown-criterion column sorts by its modal option's count (the number
 * rendered as 'modal xN'), 0 when there's no modal (no evaluations yet).
 */
export function sortValueForColumn(row: SortableResultsRow, key: ResultsSortKey): number | string {
  switch (key.column) {
    case "ref":
      return row.ref;
    case "title":
      return row.title ?? "";
    case "average":
      return row.average;
    case "count":
      return row.count;
    case "rating":
      return row.perCriterion[key.criterionId] ?? 0;
    case "dropdown": {
      const agg = row.perDropdown[key.criterionId];
      if (!agg || agg.modal === null) return 0;
      return agg.counts[agg.modal] ?? 0;
    }
  }
}

function compareResultsValues(a: number | string, b: number | string): number {
  if (typeof a === "string" && typeof b === "string") {
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
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => sign * compareResultsValues(sortValueForColumn(a, key), sortValueForColumn(b, key)));
}

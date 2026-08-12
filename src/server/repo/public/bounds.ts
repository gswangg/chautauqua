// DEC-433: public paging LIMIT ceiling. parsePage (src/routes/public/query.ts)
// already clamps `page` to [1, MAX_PUBLIC_PAGE], but `perPage`/`limit` can
// still be attacker-controlled (e.g. ?limit=100&page=50 => 5000 rows), and
// Number.isInteger(1e308) === true so a non-finite-after-multiply value can
// otherwise reach the SQL LIMIT clause undetected. boundedRowLimit is the
// single choke point for the row count passed to db.limit() on the public
// sessions/speakers list queries.

// DEC-477/DEC-487: this is the ONE home for every public-surface paging
// constant — PUBLIC_PER_PAGE (page size), MAX_PUBLIC_PAGE (deepest page
// number), and MAX_PUBLIC_ROWS (their product, never a second literal).
// Previously MAX_PUBLIC_PAGE lived in src/routes/public/query.ts and
// PER_PAGE lived in src/routes/public/shell.tsx, with MAX_PUBLIC_ROWS
// hand-kept in lockstep here — a change to either source constant could
// silently desync the ceiling. Both are deleted from their old homes;
// every importer now points here.
export const PUBLIC_PER_PAGE = 12;
export const MAX_PUBLIC_PAGE = 100;
export const MAX_PUBLIC_ROWS = MAX_PUBLIC_PAGE * PUBLIC_PER_PAGE;

function assertFiniteIntGte1(n: number, name: string): void {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`boundedRowLimit: ${name} must be a finite integer >= 1, got ${n}`);
  }
}

export function boundedRowLimit(page: number, perPage: number): number {
  assertFiniteIntGte1(page, "page");
  assertFiniteIntGte1(perPage, "perPage");
  return Math.min(page * perPage, MAX_PUBLIC_ROWS);
}

// DEC-477/DEC-487: single 'Show more' predicate for every public surface
// (sessions/speakers/gallery). `shown` is the total item count already
// rendered across pages 1..page (i.e. what the caller is about to display,
// not merely the current page's item count). Three independent reasons to
// stop offering another page: the result set is exhausted (shown >= total),
// parsePage's clamp means there's no page+1 to link to (page >= the page
// ceiling), or the next page would sit at/beyond the row ceiling (a large
// ?limit= embed can hit MAX_PUBLIC_ROWS well before MAX_PUBLIC_PAGE).
export function hasMorePages(shown: number, total: number, page: number, perPage: number): boolean {
  return shown < total && page < MAX_PUBLIC_PAGE && page * perPage < MAX_PUBLIC_ROWS;
}

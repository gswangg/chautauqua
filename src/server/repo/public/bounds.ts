// DEC-433: public paging LIMIT ceiling. parsePage (src/routes/public/query.ts)
// already clamps `page` to [1, MAX_PUBLIC_PAGE], but `perPage`/`limit` can
// still be attacker-controlled (e.g. ?limit=100&page=50 => 5000 rows), and
// Number.isInteger(1e308) === true so a non-finite-after-multiply value can
// otherwise reach the SQL LIMIT clause undetected. boundedRowLimit is the
// single choke point for the row count passed to db.limit() on the public
// sessions/speakers list queries.

export const MAX_PUBLIC_ROWS = 600;

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

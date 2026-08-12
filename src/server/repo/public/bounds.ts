// DEC-433: public paging LIMIT ceiling. parsePage (src/routes/public/query.ts)
// already clamps `page` to [1, MAX_PUBLIC_PAGE], but `perPage`/`limit` can
// still be attacker-controlled (e.g. ?limit=100&page=50 => 5000 rows), and
// Number.isInteger(1e308) === true so a non-finite-after-multiply value can
// otherwise reach the SQL LIMIT clause undetected. boundedRowLimit is the
// single choke point for the row count passed to db.limit() on the public
// sessions/speakers list queries.

// DEC-477: MAX_PUBLIC_ROWS = MAX_PUBLIC_PAGE(100, src/routes/public/query.ts)
// x PER_PAGE(12, src/routes/public/shell.tsx) = 1200 — clears SPEC.md:73-76's
// top-of-range 800 speakers so every seeded speaker is reachable via
// pagination instead of being silently truncated by this row ceiling.
export const MAX_PUBLIC_ROWS = 1200;

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

// Pure helpers for scripts/perf-smoke.ts, extracted for plain-vitest
// testing (dependency-free, no network/filesystem access — same pattern as
// scripts/seed-lib.ts / scripts/perf-seed-lib.ts). DEC-034.

/** Local-HTTP p95 budget (ms): the SPEC's 50ms budget is server time;
 * localhost adds client overhead, and 150ms still catches N+1s / full
 * table scans at 2k rows. */
export const PERF_P95_BUDGET_MS = 150;

/**
 * 95th-percentile of a sample set, nearest-rank method: sort ascending,
 * take the ceil(0.95 * n)-th smallest sample (1-indexed), clamped to the
 * last element. Throws on an empty sample set — there is no percentile of
 * nothing, and silently returning 0 would hide a harness bug.
 */
export function computeP95(samplesMs: readonly number[]): number {
  if (samplesMs.length === 0) {
    throw new Error("computeP95: samplesMs must be non-empty");
  }
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const rank = Math.ceil(0.95 * sorted.length);
  const index = Math.min(Math.max(rank - 1, 0), sorted.length - 1);
  return sorted[index]!;
}

/**
 * Comma-joins a list of ids for a schedule.ics?ids= query string, matching
 * the walkthrough's own client-side join (see the inline itinerary script
 * in src/routes/public.tsx). Throws on an empty list — an empty ?ids= is a
 * harness bug, not a valid probe input (DEC-089).
 */
export function joinIcsIds(ids: readonly string[]): string {
  if (ids.length === 0) {
    throw new Error("joinIcsIds: ids must be non-empty");
  }
  return ids.join(",");
}

/**
 * Plans the page/perPage sequence needed to accumulate `count` items given
 * a server-side perPage cap (DEC-094: src/lib/pagination.ts clamps perPage
 * to 200, so a single perPage=301 request silently returns fewer than
 * asked). Every planned page uses the *same* perPage=maxPerPage — the
 * server computes each page's offset as (page-1)*perPage using that
 * request's own perPage, so varying perPage across pages (e.g. 200 then
 * a 100-sized remainder page) produces an offset mismatch and duplicate/
 * skipped rows rather than a clean walk through the full result set.
 * Throws on non-positive count or maxPerPage — there is no sane page plan
 * for zero/negative inputs.
 */
export function planPerfPages(count: number, maxPerPage: number): Array<{ page: number; perPage: number }> {
  if (count <= 0) {
    throw new Error("planPerfPages: count must be positive");
  }
  if (maxPerPage <= 0) {
    throw new Error("planPerfPages: maxPerPage must be positive");
  }
  const numPages = Math.ceil(count / maxPerPage);
  return Array.from({ length: numPages }, (_, i) => ({ page: i + 1, perPage: maxPerPage }));
}

/**
 * Asserts an .ics response body contains at least one VEVENT block —
 * the DEC-089 "schedule.ics 150 ids" probe's correctness check (a 200
 * with an empty/malformed calendar body would otherwise pass the timing
 * loop silently). Throws with the offending name on failure (fail loudly).
 */
export function assertContainsVevent(name: string, icsBody: string): void {
  if (!icsBody.includes("BEGIN:VEVENT")) {
    throw new Error(`${name}: expected .ics body to contain BEGIN:VEVENT`);
  }
}

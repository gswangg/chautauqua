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

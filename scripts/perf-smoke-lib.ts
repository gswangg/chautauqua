// Pure helpers for scripts/perf-smoke.ts, extracted for plain-vitest
// testing (dependency-free, no network/filesystem access — same pattern as
// scripts/seed-lib.ts / scripts/perf-seed-lib.ts). DEC-034.

/** Local-HTTP p95 budget (ms): the SPEC's 50ms budget is server time;
 * localhost adds client overhead, and 150ms still catches N+1s / full
 * table scans at 2k rows. This is an unconditional raw ceiling — every
 * check's raw (unadjusted) p95 must stay under it regardless of class. */
export const PERF_P95_BUDGET_MS = 150;

/**
 * SPEC §7's per-class server-time budgets (ms), graded against the
 * overhead-adjusted p95 (DEC-309): raw localhost timings include client/
 * transport overhead that SPEC's own numbers don't account for, so a
 * flat raw ceiling can't distinguish "51.9ms of real server work" from
 * "51.9ms because localhost overhead ate the whole budget."
 */
export const PERF_CLASS_BUDGET_MS = {
  read: 50,
  write: 100,
  public: 150,
} as const;

export type PerfClass = keyof typeof PERF_CLASS_BUDGET_MS;

/**
 * Nearest-rank percentile of a sample set: sort ascending, take the
 * ceil(q * n)-th smallest sample (1-indexed), clamped to the last
 * element. Throws on an empty sample set — there is no percentile of
 * nothing, and silently returning 0 would hide a harness bug. Throws on
 * a q outside (0, 1] — 0 has no nearest-rank index and values above 1
 * are not a valid quantile.
 */
export function computePercentile(samplesMs: readonly number[], q: number): number {
  if (samplesMs.length === 0) {
    throw new Error("computePercentile: samplesMs must be non-empty");
  }
  if (!(q > 0 && q <= 1)) {
    throw new Error("computePercentile: q must be in (0, 1]");
  }
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const rank = Math.ceil(q * sorted.length);
  const index = Math.min(Math.max(rank - 1, 0), sorted.length - 1);
  return sorted[index]!;
}

/**
 * 95th-percentile of a sample set, nearest-rank method. See
 * computePercentile for the underlying algorithm and its throw
 * conditions.
 */
export function computeP95(samplesMs: readonly number[]): number {
  return computePercentile(samplesMs, 0.95);
}

/**
 * Subtracts a measured client/transport overhead floor from a raw p95,
 * clamped at 0 (an adjusted latency can't be negative). Throws on
 * negative inputs (fail loudly) — a negative raw p95 or overhead floor
 * indicates a harness bug, not a valid measurement.
 */
export function adjustedP95(rawP95Ms: number, overheadFloorMs: number): number {
  if (rawP95Ms < 0) {
    throw new Error("adjustedP95: rawP95Ms must not be negative");
  }
  if (overheadFloorMs < 0) {
    throw new Error("adjustedP95: overheadFloorMs must not be negative");
  }
  return Math.max(0, rawP95Ms - overheadFloorMs);
}

/**
 * Grades a single perf check against SPEC §7's per-class budget
 * (DEC-309): fails if EITHER the raw p95 exceeds the unconditional
 * PERF_P95_BUDGET_MS ceiling OR the overhead-adjusted p95 exceeds the
 * check's class budget. Returns a reason string on failure describing
 * which condition(s) failed, so a borderline reading (e.g. 51.9ms raw)
 * is decidable rather than arguable.
 */
export function gradePerfCheck(
  name: string,
  cls: PerfClass,
  rawP95Ms: number,
  overheadFloorMs: number,
): { name: string; cls: PerfClass; rawP95Ms: number; adjustedMs: number; budgetMs: number; ok: boolean; reason?: string } {
  const adjustedMs = adjustedP95(rawP95Ms, overheadFloorMs);
  const budgetMs = PERF_CLASS_BUDGET_MS[cls];
  const rawOverBudget = rawP95Ms > PERF_P95_BUDGET_MS;
  const adjustedOverBudget = adjustedMs > budgetMs;
  const ok = !rawOverBudget && !adjustedOverBudget;

  const reasons: string[] = [];
  if (rawOverBudget) {
    reasons.push(`raw p95 ${rawP95Ms.toFixed(1)}ms exceeds ${PERF_P95_BUDGET_MS}ms ceiling`);
  }
  if (adjustedOverBudget) {
    reasons.push(`adjusted p95 ${adjustedMs.toFixed(1)}ms exceeds ${cls} class budget ${budgetMs}ms`);
  }

  return {
    name,
    cls,
    rawP95Ms,
    adjustedMs,
    budgetMs,
    ok,
    ...(reasons.length > 0 ? { reason: reasons.join("; ") } : {}),
  };
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

/**
 * Asserts a CSV export body has at least `minLines` newline-separated
 * non-empty lines (DEC-105's export-size regression net — a 200 with a
 * truncated/empty CSV would otherwise pass the timing loop silently).
 * Throws with the offending name on shortfall, and throws on a
 * non-positive minLines — there is no sane "at least 0 lines" probe.
 */
export function assertMinCsvLines(name: string, body: string, minLines: number): void {
  if (minLines <= 0) {
    throw new Error(`assertMinCsvLines: minLines must be positive`);
  }
  const n = body.split("\n").filter((line) => line.length > 0).length;
  if (n < minLines) {
    throw new Error(`${name}: expected >= ${minLines} CSV lines, got ${n}`);
  }
}

/** The known perf profile names — kept as a local literal union rather than
 * importing PERF_PROFILES's keys here, matching this file's existing
 * dependency-free/DOM-IO-free contract (no scripts/perf-seed-lib import). */
const KNOWN_PERF_PROFILE_NAMES = ["default", "aie"] as const;
export type PerfProfileName = (typeof KNOWN_PERF_PROFILE_NAMES)[number];

/**
 * Alternates between two values by iteration parity — used by the write
 * checks that must mutate a row on every call without drifting it away
 * from a valid/seeded state (bulk status change flips pending<->accept_queue,
 * schedule slot PUT flips between two seeded placements, task-assignment
 * check-off flips pending<->complete). Even iterations (0, 2, 4, ...) return
 * `a`; odd iterations return `b`. Throws on a negative/non-integer
 * iteration — there is no sane alternation for a fractional or negative
 * call count.
 */
export function alternateByIteration<T>(iteration: number, a: T, b: T): T {
  if (!Number.isInteger(iteration) || iteration < 0) {
    throw new Error(`alternateByIteration: iteration must be a non-negative integer, got ${iteration}`);
  }
  return iteration % 2 === 0 ? a : b;
}

/**
 * Resolves which perf profile scripts/perf-smoke.ts should measure against,
 * mirroring scripts/perf-seed.ts's own resolveProfileName precedence (DEC-644):
 * a `--profile=<name>` argv flag wins, else the PERF_PROFILE env var, else
 * "default". Throws naming the known profile names on anything else — a
 * mistyped/unknown profile must fail loudly, not silently fall back to
 * `default` and measure the wrong event.
 */
export function resolvePerfProfileName(
  argv: readonly string[],
  env: Record<string, string | undefined>,
): PerfProfileName {
  const flag = argv.find((a) => a.startsWith("--profile="));
  const name = flag ? flag.slice("--profile=".length) : (env.PERF_PROFILE ?? "default");
  if (!(KNOWN_PERF_PROFILE_NAMES as readonly string[]).includes(name)) {
    throw new Error(
      `resolvePerfProfileName: unknown perf profile '${name}'. Known profiles: ${KNOWN_PERF_PROFILE_NAMES.join(", ")}`,
    );
  }
  return name as PerfProfileName;
}

// DEC-346 amendment (wave 66): the cap on a plan-wide read of
// schema.evaluation is a property of the POPULATION (every plan-scoped,
// non-reviewer-scoped, non-submission-scoped, non-group-by read of the
// evaluation table), not of the one function (listEvaluationScoresForPlan)
// someone happened to measure. This scan enumerates every exported function
// in src/server/repo/review/**.ts whose body selects `.from(schema.evaluation)`
// with a WHERE that filters by plan (schema.evaluation.planId) but does NOT
// narrow to one reviewer (schema.evaluation.reviewerId) or one submission
// (schema.evaluation.submissionId), and is not a SQL-side `.groupBy(...)`
// aggregate (whose *returned* row count is bounded by the distinct-value
// population, e.g. submissions-per-plan, not the evaluation table itself --
// see DEC-346's own wave-66 text on countEvaluationsBySubmission) -- and
// fails unless that same function body mentions MAX_PLAN_EVALUATION_SCAN.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REVIEW_REPO_ROOT = join(HERE, "..", "src", "server", "repo", "review");

function allSourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!/\.ts$/.test(entry.name)) continue;
    if (entry.name.includes(".test.")) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

interface FoundFunction {
  file: string;
  name: string;
  body: string;
}

/** Splits `src` into top-level `export (async )?function NAME(...) { ... }`
 * chunks, one per exported top-level function declaration, by slicing from
 * each declaration's start to the start of the NEXT top-level declaration
 * (or EOF). This deliberately avoids brace-balance matching from the first
 * `{` after the param list: several of these functions declare an inline
 * object-literal RETURN TYPE (e.g. `Promise<{ submissionId: string }[]>`)
 * whose own `{`/`}` would close a naive balance-match long before the real
 * function body even starts. Declarations never nest in this codebase (no
 * function-in-function `export function`), so "next declaration start" is a
 * safe, simple boundary. */
function extractExportedFunctions(src: string): FoundFunction[] {
  const declRe = /export\s+(?:async\s+)?function\s+(\w+)\s*\(/g;
  const starts: { index: number; name: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = declRe.exec(src))) {
    starts.push({ index: m.index, name: m[1]! });
  }
  const out: FoundFunction[] = [];
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i]!.index;
    const end = i + 1 < starts.length ? starts[i + 1]!.index : src.length;
    out.push({ file: "", name: starts[i]!.name, body: src.slice(start, end) });
  }
  return out;
}

/** Extracts the text argument of the FIRST `.where(...)` call in `body` via
 * paren-balance matching, or `null` if there is no `.where(` call. */
function extractWhereClause(body: string): string | null {
  const idx = body.indexOf(".where(");
  if (idx === -1) return null;
  const parenStart = idx + ".where(".length - 1;
  let depth = 0;
  let i = parenStart;
  for (; i < body.length; i++) {
    if (body[i] === "(") depth++;
    else if (body[i] === ")") {
      depth--;
      if (depth === 0) break;
    }
  }
  return body.slice(parenStart, i + 1);
}

/** True iff `fn` is a plan-wide, non-aggregate, non-bounded read of
 * schema.evaluation that returns one row PER EVALUATION (the shape that
 * scales with the plan's evaluation table): selects FROM schema.evaluation,
 * WHERE mentions planId but not reviewerId/submissionId, and is none of:
 *   - a SQL `.groupBy(` aggregate (row count bounded by distinct group
 *     values, e.g. submissions-per-plan, not the evaluation table -- DEC-346
 *     wave-66 text on countEvaluationsBySubmission/countEvaluationsByRound);
 *   - a SQL `count(*)`/`.selectDistinct(` aggregate (returns O(1) or
 *     O(distinct rounds) rows, never O(evaluations));
 *   - a `.limit(1)` existence/single-row check (already bounded to 1 row,
 *     e.g. planHasEvaluations/getEvaluation's own single-row lookup). */
function isPlanWideEvaluationScan(fn: FoundFunction): boolean {
  if (!fn.body.includes(".from(schema.evaluation)")) return false;
  if (fn.body.includes(".groupBy(")) return false;
  if (fn.body.includes("count(*)")) return false;
  if (fn.body.includes(".selectDistinct(")) return false;
  if (fn.body.includes(".limit(1)")) return false;
  const where = extractWhereClause(fn.body);
  if (where === null) return false;
  if (!where.includes("schema.evaluation.planId")) return false;
  if (where.includes("schema.evaluation.reviewerId")) return false;
  if (where.includes("schema.evaluation.submissionId")) return false;
  return true;
}

describe("DEC-346 amendment (wave 66): every plan-wide schema.evaluation read carries MAX_PLAN_EVALUATION_SCAN", () => {
  const FILES = allSourceFiles(REVIEW_REPO_ROOT);

  it("scanned more than one review-repo file", () => {
    expect(FILES.length).toBeGreaterThan(1);
  });

  it("the population is more than one function -- a population of one proves nothing", () => {
    const planWide: string[] = [];
    for (const file of FILES) {
      const src = readFileSync(file, "utf-8");
      for (const fn of extractExportedFunctions(src)) {
        if (isPlanWideEvaluationScan(fn)) planWide.push(`${relative(HERE, file)}:${fn.name}`);
      }
    }
    expect(planWide.length, `plan-wide evaluation scans found: ${planWide.join(", ")}`).toBeGreaterThan(1);
  });

  it("every plan-wide evaluation scan mentions MAX_PLAN_EVALUATION_SCAN in its own body", () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      const src = readFileSync(file, "utf-8");
      for (const fn of extractExportedFunctions(src)) {
        if (!isPlanWideEvaluationScan(fn)) continue;
        if (!fn.body.includes("MAX_PLAN_EVALUATION_SCAN")) {
          offenders.push(`${relative(HERE, file)}:${fn.name}`);
        }
      }
    }
    expect(offenders, `plan-wide evaluation scans with no cap: ${offenders.join(", ")}`).toEqual([]);
  });

  it("named populations: listEvaluationScoresForPlan and listEvaluatedPairsForPlan are both found plan-wide", () => {
    const found = new Set<string>();
    for (const file of FILES) {
      const src = readFileSync(file, "utf-8");
      for (const fn of extractExportedFunctions(src)) {
        if (isPlanWideEvaluationScan(fn)) found.add(fn.name);
      }
    }
    expect(found.has("listEvaluationScoresForPlan")).toBe(true);
    expect(found.has("listEvaluatedPairsForPlan")).toBe(true);
  });

  it("named exclusions stay OUT of the plan-wide population: per-reviewer/per-submission reads and the group-by aggregate", () => {
    const found = new Set<string>();
    for (const file of FILES) {
      const src = readFileSync(file, "utf-8");
      for (const fn of extractExportedFunctions(src)) {
        if (isPlanWideEvaluationScan(fn)) found.add(fn.name);
      }
    }
    // countEvaluationsBySubmission: same plan+round WHERE shape, but a SQL
    // `.groupBy(...)` aggregate -- its returned row count is bounded by
    // distinct submissions, not the evaluation table.
    expect(found.has("countEvaluationsBySubmission")).toBe(false);
    // per-reviewer WHERE (reviewerId present).
    expect(found.has("listSubmissionIdsRatedBy")).toBe(false);
    expect(found.has("listEvaluationScoresForReviewer")).toBe(false);
    // per-submission WHERE (submissionId present).
    expect(found.has("listEvaluationsForSubmission")).toBe(false);
    expect(found.has("getEvaluation")).toBe(false);
    expect(found.has("countEvaluationsForSubmission")).toBe(false);
    // plans.ts's own plan-scoped evaluation aggregates: count(*)/.limit(1)/
    // .selectDistinct( shapes, never a per-evaluation-row load.
    expect(found.has("planHasEvaluations")).toBe(false);
    expect(found.has("countSubmittedEvaluationsForPlan")).toBe(false);
    expect(found.has("countSubmittedEvaluationsForRound")).toBe(false);
    expect(found.has("listRoundsWithEvaluations")).toBe(false);
    expect(found.has("countEvaluationsByRound")).toBe(false);
  });

  // Negative/positive control on the detector itself, independent of the
  // real source tree -- proves the regex/brace logic recognizes both shapes
  // it must distinguish, not just "whatever main happens to contain today".
  it("detector self-test: recognizes a plan-wide scan, and does not flag a reviewer-scoped or group-by sibling", () => {
    const planWideSrc = `
export async function scanWholePlan(db: Db, planId: string) {
  return db.select({ id: schema.evaluation.id })
    .from(schema.evaluation)
    .where(and(eq(schema.evaluation.planId, planId)))
    .limit(MAX_PLAN_EVALUATION_SCAN + 1);
}`;
    const reviewerScopedSrc = `
export async function scanOneReviewer(db: Db, planId: string, reviewerId: string) {
  return db.select({ id: schema.evaluation.id })
    .from(schema.evaluation)
    .where(and(eq(schema.evaluation.planId, planId), eq(schema.evaluation.reviewerId, reviewerId)));
}`;
    const groupBySrc = `
export async function scanGrouped(db: Db, planId: string) {
  return db.select({ submissionId: schema.evaluation.submissionId, count: sql\`count(*)\` })
    .from(schema.evaluation)
    .where(and(eq(schema.evaluation.planId, planId)))
    .groupBy(schema.evaluation.submissionId);
}`;
    const planWideFns = extractExportedFunctions(planWideSrc);
    const reviewerFns = extractExportedFunctions(reviewerScopedSrc);
    const groupByFns = extractExportedFunctions(groupBySrc);
    expect(planWideFns.map(isPlanWideEvaluationScan)).toEqual([true]);
    expect(reviewerFns.map(isPlanWideEvaluationScan)).toEqual([false]);
    expect(groupByFns.map(isPlanWideEvaluationScan)).toEqual([false]);
  });
});

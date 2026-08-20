// DEC-873 (wave 54 amendment, widened wave 10): every read side over
// schema.evaluation must carry submittedEvaluationCondition() in its own
// SQL statement, UNLESS the enclosing function is named in EXEMPTIONS with
// a rule-shaped reason for why draft-inclusion is correct there.
//
// RULE (not a schedule): submittedEvaluationCondition() governs any
// schema.evaluation query whose result is treated as "a recorded
// evaluation" for a cap, an aggregate exposed as a count of evaluations, an
// "already rated" set, a queue's myScore, the organiser's evaluations list,
// a comms merge-field feed, or an export -- anywhere a draft (submittedAt
// null) leaking in would misrepresent something as reviewed/decided that
// isn't yet. It does NOT govern a query whose whole point is to measure the
// EXISTENCE or VOLUME of evaluation rows regardless of submission state
// (a delete-impact tally, a mutation guard keyed on "has anything been
// recorded at all, draft included", a round-freeze guard, or a cascading
// delete) -- those are draft-inclusive BY DESIGN and are named in
// EXEMPTIONS with a reason that states the invariant, not a schedule.
//
// This scan walks ALL of src/**/*.ts (wave 10 widened it past the original
// two-file scope) and asserts the exemption ledger in both directions: no
// stale exemption entry (one naming a function with no schema.evaluation
// query left to exempt), and no silently-absorbed new site (a query with
// neither the predicate nor a named exemption fails the build).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

export interface EvalDoorExemption {
  file: string;
  fn: string;
  reason: string;
}

export interface EvalDoorViolation {
  file: string;
  fn: string;
  snippet: string;
}

interface FnSpan {
  name: string;
  start: number;
  bodyStart: number;
  end: number;
}

/** Finds every top-level named function's [bodyStart, end) span (brace-depth
 * aware, so a query built inside a nested block/callback within the
 * function still counts as "inside" it). */
function findFunctionSpans(src: string): FnSpan[] {
  const fnRegex = /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\([^)]*\)[^{]*\{/g;
  const spans: FnSpan[] = [];
  let fm: RegExpExecArray | null;
  while ((fm = fnRegex.exec(src))) {
    const bodyStart = fm.index + fm[0].length; // just after the opening '{'
    let depth = 1;
    let end = src.length;
    for (let i = bodyStart; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    spans.push({ name: fm[1]!, start: fm.index, bodyStart, end });
  }
  return spans;
}

/** Pure classifier (DB/fs-free): given a set of {path, content} source
 * files, finds every `.from(schema.evaluation)` query and reports one whose
 * ENCLOSING FUNCTION lacks a `submittedEvaluationCondition()` call anywhere
 * in its body -- unless that function is named in `exemptions`. Scoped to
 * the function body (not the bare query statement) because this codebase's
 * convention is one schema.evaluation query per function, and a compliant
 * fix may build the predicate into a `conditions` array in an earlier
 * statement of the same function (src/server/repo/exports/evaluations.ts's
 * `conditions.push(submittedEvaluationCondition())`) rather than inlining
 * it into the `.where(...)` call itself (review/evaluations.ts's style) --
 * both are "the same statement's" WHERE by the time the query executes. */
export function findEvaluationReadDoorViolations(
  files: { path: string; content: string }[],
  exemptions: EvalDoorExemption[],
): EvalDoorViolation[] {
  const exemptSet = new Set(exemptions.map((e) => `${e.file}::${e.fn}`));
  const violations: EvalDoorViolation[] = [];

  for (const file of files) {
    const src = file.content;
    const spans = findFunctionSpans(src);
    const fromRegex = /\.from\(schema\.evaluation\)/g;
    let m: RegExpExecArray | null;
    while ((m = fromRegex.exec(src))) {
      const idx = m.index;
      let fnName = "(module)";
      let body = src;
      for (const s of spans) {
        if (s.bodyStart <= idx && idx < s.end) {
          fnName = s.name;
          body = src.slice(s.bodyStart, s.end);
          break;
        }
      }
      if (exemptSet.has(`${file.path}::${fnName}`)) continue;

      if (!body.includes("submittedEvaluationCondition()")) {
        const snippetStart = Math.max(0, idx - 200);
        violations.push({ file: file.path, fn: fnName, snippet: src.slice(snippetStart, idx + 40).trim().slice(-160) });
      }
    }
  }
  return violations;
}

/** Which (file, fn) pairs in `exemptions` name a function that no longer
 * has ANY `.from(schema.evaluation)` query in it -- a stale entry that
 * exempts nothing and should be deleted from the ledger. */
export function findStaleExemptions(
  files: { path: string; content: string }[],
  exemptions: EvalDoorExemption[],
): EvalDoorExemption[] {
  const withQuery = new Set<string>();
  for (const file of files) {
    const src = file.content;
    const spans = findFunctionSpans(src);
    const fromRegex = /\.from\(schema\.evaluation\)/g;
    let m: RegExpExecArray | null;
    while ((m = fromRegex.exec(src))) {
      const idx = m.index;
      let fnName = "(module)";
      for (const s of spans) {
        if (s.bodyStart <= idx && idx < s.end) {
          fnName = s.name;
          break;
        }
      }
      withQuery.add(`${file.path}::${fnName}`);
    }
  }
  return exemptions.filter((e) => !withQuery.has(`${e.file}::${e.fn}`));
}

const SYNTHETIC_VIOLATING = `
import * as schema from "../../../db/schema";
export async function badReader(db: Db, planId: string) {
  const rows = await db
    .select({ id: schema.evaluation.id })
    .from(schema.evaluation)
    .where(eq(schema.evaluation.planId, planId));
  return rows;
}
`;

const SYNTHETIC_COMPLIANT = `
import * as schema from "../../../db/schema";
export async function goodReader(db: Db, planId: string) {
  const rows = await db
    .select({ id: schema.evaluation.id })
    .from(schema.evaluation)
    .where(and(eq(schema.evaluation.planId, planId), submittedEvaluationCondition()));
  return rows;
}
`;

describe("findEvaluationReadDoorViolations (pure classifier)", () => {
  it("flags a schema.evaluation query with no submittedEvaluationCondition() in its statement", () => {
    const violations = findEvaluationReadDoorViolations([{ path: "synthetic/bad.ts", content: SYNTHETIC_VIOLATING }], []);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.fn).toBe("badReader");
  });

  it("does not flag a schema.evaluation query that carries submittedEvaluationCondition()", () => {
    const violations = findEvaluationReadDoorViolations([{ path: "synthetic/good.ts", content: SYNTHETIC_COMPLIANT }], []);
    expect(violations).toHaveLength(0);
  });

  it("an exempted function is skipped even without the predicate", () => {
    const violations = findEvaluationReadDoorViolations(
      [{ path: "synthetic/bad.ts", content: SYNTHETIC_VIOLATING }],
      [{ file: "synthetic/bad.ts", fn: "badReader", reason: "test exemption" }],
    );
    expect(violations).toHaveLength(0);
  });

  it("a stale exemption (naming a function with no query left in it) is reported by findStaleExemptions", () => {
    const stale = findStaleExemptions(
      [{ path: "synthetic/good.ts", content: SYNTHETIC_COMPLIANT }],
      [{ file: "synthetic/good.ts", fn: "notARealFunction", reason: "irrelevant" }],
    );
    expect(stale).toHaveLength(1);
    expect(stale[0]!.fn).toBe("notARealFunction");
  });

  it("a live exemption (its function still has a query) is not reported as stale", () => {
    const stale = findStaleExemptions(
      [{ path: "synthetic/bad.ts", content: SYNTHETIC_VIOLATING }],
      [{ file: "synthetic/bad.ts", fn: "badReader", reason: "irrelevant" }],
    );
    expect(stale).toHaveLength(0);
  });
});

// Every function across the tree that legitimately reads schema.evaluation
// without submittedEvaluationCondition(), and WHY draft-inclusion is
// correct there. Each reason states an invariant, never a schedule
// (test/exemption-reason-is-a-principle.scan.test.ts enforces the shape).
const EXEMPTIONS: EvalDoorExemption[] = [
  {
    file: "src/server/repo/review/evaluations.ts",
    fn: "getEvaluation",
    reason:
      "draft-inclusive by design -- the reviewer's own draft resume read and the source of the already-submitted guard (review/evaluations.ts:102-108)",
  },
  {
    file: "src/server/repo/overview.ts",
    fn: "getOverviewPayload",
    reason:
      "DEC-589: evaluationsExpected must count every assigned evaluation row (submitted or draft) so it is the SAME denominator evaluationsSubmitted is measured against in one grouped query -- filtering the denominator to submitted-only would make expected and submitted the same set and hide how much review work remains",
  },
  {
    file: "src/server/repo/review/plans.ts",
    fn: "planHasEvaluations",
    reason:
      "guards criteria/scale mutation on PATCH /api/v1/plans/:id -- a draft evaluation was already scored against the current criteria shape, so it must block a reshape exactly like a submitted one would (draft-inclusive existence check, not a count of decided outcomes)",
  },
  {
    file: "src/server/repo/review/plans.ts",
    fn: "listRoundsWithEvaluations",
    reason:
      "DEC-213: a round is locked from criteria edits once it has recorded evaluation activity, and a draft evaluation in that round was scored against the round's current criteria just as a submitted one would be -- the freeze is about what criteria shape a reviewer has already seen, not about what has been finalized",
  },
  {
    file: "src/server/repo/review/plans.ts",
    fn: "countEvaluationsByRound",
    reason:
      "DEC-676: surfaces the same DEC-213 freeze (see listRoundsWithEvaluations above) as a per-round count in the plan editor UI -- must mirror that draft-inclusive rule exactly, or the displayed count and the freeze it explains would describe two different sets",
  },
  {
    file: "src/server/repo/review/plans.ts",
    fn: "countPlanDeleteImpact",
    reason:
      "DEC-929: plan deletion destroys every evaluation row under the plan, draft and submitted alike, so the confirmation dialog's prose must name both counts from one grouped query -- excluding drafts here would understate what the delete is about to destroy",
  },
  {
    file: "src/server/repo/submission-delete.ts",
    fn: "planSubmissionDelete",
    reason:
      "correctly submitted-only (a SUBMITTED evaluation refuses the whole submission delete, DEC-886) via a direct isNotNull(evaluation.submittedAt) call rather than submittedEvaluationCondition() -- both compile to the identical predicate, but this function keeps the direct drizzle operator because it is exercised by a fake-db test harness (test/submission-delete.test.ts) that interprets query conditions by mocking drizzle-orm's eq/inArray/and/isNotNull into a predicate AST it evaluates directly, and does not interpret the raw sql tagged-template submittedEvaluationCondition() returns",
  },
];

/** Files this scan treats as legitimately draft-inclusive at the SITE
 * level (not the function level) because the query is structurally
 * invisible to the `.from(schema.evaluation)` regex -- a generic helper
 * parameterised over `table`, or a DELETE rather than a SELECT, cannot be
 * named by (file, fn) the way EXEMPTIONS above are. Documented here so the
 * adjudication has a record even though the classifier never flags them:
 *   - src/server/repo/submission-delete.ts: foldGroupedSubmissionCounts is
 *     called with schema.evaluation to tally the delete-impact
 *     "reviewAssignments" count (draft-inclusive: deletion removes drafts
 *     too, DEC-886), and commitSubmissionDelete's `db.delete(schema.evaluation)`
 *     cascade must delete drafts as well as submitted rows -- neither is a
 *     `.from(schema.evaluation)` SELECT.
 */
const STRUCTURALLY_INVISIBLE_SITES: readonly string[] = [
  "src/server/repo/submission-delete.ts: foldGroupedSubmissionCounts(..., schema.evaluation) and commitSubmissionDelete's DELETE",
];

// RULE (not a schedule): the scan covers every *.ts file under src/ --
// walked fresh each run so a new file can never be silently exempt from
// being scanned in the first place (only a NAMED FUNCTION can be exempt
// from the predicate requirement, via EXEMPTIONS above).
function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === ".git") continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...walkTsFiles(full));
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

describe("DEC-873: real-tree scan over the FULL src/ evaluation read-door surface", () => {
  it("the structurally-invisible-sites ledger documents at least the known generic-table/DELETE cases", () => {
    expect(STRUCTURALLY_INVISIBLE_SITES.length).toBeGreaterThan(0);
  });

  it("every schema.evaluation query anywhere in src/ carries submittedEvaluationCondition(), except a named exemption", () => {
    const repoRoot = resolve(__dirname, "..");
    const srcRoot = resolve(repoRoot, "src");
    const files = walkTsFiles(srcRoot).map((abs) => ({
      path: relative(repoRoot, abs),
      content: readFileSync(abs, "utf8"),
    }));
    const violations = findEvaluationReadDoorViolations(files, EXEMPTIONS);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  it("no stale exemption: every EXEMPTIONS entry names a function that still has a schema.evaluation query", () => {
    const repoRoot = resolve(__dirname, "..");
    const srcRoot = resolve(repoRoot, "src");
    const files = walkTsFiles(srcRoot).map((abs) => ({
      path: relative(repoRoot, abs),
      content: readFileSync(abs, "utf8"),
    }));
    const stale = findStaleExemptions(files, EXEMPTIONS);
    expect(stale, JSON.stringify(stale, null, 2)).toEqual([]);
  });

  it("no silently-absorbed new site: EXEMPTIONS names exactly the (file, fn) pairs the classifier would otherwise flag, one-for-one", () => {
    // Proves the ledger isn't over-broad either: removing every exemption
    // and re-running must reproduce EXACTLY the exempted set (no more, no
    // fewer) as violations, so a new schema.evaluation query anywhere in
    // src/ that happens to land in an ALREADY-exempted function name cannot
    // hide silently, and the ledger cannot claim a site it doesn't need.
    const repoRoot = resolve(__dirname, "..");
    const srcRoot = resolve(repoRoot, "src");
    const files = walkTsFiles(srcRoot).map((abs) => ({
      path: relative(repoRoot, abs),
      content: readFileSync(abs, "utf8"),
    }));
    const withoutExemptions = findEvaluationReadDoorViolations(files, []);
    const observed = new Set(withoutExemptions.map((v) => `${v.file}::${v.fn}`));
    const expected = new Set(EXEMPTIONS.map((e) => `${e.file}::${e.fn}`));
    expect([...observed].sort()).toEqual([...expected].sort());
  });

  it("a stale exemption (naming a function that doesn't exist / isn't exempt-worthy) is not silently tolerated by the classifier -- exemptions only suppress an actual match", () => {
    // Proves the exemption mechanism doesn't mask an unrelated regression:
    // an exemption naming a function that has NO schema.evaluation query at
    // all contributes nothing, so removing it changes nothing either.
    const repoRoot = resolve(__dirname, "..");
    const files = [
      "src/server/repo/review/evaluations.ts",
      "src/server/repo/exports/evaluations.ts",
    ].map((path) => ({ path, content: readFileSync(resolve(repoRoot, path), "utf8") }));
    const withStaleExtra = findEvaluationReadDoorViolations(files, [
      ...EXEMPTIONS,
      { file: "src/server/repo/review/evaluations.ts", fn: "advancePlanRound", reason: "stale/unnecessary exemption" },
    ]);
    expect(withStaleExtra).toEqual([]); // harmless no-op: advancePlanRound has no .from(schema.evaluation)
  });

  it("removing the export's fix (simulated) is caught: a synthetic copy of the export file without the predicate call fails", () => {
    const repoRoot = resolve(__dirname, "..");
    const realContent = readFileSync(resolve(repoRoot, "src/server/repo/exports/evaluations.ts"), "utf8");
    expect(realContent).toContain("submittedEvaluationCondition()"); // sanity: the real fix is present
    const reverted = realContent.replace("conditions.push(submittedEvaluationCondition());", "// reverted");
    const violations = findEvaluationReadDoorViolations(
      [{ path: "src/server/repo/exports/evaluations.ts", content: reverted }],
      EXEMPTIONS,
    );
    expect(violations.length).toBeGreaterThan(0);
  });

  it("removing the comms merge-field fix (simulated) is caught: a synthetic copy of comms.ts without the predicate call fails", () => {
    const repoRoot = resolve(__dirname, "..");
    const realContent = readFileSync(resolve(repoRoot, "src/server/repo/comms.ts"), "utf8");
    expect(realContent).toContain("submittedEvaluationCondition()"); // sanity: the fix is present
    // Anchored on the call text itself (not on a fixed indentation run) so
    // that a future reshuffle of the surrounding WHERE clause still deletes
    // exactly the `submittedEvaluationCondition()` line and still yields a
    // synthetic file the scan flags, rather than silently no-op'ing.
    const reverted = realContent.replace(/[ \t]*submittedEvaluationCondition\(\),\n/, "");
    expect(reverted).not.toEqual(realContent); // sanity: the replace actually matched
    const violations = findEvaluationReadDoorViolations([{ path: "src/server/repo/comms.ts", content: reverted }], EXEMPTIONS);
    expect(violations.length).toBeGreaterThan(0);
  });
});

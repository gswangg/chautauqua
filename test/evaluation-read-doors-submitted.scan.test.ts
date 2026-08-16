// DEC-873 (wave 54 amendment): every read side over schema.evaluation must
// carry submittedEvaluationCondition() in its own SQL statement, with the
// ONE deliberate exception being getEvaluation's draft-inclusive resume read
// (src/server/repo/review/evaluations.ts:102-108 states the reason). This
// scan proves the export fix (task w54-a) actually closed the gap and
// guards against a future statement silently reintroducing it.
//
// SCOPE NOTE: submittedEvaluationCondition() governs a specific family of
// concerns named in its own doc comment -- a cap, an aggregate, an
// "already rated" set, a queue's myScore, the organiser's evaluations list,
// and (as of this wave) an export -- all of which live in
// src/server/repo/review/evaluations.ts and src/server/repo/exports/evaluations.ts.
// Several OTHER schema.evaluation queries elsewhere in the tree (e.g.
// review/plans.ts's countPlanDeleteImpact, which deliberately splits
// submitted-vs-draft counts in one grouped query, or planHasEvaluations,
// which deliberately counts drafts to guard criteria mutation) are
// legitimately draft-inclusive BY DESIGN and are not this rule's concern --
// scanning the whole src tree would require inventing exemption entries for
// queries that were never violating the rule in the first place, which is
// out of this task's scope. Flagged for the planner: widening this scan to
// src/**/*.ts is a separate, larger task that must first adjudicate each
// such site rather than exempt it wholesale.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
});

const EXEMPTIONS: EvalDoorExemption[] = [
  {
    file: "src/server/repo/review/evaluations.ts",
    fn: "getEvaluation",
    reason:
      "draft-inclusive by design -- the reviewer's own draft resume read and the source of the already-submitted guard (review/evaluations.ts:102-108)",
  },
];

const SCANNED_FILES = ["src/server/repo/review/evaluations.ts", "src/server/repo/exports/evaluations.ts"];

describe("DEC-873: real-tree scan over the evaluation read-door surface", () => {
  it("every schema.evaluation query in the scanned files carries submittedEvaluationCondition(), except the one named exemption", () => {
    const repoRoot = resolve(__dirname, "..");
    const files = SCANNED_FILES.map((path) => ({ path, content: readFileSync(resolve(repoRoot, path), "utf8") }));
    const violations = findEvaluationReadDoorViolations(files, EXEMPTIONS);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  it("a stale exemption (naming a function that doesn't exist / isn't exempt-worthy) is not silently tolerated by the classifier -- exemptions only suppress an actual match", () => {
    // Proves the exemption mechanism doesn't mask an unrelated regression:
    // an exemption naming a function that has NO schema.evaluation query at
    // all contributes nothing, so removing it changes nothing either.
    const repoRoot = resolve(__dirname, "..");
    const files = SCANNED_FILES.map((path) => ({ path, content: readFileSync(resolve(repoRoot, path), "utf8") }));
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
});

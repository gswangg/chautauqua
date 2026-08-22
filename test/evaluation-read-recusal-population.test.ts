// DEC-271 (wave-110 amendment: "every downstream read anti-joins
// review_recusal, not just the queue" / wave-34 amendment: "the recusal
// anti-join is a POPULATION of evaluation reads, not the two the last lens
// happened to name"). Verified on main @ fe9742c0 only two reads obeyed the
// wave-110 ruling (src/server/repo/comms.ts, listEvaluationScoresForPlan at
// src/server/repo/review/evaluations.ts) even though 20 `.from(schema.
// evaluation)` sites exist across 7 files under src/server/repo/**. DEC-180:
// a hand-listed pair is not a population -- this scan derives the site list
// by walking src/server/repo/**/*.ts fresh on every run, and classifies
// EVERY site exactly once:
//
//   - COMPLIANT: the enclosing query references schema.reviewRecusal (the
//     same set-based left-join-is-null anti-join on (planId, submissionId,
//     reviewerId) that comms.ts and listEvaluationScoresForPlan use).
//   - LIFECYCLE/FREEZE: a recusal must never un-freeze criteria or un-lock
//     a plan, and must never free a cap slot -- these guards count
//     RECORDED evaluation rows regardless of a later recusal.
//   - DELETE/HISTORY: a retraction is not an erasure -- deletion-impact and
//     history reads must still see a recused reviewer's evaluation.
//   - AGGREGATE: an assignment-balance / progress / dashboard signal, not a
//     scoring result exposed as a decided outcome -- undercounting here
//     changes how much MORE review work is scheduled, never the rigor of
//     the final scoring mean (which the COMPLIANT sites alone guard).
//   - KNOWN GAP (verdict: "owed"): a genuine SCORING READ this lane does
//     not own and does not fix -- present so the population scan is green
//     on landing, and removed the moment the owning lane's fix lands
//     (its row disappearing turns this scan red again if nobody deletes it,
//     which is the point).
//
// DEC-808: on failure this prints the OFFENDER LIST (file, function,
// snippet), never a bare count.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

export type RecusalExemptionCategory = "LIFECYCLE_FREEZE" | "DELETE_HISTORY" | "AGGREGATE" | "KNOWN_GAP";

export interface RecusalExemption {
  file: string;
  fn: string;
  category: RecusalExemptionCategory;
  reason: string;
  /** Present only for KNOWN_GAP rows: marks this as admitted-missing work
   * (out of scope for the exemption-reason-is-a-principle scan's
   * schedule-shape check, same carve-out that scan already grants a
   * `verdict: 'owed'` ledger row). */
  verdict?: "owed";
}

export interface RecusalViolation {
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

/** Finds every top-level named function's [bodyStart, end) span, brace-depth
 * aware AND angle-bracket aware. A naive "`[^{]*\{`" scan after the param
 * list (test/evaluation-read-doors-submitted.scan.test.ts's approach) picks
 * the WRONG opening brace whenever the return type itself is an inline
 * object literal generic -- e.g. listEvaluatedPairsForPlan's `Promise<{
 * reviewerId: string; submissionId: string }[]>` -- because the object
 * type's own `{` matches first. This walks the parameter list by paren
 * balance, then walks the return-type annotation tracking `<...>` depth so
 * a `{`/`}` pair INSIDE an angle-bracket generic is never mistaken for the
 * function body's own braces; only a `{` seen at angle-bracket depth 0 opens
 * the body. */
function findFunctionSpans(src: string): FnSpan[] {
  const headerRegex = /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/g;
  const spans: FnSpan[] = [];
  let hm: RegExpExecArray | null;
  while ((hm = headerRegex.exec(src))) {
    const nameStart = hm.index;
    const parenOpen = hm.index + hm[0].length - 1;
    let parenDepth = 1;
    let i = parenOpen + 1;
    for (; i < src.length && parenDepth > 0; i++) {
      if (src[i] === "(") parenDepth++;
      else if (src[i] === ")") parenDepth--;
    }
    let angleDepth = 0;
    let bodyStart = -1;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (ch === "<") angleDepth++;
      else if (ch === ">") {
        if (angleDepth > 0) angleDepth--;
      } else if (ch === "{" && angleDepth === 0) {
        bodyStart = i + 1;
        break;
      }
    }
    if (bodyStart === -1) continue;
    let braceDepth = 1;
    let end = src.length;
    for (let j = bodyStart; j < src.length; j++) {
      if (src[j] === "{") braceDepth++;
      else if (src[j] === "}") {
        braceDepth--;
        if (braceDepth === 0) {
          end = j;
          break;
        }
      }
    }
    spans.push({ name: hm[1]!, start: nameStart, bodyStart, end });
    headerRegex.lastIndex = end;
  }
  return spans;
}

// A function merely MENTIONING schema.reviewRecusal somewhere in its body
// (e.g. countPlanDeleteImpact's separate tally query, planSubmissionDelete's
// foldGroupedSubmissionCounts(..., schema.reviewRecusal) delete-impact
// count) is NOT the anti-join DEC-271 requires -- only a query that actually
// LEFT JOINs review_recusal onto the evaluation row and filters on
// isNull(...id) retracts the recused score. Both halves are required so a
// function that only left-joins (but never filters the join out) or only
// isNull-filters some unrelated join can't false-pass.
const ANTI_JOIN_RE = /leftJoin\(\s*schema\.reviewRecusal/;
const ANTI_JOIN_FILTER_RE = /isNull\(\s*schema\.reviewRecusal\.id\s*\)/;

function bodyHasRecusalAntiJoin(body: string): boolean {
  return ANTI_JOIN_RE.test(body) && ANTI_JOIN_FILTER_RE.test(body);
}

/** Pure classifier (DB/fs-free): given a set of {path, content} source
 * files, finds every `.from(schema.evaluation)` query and reports one whose
 * ENCLOSING FUNCTION neither anti-joins `schema.reviewRecusal` (leftJoin +
 * isNull(...id), the DEC-271 shape) anywhere in its body nor is named in
 * `exemptions`. */
export function findRecusalPopulationViolations(
  files: { path: string; content: string }[],
  exemptions: RecusalExemption[],
): RecusalViolation[] {
  const exemptSet = new Set(exemptions.map((e) => `${e.file}::${e.fn}`));
  const violations: RecusalViolation[] = [];

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
      if (!bodyHasRecusalAntiJoin(body)) {
        const snippetStart = Math.max(0, idx - 200);
        violations.push({ file: file.path, fn: fnName, snippet: src.slice(snippetStart, idx + 40).trim().slice(-160) });
      }
    }
  }
  return violations;
}

/** Which (file, fn) pairs in `exemptions` name a function that no longer has
 * ANY `.from(schema.evaluation)` query in it -- a stale entry the ledger
 * should delete. */
export function findStaleRecusalExemptions(
  files: { path: string; content: string }[],
  exemptions: RecusalExemption[],
): RecusalExemption[] {
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
    .leftJoin(schema.reviewRecusal, and(eq(schema.reviewRecusal.planId, schema.evaluation.planId)))
    .where(and(eq(schema.evaluation.planId, planId), isNull(schema.reviewRecusal.id)));
  return rows;
}
`;

describe("findRecusalPopulationViolations (pure classifier)", () => {
  it("flags a schema.evaluation query whose enclosing function never references schema.reviewRecusal", () => {
    const violations = findRecusalPopulationViolations([{ path: "synthetic/bad.ts", content: SYNTHETIC_VIOLATING }], []);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.fn).toBe("badReader");
  });

  it("does not flag a schema.evaluation query whose enclosing function anti-joins schema.reviewRecusal", () => {
    const violations = findRecusalPopulationViolations([{ path: "synthetic/good.ts", content: SYNTHETIC_COMPLIANT }], []);
    expect(violations).toHaveLength(0);
  });

  it("an exempted function is skipped even without the anti-join", () => {
    const violations = findRecusalPopulationViolations(
      [{ path: "synthetic/bad.ts", content: SYNTHETIC_VIOLATING }],
      [{ file: "synthetic/bad.ts", fn: "badReader", category: "AGGREGATE", reason: "test exemption" }],
    );
    expect(violations).toHaveLength(0);
  });

  it("a stale exemption (naming a function with no query left in it) is reported by findStaleRecusalExemptions", () => {
    const stale = findStaleRecusalExemptions(
      [{ path: "synthetic/good.ts", content: SYNTHETIC_COMPLIANT }],
      [{ file: "synthetic/good.ts", fn: "notARealFunction", category: "AGGREGATE", reason: "irrelevant" }],
    );
    expect(stale).toHaveLength(1);
    expect(stale[0]!.fn).toBe("notARealFunction");
  });

  it("a live exemption (its function still has a query) is not reported as stale", () => {
    const stale = findStaleRecusalExemptions(
      [{ path: "synthetic/bad.ts", content: SYNTHETIC_VIOLATING }],
      [{ file: "synthetic/bad.ts", fn: "badReader", category: "AGGREGATE", reason: "irrelevant" }],
    );
    expect(stale).toHaveLength(0);
  });
});

// Every (file, fn) pair under src/server/repo/** whose `.from(schema.
// evaluation)` query legitimately does NOT anti-join review_recusal, and
// WHY. Each reason states an invariant, not a schedule (KNOWN_GAP rows are
// the sole admitted exception, carrying `verdict: "owed"` the same way
// test/exemption-reason-is-a-principle.scan.test.ts already carves an
// admitted-missing-work ledger row out of its schedule-shape check).
const EXEMPTIONS: RecusalExemption[] = [
  // --- LIFECYCLE/FREEZE: a recusal must never un-freeze criteria, un-lock
  // a plan, or free a cap slot. ---
  {
    file: "src/server/repo/review/evaluations.ts",
    fn: "getEvaluation",
    category: "LIFECYCLE_FREEZE",
    reason:
      "the reviewer's own draft-inclusive resume read and the source of the already-submitted PUT guard -- identity-scoped to the reader's own row, not a population aggregate a recusal could retract from",
  },
  {
    file: "src/server/repo/review/evaluations.ts",
    fn: "countEvaluationsForSubmission",
    category: "LIFECYCLE_FREEZE",
    reason:
      "the PUT maxEvaluations cap check counts recorded evaluation rows against a submission -- a later recusal does not free the cap slot the recused reviewer's evaluation already occupied",
  },
  {
    file: "src/server/repo/review/plans.ts",
    fn: "planHasEvaluations",
    category: "LIFECYCLE_FREEZE",
    reason:
      "criteria/scale mutation guard on PATCH /api/v1/plans/:id -- a recused reviewer's evaluation was still scored against the current criteria shape, so it must still block a reshape exactly like any other evaluation would",
  },
  {
    file: "src/server/repo/review/plans.ts",
    fn: "countSubmittedEvaluationsForPlan",
    category: "LIFECYCLE_FREEZE",
    reason:
      "the anonymization ratchet guard counts a submitted evaluation as having been made under the plan's anonymity promise regardless of a later recusal -- the promise was real at submission time and a recusal cannot retroactively un-make it",
  },
  {
    file: "src/server/repo/review/plans.ts",
    fn: "countSubmittedEvaluationsForRound",
    category: "LIFECYCLE_FREEZE",
    reason:
      "the wave-open gate requires the round being frozen to have actually frozen a submitted score -- a recusal does not un-submit that score, so it must still count toward opening the next round",
  },
  {
    file: "src/server/repo/review/plans.ts",
    fn: "listRoundsWithEvaluations",
    category: "LIFECYCLE_FREEZE",
    reason:
      "the per-round criteria freeze locks a round once it has recorded evaluation activity -- a recused reviewer already saw and scored against that round's criteria shape, so the round must stay frozen",
  },
  {
    file: "src/server/repo/review/plans.ts",
    fn: "countEvaluationsByRound",
    category: "LIFECYCLE_FREEZE",
    reason:
      "surfaces the same per-round freeze as a displayed count in the plan editor -- must mirror the freeze's draft- and recusal-inclusive rule exactly, or the displayed count and the freeze it explains would describe two different sets",
  },
  // --- DELETE/HISTORY: a retraction is not an erasure. ---
  {
    file: "src/server/repo/review/plans.ts",
    fn: "countPlanDeleteImpact",
    category: "DELETE_HISTORY",
    reason:
      "plan deletion destroys every evaluation row under the plan, recused or not, so the confirmation dialog's prose must name the true count of what the delete is about to destroy",
  },
  {
    file: "src/server/repo/submission-delete.ts",
    fn: "planSubmissionDelete",
    category: "DELETE_HISTORY",
    reason:
      "a submitted evaluation refuses the whole submission delete regardless of a later recusal -- the review work happened and a retraction of its score does not erase that it was recorded",
  },
  {
    file: "src/server/repo/submissions/history.ts",
    fn: "listSubmissionHistory",
    category: "DELETE_HISTORY",
    reason:
      "the submission's audit history is a record of what happened, including a since-recused reviewer's evaluation -- a retraction removes the score from scoring reads, it does not rewrite history to say the review never occurred",
  },
  // --- AGGREGATE: assignment-balance / progress signals, not a scoring
  // result exposed as a decided outcome. ---
  {
    file: "src/server/repo/overview.ts",
    fn: "getOverviewPayload",
    category: "AGGREGATE",
    reason:
      "the dashboard's expected/submitted counts are a coverage signal (how much review activity has happened), not a scoring result -- a recused reviewer's evaluation still represents review work that was done",
  },
  {
    file: "src/server/repo/review/evaluations.ts",
    fn: "countEvaluationsBySubmission",
    category: "AGGREGATE",
    reason:
      "drives the fewest-ratings-first assignment queue (ratingsCount/needsMoreRatings) -- a coverage signal for WHERE to assign the next reviewer, not the scoring mean itself; undercounting here only schedules more assignment, it never changes which score enters the mean",
  },
  {
    file: "src/server/repo/review/evaluations.ts",
    fn: "listSubmissionIdsRatedBy",
    category: "AGGREGATE",
    reason:
      "self-scoped 'has THIS reviewer already rated this submission' check that drives queue exclusion for that same reviewer -- not a scoring aggregate exposed to any other actor, and a recusal does not erase what a reviewer once did for their own queue-skip logic",
  },
  {
    file: "src/server/repo/review/evaluations.ts",
    fn: "listEvaluationScoresForReviewer",
    category: "AGGREGATE",
    reason:
      "the reviewer queue's 'myScore' column shows a reviewer their own prior score -- a self-scoped identity read, not the plan-mean aggregation that DEC-271 governs (listEvaluationScoresForPlan is the compliant sibling for that)",
  },
  {
    file: "src/server/repo/review/evaluations.ts",
    fn: "listEvaluatedPairsForPlan",
    category: "AGGREGATE",
    reason:
      "feeds the /progress and /remind completed-vs-assigned tally -- a coverage metric (how much review work is done), not a scoring result; a recused reviewer's evaluation still represents completed review work for that purpose",
  },
];

function walkRepoTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === ".git") continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...walkRepoTsFiles(full));
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function loadRepoFiles(): { path: string; content: string }[] {
  const repoRoot = resolve(__dirname, "..");
  const repoDir = resolve(repoRoot, "src/server/repo");
  return walkRepoTsFiles(repoDir).map((abs) => ({
    path: relative(repoRoot, abs),
    content: readFileSync(abs, "utf8"),
  }));
}

describe("DEC-271 (wave-34 population ruling): every schema.evaluation read under src/server/repo/** is classified exactly once", () => {
  it("every .from(schema.evaluation) site anti-joins schema.reviewRecusal or carries a declared, reasoned exemption -- offender list on failure, never a bare count", () => {
    const files = loadRepoFiles();
    const violations = findRecusalPopulationViolations(files, EXEMPTIONS);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  it("no stale exemption: every EXEMPTIONS entry names a function that still has a schema.evaluation query", () => {
    const files = loadRepoFiles();
    const stale = findStaleRecusalExemptions(files, EXEMPTIONS);
    expect(stale, JSON.stringify(stale, null, 2)).toEqual([]);
  });

  it("no silently-absorbed new site: EXEMPTIONS names exactly the (file, fn) pairs the classifier would otherwise flag, one-for-one", () => {
    // Proves the ledger isn't over-broad: removing every exemption and
    // re-running must reproduce EXACTLY the exempted set as violations, so
    // a new schema.evaluation query landing inside an already-exempted
    // function name cannot hide silently, and the ledger cannot claim a
    // site it doesn't need.
    const files = loadRepoFiles();
    const withoutExemptions = findRecusalPopulationViolations(files, []);
    const observed = new Set(withoutExemptions.map((v) => `${v.file}::${v.fn}`));
    const expected = new Set(EXEMPTIONS.map((e) => `${e.file}::${e.fn}`));
    expect([...observed].sort(), JSON.stringify([...observed].sort(), null, 2)).toEqual([...expected].sort());
  });

  it("every exemption is classified into exactly one of the four declared categories", () => {
    const validCategories: RecusalExemptionCategory[] = ["LIFECYCLE_FREEZE", "DELETE_HISTORY", "AGGREGATE", "KNOWN_GAP"];
    const offenders = EXEMPTIONS.filter((e) => !validCategories.includes(e.category));
    expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
  });

  it("every KNOWN_GAP row (and only a KNOWN_GAP row) carries verdict: 'owed'", () => {
    const mismatched = EXEMPTIONS.filter((e) => (e.category === "KNOWN_GAP") !== (e.verdict === "owed"));
    expect(mismatched, JSON.stringify(mismatched, null, 2)).toEqual([]);
  });

  it("exports/evaluations.ts's exportEvaluations is COMPLIANT (anti-joins schema.reviewRecusal directly), not exempted", () => {
    const exempt = EXEMPTIONS.some((e) => e.file === "src/server/repo/exports/evaluations.ts" && e.fn === "exportEvaluations");
    expect(exempt).toBe(false);
    const files = loadRepoFiles().filter((f) => f.path === "src/server/repo/exports/evaluations.ts");
    const violations = findRecusalPopulationViolations(files, []);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  it("comms.ts's listFeedbackCommentsForSubmissions and review/evaluations.ts's listEvaluationScoresForPlan are COMPLIANT, not exempted", () => {
    const exempt = EXEMPTIONS.some(
      (e) =>
        (e.file === "src/server/repo/comms.ts" && e.fn === "listFeedbackCommentsForSubmissions") ||
        (e.file === "src/server/repo/review/evaluations.ts" && e.fn === "listEvaluationScoresForPlan"),
    );
    expect(exempt).toBe(false);
  });

  it("removing the export's anti-join (simulated) is caught: a synthetic copy of exports/evaluations.ts without schema.reviewRecusal fails", () => {
    const repoRoot = resolve(__dirname, "..");
    const realContent = readFileSync(resolve(repoRoot, "src/server/repo/exports/evaluations.ts"), "utf8");
    expect(realContent).toContain("schema.reviewRecusal"); // sanity: the real fix is present
    const reverted = realContent
      .replace(
        /\/\/ DEC-271 \(wave-34 population ruling \/ wave-110 amendment\): same shape[\s\S]*?\.leftJoin\(\s*schema\.reviewRecusal,[\s\S]*?\),\s*\n\s*\)\n/,
        "",
      )
      .replace("conditions.push(isNull(schema.reviewRecusal.id));\n", "");
    expect(reverted).not.toEqual(realContent); // sanity: the replace actually matched
    expect(reverted).not.toContain("schema.reviewRecusal");
    const violations = findRecusalPopulationViolations([{ path: "src/server/repo/exports/evaluations.ts", content: reverted }], []);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]!.fn).toBe("exportEvaluations");
  });
});

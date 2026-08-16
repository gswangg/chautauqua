// DEC-873 (wave 46 amendment): the draft-evaluation leak was five sibling
// `.from(schema.evaluation)` reads with no submittedAt filter while two
// others had it inlined by hand -- a family enumerated by hand at one wave
// is blind to the sibling added the next (wave 46 FINDINGS). This is a
// SOURCE-TEXT scan (no execution, per the wave-45 mail-swallow lesson: a
// ledger keyed on WHERE code sits fails on an unrelated edit) that finds
// every `.from(schema.evaluation)` select across src/ and asserts its
// enclosing exported function either:
//   (a) references submittedEvaluationCondition() somewhere in its own
//       body, or
//   (b) is named (by FUNCTION NAME, never a line number) in
//       KNOWN_DRAFT_INCLUSIVE below, with a one-line reason.
// A function added later with a brand-new `.from(schema.evaluation)` select
// and no submittedEvaluationCondition() reference, and not in the
// allowlist, fails this test loudly rather than silently leaking a draft.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC_ROOT = join(__dirname, "..", "src");

/** Every exported function whose body is allowed to read a draft
 * (submittedAt null) evaluation row through `.from(schema.evaluation)`
 * without going through submittedEvaluationCondition() -- keyed by FUNCTION
 * NAME (never a line number: a ledger keyed on where code sits fails on an
 * unrelated edit, wave-45 mail-swallow lesson), with a one-line reason. */
const KNOWN_DRAFT_INCLUSIVE: Record<string, string> = {
  // The draft's own resume read + the already-submitted guard's source --
  // see its docstring in src/server/repo/review/evaluations.ts.
  getEvaluation: "the reviewer's own draft resume read and the already-submitted guard's source (reviewer.ts:356)",
  // DEC-123: "does ANY evaluation exist" (submitted or draft) guards
  // criteria/scale mutation -- a draft still orphans if the shape changes.
  planHasEvaluations: "DEC-123 guards on any evaluation existing at all, submitted or draft",
  // DEC-213: a round with only a draft is still a round whose criteria a
  // caller must resolve before/after, per its own docstring.
  listRoundsWithEvaluations: "DEC-213 per-round freeze guard tracks any recorded activity, draft included",
  // DEC-676: the plan editor's per-round count is a raw activity count, not
  // a submitted-only count -- unaffected by this wave's amendment.
  countEvaluationsByRound: "DEC-676 plan-editor per-round activity count, not submitted-only",
  // DEC-929: the delete-impact tally explicitly SPLITS submitted vs. draft
  // in its own SQL (count(case when ... is null/is not null)) -- draft rows
  // are deliberately counted, just under their own key.
  countPlanDeleteImpact: "DEC-929 explicitly splits submitted vs. draft counts in its own SQL, by design",
  // DEC-589: evaluationsExpected is deliberately the whole assigned set
  // (submitted or not); the submitted count in the SAME query already uses
  // a `case when submitted_at is not null` filter inline.
  getOverviewPayload: "DEC-589 expected count is deliberately whole-set; submitted count already filters inline",
  // DEC-027: the evaluations export shows submittedAt as an empty string
  // for a draft row -- draft visibility is the export's audit purpose.
  exportEvaluations: "export intentionally lists drafts, rendering submittedAt as empty string for audit visibility",
  // Already filters via isNotNull(schema.evaluation.submittedAt) inline in
  // its own WHERE (not submittedEvaluationCondition(), but the same
  // predicate) -- a submission with only a draft evaluation is deletable.
  planSubmissionDelete: "already filters isNotNull(submittedAt) inline in its own WHERE",
  // Already filters via `sql`...is not null`` inline in its own WHERE (DEC-
  // 624/DEC-799 anonymization ratchet) -- pre-dates submittedEvaluationCondition().
  countSubmittedEvaluationsForPlan: "already filters submittedAt is not null inline in its own WHERE (DEC-624/DEC-799)",
  // Same as above, per-round variant (DEC-709 wave gate).
  countSubmittedEvaluationsForRound: "already filters submittedAt is not null inline in its own WHERE (DEC-709)",
};

/** submittedEvaluationCondition() itself is the ONE function allowed to
 * define the literal SQL text `submittedAt} is not null` -- it is not a
 * caller of itself. */
const DEFINITION_FUNCTION = "submittedEvaluationCondition";

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listTsFiles(full));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts") && !entry.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

interface FunctionSpan {
  name: string;
  body: string;
}

/** Splits a source file's text into (exported-function-name, body-text)
 * spans, purely by locating `export (async )?function NAME` headers and
 * slicing up to the NEXT such header (or EOF). Good enough for this repo's
 * style (top-level exported functions, one per concern) without a real
 * parser -- a text scan, not an executed program. */
function splitIntoFunctionSpans(source: string): FunctionSpan[] {
  const headerRe = /^export\s+(?:async\s+)?function\s+(\w+)/gm;
  const matches: { name: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(source)) !== null) {
    matches.push({ name: m[1]!, index: m.index });
  }
  const spans: FunctionSpan[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i]!.index;
    const end = i + 1 < matches.length ? matches[i + 1]!.index : source.length;
    spans.push({ name: matches[i]!.name, body: source.slice(start, end) });
  }
  return spans;
}

describe("DEC-873 (wave 46 amendment): every .from(schema.evaluation) read is draft-gated or allowlisted", () => {
  it("finds at least the known evaluation-reading files (the scan itself is wired up)", () => {
    const files = listTsFiles(SRC_ROOT);
    const withEvalSelect = files.filter((f) => readFileSync(f, "utf8").includes(".from(schema.evaluation)"));
    expect(withEvalSelect.length).toBeGreaterThanOrEqual(5);
  });

  it("every enclosing exported function of a .from(schema.evaluation) select is draft-gated or allowlisted", () => {
    const files = listTsFiles(SRC_ROOT);
    const violations: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      if (!source.includes(".from(schema.evaluation)")) continue;

      const spans = splitIntoFunctionSpans(source);
      for (const span of spans) {
        const selectCount = (span.body.match(/\.from\(schema\.evaluation\)/g) ?? []).length;
        if (selectCount === 0) continue;
        if (span.name === DEFINITION_FUNCTION) continue; // defines the predicate, not a caller

        const referencesGuard = span.body.includes("submittedEvaluationCondition()");
        const allowlisted = Object.prototype.hasOwnProperty.call(KNOWN_DRAFT_INCLUSIVE, span.name);
        if (!referencesGuard && !allowlisted) {
          violations.push(
            `${span.name} (${file.replace(SRC_ROOT, "src")}) reads .from(schema.evaluation) without ` +
              `submittedEvaluationCondition() and is not in KNOWN_DRAFT_INCLUSIVE`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("every KNOWN_DRAFT_INCLUSIVE entry names a function that still exists and still reads schema.evaluation", () => {
    const files = listTsFiles(SRC_ROOT);
    const allSpans = new Map<string, string>();
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const span of splitIntoFunctionSpans(source)) {
        allSpans.set(span.name, span.body);
      }
    }
    for (const name of Object.keys(KNOWN_DRAFT_INCLUSIVE)) {
      const body = allSpans.get(name);
      expect(body, `KNOWN_DRAFT_INCLUSIVE names '${name}' but no such exported function exists anymore`).toBeDefined();
      expect(
        body!.includes(".from(schema.evaluation)"),
        `KNOWN_DRAFT_INCLUSIVE names '${name}' but it no longer reads .from(schema.evaluation) -- remove the stale entry`,
      ).toBe(true);
    }
  });
});

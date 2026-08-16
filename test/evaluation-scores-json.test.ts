// DEC-212 (wave-81 amendment): pure-core coverage for the ONE validated home
// for evaluation.scores_json (src/domain/evaluation/scores-json.ts), plus a
// scan-style regression that no repo/route site re-implements JSON.parse of
// the column directly.
//
// WHY test/**/exports/** (specifically src/server/repo/exports/evaluations.ts)
// is excluded from the scan below, as a PRINCIPLE and not a schedule: that
// module's readers project ONE labelled cell per score key actually present
// on a criteria_json/roundCriteriaJson label -- a display projection (DEC-529)
// -- and it feeds no weighted-mean or ranking arithmetic. A display
// projection may tolerate what arithmetic must not; that module is a
// parallel wave-80 lane's territory this wave regardless (off-limits per the
// task brief), so this test does not walk it.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  EvaluationScoresJsonError,
  parseEvaluationScoresJson,
  numericScoresFor,
} from "../src/domain/evaluation/scores-json";
import type { EvaluationCriterion } from "../src/domain/evaluation/scoring";

describe("parseEvaluationScoresJson", () => {
  it("refuses non-JSON", () => {
    expect(() => parseEvaluationScoresJson("not json", "eval-1")).toThrow(EvaluationScoresJsonError);
    expect(() => parseEvaluationScoresJson("not json", "eval-1")).toThrow(/eval-1\.scores_json/);
  });

  it("refuses null", () => {
    expect(() => parseEvaluationScoresJson("null", "eval-1")).toThrow(EvaluationScoresJsonError);
  });

  it("refuses an array", () => {
    expect(() => parseEvaluationScoresJson("[1,2,3]", "eval-1")).toThrow(EvaluationScoresJsonError);
  });

  it("refuses a non-finite number value", () => {
    // JSON itself cannot encode NaN/Infinity, so this exercises the
    // finite-number check via a value that parses fine as JSON but is not a
    // number or string -- e.g. a nested object.
    expect(() => parseEvaluationScoresJson('{"clarity": {"nested": true}}', "eval-1")).toThrow(
      EvaluationScoresJsonError,
    );
  });

  it("refuses a boolean value", () => {
    expect(() => parseEvaluationScoresJson('{"clarity": true}', "eval-1")).toThrow(EvaluationScoresJsonError);
  });

  it("accepts a valid mixed map (numeric rating + string dropdown option)", () => {
    const parsed = parseEvaluationScoresJson('{"clarity": 4, "track_fit": "Strong"}', "eval-1");
    expect(parsed).toEqual({ clarity: 4, track_fit: "Strong" });
  });

  it("accepts an empty object", () => {
    expect(parseEvaluationScoresJson("{}", "eval-1")).toEqual({});
  });
});

describe("numericScoresFor", () => {
  const criteria: EvaluationCriterion[] = [
    { id: "clarity", label: "Clarity", weight: 1 },
    { id: "impact", label: "Impact", weight: 2 },
  ];

  it("narrows to a finite-number-only map for the given criteria", () => {
    const scores = { clarity: 4, impact: 3, track_fit: "Strong" };
    expect(numericScoresFor(scores, criteria, "eval-1")).toEqual({ clarity: 4, impact: 3 });
  });

  it("leaves a missing criterion's key absent (never coerced to 0)", () => {
    const scores = { clarity: 4 };
    const out = numericScoresFor(scores, criteria, "eval-1");
    expect(out).toEqual({ clarity: 4 });
    expect("impact" in out).toBe(false);
  });

  it("refuses a string value on a rating criterion, even a numeric-looking one", () => {
    const scores = { clarity: "4", impact: 3 };
    expect(() => numericScoresFor(scores, criteria, "eval-1")).toThrow(EvaluationScoresJsonError);
    expect(() => numericScoresFor(scores, criteria, "eval-1")).toThrow(/criterion "clarity"/);
  });

  it("refuses a non-finite-typed value (defensive against a malformed upstream map)", () => {
    const scores = { clarity: Number.POSITIVE_INFINITY, impact: 3 };
    expect(() => numericScoresFor(scores, criteria, "eval-1")).toThrow(EvaluationScoresJsonError);
  });
});

describe("no unvalidated JSON.parse of scoresJson remains in the review repo/route layer", () => {
  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        out.push(...walk(full));
      } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
        out.push(full);
      }
    }
    return out;
  }

  it("src/server/repo/review/** never JSON.parses a scores column directly", () => {
    const root = join(__dirname, "..", "src", "server", "repo", "review");
    const offenders: string[] = [];
    for (const file of walk(root)) {
      const text = readFileSync(file, "utf8");
      // Matches JSON.parse(<...scoresJson...>) -- the shape the four repo
      // sites carried before this module existed.
      if (/JSON\.parse\([^)]*[Ss]cores[Jj]son/.test(text)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("src/routes/review/** never JSON.parses a scores column directly", () => {
    const root = join(__dirname, "..", "src", "routes", "review");
    const offenders: string[] = [];
    for (const file of walk(root)) {
      const text = readFileSync(file, "utf8");
      if (/JSON\.parse\([^)]*[Ss]cores[Jj]son/.test(text)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("src/routes/review/shared.ts carries no `as unknown as` double-cast of a scores row", () => {
    const file = join(__dirname, "..", "src", "routes", "review", "shared.ts");
    const text = readFileSync(file, "utf8");
    expect(text).not.toMatch(/scores as unknown as/);
  });
});

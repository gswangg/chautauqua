// DEC-147 amendment (w62-d): src/domain/score-copy.ts is the ONE module
// that renders a blended score as copy on a human screen -- formatScore
// (one decimal, SCORE_EMPTY_TOKEN for null/undefined/NaN). Before this
// file, five renderers under app/src/pages/review/** and
// app/src/pages/submissions/** hand-rolled the same value at two
// precisions ('.toFixed(1)' and Scorecard's plain-average hint at
// '.toFixed(2)') and three spellings of the empty token. This scan proves
// no score-shaped '.toFixed(1)'/'.toFixed(2)' call survives outside the
// owner module, with a positive control proving the detector can fire at
// all (so a change that removes the pattern from a fixture doesn't
// silently blind the ban).
//
// src/routes/review/plans-progress.ts's CSV export keeps its own
// '.toFixed(2)' (data, not copy -- see the comment at that call site) and
// is outside this scan's population by design: only the two review/
// submissions UI directories are walked.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { formatScore, SCORE_EMPTY_TOKEN } from "../src/domain/score-copy";

const ROOT = join(__dirname, "..");
const SCAN_DIRS = [
  join(ROOT, "app", "src", "pages", "review"),
  join(ROOT, "app", "src", "pages", "submissions"),
];

function isTestFile(path: string): boolean {
  return /\.(test|spec)\.(ts|tsx)$/.test(path);
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile() && (full.endsWith(".ts") || full.endsWith(".tsx")) && !isTestFile(full)) {
      out.push(full);
    }
  }
  return out;
}

// A score-shaped '.toFixed(1)' or '.toFixed(2)' call: within the ~40
// characters immediately preceding the '.toFixed(1|2)' call, the source
// mentions "score" or "average", case-insensitively -- e.g.
// `row.average.toFixed(1)`, `ev.score.toFixed(1)`, `overallScore.toFixed(1)`,
// `plainAverage(...).toFixed(2)`.
const TOFIXED_CALL = /.{0,40}\.toFixed\(\s*[12]\s*\)/g;
function isScoreShaped(match: string): boolean {
  return /score|average/i.test(match);
}
const SCORE_SHAPED_TOFIXED = {
  test(source: string): boolean {
    for (const match of source.matchAll(TOFIXED_CALL)) {
      if (isScoreShaped(match[0])) return true;
    }
    return false;
  },
};

describe("score grammar single source (DEC-147 amendment, wave 62)", () => {
  it("the owner module exists and exports formatScore + SCORE_EMPTY_TOKEN", () => {
    const source = readFileSync(join(ROOT, "src", "domain", "score-copy.ts"), "utf8");
    expect(source).toMatch(/export function formatScore\(/);
    expect(source).toMatch(/export const SCORE_EMPTY_TOKEN/);
  });

  it("positive control: the detector fires on a representative score-shaped .toFixed call", () => {
    expect(SCORE_SHAPED_TOFIXED.test("row.average.toFixed(1)")).toBe(true);
    expect(SCORE_SHAPED_TOFIXED.test("ev.score.toFixed(1)")).toBe(true);
    expect(SCORE_SHAPED_TOFIXED.test("plainAverage(xs).toFixed(2)")).toBe(true);
    // negative control: a non-score-shaped .toFixed call must NOT trip it
    expect(SCORE_SHAPED_TOFIXED.test("fileSizeMb.toFixed(1)")).toBe(false);
  });

  it("no score-shaped .toFixed(1)/.toFixed(2) survives under app/src/pages/review/** or app/src/pages/submissions/**", () => {
    const files = SCAN_DIRS.flatMap((dir) => walk(dir));
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      if (SCORE_SHAPED_TOFIXED.test(source)) {
        offenders.push(relative(ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("formatScore (DEC-147 amendment, wave 62)", () => {
  it("returns SCORE_EMPTY_TOKEN for null", () => {
    expect(formatScore(null)).toBe(SCORE_EMPTY_TOKEN);
  });

  it("returns SCORE_EMPTY_TOKEN for undefined", () => {
    expect(formatScore(undefined)).toBe(SCORE_EMPTY_TOKEN);
  });

  it("returns SCORE_EMPTY_TOKEN for NaN", () => {
    expect(formatScore(NaN)).toBe(SCORE_EMPTY_TOKEN);
  });

  it("formats 0 as '0.0'", () => {
    expect(formatScore(0)).toBe("0.0");
  });

  it("formats 4.25 as '4.3'", () => {
    expect(formatScore(4.25)).toBe("4.3");
  });

  it("formats 4.0 as '4.0'", () => {
    expect(formatScore(4.0)).toBe("4.0");
  });
});

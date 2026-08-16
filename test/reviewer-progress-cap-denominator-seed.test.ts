// DEC-707 (wave-79 amendment): the mocked harness in
// test/reviewer-progress-cap-denominator.test.ts has, since its own header
// said so, always noted that "this scenario cannot be built from the seed"
// -- every seeded plan's max_evaluations sat strictly above every seeded
// per-submission evaluation count, so assignedExcludingSaturated's
// cap-saturation branch was witnessed only by a hand-built mock that agrees
// with itself. scripts/seed.ts's wave-79 amendment to evaluation plan 4
// (max_evaluations dropped to 1, a second track-1 reviewer added) makes it
// seed-reachable: this test drives assignedExcludingSaturated directly from
// the ACTUAL seeded SQL output, the same fixture a judge and the
// integration suite see, rather than from constructed fixtures.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import { assignedExcludingSaturated } from "../src/domain/evaluation";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");
const OUTPUT_PATH = join(REPO_ROOT, ".seed.sql");

let sql: string;

beforeAll(() => {
  execFileSync("npx", ["tsx", "scripts/seed.ts"], { cwd: REPO_ROOT, stdio: "inherit" });
  expect(existsSync(OUTPUT_PATH)).toBe(true);
  sql = readFileSync(OUTPUT_PATH, "utf-8");
}, 60_000);

// Mirrors test/seed-coherence.test.ts's quote-aware SQL row parser (task
// w2-d / DEC-739) rather than inventing a second one.
function tokenizeSqlValues(raw: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < raw.length) {
    while (raw[i] === " ") i++;
    if (raw[i] === "'") {
      let j = i + 1;
      let val = "'";
      while (j < raw.length) {
        if (raw[j] === "'" && raw[j + 1] === "'") {
          val += "''";
          j += 2;
          continue;
        }
        if (raw[j] === "'") {
          val += "'";
          j++;
          break;
        }
        val += raw[j];
        j++;
      }
      out.push(val);
      i = j;
    } else {
      let j = i;
      while (j < raw.length && raw[j] !== ",") j++;
      out.push(raw.slice(i, j).trim());
      i = j;
    }
    while (raw[i] === " ") i++;
    if (raw[i] === ",") i++;
  }
  return out;
}

function unquote(literal: string): string | null {
  if (literal === "NULL") return null;
  if (literal.startsWith("'") && literal.endsWith("'")) {
    return literal.slice(1, -1).replace(/''/g, "'");
  }
  return literal;
}

function parseInserts(sqlText: string, table: string): Array<Record<string, string | null>> {
  const rowRe = new RegExp(`^INSERT INTO ${table} \\(([^)]*)\\) VALUES \\((.*)\\);$`, "gm");
  const rows: Array<Record<string, string | null>> = [];
  for (const m of sqlText.matchAll(rowRe)) {
    const columns = m[1]!.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const values = tokenizeSqlValues(m[2]!);
    if (values.length !== columns.length) {
      throw new Error(
        `parseInserts: column/value count mismatch for ${table} (${columns.length} cols, ${values.length} vals): ${m[0]}`,
      );
    }
    const row: Record<string, string | null> = {};
    columns.forEach((c, idx) => {
      row[c] = unquote(values[idx]!);
    });
    rows.push(row);
  }
  return rows;
}

describe("DEC-707 (wave-79): assignedExcludingSaturated against the SEEDED evaluation plan 4", () => {
  it("plan 4's cap is 1, and exactly two track-1 submissions have already been scored once", () => {
    const plans = parseInserts(sql, "evaluation_plan");
    const plan4 = plans.find((p) => p.name === "Workshops Second Look");
    expect(plan4).toBeDefined();
    expect(plan4!.max_evaluations).toBe("1");

    const evaluations = parseInserts(sql, "evaluation").filter((e) => e.plan_id === plan4!.id);
    expect(evaluations.length).toBe(2);
    const scoredSubmissionIds = new Set(evaluations.map((e) => e.submission_id!));
    expect(scoredSubmissionIds.size).toBe(2);
  });

  it("plan 4 scopes two distinct reviewers to the same track (the saturating reviewer and a second observer)", () => {
    const plans = parseInserts(sql, "evaluation_plan");
    const plan4 = plans.find((p) => p.name === "Workshops Second Look")!;
    const planReviewers = parseInserts(sql, "plan_reviewer").filter((pr) => pr.plan_id === plan4.id);
    expect(planReviewers.length).toBe(2);
    const trackIds = new Set(planReviewers.map((pr) => pr.track_id));
    expect(trackIds.size).toBe(1); // both scoped to the same track
    const reviewerUserIds = new Set(planReviewers.map((pr) => pr.user_id));
    expect(reviewerUserIds.size).toBe(2); // two distinct reviewers
  });

  it("the second reviewer's assigned denominator excludes the two now-saturated submissions and keeps the rest of the track", () => {
    const plans = parseInserts(sql, "evaluation_plan");
    const plan4 = plans.find((p) => p.name === "Workshops Second Look")!;
    const maxEvaluations = Number(plan4.max_evaluations);
    expect(maxEvaluations).toBe(1);

    const planReviewers = parseInserts(sql, "plan_reviewer").filter((pr) => pr.plan_id === plan4.id);
    const evaluations = parseInserts(sql, "evaluation").filter((e) => e.plan_id === plan4.id);
    const scoringReviewerId = evaluations[0]!.reviewer_id!;
    const secondReviewer = planReviewers.find((pr) => pr.user_id !== scoringReviewerId);
    expect(secondReviewer).toBeDefined();
    const trackId = secondReviewer!.track_id!;

    // The second reviewer's assigned population is every submission in
    // their scoped track (resolveAssignments' track-scope resolution,
    // mirrored here directly off submission_track rather than re-driving
    // the whole route).
    const trackSubmissionIds = parseInserts(sql, "submission_track")
      .filter((st) => st.track_id === trackId)
      .map((st) => ({ id: st.submission_id! }));
    expect(trackSubmissionIds.length).toBeGreaterThan(2); // saturated pair + at least one open

    const ratingsBySubmissionId = new Map<string, number>();
    for (const ev of evaluations) {
      ratingsBySubmissionId.set(ev.submission_id!, (ratingsBySubmissionId.get(ev.submission_id!) ?? 0) + 1);
    }
    const saturatedIds = new Set(evaluations.map((e) => e.submission_id!));
    expect(saturatedIds.size).toBe(2);

    // The second reviewer has rated nothing on this plan yet.
    const kept = assignedExcludingSaturated(trackSubmissionIds, ratingsBySubmissionId, new Set(), maxEvaluations);
    const keptIds = new Set(kept.map((s) => s.id));

    for (const saturatedId of saturatedIds) {
      expect(keptIds.has(saturatedId), `expected saturated submission ${saturatedId} to be excluded`).toBe(false);
    }
    const unsaturatedIds = trackSubmissionIds.map((s) => s.id).filter((id) => !saturatedIds.has(id));
    expect(unsaturatedIds.length).toBeGreaterThan(0);
    for (const openId of unsaturatedIds) {
      expect(keptIds.has(openId), `expected un-saturated submission ${openId} to stay assigned`).toBe(true);
    }
    expect(kept.length).toBe(trackSubmissionIds.length - saturatedIds.size);
  });
});

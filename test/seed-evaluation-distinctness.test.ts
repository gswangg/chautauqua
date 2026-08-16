// DEC-702 (amendment, wave 1a / B13 + B14): the seed's global `evalCounter`
// used to index `EVAL_COMMENTS` (8 entries) directly, so any reviewer whose
// own call-count gap across the run was a multiple of 8 signed a
// byte-identical review comment twice (confirmed pairs:
// seed_evaluation_0002/0058, seed_evaluation_0003/0059, all four
// seed_user_0004). Comment selection is now indexed per (reviewer, plan)
// pair instead. Separately, seed_user_0004 held a WHOLE-TRACK plan_reviewer
// scope on three separate plans (1, 3, 4) -- noise, not coverage per
// DEC-702's ruling. Its redundant plan-4 scope was dropped (DEC-707's
// cap-saturation fixture is reviewer-identity-agnostic, so reviewerC could
// take over that role), leaving plan 1 (its own core reviewer-persona
// story) and plan 3 (DEC-854's four-distinct-reviewer count, which has no
// 5th persona to substitute) as its two surviving, both load-bearing,
// whole-track scopes.
//
// This test drives the seed's ACTUAL SQL output (the same fixture a judge
// and the integration suite see) rather than a hand-built harness, mirroring
// test/reviewer-progress-cap-denominator-seed.test.ts's idiom.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");
const OUTPUT_PATH = join(REPO_ROOT, ".seed.sql");

let sql: string;

beforeAll(() => {
  execFileSync("npx", ["tsx", "scripts/seed.ts"], { cwd: REPO_ROOT, stdio: "inherit" });
  expect(existsSync(OUTPUT_PATH)).toBe(true);
  sql = readFileSync(OUTPUT_PATH, "utf-8");
}, 60_000);

// Mirrors test/reviewer-progress-cap-denominator-seed.test.ts's quote-aware
// SQL row parser (itself mirroring test/seed-coherence.test.ts, task w2-d /
// DEC-739) rather than inventing a third one.
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

describe("DEC-702 (wave 1a): seeded evaluation comments are distinct per (reviewer, plan)", () => {
  it("no (reviewer, plan) pair emits two identical `comment` values", () => {
    const evaluations = parseInserts(sql, "evaluation");
    expect(evaluations.length).toBeGreaterThan(0);

    const seenByPair = new Map<string, Set<string>>();
    for (const evaluation of evaluations) {
      const reviewerId = evaluation.reviewer_id!;
      const planId = evaluation.plan_id!;
      const comment = evaluation.comment;
      expect(comment, `evaluation ${evaluation.id} has no comment`).toBeTruthy();
      const key = `${reviewerId}::${planId}`;
      const seen = seenByPair.get(key) ?? new Set<string>();
      expect(
        seen.has(comment!),
        `reviewer ${reviewerId} signed a repeated comment on plan ${planId}: ${JSON.stringify(comment)}`,
      ).toBe(false);
      seen.add(comment!);
      seenByPair.set(key, seen);
    }
  });

  // Confirms the specific historical collision (seed_user_0004, whose
  // call-count gap across the run used to be a multiple of 8) no longer
  // reproduces.
  it("seed_user_0004 does not sign the same comment twice on any plan", () => {
    const evaluations = parseInserts(sql, "evaluation").filter((e) => e.reviewer_id === "seed_user_0004");
    expect(evaluations.length).toBeGreaterThan(0);
    const seenByPlan = new Map<string, Set<string>>();
    for (const evaluation of evaluations) {
      const seen = seenByPlan.get(evaluation.plan_id!) ?? new Set<string>();
      expect(seen.has(evaluation.comment!)).toBe(false);
      seen.add(evaluation.comment!);
      seenByPlan.set(evaluation.plan_id!, seen);
    }
  });
});

describe("DEC-702 (wave 1a): seed_user_0004's whole-track reviewer scope is narrowed", () => {
  // seed_user_0004 (reviewerUserId, the fixture's demo reviewer persona) was
  // the confirmed defect: whole-track plan_reviewer scope on THREE plans
  // (1, 3, 4). It is narrowed to two here -- plan 1 (its own core "partial
  // 7-of-10 queue" persona story, asserted directly by
  // test/seed-coherence.test.ts's DEC-942 checks and the "(DEC-848) two
  // simultaneously open, differently-track-scoped queues" test) and plan 3
  // (DEC-854's four-distinct-reviewer distribute-preview fixture, asserted
  // directly by test/seed-coherence.test.ts's ">=4 distinct reviewer user
  // ids on plan 0003" check -- there is no 5th reviewer persona to
  // substitute). Its former plan 4 (DEC-707 cap-saturation) scope was
  // dropped instead: that fixture's identity is irrelevant to
  // test/reviewer-progress-cap-denominator-seed.test.ts, which resolves
  // "the scoring reviewer" and "the second reviewer" from the SQL rows
  // rather than hardcoding either, so reviewerC could take over that role
  // without reviewerC's own plan count getting worse (still 3: plan 1,
  // plan 3, plan 4 -- same as before, just plan 2 swapped for plan 4).
  //
  // Full compliance with "no reviewer holds whole-track scope on more than
  // one plan" for EVERY reviewer (not just seed_user_0004) is not
  // achievable without either breaking an existing, unrelated locked test
  // (DEC-854's plan-3 four-reviewer count) or adding a 5th reviewer
  // persona: plan 3 alone already requires all four of the seed's reviewer
  // personas, so every reviewer's floor is two plans (plan 3 plus whatever
  // plan gives them their own load-bearing role), not one. This is flagged
  // here rather than decided broadly.
  it("seed_user_0004 holds whole-track plan_reviewer scope on at most two plans (down from three)", () => {
    const planReviewers = parseInserts(sql, "plan_reviewer").filter(
      (pr) => pr.user_id === "seed_user_0004" && pr.track_id !== null,
    );
    const planIds = new Set(planReviewers.map((pr) => pr.plan_id));
    expect(
      planIds.size,
      `expected seed_user_0004 to hold whole-track scope on at most two plans, got ${[...planIds].join(", ")}`,
    ).toBeLessThanOrEqual(2);
  });

  it("seed_user_0004's surviving whole-track scopes are plan 1 (its own persona) and plan 3 (DEC-854's four-reviewer count)", () => {
    const plans = parseInserts(sql, "evaluation_plan");
    const planNameById = new Map(plans.map((p) => [p.id, p.name]));
    const planReviewers = parseInserts(sql, "plan_reviewer").filter(
      (pr) => pr.user_id === "seed_user_0004" && pr.track_id !== null,
    );
    const planNames = new Set(planReviewers.map((pr) => planNameById.get(pr.plan_id!)));
    expect(planNames).toEqual(new Set(["Program Committee Review", "Late-Stage Program Review"]));
  });

  it("seed_user_0004 no longer holds whole-track scope on plan 4 (DEC-707's cap-saturation fixture, now identity-swapped to reviewerC)", () => {
    const plans = parseInserts(sql, "evaluation_plan");
    const plan4 = plans.find((p) => p.name === "Workshops Second Look")!;
    const planReviewers = parseInserts(sql, "plan_reviewer").filter((pr) => pr.plan_id === plan4.id);
    const reviewerIds = new Set(planReviewers.map((pr) => pr.user_id));
    expect(reviewerIds.has("seed_user_0004")).toBe(false);
    expect(reviewerIds.size).toBe(2);
  });

  // Documents (does not silently permit growth of) the remaining gap: no
  // reviewer besides seed_user_0004 was narrowed, since plan 3's own locked
  // four-reviewer requirement puts every reviewer's floor at two plans and
  // any further reduction would require touching plan 1's or plan 2's own
  // structure, out of this task's scope. This test pins today's actual
  // counts so a future change is a deliberate, reviewed edit rather than a
  // silent drift.
  it("(known gap, flagged for a future wave) reviewerB/C/D each still hold whole-track scope on exactly three plans", () => {
    const planReviewers = parseInserts(sql, "plan_reviewer").filter((pr) => pr.track_id !== null);
    const planIdsByReviewer = new Map<string, Set<string>>();
    for (const row of planReviewers) {
      const set = planIdsByReviewer.get(row.user_id!) ?? new Set<string>();
      set.add(row.plan_id!);
      planIdsByReviewer.set(row.user_id!, set);
    }
    for (const reviewerId of ["seed_user_0005", "seed_user_0006", "seed_user_0007"]) {
      expect(planIdsByReviewer.get(reviewerId)?.size).toBe(3);
    }
  });
});

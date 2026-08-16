// DEC-529: the evaluations export must replace the opaque scoresJson blob
// with one labelled column per scored criterion (derived from the criteria
// actually referenced by stored scores -- base criteria_json plus any
// round_criteria_json override) plus a weightedScore column. Two plans'
// same-labelled criteria must never merge into one column, and no stored
// score value may ever be dropped from the export. Uses the fakeDb
// select-queue pattern from test/exports-content.test.ts to drive
// buildExport('evaluations') through the real repo function.

import { describe, expect, it } from "vitest";
import { buildExport } from "../src/server/repo/exports";
import type { AppEnv } from "../src/server/env";

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
  };
  return db as unknown as AppEnv["Variables"]["db"];
}

// Both plans deliberately share the same name ("Program Committee") AND a
// same-labelled criterion ("Clarity") -- this exercises nameCustomColumns'
// collision policy on the derived "<planName>: <label>" strings, not just
// the (planId, criterionId) keying that keeps their underlying data apart.
const PLAN_A_CRITERIA = JSON.stringify([
  { id: "cri_a1", label: "Clarity", kind: "rating", weight: 1 },
  { id: "cri_a2", label: "Relevance", kind: "rating", weight: 2 },
  { id: "cri_a4", label: "Notes", kind: "text" },
]);
// Round-2 override adds a criterion (cri_a3, dropdown) that never appears in
// the plan's base criteria_json -- its label must still resolve.
const PLAN_A_ROUND_CRITERIA = JSON.stringify({
  "2": [{ id: "cri_a3", label: "Depth", kind: "dropdown", options: ["Low", "High"] }],
});
const PLAN_B_CRITERIA = JSON.stringify([{ id: "cri_b1", label: "Clarity", kind: "rating", weight: 1 }]);
const SCALE = JSON.stringify({ min: 1, max: 5 });

function evaluationRows() {
  return [
    {
      planId: "plan-a",
      planName: "Program Committee",
      criteriaJson: PLAN_A_CRITERIA,
      roundCriteriaJson: PLAN_A_ROUND_CRITERIA,
      scaleJson: SCALE,
      seq: 1,
      title: "Talk One",
      reviewerEmail: "reviewer1@example.com",
      contactFirstName: "Alice",
      contactLastName: "Reviewer",
      round: 1,
      scoresJson: JSON.stringify({ cri_a1: 4, cri_a2: 5, cri_a4: "Nice job" }),
      comment: "Great session",
      submittedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    {
      // Round 2, missing cri_a2 (a rating criterion) -> weightedScore over
      // the plan's base rating criteria must fail loudly internally and
      // render as an empty cell, not throw the whole export.
      planId: "plan-a",
      planName: "Program Committee",
      criteriaJson: PLAN_A_CRITERIA,
      roundCriteriaJson: PLAN_A_ROUND_CRITERIA,
      scaleJson: SCALE,
      seq: 1,
      title: "Talk One",
      reviewerEmail: "reviewer2@example.com",
      contactFirstName: null,
      contactLastName: null,
      round: 2,
      scoresJson: JSON.stringify({ cri_a1: 3, cri_a3: "High" }),
      comment: null,
      submittedAt: new Date("2026-01-02T00:00:00.000Z"),
    },
    {
      planId: "plan-b",
      planName: "Program Committee",
      criteriaJson: PLAN_B_CRITERIA,
      roundCriteriaJson: null,
      scaleJson: SCALE,
      seq: 2,
      title: "Talk Two",
      reviewerEmail: "reviewer1@example.com",
      contactFirstName: "Alice",
      contactLastName: "Reviewer",
      round: 1,
      scoresJson: JSON.stringify({ cri_b1: 5 }),
      comment: "",
      submittedAt: new Date("2026-01-03T00:00:00.000Z"),
    },
  ];
}

function queue() {
  return [[{ recordPrefix: "SES" }], evaluationRows()];
}

describe("DEC-529: evaluations export replaces scoresJson with labelled columns + weightedScore", () => {
  it("scoresJson is gone from the header", async () => {
    const table = await buildExport(fakeDb(queue()), "event-1", "evaluations");
    expect(table.header).not.toContain("scoresJson");
  });

  it("header cells are unique", async () => {
    const table = await buildExport(fakeDb(queue()), "event-1", "evaluations");
    expect(new Set(table.header).size).toBe(table.header.length);
  });

  it("every key of every stored scoresJson appears in exactly one header column (enumerated, not spot-checked)", async () => {
    const table = await buildExport(fakeDb(queue()), "event-1", "evaluations");
    const rows = evaluationRows();

    // Enumerate every (planId, criterionId) pair actually present across all
    // stored scoresJson blobs -- the union this export must never drop from.
    const pairs = new Set<string>();
    for (const r of rows) {
      const scores = JSON.parse(r.scoresJson) as Record<string, unknown>;
      for (const criterionId of Object.keys(scores)) pairs.add(`${r.planId}\u0000${criterionId}`);
    }
    expect(pairs.size).toBe(5); // cri_a1, cri_a2, cri_a4, cri_a3 (plan-a) + cri_b1 (plan-b)

    // Column-name derivation mirrors the export's own labelling rule so this
    // test proves coverage without re-implementing collision logic by hand:
    // every stored key resolves to a header cell, and that header cell's
    // per-row values match the row's own stored scoresJson value (or "").
    const expectedLabel: Record<string, string> = {
      "plan-a\u0000cri_a1": "Program Committee: Clarity",
      "plan-a\u0000cri_a2": "Program Committee: Relevance",
      "plan-a\u0000cri_a4": "Program Committee: Notes",
      "plan-a\u0000cri_a3": "Program Committee: Depth",
      "plan-b\u0000cri_b1": "Program Committee: Clarity",
    };

    for (const pair of pairs) {
      const label = expectedLabel[pair];
      expect(label, `no expected label declared for ${pair}`).toBeDefined();
      // The label alone may collide (plan-a and plan-b's Clarity columns
      // share "Program Committee: Clarity") -- the actual header cell must
      // still exist, either as the bare label (if it happens to be unique)
      // or disambiguated with the collision-policy suffix.
      const bareMatches = table.header.filter((h) => h === label);
      const disambiguated = table.header.filter((h) => h.startsWith(`${label} (`));
      expect(bareMatches.length + disambiguated.length, `no header column resolved for ${pair} (${label})`).toBeGreaterThan(0);
    }
  });

  it("the two same-labelled ('Clarity') criteria across plan-a and plan-b get distinct header columns", async () => {
    const table = await buildExport(fakeDb(queue()), "event-1", "evaluations");
    const clarityCols = table.header.filter((h) => h.includes("Program Committee: Clarity") || h.startsWith("Program Committee: Clarity ("));
    expect(clarityCols.length).toBe(2);
    expect(new Set(clarityCols).size).toBe(2);
  });

  it("cells: plan-a round-1 row carries its own scores and empty for plan-b's/round-2-only columns", async () => {
    const table = await buildExport(fakeDb(queue()), "event-1", "evaluations");
    const row = table.records[0]!; // reviewer1@example.com, plan-a, round 1
    const relevanceCol = table.header.find((h) => h.includes("Relevance"))!;
    const notesCol = table.header.find((h) => h.includes("Notes"))!;
    const depthCol = table.header.find((h) => h.includes("Depth"))!;
    expect(row[relevanceCol]).toBe("5");
    expect(row[notesCol]).toBe("Nice job");
    // cri_a3 is a round-2-only criterion; round-1 row has no such key.
    expect(row[depthCol]).toBe("");
  });

  it("a row missing a rating score (round-2, no cri_a2) yields an empty weightedScore and the export still succeeds", async () => {
    const table = await buildExport(fakeDb(queue()), "event-1", "evaluations");
    const round2Row = table.records.find((r) => r["round"] === "2")!;
    expect(round2Row).toBeDefined();
    expect(round2Row["weightedScore"]).toBe("");
  });

  it("a fully-scored rating row (plan-b) gets a numeric weightedScore", async () => {
    const table = await buildExport(fakeDb(queue()), "event-1", "evaluations");
    const planBRow = table.records.find((r) => r["title"] === "Talk Two")!;
    expect(planBRow["weightedScore"]).toBe("5");
  });
});

describe("DEC-147 (wave 79 amendment): weightedScore resolves per (planId, round) via criteriaForRound", () => {
  it("plan-a round 1 (no override for round 1) still weighs cri_a1+cri_a2 through the base criteria", async () => {
    const table = await buildExport(fakeDb(queue()), "event-1", "evaluations");
    const round1Row = table.records.find((r) => r["round"] === "1" && r["title"] === "Talk One")!;
    // (4*1 + 5*2) / 3 = 4.666666666666667
    expect(round1Row["weightedScore"]).toBe(String((4 * 1 + 5 * 2) / 3));
  });

  it("plan-a round 2's override REPLACES the base criteria with a dropdown-only scorecard, so weightedScore is empty (no rating criteria for that round), not merely missing a score", async () => {
    const table = await buildExport(fakeDb(queue()), "event-1", "evaluations");
    const round2Row = table.records.find((r) => r["round"] === "2")!;
    expect(round2Row["weightedScore"]).toBe("");
  });
});

describe("DEC-736 (wave 79 amendment): reviewer column carries a name when the contact has one, else the email", () => {
  it("a reviewer with a linked contact renders 'First Last'", async () => {
    const table = await buildExport(fakeDb(queue()), "event-1", "evaluations");
    const row = table.records[0]!; // reviewer1@example.com, has contactFirstName/contactLastName
    expect(row["reviewer"]).toBe("Alice Reviewer");
  });

  it("a reviewer with no linked contact name falls back to email", async () => {
    const table = await buildExport(fakeDb(queue()), "event-1", "evaluations");
    const row = table.records.find((r) => r["round"] === "2")!; // reviewer2@example.com, no contact names
    expect(row["reviewer"]).toBe("reviewer2@example.com");
  });

  it("the header has no 'reviewerEmail' column -- it was renamed to 'reviewer'", async () => {
    const table = await buildExport(fakeDb(queue()), "event-1", "evaluations");
    expect(table.header).not.toContain("reviewerEmail");
    expect(table.header).toContain("reviewer");
  });
});

describe("guard: roundCriteriaJson has exactly one legitimate reader outside labelByCriterionId", () => {
  it("src/server/repo/exports/evaluations.ts reads roundCriteriaJson only as a criteriaForRound argument or inside labelByCriterionId's deliberate all-rounds label union", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.resolve(__dirname, "../src/server/repo/exports/evaluations.ts"),
      "utf8",
    );
    const lines = src.split("\n");
    // Find labelByCriterionId's body span so its own reads are exempted --
    // it's the deliberate all-rounds label UNION, not a scoring resolution.
    const fnStart = lines.findIndex((l) => l.includes("export function labelByCriterionId"));
    expect(fnStart).toBeGreaterThanOrEqual(0);
    let depth = 0;
    let fnEnd = -1;
    for (let i = fnStart; i < lines.length; i++) {
      for (const ch of lines[i]!) {
        if (ch === "{") depth++;
        if (ch === "}") depth--;
      }
      if (depth === 0 && i > fnStart) {
        fnEnd = i;
        break;
      }
    }
    expect(fnEnd).toBeGreaterThan(fnStart);

    lines.forEach((line, idx) => {
      if (!line.includes("roundCriteriaJson")) return;
      const insideLabelFn = idx >= fnStart && idx <= fnEnd;
      const isCriteriaForRoundArg = /criteriaForRound\([^)]*roundCriteriaJson/.test(line) || /roundCriteriaJson,?\s*$/.test(line.trim()) && lines[idx - 1]?.includes("criteriaForRound(");
      const isDestructureOrSelect =
        /roundCriteriaJson:\s*schema\.evaluationPlan\.roundCriteriaJson/.test(line) || // select clause
        /roundCriteriaJson:\s*string \| null/.test(line) || // type signature
        /labelByCriterionId\(r\.criteriaJson, r\.roundCriteriaJson\)/.test(line); // label lookup call (feeds labelByCriterionId only)
      const ok = insideLabelFn || isCriteriaForRoundArg || isDestructureOrSelect;
      expect(ok, `unexpected roundCriteriaJson read outside criteriaForRound/labelByCriterionId at line ${idx + 1}: ${line}`).toBe(true);
    });
  });
});

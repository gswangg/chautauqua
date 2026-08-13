// DEC-772: loadDurationMinBySubmission hydrates each submission's format-
// derived duration in ONE batched query, and runAutoSchedule/autoSchedule
// must actually place sessions at that length instead of the grid's flat
// default.

import { describe, expect, it } from "vitest";
import { loadDurationMinBySubmission } from "../src/server/repo/agenda";
import { autoSchedule } from "../src/domain/schedule";
import type { Db } from "../src/server/context";

// Minimal fake db mirroring the sequential select() calls made by
// loadDurationMinBySubmission (same pattern as test/agenda-repo.test.ts).
function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    where: () => chain,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

describe("loadDurationMinBySubmission (DEC-772)", () => {
  it("returns an empty map for an empty id list without querying", async () => {
    const db = {
      select: () => {
        throw new Error("must not query when submissionIds is empty");
      },
    } as unknown as Db;
    const result = await loadDurationMinBySubmission(db, "event1", [], 30);
    expect(result.size).toBe(0);
  });

  it("parses a format-answer's duration and falls back to the default when absent", async () => {
    const db = {
      select: () =>
        makeChain([
          { submissionId: "sub-a", valueJson: JSON.stringify("Workshop (120 min)") },
          // sub-b has no submission_answer row at all (format-less session).
        ]),
    } as unknown as Db;

    const result = await loadDurationMinBySubmission(db, "event1", ["sub-a", "sub-b"], 30);
    expect(result.get("sub-a")).toBe(120);
    expect(result.get("sub-b")).toBe(30);
  });

  it("falls back to the default when the format label carries no parseable duration", async () => {
    const db = {
      select: () => makeChain([{ submissionId: "sub-a", valueJson: JSON.stringify("Keynote") }]),
    } as unknown as Db;

    const result = await loadDurationMinBySubmission(db, "event1", ["sub-a"], 30);
    expect(result.get("sub-a")).toBe(30);
  });
});

describe("autoSchedule honours per-submission durations (DEC-772)", () => {
  it("places a 120-min-format session as a 120-minute block while a format-less session keeps the default", () => {
    const durationBySubmission = new Map<string, number>([
      ["sub-long", 120],
      ["sub-default", 30],
    ]);

    const { placed, unplaced } = autoSchedule({
      sessions: [
        {
          submissionId: "sub-long",
          durationMin: durationBySubmission.get("sub-long")!,
          track: null,
          speakerContactIds: [],
        },
        {
          submissionId: "sub-default",
          durationMin: durationBySubmission.get("sub-default")!,
          track: null,
          speakerContactIds: [],
        },
      ],
      rooms: ["room1"],
      days: ["2026-08-10"],
      dayStartMin: 540,
      dayEndMin: 1080,
      gridMin: 15,
      existing: [],
    });

    expect(unplaced).toEqual([]);
    const long = placed.find((p) => p.submissionId === "sub-long")!;
    const short = placed.find((p) => p.submissionId === "sub-default")!;
    expect(long.endMin - long.startMin).toBe(120);
    expect(short.endMin - short.startMin).toBe(30);
  });
});

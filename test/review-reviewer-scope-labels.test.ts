// DEC-659 regression coverage: GET /api/v1/plans/:id/reviewers resolves
// trackName/submissionRef/submissionTitle through ONE batched query over the
// page's distinct non-null trackIds and ONE over the distinct non-null
// submissionIds -- never a query per row. Uses the same fake-chain pattern
// as test/agenda-repo.test.ts (no local sqlite/D1 test driver in stage 1).

import { describe, expect, it } from "vitest";
import { getTrackNamesByIds, getSubmissionLabelsByIds } from "../src/server/repo/review";
import type { Db } from "../src/server/context";

function makeChain(rows: unknown[], onCall?: () => void) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => {
      onCall?.();
      return chain;
    },
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

describe("DEC-659: getTrackNamesByIds -- one batched query, row count independent of query count", () => {
  it("resolves all present ids from a single select() call regardless of id count", async () => {
    let selectCalls = 0;
    const fixtureRows = [
      { id: "track-1", name: "Design" },
      { id: "track-2", name: "Engineering" },
      // note: no row for "track-missing" -- simulates a deleted track
    ];
    const fakeDb = {
      select: () => {
        selectCalls += 1;
        return makeChain(fixtureRows);
      },
    } as unknown as Db;

    const result = await getTrackNamesByIds(fakeDb, ["track-1", "track-2", "track-missing"]);

    expect(selectCalls).toBe(1);
    expect(result.get("track-1")).toBe("Design");
    expect(result.get("track-2")).toBe("Engineering");
    // Deleted/unknown track: absent from the map (never a raw id fallback).
    expect(result.has("track-missing")).toBe(false);
  });

  it("makes no query for an empty id list", async () => {
    let selectCalls = 0;
    const fakeDb = {
      select: () => {
        selectCalls += 1;
        return makeChain([]);
      },
    } as unknown as Db;

    const result = await getTrackNamesByIds(fakeDb, []);
    expect(selectCalls).toBe(0);
    expect(result.size).toBe(0);
  });
});

describe("DEC-659: getSubmissionLabelsByIds -- one batched query over the joined shape", () => {
  it("resolves ref (via formatRef) and title for present ids, omits ids with no row", async () => {
    let selectCalls = 0;
    const fixtureRows = [
      { id: "sub-1", title: "Talk One", seq: 14, recordPrefix: "SES" },
      { id: "sub-2", title: "Talk Two", seq: 2, recordPrefix: "SES" },
      // no row for "sub-missing" -- simulates a deleted submission
    ];
    const fakeDb = {
      select: () => {
        selectCalls += 1;
        return makeChain(fixtureRows);
      },
    } as unknown as Db;

    const result = await getSubmissionLabelsByIds(fakeDb, ["sub-1", "sub-2", "sub-missing"]);

    expect(selectCalls).toBe(1);
    expect(result.get("sub-1")).toEqual({ ref: "SES-014", title: "Talk One" });
    expect(result.get("sub-2")).toEqual({ ref: "SES-002", title: "Talk Two" });
    expect(result.has("sub-missing")).toBe(false);
  });
});

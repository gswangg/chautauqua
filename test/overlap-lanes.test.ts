// DEC-140: pure lane-assignment for overlapping schedule blocks (see
// src/lib/overlap-lanes.ts header for the algorithm/contract).

import { describe, expect, it } from "vitest";
import { assignLanes } from "../src/lib/overlap-lanes";

describe("assignLanes", () => {
  it("gives non-overlapping items full width (lane 0, laneCount 1)", () => {
    const items = [
      { id: "a", startMin: 0, endMin: 60 },
      { id: "b", startMin: 60, endMin: 120 },
      { id: "c", startMin: 120, endMin: 180 },
    ];
    const result = assignLanes(items);
    for (const r of result) {
      expect(r.lane).toBe(0);
      expect(r.laneCount).toBe(1);
    }
  });

  it("splits two overlapping items into 2 side-by-side lanes", () => {
    const items = [
      { id: "a", startMin: 0, endMin: 60 },
      { id: "b", startMin: 30, endMin: 90 },
    ];
    const result = assignLanes(items);
    const byId = new Map(result.map((r) => [r.item.id, r]));
    expect(byId.get("a")!.laneCount).toBe(2);
    expect(byId.get("b")!.laneCount).toBe(2);
    expect(byId.get("a")!.lane).not.toBe(byId.get("b")!.lane);
    expect(new Set(result.map((r) => r.lane))).toEqual(new Set([0, 1]));
  });

  it("assigns correct lanes for a 3-item overlap chain (A-B, B-C, A/C disjoint)", () => {
    const items = [
      { id: "a", startMin: 0, endMin: 60 },
      { id: "b", startMin: 30, endMin: 90 },
      { id: "c", startMin: 60, endMin: 120 },
    ];
    const result = assignLanes(items);
    const byId = new Map(result.map((r) => [r.item.id, r]));

    // Peak concurrency anywhere in this cluster is 2 (A+B, or B+C) — every
    // item in the cluster gets a 2-lane width.
    expect(byId.get("a")!.laneCount).toBe(2);
    expect(byId.get("b")!.laneCount).toBe(2);
    expect(byId.get("c")!.laneCount).toBe(2);

    // B overlaps both A and C, so B must sit in a different lane than each
    // of them.
    expect(byId.get("b")!.lane).not.toBe(byId.get("a")!.lane);
    expect(byId.get("b")!.lane).not.toBe(byId.get("c")!.lane);

    // A and C never overlap each other, so they're free to share a lane.
    expect(byId.get("a")!.lane).toBe(byId.get("c")!.lane);
  });

  it("boundary-touching intervals (end === start) do not count as overlapping", () => {
    const items = [
      { id: "a", startMin: 0, endMin: 60 },
      { id: "b", startMin: 60, endMin: 120 },
    ];
    const result = assignLanes(items);
    for (const r of result) {
      expect(r.laneCount).toBe(1);
      expect(r.lane).toBe(0);
    }
  });

  it("handles three fully mutually-overlapping items with 3 distinct lanes", () => {
    const items = [
      { id: "a", startMin: 0, endMin: 90 },
      { id: "b", startMin: 10, endMin: 100 },
      { id: "c", startMin: 20, endMin: 110 },
    ];
    const result = assignLanes(items);
    const lanes = result.map((r) => r.lane).sort();
    expect(lanes).toEqual([0, 1, 2]);
    for (const r of result) expect(r.laneCount).toBe(3);
  });
});

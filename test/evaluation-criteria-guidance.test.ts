// DEC-676: criterion guidance normalization, weighted-share display, and the
// new-plan default criteria list.
import { describe, it, expect } from "vitest";
import {
  criterionWeightShares,
  normalizeGuidance,
  DEFAULT_PLAN_CRITERIA,
  MAX_CRITERION_GUIDANCE_LENGTH,
} from "../src/domain/evaluation";

describe("normalizeGuidance (DEC-676)", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeGuidance("  Rate the depth of the proposal.  ")).toBe("Rate the depth of the proposal.");
  });

  it("collapses a blank string to undefined", () => {
    expect(normalizeGuidance("   ")).toBeUndefined();
    expect(normalizeGuidance("")).toBeUndefined();
  });

  it("passes undefined/null through as undefined", () => {
    expect(normalizeGuidance(undefined)).toBeUndefined();
    expect(normalizeGuidance(null)).toBeUndefined();
  });
});

describe("criterionWeightShares (DEC-676)", () => {
  it("returns each rating criterion's integer percentage share of total weight", () => {
    const shares = criterionWeightShares([
      { id: "a", weight: 2 },
      { id: "b", weight: 1 },
    ]);
    expect(shares).toEqual({ a: 67, b: 33 });
  });

  it("excludes non-weighted kinds (no weight field) from the share map", () => {
    const shares = criterionWeightShares([
      { id: "a", weight: 3 },
      { id: "b" }, // dropdown/text criterion: no weight
    ]);
    expect(shares).toEqual({ a: 100 });
    expect(shares.b).toBeUndefined();
  });

  it("never forces weights to sum to 100 -- shares are the DERIVED percentage, not a constraint on the input", () => {
    // Weights 1/1/1 -> shares that themselves sum to 100 here, but the
    // function doesn't require or enforce that in general (see rounding
    // case below).
    const shares = criterionWeightShares([
      { id: "a", weight: 1 },
      { id: "b", weight: 1 },
      { id: "c", weight: 1 },
    ]);
    expect(shares).toEqual({ a: 33, b: 33, c: 33 });
  });

  it("returns an empty map for an empty list or all-zero/undefined weights", () => {
    expect(criterionWeightShares([])).toEqual({});
    expect(criterionWeightShares([{ id: "a", weight: 0 }])).toEqual({});
    expect(criterionWeightShares([{ id: "a" }])).toEqual({});
  });
});

describe("DEFAULT_PLAN_CRITERIA (DEC-676)", () => {
  it("has exactly three rating criteria at equal weights, each with guidance", () => {
    expect(DEFAULT_PLAN_CRITERIA).toHaveLength(3);
    for (const c of DEFAULT_PLAN_CRITERIA) {
      expect(c.kind).toBe("rating");
      expect(c.weight).toBe(1);
      expect(typeof c.guidance).toBe("string");
      expect(c.guidance!.length).toBeGreaterThan(0);
      expect(c.guidance!.length).toBeLessThanOrEqual(MAX_CRITERION_GUIDANCE_LENGTH);
    }
  });

  it("labels Relevance, Depth, and Speaker readiness", () => {
    expect(DEFAULT_PLAN_CRITERIA.map((c) => c.label)).toEqual(["Relevance", "Depth", "Speaker readiness"]);
  });

  it("every default criterion carries a distinct id", () => {
    const ids = new Set(DEFAULT_PLAN_CRITERIA.map((c) => c.id));
    expect(ids.size).toBe(DEFAULT_PLAN_CRITERIA.length);
  });
});

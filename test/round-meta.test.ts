// DEC-147 amendment (wave 8, task w8-c) regression coverage: a round is a
// named window, not a bare integer -- roundMetaFor resolves a round's own
// {name, opensAt, closesAt}, roundLabel is the one place a round becomes
// display copy.

import { describe, it, expect } from "vitest";
import { roundMetaFor, roundLabel, planNamesRound } from "../src/domain/evaluation";

const plan = { name: "Track Review", openDate: 1000, closeDate: 2000 };

describe("roundMetaFor (DEC-147 amendment)", () => {
  it("falls back to `Round N` and the plan's own dates when overrides is null", () => {
    expect(roundMetaFor(plan, null, 1)).toEqual({ name: "Round 1", opensAt: 1000, closesAt: 2000 });
    expect(roundMetaFor(plan, null, 3)).toEqual({ name: "Round 3", opensAt: 1000, closesAt: 2000 });
  });

  it("falls back when overrides is non-null but the round has no entry", () => {
    expect(roundMetaFor(plan, { "2": { name: "Final round" } }, 1)).toEqual({
      name: "Round 1",
      opensAt: 1000,
      closesAt: 2000,
    });
  });

  it("uses the round's own name/dates when present, falling back per-field", () => {
    expect(roundMetaFor(plan, { "2": { name: "Final round" } }, 2)).toEqual({
      name: "Final round",
      opensAt: 1000,
      closesAt: 2000,
    });
    expect(roundMetaFor(plan, { "2": { opensAt: 1500, closesAt: 1800 } }, 2)).toEqual({
      name: "Round 2",
      opensAt: 1500,
      closesAt: 1800,
    });
    expect(roundMetaFor(plan, { "2": { name: "Final round", opensAt: 1500, closesAt: null } }, 2)).toEqual({
      name: "Final round",
      opensAt: 1500,
      closesAt: null,
    });
  });

  it("treats a blank name as absent, falling back to `Round N`", () => {
    expect(roundMetaFor(plan, { "2": { name: "   " } }, 2)).toEqual({
      name: "Round 2",
      opensAt: 1000,
      closesAt: 2000,
    });
  });

  it("throws loudly on a malformed entry rather than silently falling back", () => {
    // @ts-expect-error deliberately malformed for the throw-loudly assertion
    expect(() => roundMetaFor(plan, { "2": "not an object" }, 2)).toThrow();
    // @ts-expect-error deliberately malformed for the throw-loudly assertion
    expect(() => roundMetaFor(plan, { "2": { name: 42 } }, 2)).toThrow();
    // @ts-expect-error deliberately malformed for the throw-loudly assertion
    expect(() => roundMetaFor(plan, { "2": { opensAt: "not a number" } }, 2)).toThrow();
    // @ts-expect-error deliberately malformed for the throw-loudly assertion
    expect(() => roundMetaFor(plan, { "2": null }, 2)).toThrow();
  });
});

describe("roundLabel (DEC-147 amendment)", () => {
  it("is the one place a round becomes copy -- returns the resolved meta name", () => {
    expect(roundLabel("Track Review", 2, { name: "Round 2" })).toBe("Round 2");
    expect(roundLabel("Track Review", 2, { name: "Final round" })).toBe("Final round");
  });
});

describe("planNamesRound (DEC-147 wave-63 amendment)", () => {
  it("is false for a single-round plan", () => {
    expect(planNamesRound(1)).toBe(false);
  });

  it("is true for any plan with more than one round", () => {
    expect(planNamesRound(2)).toBe(true);
    expect(planNamesRound(3)).toBe(true);
  });
});

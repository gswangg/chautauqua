import { describe, expect, it } from "vitest";

import {
  evaluateDeadlineNearestWeights,
  evaluateTypeRoleResult,
  OVERVIEW_TYPE_ROLES,
  TYPE_ROLE_BLOCKING,
  type TypeRoleObserved,
} from "../scripts/render-sweep-lib";

// DEC-643 pure-evaluator unit tests: the DOM-free half of the type-role
// render-sweep pass (the in-page getComputedStyle measurement lives in
// scripts/render-sweep.ts's measureTypeRoles and needs a browser, so it is
// exercised by the render-sweep gate itself, not here).

describe("evaluateTypeRoleResult (DEC-643)", () => {
  it("passes when every measured property matches expected exactly", () => {
    const observed: TypeRoleObserved = { fontSizePx: 44, fontWeight: 700, letterSpacingEm: -0.042 };
    const result = evaluateTypeRoleResult(observed, {
      fontSizePx: 44,
      fontWeight: 700,
      letterSpacingEm: -0.042,
    });
    expect(result.ok).toBe(true);
    expect(result.failureReason).toBeUndefined();
  });

  it("tolerates small subpixel drift within tolerance", () => {
    const observed: TypeRoleObserved = { fontSizePx: 44.2, fontWeight: 700, letterSpacingEm: -0.0421 };
    const result = evaluateTypeRoleResult(observed, {
      fontSizePx: 44,
      fontWeight: 700,
      letterSpacingEm: -0.042,
    });
    expect(result.ok).toBe(true);
  });

  it("fails on a drifted font-size", () => {
    const observed: TypeRoleObserved = { fontSizePx: 40, fontWeight: 700, letterSpacingEm: -0.042 };
    const result = evaluateTypeRoleResult(observed, {
      fontSizePx: 44,
      fontWeight: 700,
      letterSpacingEm: -0.042,
    });
    expect(result.ok).toBe(false);
    expect(result.failureReason).toMatch(/font-size/);
  });

  it("fails on a wrong font-weight", () => {
    const observed: TypeRoleObserved = { fontSizePx: 44, fontWeight: 400, letterSpacingEm: -0.042 };
    const result = evaluateTypeRoleResult(observed, {
      fontSizePx: 44,
      fontWeight: 700,
      letterSpacingEm: -0.042,
    });
    expect(result.ok).toBe(false);
    expect(result.failureReason).toMatch(/font-weight/);
  });

  it("fails on drifted letter-spacing", () => {
    const observed: TypeRoleObserved = { fontSizePx: 44, fontWeight: 700, letterSpacingEm: -0.01 };
    const result = evaluateTypeRoleResult(observed, {
      fontSizePx: 44,
      fontWeight: 700,
      letterSpacingEm: -0.042,
    });
    expect(result.ok).toBe(false);
    expect(result.failureReason).toMatch(/letter-spacing/);
  });

  it("only checks properties present in `expected` (row-title has no fontSizePx expectation)", () => {
    const observed: TypeRoleObserved = { fontSizePx: 21, fontWeight: 600, letterSpacingEm: -0.015 };
    const result = evaluateTypeRoleResult(observed, { fontWeight: 600, letterSpacingEm: -0.015 });
    expect(result.ok).toBe(true);
  });

  it("fails when an expected property was never measured", () => {
    const observed: TypeRoleObserved = { fontWeight: 700 };
    const result = evaluateTypeRoleResult(observed, { fontSizePx: 44, fontWeight: 700 });
    expect(result.ok).toBe(false);
    expect(result.failureReason).toMatch(/not measured/);
  });
});

describe("evaluateDeadlineNearestWeights (DEC-643, DEC-611 wave-2 amendment)", () => {
  it("passes when exactly one cell is at the minimum value and reads 700, the rest read 400", () => {
    const result = evaluateDeadlineNearestWeights([
      { weight: 400, value: "6 days" },
      { weight: 700, value: "2 days" },
      { weight: 400, value: "9 days" },
      { weight: 400, value: "—" },
    ]);
    expect(result.ok).toBe(true);
  });

  // DEC-611 wave-2 amendment: nearest-deadline emphasis is a SET — a tie
  // marks every cell sharing the minimum value, never an arbitrary
  // first-wins pick (app/src/pages/overview/rows.test.ts:180-189).
  it("passes when two cells share the tied minimum value and both read 700", () => {
    const result = evaluateDeadlineNearestWeights([
      { weight: 700, value: "2 days" },
      { weight: 700, value: "2 days" },
      { weight: 400, value: "9 days" },
      { weight: 400, value: "—" },
    ]);
    expect(result.ok).toBe(true);
  });

  it("fails when two cells read 700 but their values are not actually tied", () => {
    const result = evaluateDeadlineNearestWeights([
      { weight: 700, value: "2 days" },
      { weight: 700, value: "6 days" },
      { weight: 400, value: "9 days" },
      { weight: 400, value: "—" },
    ]);
    expect(result.ok).toBe(false);
    expect(result.failureReason).toMatch(/non-minimum cell/);
  });

  it("fails when a non-nearest cell (not at the minimum) reads weight 700", () => {
    const result = evaluateDeadlineNearestWeights([
      { weight: 700, value: "2 days" },
      { weight: 700, value: "6 days" },
      { weight: 400, value: "9 days" },
      { weight: 400, value: "—" },
    ]);
    // one of the two 700 cells ("6 days") is not at the minimum ("2 days")
    expect(result.failureReason).toMatch(/non-nearest cell must not read 700/);
  });

  it("fails when zero cells read 700 while at least one deadline is set", () => {
    const result = evaluateDeadlineNearestWeights([
      { weight: 400, value: "2 days" },
      { weight: 400, value: "6 days" },
      { weight: 400, value: "9 days" },
      { weight: 400, value: "—" },
    ]);
    expect(result.ok).toBe(false);
    expect(result.failureReason).toMatch(/expected at least 1 cell at weight 700/);
  });

  it("passes when no deadline is set at all and no cell reads 700", () => {
    const result = evaluateDeadlineNearestWeights([
      { weight: 400, value: "—" },
      { weight: 400, value: "—" },
      { weight: 400, value: "—" },
      { weight: 400, value: "—" },
    ]);
    expect(result.ok).toBe(true);
  });

  it("fails when no deadline is set but a cell reads 700 anyway", () => {
    const result = evaluateDeadlineNearestWeights([
      { weight: 700, value: "—" },
      { weight: 400, value: "—" },
      { weight: 400, value: "—" },
      { weight: 400, value: "—" },
    ]);
    expect(result.ok).toBe(false);
    expect(result.failureReason).toMatch(/no deadline is set/);
  });

  it("fails when a non-nearest cell reads a weight other than 400 or 700", () => {
    const result = evaluateDeadlineNearestWeights([
      { weight: 700, value: "2 days" },
      { weight: 500, value: "6 days" },
      { weight: 400, value: "9 days" },
      { weight: 400, value: "—" },
    ]);
    expect(result.ok).toBe(false);
    expect(result.failureReason).toMatch(/must read weight 400/);
  });

  it("treats 'Today' as rank 0, ahead of any '1 day' cell", () => {
    const result = evaluateDeadlineNearestWeights([
      { weight: 700, value: "Today" },
      { weight: 400, value: "1 day" },
      { weight: 400, value: "9 days" },
      { weight: 400, value: "—" },
    ]);
    expect(result.ok).toBe(true);
  });
});

describe("OVERVIEW_TYPE_ROLES table (DEC-643)", () => {
  it("names the five key roles plus the deadline-value nearest override", () => {
    const roles = OVERVIEW_TYPE_ROLES.map((r) => r.role);
    expect(roles).toEqual([
      "overview-headline",
      "section-label",
      "deadline-label",
      "deadline-value",
      "deadline-value-nearest",
      "row-title",
    ]);
  });

  it("every entry expects at least one measured property", () => {
    for (const entry of OVERVIEW_TYPE_ROLES) {
      const keys = Object.keys(entry.expected);
      expect(keys.length).toBeGreaterThan(0);
    }
  });
});

describe("TYPE_ROLE_BLOCKING (DEC-643)", () => {
  it("stays advisory (false) — a fresh instrument must not gate the sweep on first measurement", () => {
    expect(TYPE_ROLE_BLOCKING).toBe(false);
  });
});

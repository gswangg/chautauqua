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

describe("evaluateDeadlineNearestWeights (DEC-643)", () => {
  it("passes when exactly one cell reads 700 and the rest read 400", () => {
    const result = evaluateDeadlineNearestWeights([400, 700, 400, 400]);
    expect(result.ok).toBe(true);
  });

  it("fails when two cells read 700 (ambiguous nearest deadline)", () => {
    const result = evaluateDeadlineNearestWeights([700, 700, 400, 400]);
    expect(result.ok).toBe(false);
    expect(result.failureReason).toMatch(/exactly 1/);
  });

  it("fails when zero cells read 700 (no nearest deadline highlighted)", () => {
    const result = evaluateDeadlineNearestWeights([400, 400, 400, 400]);
    expect(result.ok).toBe(false);
    expect(result.failureReason).toMatch(/exactly 1/);
  });

  it("fails when a non-nearest cell reads a weight other than 400", () => {
    const result = evaluateDeadlineNearestWeights([700, 500, 400, 400]);
    expect(result.ok).toBe(false);
    expect(result.failureReason).toMatch(/weight 400/);
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

// Pure ordering + validation tests for pipeline fit (CRM-07/08, DEC-821).
// sortByFit (src/domain/pipeline-fit.ts) is the pure ranking rule: descending
// by fit score, unrated (null) last, WITHIN whatever set of entries is
// handed to it -- it never looks at or reorders across stage. validateFitScore
// / validateRationale (src/routes/api/pipeline.ts) are the route-layer field
// validators: integer 1-5 or null, and bounded text or null, both throwing a
// named ApiError field rather than ever coercing.

import { describe, expect, it } from "vitest";
import { sortByFit } from "../src/domain/pipeline-fit";
import { validateFitScore, validateRationale } from "../src/routes/api/pipeline";
import { ApiError } from "../src/server/http";

describe("sortByFit", () => {
  it("orders entries by fit score descending", () => {
    const entries = [{ id: "a", fitScore: 2 }, { id: "b", fitScore: 5 }, { id: "c", fitScore: 3 }];
    expect(sortByFit(entries).map((e) => e.id)).toEqual(["b", "c", "a"]);
  });

  it("puts unrated (null) entries last, regardless of position", () => {
    const entries = [
      { id: "a", fitScore: null },
      { id: "b", fitScore: 4 },
      { id: "c", fitScore: null },
      { id: "d", fitScore: 1 },
    ];
    expect(sortByFit(entries).map((e) => e.id)).toEqual(["b", "d", "a", "c"]);
  });

  it("is a no-op ordering for an all-unrated set (stable, doesn't reorder)", () => {
    const entries = [{ id: "a", fitScore: null }, { id: "b", fitScore: null }];
    expect(sortByFit(entries).map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("does not mutate the input array", () => {
    const entries = [{ id: "a", fitScore: 1 }, { id: "b", fitScore: 5 }];
    const copy = [...entries];
    sortByFit(entries);
    expect(entries).toEqual(copy);
  });
});

describe("validateFitScore", () => {
  it("accepts undefined and null as unrated", () => {
    expect(validateFitScore(undefined)).toBeNull();
    expect(validateFitScore(null)).toBeNull();
  });

  it("accepts each integer 1-5", () => {
    for (let n = 1; n <= 5; n++) expect(validateFitScore(n)).toBe(n);
  });

  it("rejects 0 and 6 as out of range", () => {
    expect(() => validateFitScore(0)).toThrow(ApiError);
    expect(() => validateFitScore(6)).toThrow(ApiError);
  });

  it("rejects a non-integer number, never coercing", () => {
    expect(() => validateFitScore(3.5)).toThrow(ApiError);
  });

  it("rejects a string, never coercing", () => {
    expect(() => validateFitScore("3")).toThrow(ApiError);
  });

  it("names the fitScore field on the thrown error", () => {
    try {
      validateFitScore(9);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).fields).toHaveProperty("fitScore");
    }
  });
});

describe("validateRationale", () => {
  it("accepts undefined, null, and blank/whitespace as no rationale", () => {
    expect(validateRationale(undefined)).toBeNull();
    expect(validateRationale(null)).toBeNull();
    expect(validateRationale("   ")).toBeNull();
  });

  it("trims and returns a valid rationale", () => {
    expect(validateRationale("  Keynoted a similar event  ")).toBe("Keynoted a similar event");
  });

  it("rejects a non-string, never coercing", () => {
    expect(() => validateRationale(42)).toThrow(ApiError);
  });

  it("rejects text over the bounded length", () => {
    expect(() => validateRationale("x".repeat(501))).toThrow(ApiError);
  });

  it("names the rationale field on the thrown error", () => {
    try {
      validateRationale(42);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).fields).toHaveProperty("rationale");
    }
  });
});

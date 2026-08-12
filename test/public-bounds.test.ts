// DEC-433: boundedRowLimit is the single choke point for the row count
// passed to db.limit() on the public sessions/speakers list queries.

import { describe, expect, it } from "vitest";
import { boundedRowLimit, MAX_PUBLIC_ROWS, MAX_PUBLIC_PAGE, PUBLIC_PER_PAGE } from "../src/server/repo/public/bounds";

describe("boundedRowLimit (DEC-433)", () => {
  it("returns page*perPage when under the cap", () => {
    expect(boundedRowLimit(1, 20)).toBe(20);
    expect(boundedRowLimit(3, 20)).toBe(60);
  });

  it("clamps to MAX_PUBLIC_ROWS when page*perPage exceeds it", () => {
    expect(boundedRowLimit(50, 100)).toBe(MAX_PUBLIC_ROWS);
    expect(boundedRowLimit(1000, 1000)).toBe(MAX_PUBLIC_ROWS);
  });

  it("MAX_PUBLIC_ROWS is the derived MAX_PUBLIC_PAGE x PUBLIC_PER_PAGE, never a second literal (DEC-487)", () => {
    expect(MAX_PUBLIC_ROWS).toBe(MAX_PUBLIC_PAGE * PUBLIC_PER_PAGE);
  });

  it("throws (fail loudly) on non-finite or non-integer page", () => {
    expect(() => boundedRowLimit(Infinity, 20)).toThrow();
    expect(() => boundedRowLimit(NaN, 20)).toThrow();
    expect(() => boundedRowLimit(1.5, 20)).toThrow();
    expect(() => boundedRowLimit(0, 20)).toThrow();
    expect(() => boundedRowLimit(-1, 20)).toThrow();
  });

  it("throws (fail loudly) on non-finite or non-integer perPage", () => {
    expect(() => boundedRowLimit(1, Infinity)).toThrow();
    expect(() => boundedRowLimit(1, NaN)).toThrow();
    expect(() => boundedRowLimit(1, 1.5)).toThrow();
    expect(() => boundedRowLimit(1, 0)).toThrow();
    expect(() => boundedRowLimit(1, -5)).toThrow();
  });
});

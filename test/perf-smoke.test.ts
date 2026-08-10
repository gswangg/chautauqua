import { describe, expect, it } from "vitest";
import { PERF_P95_BUDGET_MS, computeP95 } from "../scripts/perf-smoke-lib";

describe("computeP95", () => {
  it("computes the 95th percentile via nearest-rank on a sorted sample", () => {
    // 20 samples 1..20 -> ceil(0.95*20) = 19th smallest = 19.
    const samples = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(computeP95(samples)).toBe(19);
  });

  it("is order-independent", () => {
    const ascending = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = [7, 2, 9, 1, 10, 4, 6, 3, 8, 5];
    expect(computeP95(shuffled)).toBe(computeP95(ascending));
  });

  it("returns the single sample for a single-element set", () => {
    expect(computeP95([42])).toBe(42);
  });

  it("clamps to the max for small sample sets", () => {
    expect(computeP95([10, 20, 30])).toBe(30);
  });

  it("throws on an empty sample set", () => {
    expect(() => computeP95([])).toThrow();
  });

  it("exposes a 150ms local budget per DEC-034", () => {
    expect(PERF_P95_BUDGET_MS).toBe(150);
  });
});

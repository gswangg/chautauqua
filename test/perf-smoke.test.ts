import { describe, expect, it } from "vitest";
import { PERF_P95_BUDGET_MS, assertContainsVevent, computeP95, joinIcsIds } from "../scripts/perf-smoke-lib";

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

describe("joinIcsIds", () => {
  it("comma-joins ids", () => {
    expect(joinIcsIds(["a", "b", "c"])).toBe("a,b,c");
  });

  it("returns a single id unchanged", () => {
    expect(joinIcsIds(["only"])).toBe("only");
  });

  it("throws on an empty list", () => {
    expect(() => joinIcsIds([])).toThrow();
  });
});

describe("assertContainsVevent", () => {
  it("does not throw when BEGIN:VEVENT is present", () => {
    expect(() => assertContainsVevent("check", "BEGIN:VCALENDAR\nBEGIN:VEVENT\nEND:VEVENT\nEND:VCALENDAR")).not.toThrow();
  });

  it("throws with the check name when BEGIN:VEVENT is missing", () => {
    expect(() => assertContainsVevent("schedule.ics 150 ids", "BEGIN:VCALENDAR\nEND:VCALENDAR")).toThrow(
      /schedule\.ics 150 ids/,
    );
  });
});

import { describe, expect, it } from "vitest";
import {
  PERF_CLASS_BUDGET_MS,
  PERF_P95_BUDGET_MS,
  adjustedP95,
  assertContainsVevent,
  assertMinCsvLines,
  computeP95,
  computePercentile,
  gradePerfCheck,
  joinIcsIds,
  planPerfPages,
  resolvePerfProfileName,
} from "../scripts/perf-smoke-lib";

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

describe("computePercentile", () => {
  it("computes p50 (median) via nearest-rank on a sorted sample", () => {
    // 10 samples 1..10 -> ceil(0.5*10) = 5th smallest = 5.
    const samples = Array.from({ length: 10 }, (_, i) => i + 1);
    expect(computePercentile(samples, 0.5)).toBe(5);
  });

  it("computes p95 identically to computeP95", () => {
    const samples = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(computePercentile(samples, 0.95)).toBe(computeP95(samples));
  });

  it("computes p100 as the max", () => {
    expect(computePercentile([10, 20, 30], 1)).toBe(30);
  });

  it("throws on an empty sample set", () => {
    expect(() => computePercentile([], 0.5)).toThrow();
  });

  it("throws on q <= 0", () => {
    expect(() => computePercentile([1, 2, 3], 0)).toThrow();
    expect(() => computePercentile([1, 2, 3], -0.5)).toThrow();
  });

  it("throws on q > 1", () => {
    expect(() => computePercentile([1, 2, 3], 1.5)).toThrow();
  });
});

describe("adjustedP95", () => {
  it("subtracts the overhead floor from the raw p95", () => {
    expect(adjustedP95(60, 10)).toBe(50);
  });

  it("clamps at 0 when the floor exceeds the raw p95", () => {
    expect(adjustedP95(5, 10)).toBe(0);
  });

  it("returns the raw value unchanged when the floor is 0", () => {
    expect(adjustedP95(42, 0)).toBe(42);
  });

  it("throws on a negative rawP95Ms", () => {
    expect(() => adjustedP95(-1, 10)).toThrow();
  });

  it("throws on a negative overheadFloorMs", () => {
    expect(() => adjustedP95(60, -1)).toThrow();
  });
});

describe("gradePerfCheck", () => {
  it("exposes SPEC §7 per-class budgets (DEC-309)", () => {
    expect(PERF_CLASS_BUDGET_MS).toEqual({ read: 50, write: 100, public: 150 });
  });

  it("passes when both the raw ceiling and the adjusted class budget are respected", () => {
    // raw 60ms, floor 20ms -> adjusted 40ms, under the 50ms read budget.
    const result = gradePerfCheck("submissions list", "read", 60, 20);
    expect(result.ok).toBe(true);
    expect(result.adjustedMs).toBe(40);
    expect(result.reason).toBeUndefined();
  });

  it("fails when the raw p95 exceeds the unconditional 150ms ceiling, even if adjusted is under class budget", () => {
    // raw 160ms > 150ms ceiling, floor 100ms -> adjusted 60ms is under the
    // 150ms public budget, but the raw ceiling still fails it.
    const result = gradePerfCheck("public agenda", "public", 160, 100);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/raw p95 160\.0ms exceeds 150ms ceiling/);
  });

  it("fails when the adjusted p95 exceeds the class budget even though raw is under the 150ms ceiling", () => {
    // The motivating case: raw 51.9ms is under the flat 150ms ceiling, but
    // for a read check (50ms budget) with a negligible overhead floor,
    // the adjusted figure still fails against the read class budget.
    const result = gradePerfCheck("submission detail", "read", 51.9, 1);
    expect(result.ok).toBe(false);
    expect(result.adjustedMs).toBeCloseTo(50.9, 5);
    expect(result.reason).toMatch(/adjusted p95 50\.9ms exceeds read class budget 50ms/);
  });

  it("fails with both reasons joined when raw and adjusted both exceed budget", () => {
    const result = gradePerfCheck("rating PUT", "write", 200, 50);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/raw p95 200\.0ms exceeds 150ms ceiling/);
    expect(result.reason).toMatch(/adjusted p95 150\.0ms exceeds write class budget 100ms/);
  });

  it("returns the check name, class, raw and adjusted values, and budget", () => {
    const result = gradePerfCheck("plan progress", "read", 30, 5);
    expect(result).toMatchObject({
      name: "plan progress",
      cls: "read",
      rawP95Ms: 30,
      adjustedMs: 25,
      budgetMs: 50,
      ok: true,
    });
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

describe("planPerfPages", () => {
  it("plans a single page when count fits within maxPerPage", () => {
    expect(planPerfPages(150, 200)).toEqual([{ page: 1, perPage: 200 }]);
  });

  it("plans every page at the same fixed perPage, never a decreasing remainder (DEC-094: 301 over cap 200)", () => {
    // Fixed perPage matters: the server computes each page's offset as
    // (page-1)*perPage from that request's own perPage, so a shrinking
    // remainder page would desync the offset and skip/duplicate rows.
    expect(planPerfPages(301, 200)).toEqual([
      { page: 1, perPage: 200 },
      { page: 2, perPage: 200 },
    ]);
  });

  it("plans exact multiples without a trailing empty page (300 over cap 200)", () => {
    expect(planPerfPages(300, 200)).toEqual([
      { page: 1, perPage: 200 },
      { page: 2, perPage: 200 },
    ]);
  });

  it("throws on non-positive count", () => {
    expect(() => planPerfPages(0, 200)).toThrow();
    expect(() => planPerfPages(-1, 200)).toThrow();
  });

  it("throws on non-positive maxPerPage", () => {
    expect(() => planPerfPages(10, 0)).toThrow();
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

describe("resolvePerfProfileName", () => {
  it("defaults to 'default' when neither a flag nor env var is set", () => {
    expect(resolvePerfProfileName([], {})).toBe("default");
  });

  it("resolves from the --profile= flag", () => {
    expect(resolvePerfProfileName(["--profile=aie"], {})).toBe("aie");
  });

  it("resolves from the PERF_PROFILE env var when no flag is present", () => {
    expect(resolvePerfProfileName([], { PERF_PROFILE: "aie" })).toBe("aie");
  });

  it("prefers the --profile= flag over the PERF_PROFILE env var", () => {
    expect(resolvePerfProfileName(["--profile=default"], { PERF_PROFILE: "aie" })).toBe("default");
  });

  it("ignores unrelated argv entries and still finds the flag", () => {
    expect(resolvePerfProfileName(["node", "scripts/perf-smoke.ts", "--profile=aie"], {})).toBe("aie");
  });

  it("throws naming the known profile names on an unknown --profile= value", () => {
    expect(() => resolvePerfProfileName(["--profile=bogus"], {})).toThrow(/bogus/);
    expect(() => resolvePerfProfileName(["--profile=bogus"], {})).toThrow(/default, aie/);
  });

  it("throws naming the known profile names on an unknown PERF_PROFILE env var", () => {
    expect(() => resolvePerfProfileName([], { PERF_PROFILE: "bogus" })).toThrow(/bogus/);
  });
});

describe("assertMinCsvLines", () => {
  it("does not throw when the line count equals the minimum exactly", () => {
    const body = Array.from({ length: 5 }, (_, i) => `line${i}`).join("\n");
    expect(() => assertMinCsvLines("export.csv", body, 5)).not.toThrow();
  });

  it("does not throw when the line count exceeds the minimum", () => {
    const body = Array.from({ length: 10 }, (_, i) => `line${i}`).join("\n");
    expect(() => assertMinCsvLines("export.csv", body, 5)).not.toThrow();
  });

  it("throws with the check name and counts when below the minimum", () => {
    const body = Array.from({ length: 3 }, (_, i) => `line${i}`).join("\n");
    expect(() => assertMinCsvLines("export submissions.csv", body, 5)).toThrow(
      /export submissions\.csv: expected >= 5 CSV lines, got 3/,
    );
  });

  it("throws on a non-positive minLines", () => {
    expect(() => assertMinCsvLines("export.csv", "a\nb\nc", 0)).toThrow();
    expect(() => assertMinCsvLines("export.csv", "a\nb\nc", -1)).toThrow();
  });

  it("counts a trailing-newline body correctly (does not count the trailing empty segment as a line)", () => {
    const body = "line0\nline1\nline2\nline3\nline4\n";
    expect(() => assertMinCsvLines("export.csv", body, 5)).not.toThrow();
    expect(() => assertMinCsvLines("export.csv", body, 6)).toThrow(
      /export\.csv: expected >= 6 CSV lines, got 5/,
    );
  });
});

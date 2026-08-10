import { describe, expect, it } from "vitest";
import {
  PERF_P95_BUDGET_MS,
  assertContainsVevent,
  assertMinCsvLines,
  computeP95,
  joinIcsIds,
  planPerfPages,
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

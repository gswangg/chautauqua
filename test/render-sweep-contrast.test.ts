import { describe, expect, it } from "vitest";

import {
  CONTRAST_BLOCKING,
  CONTRAST_MIN_RATIO,
  CONTRAST_MIN_RATIO_LARGE,
  NAMED_CONTRAST_SELECTOR,
  allContrastPassed,
  contrastErrorResult,
  contrastRatio,
  evaluateContrast,
  formatContrastSummary,
  formatContrastTable,
  relativeLuminance,
  type ContrastRouteEntry,
} from "../scripts/render-sweep-contrast";

const ENTRY: ContrastRouteEntry = { path: "/e/some-event/agenda", role: "public" };

describe("relativeLuminance", () => {
  it("computes 0 for black and 1 for white", () => {
    expect(relativeLuminance([0, 0, 0])).toBeCloseTo(0, 5);
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 5);
  });
});

describe("contrastRatio", () => {
  it("is 21:1 for black on white (and symmetric)", () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 1);
    expect(contrastRatio([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 1);
  });

  it("is 1:1 for white on white", () => {
    expect(contrastRatio([255, 255, 255], [255, 255, 255])).toBeCloseTo(1, 5);
  });

  it("clears WCAG AA (4.5:1) for the palette's muted text on paper", () => {
    // muted #565A4B on paper #F4F1E8 (docs/design/README.md tokens)
    const muted: [number, number, number] = [0x56, 0x5a, 0x4b];
    const paper: [number, number, number] = [0xf4, 0xf1, 0xe8];
    const ratio = contrastRatio(muted, paper);
    expect(ratio).toBeGreaterThanOrEqual(CONTRAST_MIN_RATIO);
  });
});

describe("evaluateContrast", () => {
  it("PASSes a route with no offenders", () => {
    const result = evaluateContrast(ENTRY, { minRatio: 12, offenders: [], exempted: [] });
    expect(result.ok).toBe(true);
    expect(result.minRatio).toBe(12);
    expect(result.failureReason).toBeUndefined();
  });

  it("FAILs a route with offenders and includes offender text in failureReason", () => {
    const offender = "span.chq-badge ratio=2.10 fg=rgb(100,100,100) bg=rgb(120,120,120)";
    const result = evaluateContrast(ENTRY, { minRatio: 2.1, offenders: [offender], exempted: [] });
    expect(result.ok).toBe(false);
    expect(result.failureReason).toContain(offender);
  });

  // DEC-426 wave-29 amendment: a disabled-token (--chq-disabled on
  // --chq-disabled-bg) pair is exempt under WCAG 2.1 SC 1.4.3, recorded via
  // exemptNote rather than silently passed or failed.
  it("records an EXEMPT-BY-RULE note without failing when only exempted pairs are under threshold", () => {
    const exempted = "label.chq-review-checkbox-label ratio=3.09 fg=rgb(125,120,105) bg=rgb(221,216,200)";
    const result = evaluateContrast(ENTRY, { minRatio: 3.09, offenders: [], exempted: [exempted] });
    expect(result.ok).toBe(true);
    expect(result.exemptNote).toContain("EXEMPT-BY-RULE");
    expect(result.exemptNote).toContain("WCAG 2.1 SC 1.4.3");
    expect(result.exemptNote).toContain(exempted);
  });

  it("omits exemptNote when nothing was exempted", () => {
    const result = evaluateContrast(ENTRY, { minRatio: 12, offenders: [], exempted: [] });
    expect(result.exemptNote).toBeUndefined();
  });

  it("PASSes vacuously when minRatio is null (no measurable text)", () => {
    const result = evaluateContrast(ENTRY, { minRatio: null, offenders: [], exempted: [] });
    expect(result.ok).toBe(true);
    expect(result.minRatio).toBeNull();
  });
});

// task-w36-e: closes the task-w35-b instrument gap (docs/verification-log/
// index/0188-2026-08-15-task-w35-b-render-sweep-a0b8501b.md:29-39) — the
// NAMED_CONTRAST_SELECTOR pair is now enumerated explicitly and published
// as its own row, independent of the route's global minRatio.
describe("evaluateContrast namedPair (task-w36-e)", () => {
  it("PASSes and publishes a namedPairNote when the named pair clears threshold", () => {
    const descriptor = `span.chq-participation-menu-caret ratio=6.28 fg=rgb(244,241,232) bg=rgb(139,148,49)`;
    const result = evaluateContrast(ENTRY, {
      minRatio: 6.28,
      offenders: [],
      exempted: [],
      namedPair: { descriptor, ratio: 6.28, ok: true },
    });
    expect(result.ok).toBe(true);
    expect(result.namedPairNote).toContain(NAMED_CONTRAST_SELECTOR);
    expect(result.namedPairNote).toContain(descriptor);
    expect(result.namedPairNote).toContain("PASS");
  });

  it("FAILs the route when the named pair is under threshold", () => {
    const descriptor = `span.chq-participation-menu-caret ratio=1.02 fg=rgb(86,90,75) bg=rgb(78,92,49)`;
    const result = evaluateContrast(ENTRY, {
      minRatio: 1.02,
      offenders: [],
      exempted: [],
      namedPair: { descriptor, ratio: 1.02, ok: false },
    });
    expect(result.ok).toBe(false);
    expect(result.failureReason).toContain(NAMED_CONTRAST_SELECTOR);
    expect(result.failureReason).toContain(descriptor);
    expect(result.namedPairNote).toContain("FAIL");
  });

  it("omits namedPairNote when the selector isn't present on the route", () => {
    const result = evaluateContrast(ENTRY, { minRatio: 10, offenders: [], exempted: [], namedPair: null });
    expect(result.namedPairNote).toBeUndefined();
  });

  it("formatContrastTable includes the NAMED-PAIR note", () => {
    const descriptor = `span.chq-participation-menu-caret ratio=6.28 fg=rgb(244,241,232) bg=rgb(139,148,49)`;
    const results = [
      evaluateContrast(ENTRY, { minRatio: 6.28, offenders: [], exempted: [], namedPair: { descriptor, ratio: 6.28, ok: true } }),
    ];
    expect(formatContrastTable(results)).toContain("NAMED-PAIR");
    expect(formatContrastTable(results)).toContain(NAMED_CONTRAST_SELECTOR);
  });
});

describe("contrastErrorResult", () => {
  it("produces an instrument-blocked FAIL", () => {
    const result = contrastErrorResult(ENTRY, "__name is not defined");
    expect(result.ok).toBe(false);
    expect(result.minRatio).toBeNull();
    expect(result.failureReason).toContain("instrument-blocked");
    expect(result.failureReason).toContain("__name is not defined");
  });
});

describe("allContrastPassed / formatting", () => {
  it("allContrastPassed is true only when every result passed", () => {
    const passing = [evaluateContrast(ENTRY, { minRatio: 10, offenders: [], exempted: [] })];
    const failing = [evaluateContrast(ENTRY, { minRatio: 1, offenders: ["x"], exempted: [] })];
    expect(allContrastPassed(passing)).toBe(true);
    expect(allContrastPassed(failing)).toBe(false);
  });

  it("formatContrastTable/Summary render without throwing", () => {
    const results = [
      evaluateContrast(ENTRY, { minRatio: 10, offenders: [], exempted: [] }),
      contrastErrorResult(ENTRY, "boom"),
    ];
    expect(formatContrastTable(results)).toContain("PASS");
    expect(formatContrastTable(results)).toContain("FAIL");
    expect(formatContrastSummary(results)).toBe("1/2 contrast checks passed");
  });
});

describe("constants", () => {
  it("flip rule: CONTRAST_BLOCKING flips true once a run reads all-PASS (DEC-444/DEC-445)", () => {
    expect(CONTRAST_BLOCKING).toBe(true);
  });

  it("thresholds match WCAG AA", () => {
    expect(CONTRAST_MIN_RATIO).toBe(4.5);
    expect(CONTRAST_MIN_RATIO_LARGE).toBe(3);
  });
});

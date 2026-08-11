import { describe, expect, it } from "vitest";

import {
  allMobilePassed,
  allPassed,
  evaluateMobileRoute,
  evaluateRoute,
  formatMobileResultsTable,
  formatMobileSummary,
  formatResultsTable,
  formatSummary,
  isNonEmptyText,
  type MobileRouteEntry,
} from "../scripts/render-sweep-lib";
import type { RouteManifestEntry } from "../app/src/routeManifest";

const ENTRY: RouteManifestEntry = { path: "/admin/overview", role: "organizer" };

describe("isNonEmptyText", () => {
  it("is false for empty/whitespace-only text", () => {
    expect(isNonEmptyText("")).toBe(false);
    expect(isNonEmptyText("   \n\t")).toBe(false);
  });

  it("is true for real text", () => {
    expect(isNonEmptyText("  Overview  ")).toBe(true);
  });
});

describe("evaluateRoute", () => {
  it("passes when status 200, non-empty text, and no errors", () => {
    const result = evaluateRoute(ENTRY, {
      status: 200,
      bodyText: "Overview",
      consoleErrors: [],
      pageErrors: [],
    });
    expect(result.ok).toBe(true);
    expect(result.failureReason).toBeUndefined();
  });

  it("fails on non-200 status", () => {
    const result = evaluateRoute(ENTRY, { status: 403, bodyText: "Forbidden", consoleErrors: [], pageErrors: [] });
    expect(result.ok).toBe(false);
    expect(result.failureReason).toMatch(/403/);
  });

  it("fails on empty rendered text", () => {
    const result = evaluateRoute(ENTRY, { status: 200, bodyText: "   ", consoleErrors: [], pageErrors: [] });
    expect(result.ok).toBe(false);
    expect(result.failureReason).toMatch(/empty rendered text/);
  });

  it("fails on any console error", () => {
    const result = evaluateRoute(ENTRY, {
      status: 200,
      bodyText: "Overview",
      consoleErrors: ["TypeError: boom"],
      pageErrors: [],
    });
    expect(result.ok).toBe(false);
    expect(result.failureReason).toMatch(/console error/);
  });

  it("fails on any pageerror", () => {
    const result = evaluateRoute(ENTRY, {
      status: 200,
      bodyText: "Overview",
      consoleErrors: [],
      pageErrors: ["ReferenceError: x is not defined"],
    });
    expect(result.ok).toBe(false);
    expect(result.failureReason).toMatch(/pageerror/);
  });

  it("combines multiple failure reasons", () => {
    const result = evaluateRoute(ENTRY, { status: 500, bodyText: "", consoleErrors: [], pageErrors: [] });
    expect(result.ok).toBe(false);
    expect(result.failureReason).toMatch(/500/);
    expect(result.failureReason).toMatch(/empty rendered text/);
  });
});

describe("allPassed / formatSummary / formatResultsTable", () => {
  const passing = evaluateRoute(ENTRY, { status: 200, bodyText: "ok", consoleErrors: [], pageErrors: [] });
  const failing = evaluateRoute(
    { path: "/admin/speakers", role: "organizer" },
    { status: 500, bodyText: "", consoleErrors: [], pageErrors: [] },
  );

  it("allPassed is true only when every result passed", () => {
    expect(allPassed([passing])).toBe(true);
    expect(allPassed([passing, failing])).toBe(false);
  });

  it("formatSummary reports the passed/total count", () => {
    expect(formatSummary([passing, failing])).toBe("1/2 routes passed");
    expect(formatSummary([passing])).toBe("1/1 routes passed");
  });

  it("formatResultsTable includes PASS and FAIL markers with the path and role", () => {
    const table = formatResultsTable([passing, failing]);
    expect(table).toContain("/admin/overview");
    expect(table).toContain("PASS");
    expect(table).toContain("/admin/speakers");
    expect(table).toContain("FAIL");
  });
});

describe("evaluateMobileRoute (DEC-253)", () => {
  const ENTRY: MobileRouteEntry = { path: "/e/devflow-conf-2027/sessions", role: "public" };

  it("passes with no overflow and a >= 40px control", () => {
    const result = evaluateMobileRoute(ENTRY, {
      status: 200,
      scrollWidth: 390,
      viewportWidth: 390,
      minControlHeight: 40,
    });
    expect(result.ok).toBe(true);
    expect(result.overflowPx).toBe(0);
    expect(result.failureReason).toBeUndefined();
  });

  it("tolerates 1px of sub-pixel rounding", () => {
    const result = evaluateMobileRoute(ENTRY, {
      status: 200,
      scrollWidth: 391,
      viewportWidth: 390,
      minControlHeight: 40,
    });
    expect(result.ok).toBe(true);
  });

  it("fails on horizontal overflow beyond the tolerance", () => {
    const result = evaluateMobileRoute(ENTRY, {
      status: 200,
      scrollWidth: 620,
      viewportWidth: 390,
      minControlHeight: 40,
    });
    expect(result.ok).toBe(false);
    expect(result.overflowPx).toBe(230);
    expect(result.failureReason).toMatch(/horizontal overflow 230px/);
  });

  it("fails on a sub-40px primary control", () => {
    const result = evaluateMobileRoute(ENTRY, {
      status: 200,
      scrollWidth: 390,
      viewportWidth: 390,
      minControlHeight: 24,
    });
    expect(result.ok).toBe(false);
    expect(result.failureReason).toMatch(/control height 24px < 40px/);
  });

  it("passes when a route has no measurable controls (minControlHeight null)", () => {
    const result = evaluateMobileRoute(ENTRY, {
      status: 200,
      scrollWidth: 390,
      viewportWidth: 390,
      minControlHeight: null,
    });
    expect(result.ok).toBe(true);
  });

  it("fails on non-200 status", () => {
    const result = evaluateMobileRoute(ENTRY, {
      status: 404,
      scrollWidth: 390,
      viewportWidth: 390,
      minControlHeight: 40,
    });
    expect(result.ok).toBe(false);
    expect(result.failureReason).toMatch(/404/);
  });

  it("combines overflow + control-height failure reasons", () => {
    const result = evaluateMobileRoute(ENTRY, {
      status: 200,
      scrollWidth: 620,
      viewportWidth: 390,
      minControlHeight: 20,
    });
    expect(result.ok).toBe(false);
    expect(result.failureReason).toMatch(/horizontal overflow/);
    expect(result.failureReason).toMatch(/control height/);
  });
});

describe("allMobilePassed / formatMobileSummary / formatMobileResultsTable", () => {
  const passing = evaluateMobileRoute(
    { path: "/submit/devflow-conf-2027", role: "public" },
    { status: 200, scrollWidth: 390, viewportWidth: 390, minControlHeight: 44 },
  );
  const failing = evaluateMobileRoute(
    { path: "/e/devflow-conf-2027/agenda", role: "public" },
    { status: 200, scrollWidth: 900, viewportWidth: 390, minControlHeight: 44 },
  );

  it("allMobilePassed is true only when every result passed", () => {
    expect(allMobilePassed([passing])).toBe(true);
    expect(allMobilePassed([passing, failing])).toBe(false);
  });

  it("formatMobileSummary reports the passed/total count", () => {
    expect(formatMobileSummary([passing, failing])).toBe("1/2 mobile routes passed");
    expect(formatMobileSummary([passing])).toBe("1/1 mobile routes passed");
  });

  it("formatMobileResultsTable includes PASS and FAIL markers with the path", () => {
    const table = formatMobileResultsTable([passing, failing]);
    expect(table).toContain("/submit/devflow-conf-2027");
    expect(table).toContain("PASS");
    expect(table).toContain("/e/devflow-conf-2027/agenda");
    expect(table).toContain("FAIL");
  });
});

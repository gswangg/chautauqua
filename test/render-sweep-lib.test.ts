import { describe, expect, it } from "vitest";

import {
  allPassed,
  evaluateRoute,
  formatResultsTable,
  formatSummary,
  isNonEmptyText,
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

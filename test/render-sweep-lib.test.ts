import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  ADMIN_MOBILE_PASS_BLOCKING,
  EMPTY_MOBILE_OBSERVATION,
  allMobilePassed,
  allPassed,
  evaluateMobileRoute,
  evaluateRoute,
  formatMobileResultsTable,
  formatMobileSummary,
  formatResultsTable,
  formatSummary,
  isNonEmptyText,
  mobileErrorResult,
  routeErrorResult,
  type MobileRouteEntry,
} from "../scripts/render-sweep-lib";
import { ADMIN_MOBILE_ROUTE_MANIFEST } from "../scripts/render-sweep";
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

  it("passes with no overflow and a >= 44px control", () => {
    const result = evaluateMobileRoute(ENTRY, {
      ...EMPTY_MOBILE_OBSERVATION,
      status: 200,
      scrollWidth: 390,
      viewportWidth: 390,
      minControlHeight: 44,
    });
    expect(result.ok).toBe(true);
    expect(result.overflowPx).toBe(0);
    expect(result.failureReason).toBeUndefined();
  });

  it("tolerates 1px of sub-pixel rounding", () => {
    const result = evaluateMobileRoute(ENTRY, {
      ...EMPTY_MOBILE_OBSERVATION,
      status: 200,
      scrollWidth: 391,
      viewportWidth: 390,
      minControlHeight: 44,
    });
    expect(result.ok).toBe(true);
  });

  it("fails on horizontal overflow beyond the tolerance", () => {
    const result = evaluateMobileRoute(ENTRY, {
      ...EMPTY_MOBILE_OBSERVATION,
      status: 200,
      scrollWidth: 620,
      viewportWidth: 390,
      minControlHeight: 44,
    });
    expect(result.ok).toBe(false);
    expect(result.overflowPx).toBe(230);
    expect(result.failureReason).toMatch(/horizontal overflow 230px/);
  });

  it("fails on a sub-44px primary control", () => {
    const result = evaluateMobileRoute(ENTRY, {
      ...EMPTY_MOBILE_OBSERVATION,
      status: 200,
      scrollWidth: 390,
      viewportWidth: 390,
      minControlHeight: 24,
    });
    expect(result.ok).toBe(false);
    expect(result.failureReason).toMatch(/control height 24px < 44px/);
  });

  it("fails on a 42px control now that the DEC-393 floor is 44px", () => {
    const result = evaluateMobileRoute(ENTRY, {
      ...EMPTY_MOBILE_OBSERVATION,
      status: 200,
      scrollWidth: 390,
      viewportWidth: 390,
      minControlHeight: 42,
    });
    expect(result.ok).toBe(false);
    expect(result.failureReason).toMatch(/control height 42px < 44px/);
  });

  it("passes when a route has no measurable controls (minControlHeight null)", () => {
    const result = evaluateMobileRoute(ENTRY, {
      ...EMPTY_MOBILE_OBSERVATION,
      status: 200,
      scrollWidth: 390,
      viewportWidth: 390,
      minControlHeight: null,
    });
    expect(result.ok).toBe(true);
  });

  it("fails on non-200 status", () => {
    const result = evaluateMobileRoute(ENTRY, {
      ...EMPTY_MOBILE_OBSERVATION,
      status: 404,
      scrollWidth: 390,
      viewportWidth: 390,
      minControlHeight: 44,
    });
    expect(result.ok).toBe(false);
    expect(result.failureReason).toMatch(/404/);
  });

  it("combines overflow + control-height failure reasons", () => {
    const result = evaluateMobileRoute(ENTRY, {
      ...EMPTY_MOBILE_OBSERVATION,
      status: 200,
      scrollWidth: 620,
      viewportWidth: 390,
      minControlHeight: 20,
    });
    expect(result.ok).toBe(false);
    expect(result.failureReason).toMatch(/horizontal overflow/);
    expect(result.failureReason).toMatch(/control height/);
  });

  it("reports overflow from a clipped element even when scrollWidth equals viewportWidth", () => {
    const result = evaluateMobileRoute(ENTRY, {
      ...EMPTY_MOBILE_OBSERVATION,
      status: 200,
      scrollWidth: 390,
      viewportWidth: 390,
      maxElementRight: 460,
      overflowOffenders: ["div.chq-foo w=200px right=460px"],
    });
    expect(result.ok).toBe(false);
    expect(result.overflowPx).toBe(70);
    expect(result.failureReason).toMatch(/horizontal overflow 70px/);
  });

  it("includes offenders in the failure reason, widest first", () => {
    const result = evaluateMobileRoute(ENTRY, {
      ...EMPTY_MOBILE_OBSERVATION,
      status: 200,
      scrollWidth: 620,
      viewportWidth: 390,
      maxElementRight: 620,
      overflowOffenders: ["div.chq-a w=230px right=620px", "span.chq-b w=100px right=490px"],
    });
    expect(result.ok).toBe(false);
    expect(result.failureReason).toMatch(
      /widest: div\.chq-a w=230px right=620px \| span\.chq-b w=100px right=490px/,
    );
  });

  it("appends the offending control's selector to the control-height reason", () => {
    const result = evaluateMobileRoute(ENTRY, {
      ...EMPTY_MOBILE_OBSERVATION,
      status: 200,
      scrollWidth: 390,
      viewportWidth: 390,
      minControlHeight: 24,
      minControlSelector: "button.chq-nav-tab",
    });
    expect(result.ok).toBe(false);
    expect(result.failureReason).toMatch(/control height 24px < 44px \(button\.chq-nav-tab\)/);
  });

  it("a passing route (no offenders, no clipped elements) is unchanged", () => {
    const result = evaluateMobileRoute(ENTRY, {
      ...EMPTY_MOBILE_OBSERVATION,
      status: 200,
      scrollWidth: 390,
      viewportWidth: 390,
      maxElementRight: 390,
      minControlHeight: 44,
      minControlSelector: "button.chq-nav-tab",
    });
    expect(result.ok).toBe(true);
    expect(result.overflowPx).toBe(0);
    expect(result.failureReason).toBeUndefined();
  });

  it("the offender string carries no free text — only tag/class/geometry tokens", () => {
    const result = evaluateMobileRoute(ENTRY, {
      ...EMPTY_MOBILE_OBSERVATION,
      status: 200,
      scrollWidth: 620,
      viewportWidth: 390,
      maxElementRight: 620,
      overflowOffenders: ["div.chq-agenda-row w=230px right=620px"],
    });
    expect(result.failureReason).toBeDefined();
    const widestPart = (result.failureReason as string).split("widest: ")[1];
    // Only [a-z0-9.-] tokens, whitespace, '=', 'px', and '|' separators —
    // nothing resembling rendered text (e.g. no quotes, no capitalized words).
    expect(widestPart).toMatch(/^[a-z0-9.\-=\s|px]+$/);
  });
});

describe("allMobilePassed / formatMobileSummary / formatMobileResultsTable", () => {
  const passing = evaluateMobileRoute(
    { path: "/submit/devflow-conf-2027", role: "public" },
    { ...EMPTY_MOBILE_OBSERVATION, status: 200, scrollWidth: 390, viewportWidth: 390, minControlHeight: 44 },
  );
  const failing = evaluateMobileRoute(
    { path: "/e/devflow-conf-2027/agenda", role: "public" },
    { ...EMPTY_MOBILE_OBSERVATION, status: 200, scrollWidth: 900, viewportWidth: 390, minControlHeight: 44 },
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

describe("routeErrorResult (DEC-389)", () => {
  it("produces a FAIL row carrying the error message", () => {
    const result = routeErrorResult(ENTRY, "navigation error: net::ERR_CONNECTION_REFUSED");
    expect(result.ok).toBe(false);
    expect(result.entry).toBe(ENTRY);
    expect(result.status).toBe(0);
    expect(result.bodyNonEmpty).toBe(false);
    expect(result.failureReason).toBe("navigation error: net::ERR_CONNECTION_REFUSED");
  });

  it("appears as FAIL in formatResultsTable and drops allPassed to false", () => {
    const result = routeErrorResult(ENTRY, "dev server died mid-run");
    const table = formatResultsTable([result]);
    expect(table).toContain("FAIL");
    expect(table).toContain("dev server died mid-run");
    expect(allPassed([result])).toBe(false);
  });
});

describe("mobileErrorResult (DEC-389)", () => {
  const MOBILE_ENTRY: MobileRouteEntry = { path: "/portal", role: "speaker" };

  it("produces a FAIL row carrying the error message", () => {
    const result = mobileErrorResult(MOBILE_ENTRY, "login failed for role 'speaker': still on /login after submit");
    expect(result.ok).toBe(false);
    expect(result.entry).toBe(MOBILE_ENTRY);
    expect(result.status).toBe(0);
    expect(result.minControlHeight).toBeNull();
    expect(result.failureReason).toBe("login failed for role 'speaker': still on /login after submit");
  });

  it("appears as FAIL in formatMobileResultsTable and drops allMobilePassed to false", () => {
    const result = mobileErrorResult(MOBILE_ENTRY, "navigation error: net::ERR_CONNECTION_REFUSED");
    const table = formatMobileResultsTable([result]);
    expect(table).toContain("FAIL");
    expect(table).toContain("navigation error: net::ERR_CONNECTION_REFUSED");
    expect(allMobilePassed([result])).toBe(false);
  });
});

describe("ADMIN_MOBILE_ROUTE_MANIFEST (DEC-387)", () => {
  it("is non-empty", () => {
    expect(ADMIN_MOBILE_ROUTE_MANIFEST.length).toBeGreaterThan(0);
  });

  it("only contains organizer or reviewer entries", () => {
    for (const entry of ADMIN_MOBILE_ROUTE_MANIFEST) {
      expect(["organizer", "reviewer"]).toContain(entry.role);
    }
  });

  it("excludes the /admin/* catch-all", () => {
    expect(ADMIN_MOBILE_ROUTE_MANIFEST.some((entry) => entry.path === "/admin/*")).toBe(false);
  });

  it("has no duplicate path+role pairs", () => {
    const seen = new Set<string>();
    for (const entry of ADMIN_MOBILE_ROUTE_MANIFEST) {
      const key = `${entry.path}::${entry.role}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

describe("ADMIN_MOBILE_PASS_BLOCKING (DEC-387)", () => {
  it("is false on landing, with the flip rule documented on the constant", () => {
    expect(ADMIN_MOBILE_PASS_BLOCKING).toBe(false);
    const source = readFileSync(new URL("../scripts/render-sweep-lib.ts", import.meta.url), "utf-8");
    // DEC-387 verbatim: "it becomes true in the wave after the pass first
    // reads all-PASS."
    expect(source).toContain("it becomes true in the wave after the pass first reads all-PASS");
  });
});

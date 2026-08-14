import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  ADMIN_MOBILE_PASS_BLOCKING,
  EMPTY_MOBILE_OBSERVATION,
  FONT_FLOOR_BLOCKING,
  MIN_FONT_PX,
  PAGE_EVALUATE_KEEPNAMES_SHIM,
  allFontFloorPassed,
  allMobilePassed,
  allPassed,
  evaluateFontFloor,
  evaluateMobileRoute,
  evaluateRoute,
  filterKnownClipExceptions,
  fontFloorErrorResult,
  formatFontFloorSummary,
  formatFontFloorTable,
  formatMobileResultsTable,
  formatMobileSummary,
  formatResultsTable,
  formatSummary,
  isNonEmptyText,
  mobileErrorResult,
  routeErrorResult,
  type FontFloorRouteEntry,
  type MobileRouteEntry,
} from "../scripts/render-sweep-lib";
import { ADMIN_MOBILE_ROUTE_MANIFEST, KNOWN_CLIP_EXCEPTIONS, MOBILE_ROUTE_MANIFEST } from "../scripts/render-sweep";
import { ROUTE_MANIFEST } from "../app/src/routeManifest";
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

  // DEC-424: content-spill attribution — a route whose scrollWidth exceeds
  // the viewport but whose collected element rects never individually
  // crossed the viewport edge (e.g. scroller-held elements excluded, or a
  // wide inline spill) still gets an offender string rather than an empty
  // list.
  it("(DEC-424) passes when scrollWidth == viewportWidth and maxElementRight == viewportWidth", () => {
    const result = evaluateMobileRoute(ENTRY, {
      ...EMPTY_MOBILE_OBSERVATION,
      status: 200,
      scrollWidth: 390,
      viewportWidth: 390,
      maxElementRight: 390,
      overflowOffenders: [],
      minControlHeight: 44,
    });
    expect(result.ok).toBe(true);
    expect(result.overflowPx).toBe(0);
    expect(result.failureReason).toBeUndefined();
  });

  it("(DEC-424) fails with a content-spill offender when scrollWidth 415 > viewportWidth 390", () => {
    const result = evaluateMobileRoute(ENTRY, {
      ...EMPTY_MOBILE_OBSERVATION,
      status: 200,
      scrollWidth: 415,
      viewportWidth: 390,
      maxElementRight: 390,
      overflowOffenders: ["span.chq-foo spill=25px (scrollWidth 415 > clientWidth 390)"],
      minControlHeight: 44,
    });
    expect(result.ok).toBe(false);
    expect(result.overflowPx).toBe(25);
    expect(result.failureReason).toMatch(/horizontal overflow 25px \(scrollWidth 415 > viewport 390\)/);
    expect(result.failureReason).toContain(
      "span.chq-foo spill=25px (scrollWidth 415 > clientWidth 390)",
    );
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

describe("ADMIN_MOBILE_PASS_BLOCKING (DEC-387/DEC-431)", () => {
  it("is true after DEC-431's flip (w13-a's own run read 20/20 all-PASS), flip rule stays documented", () => {
    expect(ADMIN_MOBILE_PASS_BLOCKING).toBe(true);
    const source = readFileSync(new URL("../scripts/render-sweep-lib.ts", import.meta.url), "utf-8");
    // DEC-387 verbatim: "it becomes true in the wave after the pass first
    // reads all-PASS."
    expect(source).toContain("it becomes true in the wave after the pass first reads all-PASS");
  });
});

describe("PAGE_EVALUATE_KEEPNAMES_SHIM (DEC-411)", () => {
  it("is a raw string, not a function reference (esbuild keepNames cannot rewrite it)", () => {
    expect(typeof PAGE_EVALUATE_KEEPNAMES_SHIM).toBe("string");
  });

  it("when eval'd, defines a global __name that returns its argument unchanged", () => {
    const g = { __name: undefined as unknown } as Record<string, unknown>;
    const fn = new Function("globalThis", `${PAGE_EVALUATE_KEEPNAMES_SHIM}\nreturn globalThis.__name;`);
    const __name = fn(g) as (fn: unknown, name?: string) => unknown;
    expect(typeof __name).toBe("function");
    const sentinel = () => "sentinel";
    expect(__name(sentinel, "sentinel")).toBe(sentinel);
  });

  it("does not clobber a pre-existing __name (idempotent across repeated addInitScript calls)", () => {
    const existing = () => "already-here";
    const g = { __name: existing } as unknown as Record<string, unknown>;
    const fn = new Function("globalThis", `${PAGE_EVALUATE_KEEPNAMES_SHIM}\nreturn globalThis.__name;`);
    expect(fn(g)).toBe(existing);
  });

  it("scripts/render-sweep.ts installs the shim via addInitScript in both visitRoute and visitMobileRoute, before every page.evaluate call site", () => {
    const rawSource = readFileSync(new URL("../scripts/render-sweep.ts", import.meta.url), "utf-8");
    // Strip `//` line comments before searching for call-site ordering, so
    // prose in comments (which may itself mention "page.evaluate(") can't
    // shadow the real call sites this test is checking.
    const source = rawSource
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, ""))
      .join("\n");

    // Split the file into its two page-visiting functions so each is
    // checked independently.
    const visitRouteStart = source.indexOf("async function visitRoute(");
    const visitMobileRouteStart = source.indexOf("async function visitMobileRoute(");
    const mainStart = source.indexOf("async function main(");
    expect(visitRouteStart).toBeGreaterThan(-1);
    expect(visitMobileRouteStart).toBeGreaterThan(-1);
    expect(mainStart).toBeGreaterThan(-1);

    const visitRouteBody = source.slice(visitRouteStart, visitMobileRouteStart);
    const visitMobileRouteBody = source.slice(visitMobileRouteStart, mainStart);

    for (const [name, body] of [
      ["visitRoute", visitRouteBody],
      ["visitMobileRoute", visitMobileRouteBody],
    ] as const) {
      expect(body, `${name} must call context.newPage()`).toContain("context.newPage()");
      expect(body, `${name} must install the keepNames shim via addInitScript`).toMatch(
        /addInitScript\(\{\s*content:\s*PAGE_EVALUATE_KEEPNAMES_SHIM\s*\}\)/,
      );
      const newPageIdx = body.indexOf("context.newPage()");
      const shimIdx = body.indexOf("addInitScript({ content: PAGE_EVALUATE_KEEPNAMES_SHIM })");
      const evaluateIdx = body.indexOf("page.evaluate(");
      expect(shimIdx, `${name}: shim call must come after newPage()`).toBeGreaterThan(newPageIdx);
      if (evaluateIdx !== -1) {
        expect(shimIdx, `${name}: shim must be installed before any page.evaluate() call`).toBeLessThan(evaluateIdx);
      }
    }

    // No page.evaluate call site anywhere in the file is reachable without
    // going through one of the two functions checked above, or through the
    // measureFontFloor() / measureContrast() / measureClipOffenders() /
    // measureTypeRoles() helpers those functions call after installing the
    // shim (DEC-421/DEC-426/DEC-620/DEC-643) — the module has no
    // page.evaluate call sites outside visitRoute, visitMobileRoute,
    // measureFontFloor, measureContrast, measureClipOffenders, and
    // measureTypeRoles.
    const evaluateCallCount = (source.match(/page\.evaluate\(/g) ?? []).length;
    const evaluateCallsInVisitRouteBody = (visitRouteBody.match(/page\.evaluate\(/g) ?? []).length;
    const evaluateCallsInMobileBody = (visitMobileRouteBody.match(/page\.evaluate\(/g) ?? []).length;
    const measureFontFloorStart = source.indexOf("async function measureFontFloor(");
    expect(measureFontFloorStart).toBeGreaterThan(-1);
    const measureFontFloorEnd = source.indexOf("\n}\n", measureFontFloorStart) + 3;
    const measureFontFloorBody = source.slice(measureFontFloorStart, measureFontFloorEnd);
    const evaluateCallsInMeasureFontFloor = (measureFontFloorBody.match(/page\.evaluate\(/g) ?? []).length;
    const measureContrastStart = source.indexOf("async function measureContrast(");
    expect(measureContrastStart).toBeGreaterThan(-1);
    const measureContrastEnd = source.indexOf("\n}\n", measureContrastStart) + 3;
    const measureContrastBody = source.slice(measureContrastStart, measureContrastEnd);
    const evaluateCallsInMeasureContrast = (measureContrastBody.match(/page\.evaluate\(/g) ?? []).length;
    const measureClipOffendersStart = source.indexOf("async function measureClipOffenders(");
    expect(measureClipOffendersStart).toBeGreaterThan(-1);
    const measureClipOffendersEnd = source.indexOf("\n}\n", measureClipOffendersStart) + 3;
    const measureClipOffendersBody = source.slice(measureClipOffendersStart, measureClipOffendersEnd);
    const evaluateCallsInMeasureClipOffenders = (measureClipOffendersBody.match(/page\.evaluate\(/g) ?? []).length;
    const measureTypeRolesStart = source.indexOf("async function measureTypeRoles(");
    expect(measureTypeRolesStart).toBeGreaterThan(-1);
    const measureTypeRolesEnd = source.indexOf("\n}\n", measureTypeRolesStart) + 3;
    const measureTypeRolesBody = source.slice(measureTypeRolesStart, measureTypeRolesEnd);
    const evaluateCallsInMeasureTypeRoles = (measureTypeRolesBody.match(/page\.evaluate\(/g) ?? []).length;
    expect(evaluateCallCount).toBe(
      evaluateCallsInVisitRouteBody +
        evaluateCallsInMobileBody +
        evaluateCallsInMeasureFontFloor +
        evaluateCallsInMeasureContrast +
        evaluateCallsInMeasureClipOffenders +
        evaluateCallsInMeasureTypeRoles,
    );
  });
});

describe("MOBILE_ROUTE_MANIFEST (DEC-411 superset)", () => {
  it("is a subset of ROUTE_MANIFEST's path+role pairs (DEC-403 superset invariant)", () => {
    const routeManifestKeys = new Set(ROUTE_MANIFEST.map((e) => `${e.path}::${e.role}`));
    for (const entry of MOBILE_ROUTE_MANIFEST) {
      if (entry.role === "public") {
        // DEC-403: no-login public/embed surfaces aren't necessarily in
        // ROUTE_MANIFEST's own <Route> tree (they're the mobile-only
        // superset ROUTE_MANIFEST added *because of* this pass) — only the
        // role-gated portal/account entries need to already exist there.
        continue;
      }
      expect(routeManifestKeys.has(`${entry.path}::${entry.role}`), `${entry.path} (${entry.role}) missing from ROUTE_MANIFEST`).toBe(
        true,
      );
    }
  });

  it("covers the whole speaker portal, not just /portal", () => {
    const paths = MOBILE_ROUTE_MANIFEST.filter((e) => e.role === "speaker").map((e) => e.path);
    expect(paths).toContain("/portal");
    expect(paths).toContain("/portal/tasks");
    expect(paths).toContain("/portal/profile");
    expect(paths).toContain("/portal/submissions/seed_submission_0001");
    expect(paths).toContain("/portal/submissions/seed_submission_0001/edit");
    expect(paths).toContain("/portal/tasks/seed_task_assignment_0001/form");
  });

  it("includes /account/password for the speaker role", () => {
    expect(
      MOBILE_ROUTE_MANIFEST.some((e) => e.path === "/account/password" && e.role === "speaker"),
    ).toBe(true);
  });
});

describe("evaluateFontFloor (DEC-421)", () => {
  const ENTRY: FontFloorRouteEntry = { path: "/admin/overview", role: "organizer" };

  it("fails when the smallest measured font is below the 10px floor", () => {
    const result = evaluateFontFloor(ENTRY, "desktop", { minFontPx: 9, offenders: ["span.chq-label 9px"] });
    expect(result.ok).toBe(false);
    expect(result.minFontPx).toBe(9);
    expect(result.path).toBe(ENTRY.path);
    expect(result.role).toBe(ENTRY.role);
    expect(result.viewport).toBe("desktop");
    expect(result.failureReason).toMatch(/min font-size 9px < 10px/);
    expect(result.failureReason).toMatch(/smallest: span\.chq-label 9px/);
  });

  it("passes when the smallest measured font is exactly at the floor", () => {
    const result = evaluateFontFloor(ENTRY, "mobile", { minFontPx: MIN_FONT_PX, offenders: [] });
    expect(result.ok).toBe(true);
    expect(result.minFontPx).toBe(10);
    expect(result.viewport).toBe("mobile");
    expect(result.failureReason).toBeUndefined();
  });

  it("passes when the smallest measured font is above the floor", () => {
    const result = evaluateFontFloor(ENTRY, "desktop", { minFontPx: 14, offenders: [] });
    expect(result.ok).toBe(true);
    expect(result.failureReason).toBeUndefined();
  });

  it("passes vacuously when the page has no measurable text (minFontPx null)", () => {
    const result = evaluateFontFloor(ENTRY, "desktop", { minFontPx: null, offenders: [] });
    expect(result.ok).toBe(true);
    expect(result.minFontPx).toBeNull();
    expect(result.failureReason).toBeUndefined();
  });

  it("includes up to 3 offenders, smallest first, in the failure reason", () => {
    const result = evaluateFontFloor(ENTRY, "desktop", {
      minFontPx: 8,
      offenders: ["span.chq-a 8px", "div.chq-b 9px"],
    });
    expect(result.failureReason).toMatch(/smallest: span\.chq-a 8px \| div\.chq-b 9px/);
  });
});

describe("fontFloorErrorResult (DEC-421)", () => {
  const ENTRY: FontFloorRouteEntry = { path: "/portal", role: "speaker" };

  it("produces a FAIL row prefixed instrument-blocked, carrying the error message", () => {
    const result = fontFloorErrorResult(ENTRY, "mobile", "__name is not defined");
    expect(result.ok).toBe(false);
    expect(result.minFontPx).toBeNull();
    expect(result.path).toBe(ENTRY.path);
    expect(result.viewport).toBe("mobile");
    expect(result.failureReason).toBe("instrument-blocked: __name is not defined");
  });
});

describe("allFontFloorPassed / formatFontFloorSummary / formatFontFloorTable (DEC-421)", () => {
  const passing = evaluateFontFloor({ path: "/admin/overview", role: "organizer" }, "desktop", {
    minFontPx: 14,
    offenders: [],
  });
  const failing = evaluateFontFloor({ path: "/e/devflow-conf-2027/sessions", role: "public" }, "mobile", {
    minFontPx: 8,
    offenders: ["span.chq-label 8px"],
  });

  it("allFontFloorPassed is true only when every result passed", () => {
    expect(allFontFloorPassed([passing])).toBe(true);
    expect(allFontFloorPassed([passing, failing])).toBe(false);
  });

  it("formatFontFloorSummary reports the passed/total count", () => {
    expect(formatFontFloorSummary([passing, failing])).toBe("1/2 font-floor checks passed");
    expect(formatFontFloorSummary([passing])).toBe("1/1 font-floor checks passed");
  });

  it("formatFontFloorTable includes PASS and FAIL markers with the path, role, and viewport", () => {
    const table = formatFontFloorTable([passing, failing]);
    expect(table).toContain("/admin/overview");
    expect(table).toContain("organizer");
    expect(table).toContain("desktop");
    expect(table).toContain("PASS");
    expect(table).toContain("/e/devflow-conf-2027/sessions");
    expect(table).toContain("mobile");
    expect(table).toContain("FAIL");
  });
});

describe("FONT_FLOOR_BLOCKING (DEC-421/DEC-431)", () => {
  it("is true after DEC-431's flip (w13-a's own run read 83/83 all-PASS), reusing the DEC-387 flip rule", () => {
    expect(FONT_FLOOR_BLOCKING).toBe(true);
    const source = readFileSync(new URL("../scripts/render-sweep-lib.ts", import.meta.url), "utf-8");
    expect(source).toContain("it becomes true in the wave after the pass first reads all-PASS");
  });

  it("is gated through the same allFontFloorPassed && FONT_FLOOR_BLOCKING expression now that it's true", () => {
    const source = readFileSync(new URL("../scripts/render-sweep.ts", import.meta.url), "utf-8");
    expect(source).toMatch(/allFontFloorPassed\(fontFloorResults\)\s*&&\s*FONT_FLOOR_BLOCKING/);
  });
});

// ---------------------------------------------------------------------------
// DEC-620 vertical-clip pass: agenda cards bleeding past their own boxes
// unseen is scrollHeight > clientHeight with overflow-y visible|hidden; a
// deliberate scroll container (overflow-y auto|scroll) is not a bug.
// ---------------------------------------------------------------------------

describe("evaluateRoute clipOffenders (DEC-620)", () => {
  it("a scroll container is not an offender — passes with an empty clipOffenders list", () => {
    const result = evaluateRoute(ENTRY, {
      status: 200,
      bodyText: "Overview",
      consoleErrors: [],
      pageErrors: [],
      clipOffenders: [],
    });
    expect(result.ok).toBe(true);
    expect(result.clipOffenders).toEqual([]);
    expect(result.failureReason).toBeUndefined();
  });

  it("a clipped fixed-height box is an offender — fails with a reason in the overflow-reporting shape", () => {
    const result = evaluateRoute(ENTRY, {
      status: 200,
      bodyText: "Overview",
      consoleErrors: [],
      pageErrors: [],
      clipOffenders: ["div.chq-agenda-card clip=41px (scrollHeight 120 > clientHeight 79)"],
    });
    expect(result.ok).toBe(false);
    expect(result.failureReason).toMatch(/1 vertical clip offender\(s\)/);
    expect(result.failureReason).toContain(
      "div.chq-agenda-card clip=41px (scrollHeight 120 > clientHeight 79)",
    );
  });

  it("defaults clipOffenders to an empty list when the caller omits it", () => {
    const result = evaluateRoute(ENTRY, { status: 200, bodyText: "Overview", consoleErrors: [], pageErrors: [] });
    expect(result.ok).toBe(true);
    expect(result.clipOffenders).toEqual([]);
  });
});

describe("evaluateMobileRoute clipOffenders (DEC-620)", () => {
  const MOBILE_ENTRY: MobileRouteEntry = { path: "/e/devflow-conf-2027/agenda", role: "public" };

  it("a scroll container is not an offender — passes", () => {
    const result = evaluateMobileRoute(MOBILE_ENTRY, {
      ...EMPTY_MOBILE_OBSERVATION,
      status: 200,
      scrollWidth: 390,
      viewportWidth: 390,
      minControlHeight: 44,
      clipOffenders: [],
    });
    expect(result.ok).toBe(true);
    expect(result.failureReason).toBeUndefined();
  });

  it("a clipped fixed-height box is an offender — fails", () => {
    const result = evaluateMobileRoute(MOBILE_ENTRY, {
      ...EMPTY_MOBILE_OBSERVATION,
      status: 200,
      scrollWidth: 390,
      viewportWidth: 390,
      minControlHeight: 44,
      clipOffenders: ["div.chq-agenda-card clip=41px (scrollHeight 120 > clientHeight 79)"],
    });
    expect(result.ok).toBe(false);
    expect(result.failureReason).toMatch(/1 vertical clip offender\(s\)/);
    expect(result.failureReason).toContain(
      "div.chq-agenda-card clip=41px (scrollHeight 120 > clientHeight 79)",
    );
  });
});

describe("filterKnownClipExceptions (DEC-620)", () => {
  it("passes an offender through unchanged when no exception matches", () => {
    const offenders = ["div.chq-agenda-card clip=41px (scrollHeight 120 > clientHeight 79)"];
    expect(filterKnownClipExceptions("/e/devflow-conf-2027/agenda", offenders, {})).toEqual(offenders);
  });

  it("drops an offender whose route+selector key is present in the exceptions map", () => {
    const offenders = ["div.chq-agenda-card clip=41px (scrollHeight 120 > clientHeight 79)"];
    const exceptions = {
      "/e/devflow-conf-2027/agenda::div.chq-agenda-card": "owned by task-w5-x, agenda route in flight",
    };
    expect(filterKnownClipExceptions("/e/devflow-conf-2027/agenda", offenders, exceptions)).toEqual([]);
  });

  it("only drops the matching selector, leaving other offenders on the same route", () => {
    const offenders = [
      "div.chq-agenda-card clip=41px (scrollHeight 120 > clientHeight 79)",
      "div.chq-other clip=10px (scrollHeight 50 > clientHeight 40)",
    ];
    const exceptions = {
      "/e/devflow-conf-2027/agenda::div.chq-agenda-card": "owned by task-w5-x, agenda route in flight",
    };
    expect(filterKnownClipExceptions("/e/devflow-conf-2027/agenda", offenders, exceptions)).toEqual([
      "div.chq-other clip=10px (scrollHeight 50 > clientHeight 40)",
    ]);
  });

  it("an entry present in KNOWN_CLIP_EXCEPTIONS does not fail its route end-to-end", () => {
    // Exercises the real exported KNOWN_CLIP_EXCEPTIONS map from
    // scripts/render-sweep.ts together with evaluateRoute — a fabricated
    // offender for a route+selector we add to a local copy of the map (since
    // the real map may be empty) must not fail the route once filtered.
    const path = "/e/devflow-conf-2027/agenda";
    const selector = "div.chq-known-offender";
    const localExceptions = { ...KNOWN_CLIP_EXCEPTIONS, [`${path}::${selector}`]: "test fixture exception" };
    const raw = [`${selector} clip=41px (scrollHeight 120 > clientHeight 79)`];
    const filtered = filterKnownClipExceptions(path, raw, localExceptions);
    const result = evaluateRoute(
      { path, role: "public" },
      { status: 200, bodyText: "Agenda", consoleErrors: [], pageErrors: [], clipOffenders: filtered },
    );
    expect(filtered).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

describe("KNOWN_CLIP_EXCEPTIONS (DEC-991)", () => {
  it("has exactly one entry -- the deliberate agenda-card line-clamp", () => {
    expect(Object.keys(KNOWN_CLIP_EXCEPTIONS)).toEqual(["/admin/agenda::div.chq-session-card-title"]);
  });

  it("every reason string names a fact about the element, never a scheduling excuse", () => {
    for (const reason of Object.values(KNOWN_CLIP_EXCEPTIONS)) {
      expect(reason).toMatch(/intentional|deliberate|line-clamp/i);
      expect(reason).not.toMatch(/in-flight|owned by|needs a visual pass|follow-up/i);
    }
  });
});

describe("DEC-991 heading line-heights (>= 1.15)", () => {
  /** Extracts the numeric line-height declared on a given selector's rule
   * body within a CSS-text blob (the module's exported template-string
   * constant, or a whole .css file). Fails loudly if the selector or its
   * line-height declaration is missing rather than silently skipping. */
  function lineHeightFor(cssText: string, selector: string): number {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const ruleMatch = cssText.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
    if (!ruleMatch) throw new Error(`selector ${selector} not found in CSS text`);
    const ruleBody = ruleMatch[1];
    if (ruleBody === undefined) throw new Error(`selector ${selector} matched with no capture group`);
    const lineHeightMatch = ruleBody.match(/line-height:\s*(var\(\s*(--[\w-]+)\s*\)|[\d.]+)/);
    if (!lineHeightMatch) throw new Error(`selector ${selector} has no line-height declaration`);
    const value = lineHeightMatch[1];
    if (value === undefined) throw new Error(`selector ${selector} matched with no line-height capture`);
    // DEC-643 tokenises the Overview type roles, so a role's line-height may be
    // declared as var(--chq-type-*) rather than a literal. Resolve one level of
    // indirection against the token source rather than forcing the literal back
    // into the component (which is the per-component drift DEC-643 forbids).
    const tokenName = lineHeightMatch[2];
    if (tokenName !== undefined) return tokenLineHeight(tokenName);
    return Number(value);
  }

  /** Resolves a --chq-type-* line-height token to its declared numeric value in
   * the app token source. Fails loudly if the token is undeclared. */
  function tokenLineHeight(tokenName: string): number {
    const tokenSource = readFileSync(new URL("../app/src/styles.css", import.meta.url), "utf-8");
    const declMatch = tokenSource.match(new RegExp(`${tokenName}:\\s*([\\d.]+)\\s*;`));
    if (!declMatch) throw new Error(`token ${tokenName} not declared in app/src/styles.css`);
    const declared = declMatch[1];
    if (declared === undefined) throw new Error(`token ${tokenName} matched with no capture`);
    return Number(declared);
  }

  const cases: Array<{ file: string; selector: string }> = [
    { file: "../src/routes/portal/portal.css.ts", selector: ".chq-portal-hero" },
    // .chq-pub-header-title lives in public.css.ts's chrome fragment (wave-68
    // contention decomposition, src/routes/public/css/chrome.css.ts) rather
    // than inline in public.css.ts itself.
    { file: "../src/routes/public/css/chrome.css.ts", selector: ".chq-pub-header-title" },
    { file: "../src/routes/public/cfp.css.ts", selector: ".chq-cfp-title" },
    { file: "../src/routes/auth.css.ts", selector: ".chq-auth-title" },
    { file: "../src/routes/public/home.css.ts", selector: ".chq-home-hero h1" },
    { file: "../app/src/pages/overview/overview.css", selector: ".chq-overview-headline" },
  ];

  for (const { file, selector } of cases) {
    it(`${selector} in ${file} declares line-height >= 1.15`, () => {
      const source = readFileSync(new URL(file, import.meta.url), "utf-8");
      expect(lineHeightFor(source, selector)).toBeGreaterThanOrEqual(1.15);
    });
  }

  it("the SSR theme declares the same overview-headline line-height as the app token source", () => {
    const themeSrc = readFileSync(new URL("../src/views/theme.ts", import.meta.url), "utf-8");
    const themeMatch = themeSrc.match(/--chq-type-overview-headline-line-height:\s*([\d.]+)\s*;/);
    expect(themeMatch).not.toBeNull();
    expect(Number(themeMatch?.[1])).toBe(tokenLineHeight("--chq-type-overview-headline-line-height"));
  });
});

describe("dead gallery-tile/name rules removed (DEC-991)", () => {
  it("public.css.ts no longer defines .chq-pub-gallery-tile / .chq-pub-gallery-name", () => {
    const source = readFileSync(new URL("../src/routes/public/public.css.ts", import.meta.url), "utf-8");
    expect(source).not.toMatch(/\.chq-pub-gallery-tile/);
    expect(source).not.toMatch(/\.chq-pub-gallery-name/);
  });

  it("no markup in src/ references .chq-pub-gallery-tile / .chq-pub-gallery-name", () => {
    const shell = readFileSync(new URL("../src/routes/public/shell.tsx", import.meta.url), "utf-8");
    const speakers = readFileSync(new URL("../src/routes/public/speakers.tsx", import.meta.url), "utf-8");
    for (const markup of [shell, speakers]) {
      expect(markup).not.toMatch(/chq-pub-gallery-tile/);
      expect(markup).not.toMatch(/chq-pub-gallery-name/);
    }
  });
});

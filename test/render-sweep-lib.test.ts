import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  ADMIN_MOBILE_PASS_BLOCKING,
  EMPTY_MOBILE_OBSERVATION,
  PAGE_EVALUATE_KEEPNAMES_SHIM,
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
import { ADMIN_MOBILE_ROUTE_MANIFEST, MOBILE_ROUTE_MANIFEST } from "../scripts/render-sweep";
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
    // going through one of the two functions checked above (the module has
    // exactly two page.evaluate call sites total, both inside
    // visitMobileRoute; visitRoute has none but is still guarded above).
    const evaluateCallCount = (source.match(/page\.evaluate\(/g) ?? []).length;
    const evaluateCallsInMobileBody = (visitMobileRouteBody.match(/page\.evaluate\(/g) ?? []).length;
    expect(evaluateCallCount).toBe(evaluateCallsInMobileBody);
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

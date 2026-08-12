// Pure helpers for scripts/render-sweep.ts (DEC-144/DEC-139 render-sweep
// gate), extracted for plain-vitest testing without node:/playwright
// imports — same pattern as scripts/walkthrough-lib.ts /
// scripts/perf-smoke-lib.ts.

import type { RouteManifestEntry } from "../app/src/routeManifest";

export interface RouteResult {
  entry: RouteManifestEntry;
  status: number;
  bodyNonEmpty: boolean;
  consoleErrors: string[];
  pageErrors: string[];
  ok: boolean;
  failureReason?: string;
}

/** True if a route's body text (trimmed) is non-empty. */
export function isNonEmptyText(text: string): boolean {
  return text.trim().length > 0;
}

/**
 * Evaluates a single route's collected observations against the render-sweep
 * pass criteria: HTTP 200, non-empty rendered text, and zero collected
 * console 'error' + pageerror events (no allowlist).
 */
export function evaluateRoute(
  entry: RouteManifestEntry,
  observed: { status: number; bodyText: string; consoleErrors: string[]; pageErrors: string[] },
): RouteResult {
  const bodyNonEmpty = isNonEmptyText(observed.bodyText);
  const reasons: string[] = [];
  if (observed.status !== 200) reasons.push(`status ${observed.status} !== 200`);
  if (!bodyNonEmpty) reasons.push("empty rendered text");
  if (observed.consoleErrors.length > 0) {
    reasons.push(`${observed.consoleErrors.length} console error(s): ${observed.consoleErrors.join(" | ")}`);
  }
  if (observed.pageErrors.length > 0) {
    reasons.push(`${observed.pageErrors.length} pageerror(s): ${observed.pageErrors.join(" | ")}`);
  }
  return {
    entry,
    status: observed.status,
    bodyNonEmpty,
    consoleErrors: observed.consoleErrors,
    pageErrors: observed.pageErrors,
    ok: reasons.length === 0,
    failureReason: reasons.length > 0 ? reasons.join("; ") : undefined,
  };
}

/** DEC-389: builds a FAIL RouteResult for an entry whose navigation threw
 * (e.g. page.goto rejected because the dev server died mid-run) rather than
 * letting the error propagate out of the sweep and abort the whole gate. */
export function routeErrorResult(entry: RouteManifestEntry, message: string): RouteResult {
  return {
    entry,
    status: 0,
    bodyNonEmpty: false,
    consoleErrors: [],
    pageErrors: [],
    ok: false,
    failureReason: message,
  };
}

/** Renders a PASS/FAIL table for the collected route results, one line per route. */
export function formatResultsTable(results: readonly RouteResult[]): string {
  const pathWidth = Math.max(...results.map((r) => r.entry.path.length), "path".length);
  const roleWidth = Math.max(...results.map((r) => r.entry.role.length), "role".length);
  const lines: string[] = [];
  lines.push(`${"path".padEnd(pathWidth)}  ${"role".padEnd(roleWidth)}  status`);
  for (const r of results) {
    const mark = r.ok ? "PASS" : "FAIL";
    const detail = r.ok ? "" : `  (${r.failureReason})`;
    lines.push(`${r.entry.path.padEnd(pathWidth)}  ${r.entry.role.padEnd(roleWidth)}  ${mark}${detail}`);
  }
  return lines.join("\n");
}

/** True if every result passed; used to decide the process exit code. */
export function allPassed(results: readonly RouteResult[]): boolean {
  return results.every((r) => r.ok);
}

/** Summary line: "N/M routes passed". */
export function formatSummary(results: readonly RouteResult[]): string {
  const passed = results.filter((r) => r.ok).length;
  return `${passed}/${results.length} routes passed`;
}

// ---------------------------------------------------------------------------
// DEC-253 mobile pass (390x844): a second sweep over the no-login/portal
// surfaces asserting zero page-level horizontal overflow and a minimum
// tap-target height on primary nav/filter/submit controls. Kept separate
// from RouteResult/evaluateRoute above since the observations are different
// (viewport geometry, not console/pageerror events) — same PASS/FAIL table
// + summary shape for a consistent gate report.
// ---------------------------------------------------------------------------

export interface MobileRouteEntry {
  readonly path: string;
  readonly role: "organizer" | "reviewer" | "speaker" | "public";
}

export interface MobileObservation {
  status: number;
  /** document.scrollingElement.scrollWidth */
  scrollWidth: number;
  /** window.innerWidth */
  viewportWidth: number;
  /** Minimum getBoundingClientRect().height among visible primary nav/
   * filter/submit controls on the page, or null if the page has none
   * (e.g. a route with no such controls at all). */
  minControlHeight: number | null;
  /** DEC-401: maximum getBoundingClientRect().right over every visible
   * element on the page — catches elements clipped by an ancestor's
   * overflow:hidden that scrollWidth alone would miss. */
  maxElementRight: number;
  /** DEC-401: up to 3 structural descriptors (never text content) for the
   * widest-overhanging elements whose rect.right exceeds the viewport,
   * widest first — e.g. "div.chq-foo w=420px right=460px". */
  overflowOffenders: string[];
  /** DEC-401: structural descriptor (class list / tag) of the element that
   * produced minControlHeight, or null if there is no such control. */
  minControlSelector: string | null;
}

export interface MobileRouteResult {
  entry: MobileRouteEntry;
  status: number;
  scrollWidth: number;
  viewportWidth: number;
  overflowPx: number;
  minControlHeight: number | null;
  ok: boolean;
  failureReason?: string;
}

const MIN_TAP_TARGET_PX = 44;
// 1px slack for sub-pixel layout rounding across engines.
const OVERFLOW_TOLERANCE_PX = 1;

/** Evaluates one route's mobile-viewport observation: HTTP 200, no
 * page-level horizontal overflow, and every measured primary control
 * meets the >= 44px tap-target height (DEC-393). */
export function evaluateMobileRoute(entry: MobileRouteEntry, observed: MobileObservation): MobileRouteResult {
  // DEC-401: also consider maxElementRight — an element clipped by an
  // ancestor's overflow:hidden can widen the visible page without moving
  // document.scrollingElement.scrollWidth.
  const overflowPx = Math.round(Math.max(observed.scrollWidth, observed.maxElementRight) - observed.viewportWidth);
  const reasons: string[] = [];
  if (observed.status !== 200) reasons.push(`status ${observed.status} !== 200`);
  if (overflowPx > OVERFLOW_TOLERANCE_PX) {
    let reason = `horizontal overflow ${overflowPx}px (scrollWidth ${observed.scrollWidth} > viewport ${observed.viewportWidth})`;
    if (observed.overflowOffenders.length > 0) {
      reason += ` — widest: ${observed.overflowOffenders.join(" | ")}`;
    }
    reasons.push(reason);
  }
  if (observed.minControlHeight !== null && observed.minControlHeight < MIN_TAP_TARGET_PX) {
    let reason = `control height ${observed.minControlHeight}px < ${MIN_TAP_TARGET_PX}px`;
    if (observed.minControlSelector) {
      reason += ` (${observed.minControlSelector})`;
    }
    reasons.push(reason);
  }
  return {
    entry,
    status: observed.status,
    scrollWidth: observed.scrollWidth,
    viewportWidth: observed.viewportWidth,
    overflowPx,
    minControlHeight: observed.minControlHeight,
    ok: reasons.length === 0,
    failureReason: reasons.length > 0 ? reasons.join("; ") : undefined,
  };
}

/** DEC-389: builds a FAIL MobileRouteResult for an entry whose navigation or
 * login threw, rather than letting the error abort the whole mobile pass. */
export function mobileErrorResult(entry: MobileRouteEntry, message: string): MobileRouteResult {
  return {
    entry,
    status: 0,
    scrollWidth: 0,
    viewportWidth: 0,
    overflowPx: 0,
    minControlHeight: null,
    ok: false,
    failureReason: message,
  };
}

/** Default MobileObservation for tests that only care about a subset of
 * fields — spread and override rather than repeating all keys everywhere. */
export const EMPTY_MOBILE_OBSERVATION: MobileObservation = {
  status: 200,
  scrollWidth: 0,
  viewportWidth: 0,
  minControlHeight: null,
  maxElementRight: 0,
  overflowOffenders: [],
  minControlSelector: null,
};

/** True if every mobile route result passed. */
export function allMobilePassed(results: readonly MobileRouteResult[]): boolean {
  return results.every((r) => r.ok);
}

/** Renders a PASS/FAIL table for the collected mobile route results. */
export function formatMobileResultsTable(results: readonly MobileRouteResult[]): string {
  const pathWidth = Math.max(...results.map((r) => r.entry.path.length), "path".length);
  const lines: string[] = [];
  lines.push(`${"path".padEnd(pathWidth)}  overflowPx  minControlPx  status`);
  for (const r of results) {
    const mark = r.ok ? "PASS" : "FAIL";
    const detail = r.ok ? "" : `  (${r.failureReason})`;
    lines.push(
      `${r.entry.path.padEnd(pathWidth)}  ${String(r.overflowPx).padStart(10)}  ${String(
        r.minControlHeight ?? "-",
      ).padStart(13)}  ${mark}${detail}`,
    );
  }
  return lines.join("\n");
}

/** Summary line: "N/M mobile routes passed". */
export function formatMobileSummary(results: readonly MobileRouteResult[]): string {
  const passed = results.filter((r) => r.ok).length;
  return `${passed}/${results.length} mobile routes passed`;
}

// ---------------------------------------------------------------------------
// DEC-387 admin mobile pass (390x844, advisory): reuses evaluateMobileRoute/
// formatMobileResultsTable/formatMobileSummary above (no parallel evaluator)
// against the organizer + reviewer entries of ROUTE_MANIFEST. See
// scripts/render-sweep.ts's ADMIN_MOBILE_ROUTE_MANIFEST for the route list.
// ---------------------------------------------------------------------------

/** DEC-387 flip rule (verbatim): "it becomes true in the wave after the pass first reads all-PASS."
 * Until then the admin mobile pass is advisory — it prints its own
 * PASS/FAIL table and summary but never contributes to the render-sweep
 * gate's exit code. */
export const ADMIN_MOBILE_PASS_BLOCKING = false;

// ---------------------------------------------------------------------------
// DEC-411: page.evaluate keepNames shim. tsx runs esbuild with keepNames,
// which rewrites named function/closure declarations to
// `__name(fn, "name")` calls. When such a rewritten closure's source text is
// serialized into a Playwright page.evaluate() call, it executes inside the
// browser page context, which has no __name — throwing
// "ReferenceError: __name is not defined" (see
// docs/verification-log/task-w7-e-render-sweep-redesign.md, all 35 mobile
// rows). Deliberately a raw string (not a function converted via
// .toString()): addInitScript({ content }) is never passed through esbuild,
// so the shim's own source text cannot itself be rewritten into a broken
// __name(fn, "shim") call — that would be circular.
// ---------------------------------------------------------------------------
export const PAGE_EVALUATE_KEEPNAMES_SHIM =
  "globalThis.__name = globalThis.__name || function (fn) { return fn; };";

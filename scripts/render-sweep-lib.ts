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

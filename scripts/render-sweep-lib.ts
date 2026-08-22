// Pure helpers for scripts/render-sweep.ts (DEC-144/DEC-139 render-sweep
// gate), extracted for plain-vitest testing without node:/playwright
// imports — same pattern as scripts/walkthrough-lib.ts /
// scripts/perf-smoke-lib.ts.

import type { RouteManifestEntry } from "../app/src/routeManifest";
import { DEC_253, DEC_393 } from "../src/decisions";

// DEC-253 wave-155 amendment: deriveInteractiveOffenders below, and its wiring
// into evaluateMobileRoute, is this decision's implementation -- a compile-
// checked reference so the dependency shows up outside the decisions
// machinery itself (test/decisions-orphan-ratchet.test.ts).
void DEC_253;

// DEC-393 (v12m-w11-tc): ADMIN_MOBILE_INTERACTIVE_OFFENDERS_CEILING below is
// re-measured by re-running the live gate this task's ceiling change, not by
// reading/trusting the offender roster's own prose -- a compile-checked
// reference so the dependency shows up outside the decisions machinery
// itself (test/decisions-orphan-ratchet.test.ts).
void DEC_393;

export interface RouteResult {
  entry: RouteManifestEntry;
  status: number;
  bodyNonEmpty: boolean;
  consoleErrors: string[];
  pageErrors: string[];
  clipOffenders: string[];
  landedPath: string;
  ok: boolean;
  failureReason?: string;
}

/** True if a route's body text (trimmed) is non-empty. */
export function isNonEmptyText(text: string): boolean {
  return text.trim().length > 0;
}

/**
 * w17-d: for a row that DELIBERATELY expects a non-200 status (e.g. the
 * DEC-945 chromeless /admin/* 404, DEC-747's /portal/preview 404), Chromium
 * itself logs a console 'error' for the top-level navigation's own failed
 * resource load ("Failed to load resource: the server responded with a
 * status of 404 (Not Found)") -- a direct, unavoidable byproduct of the
 * expected status, not a product-code defect. Strips exactly that one
 * message (matched by the row's own expectedStatus, never a blanket
 * allowlist) so an intentionally-non-200 row can still satisfy the
 * zero-console-errors rule; any OTHER console error on the same page (a
 * broken image, a script exception) still fails the row.
 *
 * DEC-253/DEC-643 w25-e: typed structurally on `{ expectedStatus? }` rather
 * than RouteManifestEntry specifically so the same filter is reusable by
 * evaluateMobileRoute's MobileRouteEntry (which now also carries an
 * expectedStatus for deliberately-non-200 mobile rows like
 * /portal/preview's existence-hiding 404).
 */
export function filterExpectedStatusConsoleNoise(
  entry: { readonly expectedStatus?: number },
  consoleErrors: readonly string[],
): string[] {
  const expectedStatus = entry.expectedStatus ?? 200;
  if (expectedStatus === 200) return [...consoleErrors];
  const noise = new RegExp(
    `^Failed to load resource: the server responded with a status of ${expectedStatus} \\(`,
  );
  let stripped = false;
  const out: string[] = [];
  for (const msg of consoleErrors) {
    if (!stripped && noise.test(msg)) {
      stripped = true;
      continue;
    }
    out.push(msg);
  }
  return out;
}

/**
 * Evaluates a single route's collected observations against the render-sweep
 * pass criteria: HTTP 200, non-empty rendered text, and zero collected
 * console 'error' + pageerror events (no allowlist beyond
 * filterExpectedStatusConsoleNoise's single-message strip for a
 * deliberately-non-200 row).
 */
export function evaluateRoute(
  entry: RouteManifestEntry,
  observed: {
    status: number;
    bodyText: string;
    consoleErrors: string[];
    pageErrors: string[];
    /** DEC-620: structural descriptors (never text content, same convention
     * as overflowOffenders) for elements whose scrollHeight exceeds their
     * clientHeight while overflow-y computes to visible|hidden — the class
     * of bug that let agenda cards bleed past their own boxes unseen.
     * Already filtered against KNOWN_CLIP_EXCEPTIONS by the caller. */
    clipOffenders?: string[];
    /** w45-a: the pathname the browser actually landed on once navigation
     * settled (e.g. after following a redirect). Defaults to `entry.path`
     * when the caller omits it (existing unit tests that don't care about
     * this axis). */
    landedPath?: string;
  },
): RouteResult {
  const bodyNonEmpty = isNonEmptyText(observed.bodyText);
  const clipOffenders = observed.clipOffenders ?? [];
  const landedPath = observed.landedPath ?? entry.path;
  const expectedStatus = entry.expectedStatus ?? 200;
  const expectedLandedPath = entry.expectedLandedPath ?? entry.path;
  const consoleErrors = filterExpectedStatusConsoleNoise(entry, observed.consoleErrors);
  const reasons: string[] = [];
  if (observed.status !== expectedStatus) {
    reasons.push(`status ${observed.status} !== expected ${expectedStatus}`);
  }
  if (landedPath !== expectedLandedPath) {
    reasons.push(`landed on ${landedPath} !== expected ${expectedLandedPath}`);
  }
  if (!bodyNonEmpty) reasons.push("empty rendered text");
  if (consoleErrors.length > 0) {
    reasons.push(`${consoleErrors.length} console error(s): ${consoleErrors.join(" | ")}`);
  }
  if (observed.pageErrors.length > 0) {
    reasons.push(`${observed.pageErrors.length} pageerror(s): ${observed.pageErrors.join(" | ")}`);
  }
  if (clipOffenders.length > 0) {
    reasons.push(`${clipOffenders.length} vertical clip offender(s): ${clipOffenders.join(" | ")}`);
  }
  return {
    entry,
    status: observed.status,
    bodyNonEmpty,
    consoleErrors: observed.consoleErrors,
    pageErrors: observed.pageErrors,
    clipOffenders,
    landedPath,
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
    clipOffenders: [],
    landedPath: entry.path,
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
// surfaces asserting zero page-level horizontal overflow, a minimum
// tap-target height on primary nav/filter/submit controls, and (wave-30
// amendment) zero collected console/pageerror events. Kept as a parallel
// evaluator to RouteResult/evaluateRoute above (rather than reusing it
// outright) because a desktop pass CANNOT see a phone-only component's
// errors: components like PhoneAgenda mount only at this 390px viewport,
// so their console/pageerror events never reach the desktop sweep — the
// mobile pass is the only observer for that surface, same PASS/FAIL table
// + summary shape for a consistent gate report.
// ---------------------------------------------------------------------------

export interface MobileRouteEntry {
  readonly path: string;
  readonly role: "organizer" | "reviewer" | "speaker" | "public";
  /** DEC-253/DEC-747/DEC-945 w25-e: mirrors RouteManifestEntry.expectedStatus
   * — a route that deliberately renders a non-200 (e.g. /portal/preview's
   * existence-hiding 404 with no ?eventId=) must carry that expectation
   * through to the mobile pass too, the same way the desktop pass already
   * does, rather than reading a permanent FAIL against a fixed 200. */
  readonly expectedStatus?: number;
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
  /** DEC-367 w19-f: minimum getBoundingClientRect().width over the SAME
   * population of visible primary nav/filter/submit controls that produces
   * minControlHeight — the 44px floor's ruling is "min-height:44px plus
   * centred flex plus horizontal padding" (DESIGN-RULINGS.md), so a control
   * that is tall enough but narrower than its own text (padding alone,
   * DEC-393's evasion) must fail too. null under the exact same condition as
   * minControlHeight (no such controls found on the route) so a
   * control-free route stays inert rather than turning red. */
  minControlWidth: number | null;
  /** DEC-401: maximum getBoundingClientRect().right over every visible
   * element on the page — catches elements clipped by an ancestor's
   * overflow:hidden that scrollWidth alone would miss. DEC-424: elements
   * held inside a deliberate horizontal scroller (an ancestor with
   * overflow-x: auto|scroll, DEC-414's remedy) are excluded from this
   * measurement — they are not overflow bugs. */
  maxElementRight: number;
  /** DEC-401: up to 3 structural descriptors (never text content) for the
   * widest-overhanging elements whose rect.right exceeds the viewport,
   * widest first — e.g. "div.chq-foo w=420px right=460px". DEC-424: excludes
   * elements held by a horizontal scroller ancestor. If this list is empty
   * but the page's scrollWidth still overflows the viewport (content-spill
   * with no single offending rect.right), it is instead populated with up
   * to 3 visible, non-scroller-held elements whose own
   * el.scrollWidth > el.clientWidth, sorted by spill magnitude descending —
   * e.g. "span.chq-foo spill=25px (scrollWidth 415 > clientWidth 390)". */
  overflowOffenders: string[];
  /** DEC-401: structural descriptor (class list / tag) of the element that
   * produced minControlHeight, or null if there is no such control. */
  minControlSelector: string | null;
  /** DEC-620: structural descriptors (never text content) for up to 5
   * elements, worst-first, whose scrollHeight exceeds their clientHeight by
   * more than 2px while overflow-y computes to visible|hidden (a deliberate
   * scroll container — overflow-y auto|scroll — is excluded, same convention
   * as overflowOffenders excluding overflow-x scrollers). Already filtered
   * against KNOWN_CLIP_EXCEPTIONS by the caller. */
  clipOffenders: string[];
  /** DEC-253 wave-30 amendment: collected console 'error' events for this
   * mobile-viewport page load, same convention as RouteResult.consoleErrors
   * above — phone-only components (e.g. PhoneAgenda) mount only at this
   * viewport width, so the desktop pass never sees their console errors. */
  consoleErrors: string[];
  /** DEC-253 wave-30 amendment: collected uncaught page 'pageerror' events,
   * same convention as RouteResult.pageErrors. */
  pageErrors: string[];
  /** DEC-253 wave-155 amendment: every visible control's structural box
   * (selector, tag, width, height) over the SAME population that produced
   * minControlHeight/minControlWidth above — the raw material
   * evaluateMobileRoute hands to deriveInteractiveOffenders so the live
   * gate reports every control under the floor, not just the shortest one
   * (DEC-253). Collected in the page.evaluate control loop alongside the
   * minima, which stay untouched. */
  interactiveMeasurements: InteractiveMeasurement[];
}

export interface MobileRouteResult {
  entry: MobileRouteEntry;
  status: number;
  scrollWidth: number;
  viewportWidth: number;
  overflowPx: number;
  minControlHeight: number | null;
  /** DEC-367 w19-f: mirrors minControlHeight, same population, same null
   * convention. */
  minControlWidth: number | null;
  /** DEC-253 wave-30 amendment: console errors that survived
   * filterExpectedStatusConsoleNoise, printed in the failure reason and
   * available to the report the same way RouteResult.consoleErrors is. */
  consoleErrors: string[];
  /** DEC-253 wave-30 amendment: uncaught page errors observed at this
   * viewport, same convention as RouteResult.pageErrors. */
  pageErrors: string[];
  /** DEC-253/DEC-367/DEC-808 wave-155 amendment: structural descriptors
   * ("tag.class w=WxH") for EVERY visible control under MIN_TAP_TARGET_PX
   * on either dimension — deriveInteractiveOffenders over the SAME
   * population/floor that produced minControlHeight/minControlWidth,
   * never a re-implemented predicate. Empty when no such control exists,
   * including when the route has no measured controls at all. */
  interactiveOffenders: string[];
  ok: boolean;
  failureReason?: string;
}

export const MIN_TAP_TARGET_PX = 44;
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
  const expectedStatus = entry.expectedStatus ?? 200;
  const reasons: string[] = [];
  if (observed.status !== expectedStatus) reasons.push(`status ${observed.status} !== expected ${expectedStatus}`);
  if (overflowPx > OVERFLOW_TOLERANCE_PX) {
    let reason = `horizontal overflow ${overflowPx}px (scrollWidth ${observed.scrollWidth} > viewport ${observed.viewportWidth})`;
    if (observed.overflowOffenders.length > 0) {
      reason += ` — widest: ${observed.overflowOffenders.join(" | ")}`;
    }
    reasons.push(reason);
  }
  const heightFails = observed.minControlHeight !== null && observed.minControlHeight < MIN_TAP_TARGET_PX;
  const widthFails = observed.minControlWidth !== null && observed.minControlWidth < MIN_TAP_TARGET_PX;
  if (heightFails || widthFails) {
    const dims: string[] = [];
    if (heightFails) dims.push(`control height ${observed.minControlHeight}px < ${MIN_TAP_TARGET_PX}px`);
    if (widthFails) dims.push(`control width ${observed.minControlWidth}px < ${MIN_TAP_TARGET_PX}px`);
    let reason = dims.join(", ");
    if (observed.minControlSelector) {
      reason += ` (${observed.minControlSelector})`;
    }
    reasons.push(reason);
  }
  if (observed.clipOffenders.length > 0) {
    reasons.push(`${observed.clipOffenders.length} vertical clip offender(s): ${observed.clipOffenders.join(" | ")}`);
  }
  // DEC-253/DEC-367/DEC-808 wave-155 amendment: deriveInteractiveOffenders
  // over the SAME measured population/floor that produced
  // minControlHeight/minControlWidth above — reports every offending
  // control, not just the shortest one (this task's whole point). Additive
  // to the heightFails/widthFails reason above, which stays untouched (the
  // public-pass contract DEC-253 already relies on).
  const interactiveOffenderMeasurements = deriveInteractiveOffenders(observed.interactiveMeasurements, MIN_TAP_TARGET_PX);
  const interactiveOffenders = interactiveOffenderMeasurements.map(
    (m) => `${m.selector} w=${Math.round(m.width)}px h=${Math.round(m.height)}px`,
  );
  if (interactiveOffenders.length > 0) {
    reasons.push(`${interactiveOffenders.length} interactive offender(s) under ${MIN_TAP_TARGET_PX}px: ${interactiveOffenders.join(" | ")}`);
  }
  // DEC-253 wave-30 amendment: same expected-status noise filter as the
  // desktop pass — a mobile row with a deliberate non-200 expectedStatus
  // (e.g. /portal/preview's existence-hiding 404) legitimately logs the
  // browser's own failed top-level navigation console error.
  const consoleErrors = filterExpectedStatusConsoleNoise(entry, observed.consoleErrors);
  if (consoleErrors.length > 0) {
    reasons.push(`${consoleErrors.length} console error(s): ${consoleErrors.join(" | ")}`);
  }
  if (observed.pageErrors.length > 0) {
    reasons.push(`${observed.pageErrors.length} pageerror(s): ${observed.pageErrors.join(" | ")}`);
  }
  return {
    entry,
    status: observed.status,
    scrollWidth: observed.scrollWidth,
    viewportWidth: observed.viewportWidth,
    overflowPx,
    minControlHeight: observed.minControlHeight,
    minControlWidth: observed.minControlWidth,
    consoleErrors,
    pageErrors: observed.pageErrors,
    interactiveOffenders,
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
    minControlWidth: null,
    consoleErrors: [],
    pageErrors: [],
    interactiveOffenders: [],
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
  minControlWidth: null,
  maxElementRight: 0,
  overflowOffenders: [],
  minControlSelector: null,
  clipOffenders: [],
  consoleErrors: [],
  pageErrors: [],
  interactiveMeasurements: [],
};

/** True if every mobile route result passed. */
export function allMobilePassed(results: readonly MobileRouteResult[]): boolean {
  return results.every((r) => r.ok);
}

/** Renders a PASS/FAIL table for the collected mobile route results. */
export function formatMobileResultsTable(results: readonly MobileRouteResult[]): string {
  const pathWidth = Math.max(...results.map((r) => r.entry.path.length), "path".length);
  const lines: string[] = [];
  lines.push(`${"path".padEnd(pathWidth)}  overflowPx  minControlHPx  minControlWPx  status`);
  for (const r of results) {
    const mark = r.ok ? "PASS" : "FAIL";
    const detail = r.ok ? "" : `  (${r.failureReason})`;
    lines.push(
      `${r.entry.path.padEnd(pathWidth)}  ${String(r.overflowPx).padStart(10)}  ${String(
        r.minControlHeight ?? "-",
      ).padStart(13)}  ${String(r.minControlWidth ?? "-").padStart(13)}  ${mark}${detail}`,
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
 * w12-a's Reading 2 (re-confirmed on w13-a's own tree, docs/verification-log/
 * task-w13-a-render-sweep-stage1.md) read 20/20 all-PASS — DEC-431 fires the
 * flip here. The admin mobile pass now contributes to the render-sweep gate's
 * exit code. */
export const ADMIN_MOBILE_PASS_BLOCKING = true;

// ---------------------------------------------------------------------------
// DEC-367/DEC-808 w7-dd: the admin mobile pass's control population used to
// be ADMIN_MOBILE_CONTROL_SELECTOR, a hand-listed six-selector list
// (.chq-tabbar a/button, .chq-btn, .chq-input, .chq-select, header nav a) —
// exactly the DEC-180/DEC-808 shape ("a hand-listed population is not a
// population") applied to a selector list instead of a file list. That is
// how a live 95x19px .chq-participation-menu-trigger renders on an admin
// page while every static tap-floor ratchet reads 0: the static scans are
// token-keyed, and the one instrument that measures real geometry was
// pointed at a named handful. INTERACTIVE_CONTROL_SELECTOR replaces it with
// every element the DOM itself calls interactive, so the live gate speaks
// the same vocabulary as the tap-target tag list DEC-393 wave-144 widened
// with <summary> (DEC-613: a second copy of a vocabulary is a trap with a
// delay fuse).
// ---------------------------------------------------------------------------
export const INTERACTIVE_CONTROL_SELECTOR = [
  "a[href]",
  "button",
  "input:not([type=hidden])",
  "select",
  "textarea",
  "summary",
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="checkbox"]',
  "[tabindex]:not([tabindex=\"-1\"])",
].join(", ");

/** A single already-measured box, in the shape the live sweep collects with
 * `getBoundingClientRect()` inside `page.evaluate` — kept separate from any
 * DOM/Playwright type so `deriveInteractiveOffenders` below stays pure and
 * plain-vitest-testable (this file's whole contract: no node:/playwright
 * imports). `visible` carries the caller's own `offsetParent !== null` check
 * (DEC-393: visible only, not display:none) rather than this function
 * re-implementing a DOM query the caller already ran. */
export interface InteractiveMeasurement {
  selector: string;
  tagName: string;
  width: number;
  height: number;
  visible: boolean;
}

/** Pure decision logic for the widened admin mobile control population:
 * every visible measurement whose height or width falls under `floorPx`
 * (DEC-367's two-dimension floor — a control can clear the height floor on
 * padding alone but still be no wider than its own text, DEC-393's
 * evasion). Invisible measurements are skipped, never re-measured. */
export function deriveInteractiveOffenders(
  measurements: readonly InteractiveMeasurement[],
  floorPx: number,
): InteractiveMeasurement[] {
  return measurements.filter((m) => m.visible && (m.height < floorPx || m.width < floorPx));
}

/** DEC-367/DEC-808/DEC-976 w7-dd, wave-155 amendment (task pc): two-sided
 * ratchet for the admin mobile pass's offender count once its control
 * population widens from the hand-listed six-selector
 * ADMIN_MOBILE_CONTROL_SELECTOR to the full INTERACTIVE_CONTROL_SELECTOR
 * above. A widening re-seeds where it widens in the repairing commit
 * rather than flipping a blocking gate red on landing (DEC-976 wave-138,
 * DEC-393 wave-139's own precedent for exactly this move: "the widening
 * lands as a parameter, and the population is re-measured on the tree, not
 * carried forward from the ruling's own estimate").
 *
 * MEASURED, not invented (DEC-967): this task ran the full local stack
 * (migrations + seed + wrangler dev) and `npm run gate:render-sweep`
 * end-to-end against this same commit's plumbing. The admin mobile pass's
 * own printed total read `render-sweep: admin mobile total interactive
 * offenders: 79`, over ADMIN_MOBILE_ROUTE_MANIFEST at MIN_TAP_TARGET_PX via
 * deriveInteractiveOffenders — same population, same floor, same pure
 * predicate this ceiling itself compares against, wired into
 * ADMIN_MOBILE_PASS_BLOCKING's decision in this same commit. The previous
 * -1 sentinel (which could satisfy neither side of a real two-sided ratchet)
 * is replaced by that measured count.
 *
 * RE-MEASURED, task v12m-w11-tc (DEC-393/DEC-382): re-ran the live gate
 * fresh against this task's own worktree HEAD rather than trusting the
 * roster's stale prose (docs/design/audit/admin-390-interactive-offenders-
 * w27.md's row 9 called `.chq-review-checkbox-label` "a class with no CSS
 * rule of any kind" — false on this tree, review.css:921/:2629 both declare
 * `min-height: 44px`). Re-measured total before this task's own fix:
 * still 79 (unchanged — the review.css floor a prior task already landed
 * doesn't shrink the raw offender count, since render-sweep measures the
 * bare `<input>` itself, not its wrapping label; it just makes that
 * sighting EXEMPT rather than a candidate defect, same idiom as
 * `.chq-check-hit`). This task's own fix — `a.chq-auth-back` (`/account/
 * password`, 37×44, DEC-393's width-floor gap: `min-height:44px` alone,
 * no `min-width`, same shape the now-fixed `.chq-link-button`/`.chq-pill`
 * sites had) — gained `min-width:44px` + centring in `src/routes/
 * auth.css.ts`'s one terminal `@media (max-width:700px)` block, clearing
 * both of its two route sightings. Re-measured total after the fix: 77.
 * `a.chq-wordmark` (`/dev/mailbox`(`/:id`), 113×28, 2 sightings) is left
 * unfixed and DEC-382-exempted (comment above `.chq-wordmark` in
 * src/views/theme.ts) — it is TOOLS_CSS operator chrome, not a design-
 * system control, and restyling the shared THEME_CSS selector would also
 * inflate the wordmark on every real design surface reusing it. The 9
 * `input.chq-check.chq-taskview-check` sightings (`/admin/speakers/tasks/
 * seed_task_0001`) are counted but out of this task's scope (owned by
 * lane v12m-w11-te). See docs/design/audit/admin-390-interactive-
 * offenders-w27.md for the full re-measured, re-classified roster.
 *
 * Wave 23 (task w23-f, DEC-144 wave-23 amendment): ROUTE_MANIFEST widened
 * with the last three unvisited sub-states (`?section=your-data&edit=1&
 * intent=new`, `?import=1`, `?history=0` on the submission-detail row),
 * which widens what this live 390 pass visits. Re-measured total: 103 (77
 * + 26). The 26 new sightings are `/admin/contacts?import=1` (25x
 * `input.chq-check`, ContactsTable row-select, `.chq-check-hit` wrap --
 * the exact same idiom-2 EXEMPT population as the bare `/admin/contacts`
 * row) and `/admin/submissions/seed_submission_0001?history=0` (1x
 * `input.chq-check`, same row-select idiom as the sibling `/admin/
 * submissions/seed_submission_0001` and `?edit=1` rows). The new
 * `?section=your-data&edit=1&intent=new` row contributed zero interactive
 * offenders. See docs/design/audit/route-substate-390-sweep-v12.md for the
 * full classification. */
export const ADMIN_MOBILE_INTERACTIVE_OFFENDERS_CEILING = 103;

/** DEC-996 wave-24 amendment: classification result for one printed offender
 * line. `EXEMPT` names the receipt token (a class name) that reaches it —
 * either a `tap-floor-exempt:` comment naming that literal class, or the
 * `.chq-check-hit` wrapper idiom (both derived by the caller from the tree,
 * never hand-listed here). `CANDIDATE` carries no receipt: nothing in the
 * exempt set names any class token the offender's own selector carries. */
export interface AdminMobileOffenderClassification {
  readonly classification: "EXEMPT" | "CANDIDATE";
  readonly receipt?: string;
}

/** DEC-996 wave-24 amendment: pure classifier for one already-printed
 * offender line (the `${selector} w=${w}px h=${h}px` shape
 * `evaluateMobileRoute` above produces). Takes the exempt token set as an
 * ARGUMENT — never reads the filesystem, never imports anything beyond what
 * this module already imports — so this file stays pure and
 * playwright-free, callable from plain vitest. `exemptSelectors` holds bare
 * class names (no leading `.`); every class token the offender's selector
 * prefix carries (e.g. `input.chq-check.chq-taskview-check` -> `chq-check`,
 * `chq-taskview-check`) is checked against it, first match wins and is
 * reported as the receipt. A selector with no class token, or no token in
 * the set, classifies CANDIDATE. */
export function classifyAdminMobileOffender(
  offenderLine: string,
  exemptSelectors: ReadonlySet<string>,
): AdminMobileOffenderClassification {
  const selectorPart = offenderLine.split(/\s+w=/)[0] ?? offenderLine;
  const classTokens = (selectorPart.match(/\.[a-zA-Z0-9_-]+/g) ?? []).map((t) => t.slice(1));
  for (const token of classTokens) {
    if (exemptSelectors.has(token)) {
      return { classification: "EXEMPT", receipt: token };
    }
  }
  return { classification: "CANDIDATE" };
}

/** Shape formatAdminMobileOffenderLedger needs from a MobileRouteResult —
 * only the path and the offender roster, so the pure formatter never has to
 * import the full MobileRouteResult/RouteManifestEntry (or any playwright
 * type) to be called. */
export interface AdminMobileOffenderLedgerRow {
  readonly path: string;
  readonly interactiveOffenders: readonly string[];
}

/** DEC-996: renders the admin 390 mobile pass's per-route offender roster as
 * deterministic markdown — the file scripts/render-sweep.ts writes to
 * docs/design/audit/admin-mobile-tap-floor-390-v12.md on every gate run, so
 * the count the gate prints and discards to scrollback has a durable roster
 * in the tree instead. Pure: takes only {path, interactiveOffenders} per row
 * (never a live MobileRouteResult/playwright type), sorted by route path for
 * a stable diff across re-runs; each offender string is emitted verbatim,
 * one per line. */
export function formatAdminMobileOffenderLedger(
  results: readonly AdminMobileOffenderLedgerRow[],
  ceiling: number,
  exemptSelectors: ReadonlySet<string> = new Set(),
): string {
  void ceiling; // DEC-996 wave-24 amendment: the printed total classifies the
  // population instead of comparing it to the raw ceiling — the ceiling
  // itself is unchanged and still lives in ADMIN_MOBILE_INTERACTIVE_OFFENDERS_CEILING.
  const lines: string[] = [];
  lines.push("# Admin mobile tap-floor offender roster (390px, DEC-253/DEC-367/DEC-808/DEC-996)");
  lines.push("");
  lines.push(
    "MACHINE-WRITTEN by `npm run gate:render-sweep` (scripts/render-sweep.ts). Do not hand-edit — the next gate run overwrites this file unconditionally.",
  );
  lines.push("");
  lines.push(
    "Lists every visible interactive control under the 44px tap-target floor (`MIN_TAP_TARGET_PX`, either dimension) found by the admin 390x844 mobile pass, one route section per route with at least one offender, sorted by route path. Each line is classified EXEMPT (naming the receipt token that reaches it) or CANDIDATE (DEC-996 wave-24 amendment) — a bare count over this mixed population is not a measurement.",
  );
  lines.push("");

  const offending = results
    .filter((r) => r.interactiveOffenders.length > 0)
    .slice()
    .sort((a, b) => a.path.localeCompare(b.path));

  let exemptCount = 0;
  let candidateCount = 0;

  if (offending.length === 0) {
    lines.push("No offenders measured on the last gate run.");
  } else {
    for (const r of offending) {
      lines.push(`## ${r.path}`);
      lines.push("");
      for (const offender of r.interactiveOffenders) {
        const c = classifyAdminMobileOffender(offender, exemptSelectors);
        if (c.classification === "EXEMPT") {
          exemptCount++;
          lines.push(`- ${offender} — **EXEMPT** (receipt: \`${c.receipt}\`)`);
        } else {
          candidateCount++;
          lines.push(`- ${offender} — **CANDIDATE**`);
        }
      }
      lines.push("");
    }
  }

  const total = results.reduce((sum, r) => sum + r.interactiveOffenders.length, 0);
  lines.push(`Measured total: ${total} (exempt: ${exemptCount}, candidate defects: ${candidateCount})`);
  return lines.join("\n") + "\n";
}

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

// ---------------------------------------------------------------------------
// DEC-421 type-floor pass (advisory): docs/eval-findings.md:70-74 and
// docs/design/README.md:74/:207 name "no computed font-size below 10px
// anywhere in the rendered admin/portal/public routes" as the mandate's
// second render-sweep invariant, alongside the DEC-393 44px tap-target pass
// above. Reuses the desktop pass's ROUTE_MANIFEST visits and the mobile
// pass's MOBILE_ROUTE_MANIFEST visits (see scripts/render-sweep.ts) rather
// than adding a third route list — every visited page gets one extra
// page.evaluate measuring the smallest getComputedStyle(el).fontSize among
// elements that actually render text.
// ---------------------------------------------------------------------------

export const MIN_FONT_PX = 10;

/** DEC-387 flip rule (verbatim), reused here per DEC-421: "it becomes true in
 * the wave after the pass first reads all-PASS." w12-a's Reading 2 read
 * 42/42 all-PASS and re-confirmed all-PASS on w13-a's own tree (83/83,
 * docs/verification-log/task-w13-a-render-sweep-stage1.md) — DEC-431 fires
 * the flip here. The type-floor pass now contributes to the render-sweep
 * gate's exit code. */
export const FONT_FLOOR_BLOCKING = true;

export interface FontFloorRouteEntry {
  readonly path: string;
  readonly role: string;
}

/** Raw in-page measurement: the smallest getComputedStyle(el).fontSize among
 * elements with a non-empty direct text node and a non-zero rendered box, or
 * null if the page has no such elements (e.g. a blank/loading state). */
export interface FontFloorObservation {
  minFontPx: number | null;
  /** Up to 3 structural descriptors (tag + class list + the px value, never
   * text content — same DEC-401 convention as overflowOffenders) for
   * elements under MIN_FONT_PX, smallest first. */
  offenders: string[];
}

export interface FontFloorResult {
  path: string;
  role: string;
  viewport: "desktop" | "mobile";
  minFontPx: number | null;
  ok: boolean;
  failureReason?: string;
}

/** Evaluates one route+viewport's font-floor observation: every measured
 * text element must render at >= MIN_FONT_PX. A page with no measurable text
 * (minFontPx null) passes vacuously, same convention as
 * evaluateMobileRoute's minControlHeight null case. */
export function evaluateFontFloor(
  entry: FontFloorRouteEntry,
  viewport: "desktop" | "mobile",
  observed: FontFloorObservation,
): FontFloorResult {
  const reasons: string[] = [];
  if (observed.minFontPx !== null && observed.minFontPx < MIN_FONT_PX) {
    let reason = `min font-size ${observed.minFontPx}px < ${MIN_FONT_PX}px`;
    if (observed.offenders.length > 0) {
      reason += ` — smallest: ${observed.offenders.join(" | ")}`;
    }
    reasons.push(reason);
  }
  return {
    path: entry.path,
    role: entry.role,
    viewport,
    minFontPx: observed.minFontPx,
    ok: reasons.length === 0,
    failureReason: reasons.length > 0 ? reasons.join("; ") : undefined,
  };
}

/** DEC-389-style FAIL row for a route+viewport whose in-page measurement
 * threw (e.g. the DEC-411 keepNames shim wasn't applied and page.evaluate
 * raised "__name is not defined") — reported as instrument-blocked rather
 * than recording a false minFontPx of 0/null. */
export function fontFloorErrorResult(
  entry: FontFloorRouteEntry,
  viewport: "desktop" | "mobile",
  message: string,
): FontFloorResult {
  return {
    path: entry.path,
    role: entry.role,
    viewport,
    minFontPx: null,
    ok: false,
    failureReason: `instrument-blocked: ${message}`,
  };
}

/** Renders a PASS/FAIL table for the collected font-floor results, one line
 * per route+viewport (mirrors formatMobileResultsTable's shape). */
export function formatFontFloorTable(results: readonly FontFloorResult[]): string {
  const pathWidth = Math.max(...results.map((r) => r.path.length), "path".length);
  const roleWidth = Math.max(...results.map((r) => r.role.length), "role".length);
  const lines: string[] = [];
  lines.push(
    `${"path".padEnd(pathWidth)}  ${"role".padEnd(roleWidth)}  viewport  minFontPx  status`,
  );
  for (const r of results) {
    const mark = r.ok ? "PASS" : "FAIL";
    const detail = r.ok ? "" : `  (${r.failureReason})`;
    lines.push(
      `${r.path.padEnd(pathWidth)}  ${r.role.padEnd(roleWidth)}  ${r.viewport.padEnd(7)}  ${String(
        r.minFontPx ?? "-",
      ).padStart(9)}  ${mark}${detail}`,
    );
  }
  return lines.join("\n");
}

/** True if every font-floor result passed; kept for symmetry with
 * allPassed/allMobilePassed even though FONT_FLOOR_BLOCKING keeps this out
 * of the gate's exit code for now. */
export function allFontFloorPassed(results: readonly FontFloorResult[]): boolean {
  return results.every((r) => r.ok);
}

/** Summary line: "N/M font-floor checks passed". */
export function formatFontFloorSummary(results: readonly FontFloorResult[]): string {
  const passed = results.filter((r) => r.ok).length;
  return `${passed}/${results.length} font-floor checks passed`;
}

// ---------------------------------------------------------------------------
// DEC-620 vertical-clip pass: the render-sweep in-page probe (see
// scripts/render-sweep.ts's measureClipOffenders) collects visible elements
// where scrollHeight > clientHeight + 2 AND computed overflow-y is
// visible|hidden — a deliberate scroll container (overflow-y auto|scroll) is
// excluded by that condition already, same convention as overflowOffenders
// excluding overflow-x scrollers. Offenders known to belong to a route/file
// another in-flight branch owns are named here (never silently absorbed into
// tolerance) and filtered out before evaluateRoute/evaluateMobileRoute see
// them, so they never fail the gate.
// ---------------------------------------------------------------------------

// DEC-620 wave-25 amendment: `scrollHeight > clientHeight` alone is not a
// clip — it's only correct-by-construction as an offender when something
// actually clips it. The in-page probe (scripts/render-sweep.ts's
// measureClipOffenders) measures raw geometry/context per candidate element
// and hands the array here; the PASS/FAIL decision itself is this pure,
// unit-testable predicate so it never needs a browser to verify. An element
// is a genuine clip offender only when all four hold:
//   (0)   it is not itself a deliberate scroll container (own computed
//         overflow-y is auto|scroll) — an element that resolves its own
//         overflow with a scrollbar loses nothing; this is the pre-existing
//         rule the original DEC-620 probe already applied (`.chq-main`,
//         app/src/styles.css:404-409, is exactly this shape: `overflow-y:
//         auto`, "the ONLY [scrolling region]" per styles.css:179) and the
//         wave-25 amendment does not repeal it
//   (i)   it or an ancestor establishes a real clipping context (computed
//         overflow-x/y is hidden|scroll|auto, or a clipping clip/clip-path)
//   (ii)  it is not the deliberate visually-hidden collapse
//         (clientHeight <= CLIP_VISUALLY_HIDDEN_MAX_PX)
//   (iii) the overflowing content is not a replaced-content crop (an img/
//         video element, or an element that declares object-fit)
export const CLIP_VISUALLY_HIDDEN_MAX_PX = 1;

/** Raw per-element measurement the in-page probe collects — geometry plus
 * the three boolean facts (self is its own deliberate scroll container /
 * clipping context present / overflowing content is a replaced-content
 * crop) the DEC-620 wave-25 amendment predicate needs. Deliberately carries
 * no text content (DEC-401). */
export interface ClipCandidate {
  descriptor: string;
  scrollHeight: number;
  clientHeight: number;
  isSelfScrollContainer: boolean;
  hasClippingContext: boolean;
  isReplacedContentCrop: boolean;
}

/** DEC-620 wave-25 amendment predicate: true only when `candidate` is a
 * genuine clip (satisfies all three conditions above). Pure — no DOM, so
 * it's directly unit-testable. */
export function isGenuineClipOffender(candidate: ClipCandidate, tolerancePx: number): boolean {
  if (candidate.scrollHeight <= candidate.clientHeight + tolerancePx) return false;
  if (candidate.isSelfScrollContainer) return false;
  if (!candidate.hasClippingContext) return false;
  if (candidate.clientHeight <= CLIP_VISUALLY_HIDDEN_MAX_PX) return false;
  if (candidate.isReplacedContentCrop) return false;
  return true;
}

/** Formats one genuine offender the same way the pre-amendment probe did:
 * `${descriptor} clip=${N}px (scrollHeight ${sh} > clientHeight ${ch})`. */
export function formatClipOffender(candidate: ClipCandidate): string {
  const clip = candidate.scrollHeight - candidate.clientHeight;
  return `${candidate.descriptor} clip=${Math.round(clip)}px (scrollHeight ${Math.round(candidate.scrollHeight)} > clientHeight ${Math.round(
    candidate.clientHeight,
  )})`;
}

/** Filters `candidates` down to genuine clip offenders (isGenuineClipOffender),
 * worst-first by clip size, capped at `cap`, formatted for display. */
export function selectClipOffenders(candidates: readonly ClipCandidate[], tolerancePx: number, cap: number): string[] {
  return candidates
    .filter((c) => isGenuineClipOffender(c, tolerancePx))
    .slice()
    .sort((a, b) => b.scrollHeight - b.clientHeight - (a.scrollHeight - a.clientHeight))
    .slice(0, cap)
    .map(formatClipOffender);
}

/** Filters clipOffenders collected for `path` against KNOWN_CLIP_EXCEPTIONS
 * (keyed `${path}::${selector}`, selector = the offender string's leading
 * "tag.class.class" token before " clip="). Pure so it stays unit-testable
 * without a browser. */
export function filterKnownClipExceptions(
  path: string,
  offenders: readonly string[],
  exceptions: Readonly<Record<string, string>>,
): string[] {
  return offenders.filter((offender) => {
    const selector = offender.split(" clip=")[0];
    const key = `${path}::${selector}`;
    return !(key in exceptions);
  });
}

// ---------------------------------------------------------------------------
// DEC-643 type-role pass (advisory): docs/design/README.md's typography
// table (lines 62-74) plus the Overview §01 deadline-cell note (line 166)
// name exact size/weight/tracking values for a handful of key roles, tokenised
// in app/src/styles.css as --chq-type-<role>-size|-weight|-tracking (see
// test/type-scale-conformance.test.ts for the source-scanning check that
// overview.css actually references those tokens). This pass measures the
// *rendered* values via getComputedStyle at /admin/overview desktop, the same
// "advisory, never flips the exit code" convention as the DEC-421 font-floor
// pass above — a drifted computed value is real signal, but this is the
// first time these roles have been measured and shouldn't gate the sweep.
// ---------------------------------------------------------------------------

/** Mirrors FONT_FLOOR_BLOCKING: type-role failures never flip render-sweep's
 * exit code while this stays false. Flip per the same DEC-387 rule once a
 * reading has come back all-PASS and been reconfirmed on a later branch. */
export const TYPE_ROLE_BLOCKING = false;

/** Tolerance for float comparisons of px/em values coming back from
 * getComputedStyle (browser rounding, subpixel rendering). */
const TYPE_ROLE_PX_TOLERANCE = 0.5;
const TYPE_ROLE_EM_TOLERANCE = 0.002;

export interface TypeRoleExpected {
  readonly fontSizePx?: number;
  readonly fontWeight?: number;
  readonly letterSpacingEm?: number;
}

export interface TypeRoleObserved {
  readonly fontSizePx?: number;
  readonly fontWeight?: number;
  readonly letterSpacingEm?: number;
}

export interface TypeRoleEntry {
  readonly selector: string;
  readonly role: string;
  readonly expected: TypeRoleExpected;
}

export interface TypeRoleResult {
  selector: string;
  role: string;
  ok: boolean;
  failureReason?: string;
  observed: TypeRoleObserved;
  expected: TypeRoleExpected;
}

/** Pure, DOM-free comparison of one role's observed getComputedStyle reading
 * against its expected {fontSizePx, fontWeight, letterSpacingEm} — only the
 * properties present on `expected` are checked (mirrors evaluateFontFloor's
 * "only measured properties can fail" shape). Font-size/letter-spacing
 * compare within a small tolerance for browser subpixel rounding; weight
 * compares exactly (weights are discrete tokens, never fractional). */
export function evaluateTypeRoleResult(
  observed: TypeRoleObserved,
  expected: TypeRoleExpected,
): { ok: boolean; failureReason?: string } {
  const reasons: string[] = [];

  if (expected.fontSizePx !== undefined) {
    if (observed.fontSizePx === undefined || Number.isNaN(observed.fontSizePx)) {
      reasons.push(`font-size not measured (expected ${expected.fontSizePx}px)`);
    } else if (Math.abs(observed.fontSizePx - expected.fontSizePx) > TYPE_ROLE_PX_TOLERANCE) {
      reasons.push(`font-size ${observed.fontSizePx}px !== expected ${expected.fontSizePx}px`);
    }
  }

  if (expected.fontWeight !== undefined) {
    if (observed.fontWeight === undefined || Number.isNaN(observed.fontWeight)) {
      reasons.push(`font-weight not measured (expected ${expected.fontWeight})`);
    } else if (observed.fontWeight !== expected.fontWeight) {
      reasons.push(`font-weight ${observed.fontWeight} !== expected ${expected.fontWeight}`);
    }
  }

  if (expected.letterSpacingEm !== undefined) {
    if (observed.letterSpacingEm === undefined || Number.isNaN(observed.letterSpacingEm)) {
      reasons.push(`letter-spacing not measured (expected ${expected.letterSpacingEm}em)`);
    } else if (Math.abs(observed.letterSpacingEm - expected.letterSpacingEm) > TYPE_ROLE_EM_TOLERANCE) {
      reasons.push(`letter-spacing ${observed.letterSpacingEm}em !== expected ${expected.letterSpacingEm}em`);
    }
  }

  return { ok: reasons.length === 0, failureReason: reasons.length > 0 ? reasons.join("; ") : undefined };
}

/** One measured `.chq-overview-deadline-value` cell: its observed
 * font-weight and its rendered text (`cell.display` from
 * app/src/pages/overview/rows.ts — "Today" / "N day(s)" / the unset em
 * dash "—"). */
export interface DeadlineNearestCell {
  readonly weight: number;
  readonly value: string;
}

/** Parses a `formatDeadlineValue` display string back into a comparable
 * rank: 0 for "Today", N for "N day"/"N days", null for the unset "—".
 * Mirrors the ONE ranking rows.ts's buildDeadlineCells actually uses (raw
 * ms, DEC-370 amendment: ties are measured on the DISPLAYED value) closely
 * enough that two cells with the same rank are exactly the cells rows.ts
 * would mark isNearest together. */
function parseDeadlineRank(value: string): number | null {
  if (value === "—") return null;
  if (value === "Today") return 0;
  const m = /^(\d+) days?$/.exec(value);
  if (m) return Number(m[1]);
  return null;
}

/** The Overview §01 deadline-strip note: "the nearest deadline is weight
 * 700, the rest 400" — a group rule across the strip's 4 cells that a
 * single-selector check can't express. DEC-611's wave-2 amendment made
 * nearest-deadline emphasis a SET: a tie marks every cell sharing the
 * minimum displayed value, never an arbitrary first-wins pick (see
 * app/src/pages/overview/rows.test.ts:180-189). So this evaluator ranks
 * every cell's displayed value (parseDeadlineRank) and requires: every
 * cell at the minimum rank reads weight 700, every cell NOT at the
 * minimum rank reads weight 400 (700 only allowed exactly at the tied
 * minimum — a cell at 700 that isn't at the minimum still fails), and
 * when no cell has a set value at all, no cell may read 700. */
export function evaluateDeadlineNearestWeights(cells: readonly DeadlineNearestCell[]): {
  ok: boolean;
  failureReason?: string;
} {
  const reasons: string[] = [];
  const ranks = cells.map((c) => parseDeadlineRank(c.value));
  const setRanks = ranks.filter((r): r is number => r !== null);
  const minRank = setRanks.length > 0 ? Math.min(...setRanks) : null;

  const nearestCount = cells.filter((c) => c.weight === 700).length;
  if (minRank === null && nearestCount > 0) {
    reasons.push(`no deadline is set, expected 0 cells at weight 700, observed ${nearestCount}`);
  }
  if (minRank !== null && nearestCount === 0) {
    reasons.push(`expected at least 1 cell at weight 700 (minimum deadline value present), observed 0`);
  }

  cells.forEach((c, i) => {
    const isAtMinimum = minRank !== null && ranks[i] === minRank;
    if (isAtMinimum && c.weight !== 700) {
      reasons.push(`cell at the minimum deadline value ("${c.value}") reads weight ${c.weight} !== expected 700`);
    }
    if (!isAtMinimum && c.weight !== 400) {
      reasons.push(`non-minimum cell ("${c.value}", weight ${c.weight}) must read weight 400${c.weight === 700 ? " (a non-nearest cell must not read 700)" : ""}`);
    }
  });

  return { ok: reasons.length === 0, failureReason: reasons.length > 0 ? reasons.join("; ") : undefined };
}

/** /admin/overview desktop key-role table (DEC-643): the five roles named in
 * the tokenisation task plus the deadline-strip group rule, expressed as one
 * entry per measured selector. `.chq-overview-deadline-value` (no
 * `.chq-overview-deadline-nearest` modifier) covers the 3 non-nearest cells;
 * the nearest cell is measured separately by role/selector below and the
 * group weight rule is checked by evaluateDeadlineNearestWeights over all 4
 * cells' observed weights (wired in scripts/render-sweep.ts). */
export const OVERVIEW_TYPE_ROLES: readonly TypeRoleEntry[] = [
  { selector: ".chq-overview-headline", role: "overview-headline", expected: { fontSizePx: 44, fontWeight: 700, letterSpacingEm: -0.042 } },
  { selector: ".chq-overview-section-label", role: "section-label", expected: { fontSizePx: 11, fontWeight: 700, letterSpacingEm: 0.12 } },
  { selector: ".chq-overview-deadline-label", role: "deadline-label", expected: { fontSizePx: 10, fontWeight: 700, letterSpacingEm: 0.12 } },
  {
    selector: ".chq-overview-deadline-value:not(.chq-overview-deadline-nearest)",
    role: "deadline-value",
    expected: { fontSizePx: 30, fontWeight: 400 },
  },
  {
    selector: ".chq-overview-deadline-value.chq-overview-deadline-nearest",
    role: "deadline-value-nearest",
    expected: { fontSizePx: 30, fontWeight: 700 },
  },
  { selector: ".chq-overview-row-title", role: "row-title", expected: { fontWeight: 600, letterSpacingEm: -0.015 } },
] as const;

/** Renders a PASS/FAIL table for the collected type-role results, one line
 * per selector (mirrors formatFontFloorTable's shape). */
export function formatTypeRoleTable(results: readonly TypeRoleResult[]): string {
  const selectorWidth = Math.max(...results.map((r) => r.selector.length), "selector".length);
  const roleWidth = Math.max(...results.map((r) => r.role.length), "role".length);
  const lines: string[] = [];
  lines.push(`${"selector".padEnd(selectorWidth)}  ${"role".padEnd(roleWidth)}  status`);
  for (const r of results) {
    const mark = r.ok ? "PASS" : "FAIL";
    const detail = r.ok ? "" : `  (${r.failureReason})`;
    lines.push(`${r.selector.padEnd(selectorWidth)}  ${r.role.padEnd(roleWidth)}  ${mark}${detail}`);
  }
  return lines.join("\n");
}

/** True if every type-role result passed; kept for symmetry with
 * allFontFloorPassed even though TYPE_ROLE_BLOCKING keeps this out of the
 * gate's exit code for now. */
export function allTypeRolePassed(results: readonly TypeRoleResult[]): boolean {
  return results.every((r) => r.ok);
}

/** Summary line: "N/M type-role checks passed". */
export function typeRoleSummaryLine(results: readonly TypeRoleResult[]): string {
  const passed = results.filter((r) => r.ok).length;
  return `${passed}/${results.length} type-role checks passed`;
}

// ---------------------------------------------------------------------------
// DEC-409 B8 interaction-state pass (wave-35 amendment): the three
// deterministically measurable states from docs/design/DESIGN-RULINGS.md
// §B8 — focus, hover, disabled — measured live via getComputedStyle in
// scripts/render-sweep.ts rather than proven only by a stylesheet source
// scan (test/control-class-conformance.test.ts, test/state-band-inset.scan.
// test.ts stay in place for their own regression role; a passing source
// scan proves intent, not that the cascade actually renders it — see the
// settings-panel cascade-defeat precedent DEC-409's amendment names).
// Advisory (INTERACTION_STATE_BLOCKING false) until a run reads all-PASS,
// same DEC-387 flip rule as FONT_FLOOR_BLOCKING/TYPE_ROLE_BLOCKING above.
// ---------------------------------------------------------------------------

export const INTERACTION_STATE_BLOCKING = false;

export type InteractionStateKind = "focus" | "hover" | "disabled";

/** Only the properties relevant to a given check's kind are set; only
 * properties present on `expected` are compared (same "only measured
 * properties can fail" convention as TypeRoleExpected/evaluateTypeRoleResult). */
export interface InteractionStateExpected {
  readonly outlineWidthPx?: number;
  readonly outlineStyle?: string;
  readonly outlineColorHex?: string;
  readonly outlineOffsetPx?: number;
  readonly backgroundColorHex?: string;
  readonly colorHex?: string;
  /** DEC-409/§B8's hover "no shift": the element's own box (y, height) must
   * read identically before and after the hover interaction. */
  readonly noLayoutShift?: boolean;
}

export interface InteractionStateObserved {
  readonly outlineWidthPx?: number;
  readonly outlineStyle?: string;
  readonly outlineColorHex?: string;
  readonly outlineOffsetPx?: number;
  readonly backgroundColorHex?: string;
  readonly colorHex?: string;
  readonly boxBefore?: { y: number; height: number };
  readonly boxAfter?: { y: number; height: number };
}

export interface InteractionStateEntry {
  readonly kind: InteractionStateKind;
  readonly path: string;
  readonly selector: string;
  readonly role: string;
  readonly expected: InteractionStateExpected;
  /** DEC-409 wave-29 amendment: the browser viewport this row must be
   * measured at. Some routes render a structurally different component
   * tree per persona/viewport (the public CFP wizard's step-next button
   * is display:none above 700px width; `/admin/review/plans/:id` renders
   * PlanEditor for an organizer visit but ReviewerQueue for a reviewer
   * visit of the SAME path) — a probe that ignores viewport/persona and
   * matches on path alone can visit a context where the target element
   * cannot exist BY CONSTRUCTION, which is an instrument defect, not a
   * product defect. Every instrument-blocked reason string names this
   * viewport so a reader can tell "genuinely missing" from "wrong window
   * to look through" at a glance. */
  readonly viewport: { readonly width: number; readonly height: number };
  /** DEC-426 wave-29 amendment: the RouteManifestEntry persona this row
   * must be measured under, disambiguating routes whose path is shared
   * across two structurally different component trees (see `viewport`
   * doc above). The check only runs for the manifest visit whose
   * `entry.role` matches this field. */
  readonly personaRole: RouteManifestEntry["role"];
}

export interface InteractionStateResult {
  kind: InteractionStateKind;
  path: string;
  selector: string;
  role: string;
  ok: boolean;
  failureReason?: string;
  observed: InteractionStateObserved;
  expected: InteractionStateExpected;
}

const BOX_SHIFT_TOLERANCE_PX = 0.5;

/** Pure, DOM-free comparison of one interaction-state entry's observed
 * getComputedStyle/box reading against its expected values — mirrors
 * evaluateTypeRoleResult's shape (only the properties present on `expected`
 * are checked). The failure message is always prefixed with the entry's
 * selector so a FAIL row names the exact element that missed. */
export function evaluateInteractionState(
  entry: InteractionStateEntry,
  observed: InteractionStateObserved,
): InteractionStateResult {
  const { expected } = entry;
  const reasons: string[] = [];

  if (expected.outlineWidthPx !== undefined) {
    if (observed.outlineWidthPx === undefined || Number.isNaN(observed.outlineWidthPx)) {
      reasons.push(`outline-width not measured (expected ${expected.outlineWidthPx}px)`);
    } else if (observed.outlineWidthPx !== expected.outlineWidthPx) {
      reasons.push(`outline-width ${observed.outlineWidthPx}px !== expected ${expected.outlineWidthPx}px`);
    }
  }

  if (expected.outlineStyle !== undefined) {
    if (observed.outlineStyle === undefined) {
      reasons.push(`outline-style not measured (expected ${expected.outlineStyle})`);
    } else if (observed.outlineStyle !== expected.outlineStyle) {
      reasons.push(`outline-style ${observed.outlineStyle} !== expected ${expected.outlineStyle}`);
    }
  }

  if (expected.outlineColorHex !== undefined) {
    if (observed.outlineColorHex === undefined) {
      reasons.push(`outline-color not measured (expected ${expected.outlineColorHex})`);
    } else if (observed.outlineColorHex.toUpperCase() !== expected.outlineColorHex.toUpperCase()) {
      reasons.push(`outline-color ${observed.outlineColorHex} !== expected ${expected.outlineColorHex}`);
    }
  }

  if (expected.outlineOffsetPx !== undefined) {
    if (observed.outlineOffsetPx === undefined || Number.isNaN(observed.outlineOffsetPx)) {
      reasons.push(`outline-offset not measured (expected ${expected.outlineOffsetPx}px)`);
    } else if (observed.outlineOffsetPx !== expected.outlineOffsetPx) {
      reasons.push(`outline-offset ${observed.outlineOffsetPx}px !== expected ${expected.outlineOffsetPx}px`);
    }
  }

  if (expected.backgroundColorHex !== undefined) {
    if (observed.backgroundColorHex === undefined) {
      reasons.push(`background-color not measured (expected ${expected.backgroundColorHex})`);
    } else if (observed.backgroundColorHex.toUpperCase() !== expected.backgroundColorHex.toUpperCase()) {
      reasons.push(`background-color ${observed.backgroundColorHex} !== expected ${expected.backgroundColorHex}`);
    }
  }

  if (expected.colorHex !== undefined) {
    if (observed.colorHex === undefined) {
      reasons.push(`color not measured (expected ${expected.colorHex})`);
    } else if (observed.colorHex.toUpperCase() !== expected.colorHex.toUpperCase()) {
      reasons.push(`color ${observed.colorHex} !== expected ${expected.colorHex}`);
    }
  }

  if (expected.noLayoutShift) {
    if (!observed.boxBefore || !observed.boxAfter) {
      reasons.push("element box not measured before/after hover");
    } else if (
      Math.abs(observed.boxBefore.y - observed.boxAfter.y) > BOX_SHIFT_TOLERANCE_PX ||
      Math.abs(observed.boxBefore.height - observed.boxAfter.height) > BOX_SHIFT_TOLERANCE_PX
    ) {
      reasons.push(
        `element box shifted on hover: before y=${observed.boxBefore.y},h=${observed.boxBefore.height} ` +
          `!== after y=${observed.boxAfter.y},h=${observed.boxAfter.height}`,
      );
    }
  }

  return {
    kind: entry.kind,
    path: entry.path,
    selector: entry.selector,
    role: entry.role,
    ok: reasons.length === 0,
    failureReason: reasons.length > 0 ? `${entry.selector}: ${reasons.join("; ")}` : undefined,
    observed,
    expected,
  };
}

/** DEC-389-style FAIL row for an interaction-state check whose in-page
 * measurement threw (e.g. the target selector never resolved) — reported as
 * instrument-blocked rather than a false empty observation. */
export function interactionStateErrorResult(
  entry: InteractionStateEntry,
  message: string,
): InteractionStateResult {
  return {
    kind: entry.kind,
    path: entry.path,
    selector: entry.selector,
    role: entry.role,
    ok: false,
    // DEC-409 wave-29 amendment: name the viewport this row measured at,
    // so an instrument-blocked reason can be told apart from a genuine
    // markup defect without re-deriving which window the probe used.
    failureReason: `${entry.selector}: instrument-blocked (viewport ${entry.viewport.width}x${entry.viewport.height}, persona ${entry.personaRole}): ${message}`,
    observed: {},
    expected: entry.expected,
  };
}

/** Renders a PASS/FAIL table for the collected interaction-state results,
 * one line per check (mirrors formatTypeRoleTable's shape). */
export function formatInteractionStateTable(results: readonly InteractionStateResult[]): string {
  const selectorWidth = Math.max(...results.map((r) => r.selector.length), "selector".length);
  const roleWidth = Math.max(...results.map((r) => r.role.length), "role".length);
  const lines: string[] = [];
  lines.push(`${"selector".padEnd(selectorWidth)}  ${"role".padEnd(roleWidth)}  kind      status`);
  for (const r of results) {
    const mark = r.ok ? "PASS" : "FAIL";
    const detail = r.ok ? "" : `  (${r.failureReason})`;
    lines.push(`${r.selector.padEnd(selectorWidth)}  ${r.role.padEnd(roleWidth)}  ${r.kind.padEnd(8)}  ${mark}${detail}`);
  }
  return lines.join("\n");
}

/** True if every interaction-state result passed; kept for symmetry with
 * allTypeRolePassed even though INTERACTION_STATE_BLOCKING keeps this out of
 * the gate's exit code for now. */
export function allInteractionStatesPassed(results: readonly InteractionStateResult[]): boolean {
  return results.every((r) => r.ok);
}

/** Summary line: "N/M interaction-state checks passed". */
export function interactionStateSummaryLine(results: readonly InteractionStateResult[]): string {
  const passed = results.filter((r) => r.ok).length;
  return `${passed}/${results.length} interaction-state checks passed`;
}

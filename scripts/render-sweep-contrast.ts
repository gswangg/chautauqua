// DEC-426: WCAG AA contrast render-sweep pass, own module (advisory).
//
// docs/design/README.md and eval-findings.md:51 name WCAG AA contrast as the
// THIRD render-sweep mandate invariant alongside DEC-393's 44px tap-target
// pass and DEC-421's 10px type-floor pass. This module is the pure,
// unit-testable half (luminance/ratio math + PASS/FAIL evaluation/
// formatting); the in-page measurement itself stays INLINE in
// scripts/render-sweep.ts's page.evaluate callback (DEC-411 — a named
// closure serialised across the Playwright boundary breaks under tsx's
// esbuild keepNames rewrite), never imported from here.
//
// Desktop-only (see scripts/render-sweep.ts's visitRoute), never restructures
// render-sweep-lib.ts.

/** DEC-387 flip rule (verbatim), reused here per DEC-426: "it becomes true in
 * the wave after the pass first reads all-PASS." w13-a fixed the two named
 * DEC-430 offenders (forms drag glyph, public track chip) but unmasked a
 * third, previously-unreported offender on /admin/submissions/forms (td text
 * in --chq-disabled, ratio 3.06 against paper), which DEC-430 did not name
 * and that task did not scope in — that run read 41/42, not all-PASS
 * (docs/verification-log/task-w13-a-render-sweep-stage1.md), and every
 * intervening run (w14-d, w15-e) re-confirmed the same single offender
 * unfixed. DEC-444 (task-w16-a) re-pointed its two declaration sites —
 * `.chq-forms-field-locked` (app/src/styles.css) and
 * `.chq-forms-settings-title` (app/src/pages/forms/forms.css) — from
 * `var(--chq-disabled)` to `var(--chq-muted)` (6.28:1 against paper, well
 * above the 4.5:1 AA minimum), WITHOUT changing --chq-disabled itself (then
 * #8E8A7A, still WCAG-exempt for genuinely disabled controls; DEC-436's
 * wave-25 amendment later darkened that token to #7D7869). This lane's
 * own render-sweep run then read 42/42 all-PASS
 * (docs/verification-log/task-w16-a-build-test-stage1.md), so per DEC-436
 * ("flip only if your own run reads all-PASS") CONTRAST_BLOCKING now flips
 * to true. */
export const CONTRAST_BLOCKING = true;

/** DEC-426 wave-36 amendment (task-w36-e, closing the task-w35-b instrument
 * gap): the specific selector task-w29-d credited a contrast PASS to
 * (app/src/pages/speakers/speakers.css:405) but that no run of this gate
 * ever enumerated by name — every route's contrast measurement now checks
 * for this selector explicitly and publishes its own ratio/PASS-FAIL as a
 * `NAMED-PAIR` note, independent of whether it happens to be that route's
 * global-minimum offender. */
export const NAMED_CONTRAST_SELECTOR = ".chq-participation-menu-caret";

/** WCAG AA minimum contrast ratio for normal text. */
export const CONTRAST_MIN_RATIO = 4.5;

/** WCAG AA minimum contrast ratio for large text (>=24px, or >=18.66px at
 * font-weight >= 700). */
export const CONTRAST_MIN_RATIO_LARGE = 3;

/** WCAG relative luminance of an sRGB colour, each channel 0-255. */
export function relativeLuminance(rgb: [number, number, number]): number {
  const channel = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = rgb;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two sRGB colours (always >= 1). */
export function contrastRatio(fg: [number, number, number], bg: [number, number, number]): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export interface ContrastRouteEntry {
  readonly path: string;
  readonly role: string;
}

/** Raw in-page measurement: the smallest observed foreground/background
 * contrast ratio (against its applicable threshold) among elements with a
 * non-empty direct text node and a non-zero rendered box, or null if the
 * page has no such elements. */
export interface ContrastObservation {
  minRatio: number | null;
  /** Up to 3 structural descriptors (tag + up to 3 classes + the ratio and
   * the two colours, never text content — DEC-401 convention) for elements
   * under their applicable threshold, lowest ratio first. */
  offenders: string[];
  /** DEC-426 wave-29 amendment: same descriptor shape as `offenders`, but for
   * elements under threshold whose fg/bg pair is the `--chq-disabled` /
   * `--chq-disabled-bg` token pair (#7D7869 on #DDD8C8) — an inactive
   * component, exempt under WCAG 2.1 SC 1.4.3 ("Incidental" text and
   * "Inactive User Interface Components have no contrast requirement"). Kept
   * OUT of `offenders` (so it never fails the gate) but never silently
   * dropped either — evaluateContrast records it as its own exemption row. */
  exempted: string[];
  /** DEC-426 wave-36 amendment (task-w36-e): the `.chq-participation-menu-
   * caret` pair (DEC-830 wave-29's `color: inherit` fix,
   * app/src/pages/speakers/speakers.css:405) named by task-w29-d but never
   * enumerated by this instrument (task-w35-b found zero selector
   * references) — measured explicitly, independent of whether it happens
   * to be this route's global-minimum offender, so its ratio is always
   * published when the element is present. `null` when the selector isn't
   * on the page at all. */
  namedPair?: { descriptor: string; ratio: number; ok: boolean } | null;
}

export interface ContrastResult {
  path: string;
  role: string;
  minRatio: number | null;
  ok: boolean;
  failureReason?: string;
  /** DEC-426 wave-29 amendment: set whenever this route measured at least
   * one exempted (disabled-token) pair — printed regardless of `ok`, so an
   * exemption is always recorded, never a silent pass and never a FAIL. */
  exemptNote?: string;
  /** DEC-426 wave-36 amendment (task-w36-e): `.chq-participation-menu-caret`
   * ratio + PASS/FAIL, printed whenever the element is present on the
   * route regardless of the route's overall `ok`. */
  namedPairNote?: string;
}

/** Evaluates one route's contrast observation. A page with no measurable
 * text (minRatio null) passes vacuously, same convention as
 * evaluateFontFloor/evaluateMobileRoute's null cases. The applicable
 * threshold comparison already happened in-page (per-element, since large
 * vs. normal text differ); a non-null minRatio below any applicable
 * threshold is surfaced via the offenders list. Exempted (disabled-token)
 * pairs never contribute to `offenders`/`ok` but are always surfaced via
 * `exemptNote`, citing the WCAG rule that exempts them. */
export function evaluateContrast(entry: ContrastRouteEntry, observed: ContrastObservation): ContrastResult {
  const reasons: string[] = [];
  if (observed.offenders.length > 0) {
    reasons.push(`contrast below WCAG AA threshold — worst: ${observed.offenders.join(" | ")}`);
  }
  const exemptNote =
    observed.exempted.length > 0
      ? `EXEMPT-BY-RULE (WCAG 2.1 SC 1.4.3, inactive component): ${observed.exempted.join(" | ")}`
      : undefined;
  let namedPairNote: string | undefined;
  if (observed.namedPair) {
    const mark = observed.namedPair.ok ? "PASS" : "FAIL";
    namedPairNote = `NAMED-PAIR ${NAMED_CONTRAST_SELECTOR}: ${observed.namedPair.descriptor} ${mark}`;
    if (!observed.namedPair.ok) {
      reasons.push(`named pair ${NAMED_CONTRAST_SELECTOR} below WCAG AA threshold — ${observed.namedPair.descriptor}`);
    }
  }
  return {
    path: entry.path,
    role: entry.role,
    minRatio: observed.minRatio,
    ok: reasons.length === 0,
    failureReason: reasons.length > 0 ? reasons.join("; ") : undefined,
    exemptNote,
    namedPairNote,
  };
}

/** DEC-389-style FAIL row for a route whose in-page measurement threw —
 * reported as instrument-blocked rather than recording a false minRatio. */
export function contrastErrorResult(entry: ContrastRouteEntry, message: string): ContrastResult {
  return {
    path: entry.path,
    role: entry.role,
    minRatio: null,
    ok: false,
    failureReason: `instrument-blocked: ${message}`,
  };
}

/** True if every contrast result passed; kept for symmetry with
 * allPassed/allFontFloorPassed even though CONTRAST_BLOCKING keeps this out
 * of the gate's exit code for now. */
export function allContrastPassed(results: readonly ContrastResult[]): boolean {
  return results.every((r) => r.ok);
}

/** Renders a PASS/FAIL table for the collected contrast results, one line
 * per route (mirrors formatFontFloorTable's shape). */
export function formatContrastTable(results: readonly ContrastResult[]): string {
  const pathWidth = Math.max(...results.map((r) => r.path.length), "path".length);
  const roleWidth = Math.max(...results.map((r) => r.role.length), "role".length);
  const lines: string[] = [];
  lines.push(`${"path".padEnd(pathWidth)}  ${"role".padEnd(roleWidth)}  minRatio  status`);
  for (const r of results) {
    const mark = r.ok ? "PASS" : "FAIL";
    const detail = r.ok ? "" : `  (${r.failureReason})`;
    const exemptDetail = r.exemptNote ? `  [${r.exemptNote}]` : "";
    const namedPairDetail = r.namedPairNote ? `  [${r.namedPairNote}]` : "";
    const ratioStr = r.minRatio === null ? "-" : r.minRatio.toFixed(2);
    lines.push(
      `${r.path.padEnd(pathWidth)}  ${r.role.padEnd(roleWidth)}  ${ratioStr.padStart(8)}  ${mark}${detail}${exemptDetail}${namedPairDetail}`,
    );
  }
  return lines.join("\n");
}

/** Summary line: "N/M contrast checks passed". */
export function formatContrastSummary(results: readonly ContrastResult[]): string {
  const passed = results.filter((r) => r.ok).length;
  return `${passed}/${results.length} contrast checks passed`;
}

// DEC-919 w7-de: 390 sibling-overlap detector -- the defect class every
// existing render-sweep instrument is structurally blind to. Verified live:
// on the Submissions detail page at 390 the speaker byline
// (`.chq-detail-byline`, top 285, height 21) and the session's date/room
// link (top 292, height 15) render superimposed at the same `left:16`, as
// illegible overlapping text -- desktop-clean, zero document overflow,
// no tap-floor breach, no frame-citation contradiction. The cause:
// `.chq-detail-placement`'s `margin: -1rem 0 1.25rem` tucks the link under
// the h1, correct only while the byline is `display:none`, wrong the
// instant a `<=700px` block REVEALS the byline between them.
//
// Overflow measures the DOCUMENT against the viewport; the tap floor
// measures ONE box's size. Neither predicate can express a relationship
// BETWEEN two boxes. This module does: pairwise rectangle intersection over
// text-bearing sibling boxes measured at 390.
//
// Pure, no node:/playwright imports -- same split scripts/render-sweep-lib.ts
// already uses, so it is testable under plain vitest (see
// test/render-sweep-overlap-lib.test.ts). scripts/render-sweep.ts collects
// the OverlapBox[] via a single page.evaluate and hands it to findOverlaps.

/** One measured box on the page at 390x844. `position` and `zIndex` are
 * carried as measured INPUTS (from getComputedStyle in the browser), never
 * re-derived here, so this module stays pure and DOM-free. */
export interface OverlapBox {
  selector: string;
  text: string;
  top: number;
  left: number;
  width: number;
  height: number;
  position: string;
  zIndex: string;
}

/** One pair of text-bearing boxes whose rects intersect by more than
 * `tolerancePx` on both axes, with neither box containing the other and
 * neither box a designed overlay (absolute/fixed position or a non-auto
 * z-index). */
export interface OverlapOffender {
  a: OverlapBox;
  b: OverlapBox;
  /** Width of the intersected rectangle, px. */
  overlapWidth: number;
  /** Height of the intersected rectangle, px. */
  overlapHeight: number;
  /** overlapWidth * overlapHeight, px^2. */
  overlapAreaPx2: number;
}

export interface FindOverlapsOptions {
  /** Absorbs 1px seams and sub-pixel rounding: an intersection whose width
   * or height is <= tolerancePx is NOT reported (it is a seam, not an
   * overlap). An intersection that exceeds tolerancePx on BOTH axes is
   * reported. */
  tolerancePx: number;
}

function right(box: OverlapBox): number {
  return box.left + box.width;
}

function bottom(box: OverlapBox): number {
  return box.top + box.height;
}

/** True if `text`, trimmed, is non-empty. */
function hasText(box: OverlapBox): boolean {
  return box.text.trim().length > 0;
}

/** DEC-919: a box positioned by design (absolute/fixed, or a z-index the
 * author explicitly set) is an overlay by construction -- reporting it as a
 * "sibling" overlap would just be re-discovering deliberate layering
 * (tooltips, badges, sticky headers). Excluded entirely: any pair involving
 * such a box is skipped, not just re-labelled. */
function isDesignedOverlay(box: OverlapBox): boolean {
  return box.position === "absolute" || box.position === "fixed" || box.zIndex !== "auto";
}

/** True if `outer` fully encloses `inner` (within `tolerancePx`) -- the
 * ordinary, legitimate case of a parent box enclosing its own child text
 * node. Such pairs are never offenders: containment is not overlap. */
function contains(outer: OverlapBox, inner: OverlapBox, tolerancePx: number): boolean {
  return (
    outer.left - tolerancePx <= inner.left &&
    outer.top - tolerancePx <= inner.top &&
    right(outer) + tolerancePx >= right(inner) &&
    bottom(outer) + tolerancePx >= bottom(inner)
  );
}

/** Pairwise rectangle intersection over TEXT-BEARING boxes only. A pair is
 * reported iff: both boxes have non-empty trimmed text; neither box
 * contains the other; neither box is a designed overlay
 * (position:absolute|fixed or a non-auto z-index); and the intersected
 * rectangle's width AND height both exceed `tolerancePx`. */
export function findOverlaps(
  boxes: readonly OverlapBox[],
  opts: FindOverlapsOptions,
): OverlapOffender[] {
  const { tolerancePx } = opts;
  const candidates = boxes.filter((b) => hasText(b) && !isDesignedOverlay(b));
  const offenders: OverlapOffender[] = [];
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      // Safe: i in [0,length) and j in (i,length) by the loop bounds above.
      const a = candidates[i]!;
      const b = candidates[j]!;
      if (contains(a, b, tolerancePx) || contains(b, a, tolerancePx)) continue;

      const ix1 = Math.max(a.left, b.left);
      const iy1 = Math.max(a.top, b.top);
      const ix2 = Math.min(right(a), right(b));
      const iy2 = Math.min(bottom(a), bottom(b));
      const overlapWidth = ix2 - ix1;
      const overlapHeight = iy2 - iy1;
      if (overlapWidth <= tolerancePx || overlapHeight <= tolerancePx) continue;

      offenders.push({
        a,
        b,
        overlapWidth: Math.round(overlapWidth),
        overlapHeight: Math.round(overlapHeight),
        overlapAreaPx2: Math.round(overlapWidth * overlapHeight),
      });
    }
  }
  return offenders;
}

/** One route's overlap reading: mirrors MobileRouteResult's per-route
 * pass/fail shape so the console output reads like the rest of the sweep. */
export interface OverlapRouteResult {
  path: string;
  offenders: readonly OverlapOffender[];
  ok: boolean;
  failureReason?: string;
}

function describeOffender(o: OverlapOffender): string {
  return (
    `${o.a.selector} [top=${o.a.top} left=${o.a.left} w=${o.a.width} h=${o.a.height}]` +
    ` overlaps ${o.b.selector} [top=${o.b.top} left=${o.b.left} w=${o.b.width} h=${o.b.height}]` +
    ` (${o.overlapWidth}x${o.overlapHeight}px, area=${o.overlapAreaPx2}px^2)`
  );
}

/** Evaluates one route's collected boxes: PASS iff findOverlaps reports zero
 * offenders. */
export function evaluateOverlapRoute(
  path: string,
  boxes: readonly OverlapBox[],
  opts: FindOverlapsOptions,
): OverlapRouteResult {
  const offenders = findOverlaps(boxes, opts);
  const ok = offenders.length === 0;
  return {
    path,
    offenders,
    ok,
    failureReason: ok ? undefined : offenders.map(describeOffender).join("; "),
  };
}

/** True if every route's overlap reading passed. */
export function allOverlapsPassed(results: readonly OverlapRouteResult[]): boolean {
  return results.every((r) => r.ok);
}

/** Renders a PASS/FAIL table for the collected overlap route results, one
 * line per route -- mirrors formatMobileResultsTable's shape. */
export function formatOverlapTable(results: readonly OverlapRouteResult[]): string {
  const pathWidth = Math.max(...results.map((r) => r.path.length), "path".length);
  const lines: string[] = [];
  lines.push(`${"path".padEnd(pathWidth)}  offenders  status`);
  for (const r of results) {
    const mark = r.ok ? "PASS" : "FAIL";
    const detail = r.ok ? "" : `  (${r.failureReason})`;
    lines.push(`${r.path.padEnd(pathWidth)}  ${String(r.offenders.length).padStart(9)}  ${mark}${detail}`);
  }
  return lines.join("\n");
}

/** Summary line: "N/M routes had zero sibling overlaps". */
export function formatOverlapSummary(results: readonly OverlapRouteResult[]): string {
  const passed = results.filter((r) => r.ok).length;
  return `${passed}/${results.length} routes had zero sibling overlaps`;
}

/** 1px slack for sub-pixel layout rounding across engines, same convention
 * as OVERFLOW_TOLERANCE_PX in render-sweep-lib.ts. */
export const OVERLAP_TOLERANCE_PX = 1;

/** DEC-919 w7-de: landing state. This pass is brand new and has never been
 * run against the live app (this wave built the pure lib + its wiring only;
 * `scripts/render-sweep.ts`'s own docs forbid booting a server or running
 * the gate from a worker task). Lands ADVISORY (false) so a first live
 * reading -- which may surface the verified byline/schedule-link defect
 * itself, plus any other sibling-overlap this repo has never measured
 * before -- does not retroactively fail a gate no wave has read green.
 * Flip rule mirrors DEC-387/ADMIN_MOBILE_PASS_BLOCKING's own precedent: a
 * later wave flips this true once a reading of the full route population
 * comes back all-PASS. */
export const OVERLAP_PASS_BLOCKING = false;

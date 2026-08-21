// DEC-919 w7-de: unit tests for scripts/render-sweep-overlap-lib.ts's
// pairwise sibling-overlap detector. Every case here is FABRICATED geometry
// -- never a live product measurement -- exercising each branch the module
// documents.

import { describe, expect, it } from "vitest";

import {
  allOverlapsPassed,
  evaluateOverlapRoute,
  findOverlaps,
  formatOverlapTable,
  type OverlapBox,
  OVERLAP_TOLERANCE_PX,
} from "../scripts/render-sweep-overlap-lib";

/** Base box with sane static-layering defaults; individual fields overridden
 * per case. */
function box(overrides: Partial<OverlapBox>): OverlapBox {
  return {
    selector: "div.chq-box",
    text: "some text",
    top: 0,
    left: 0,
    width: 100,
    height: 20,
    position: "static",
    zIndex: "auto",
    ...overrides,
  };
}

describe("findOverlaps", () => {
  it("POSITIVE control: reproduces the byline/schedule-link geometry (reported)", () => {
    // .chq-detail-byline: top 285, height 21, left 16. Widths differ (and
    // neither range encloses the other's left+top+right+bottom) so this is
    // a genuine partial overlap, never containment -- the byline is
    // narrower than the byline's row but the link is wider still and
    // starts lower, so neither rect fully encloses the other.
    const byline = box({ selector: ".chq-detail-byline", text: "By Jane Speaker", top: 285, left: 16, width: 150, height: 21 });
    // schedule link: top 292, height 15, left 16
    const link = box({ selector: ".chq-detail-placement a", text: "Sat 2pm · Room A", top: 292, left: 16, width: 250, height: 15 });
    const offenders = findOverlaps([byline, link], { tolerancePx: OVERLAP_TOLERANCE_PX });
    expect(offenders).toHaveLength(1);
    expect(offenders[0]!.overlapWidth).toBeGreaterThan(OVERLAP_TOLERANCE_PX);
    expect(offenders[0]!.overlapHeight).toBeGreaterThan(OVERLAP_TOLERANCE_PX);
    expect([offenders[0]!.a.selector, offenders[0]!.b.selector]).toEqual(
      expect.arrayContaining([".chq-detail-byline", ".chq-detail-placement a"]),
    );
  });

  it("NEGATIVE control: cleanly stacked lines are not reported", () => {
    const first = box({ selector: ".line-a", top: 285, left: 16, height: 21 });
    const second = box({ selector: ".line-b", top: 310, left: 16, height: 15 });
    expect(findOverlaps([first, second], { tolerancePx: OVERLAP_TOLERANCE_PX })).toHaveLength(0);
  });

  it("parent/child containment is not reported", () => {
    const parent = box({ selector: ".chq-card", top: 0, left: 0, width: 300, height: 100 });
    const child = box({ selector: ".chq-card-title", top: 10, left: 10, width: 200, height: 20 });
    expect(findOverlaps([parent, child], { tolerancePx: OVERLAP_TOLERANCE_PX })).toHaveLength(0);
    // containment is symmetric in the check (order of args to findOverlaps
    // shouldn't matter)
    expect(findOverlaps([child, parent], { tolerancePx: OVERLAP_TOLERANCE_PX })).toHaveLength(0);
  });

  it("an absolutely-positioned overlay is excluded", () => {
    const base = box({ selector: ".chq-base", top: 0, left: 0, width: 200, height: 40 });
    const overlay = box({ selector: ".chq-badge", position: "absolute", top: 5, left: 5, width: 50, height: 20 });
    expect(findOverlaps([base, overlay], { tolerancePx: OVERLAP_TOLERANCE_PX })).toHaveLength(0);
  });

  it("a fixed-position overlay is excluded", () => {
    const base = box({ selector: ".chq-base", top: 0, left: 0, width: 200, height: 40 });
    const overlay = box({ selector: ".chq-sticky", position: "fixed", top: 5, left: 5, width: 50, height: 20 });
    expect(findOverlaps([base, overlay], { tolerancePx: OVERLAP_TOLERANCE_PX })).toHaveLength(0);
  });

  it("a non-auto z-index box is excluded even if statically positioned", () => {
    const base = box({ selector: ".chq-base", top: 0, left: 0, width: 200, height: 40 });
    const layered = box({ selector: ".chq-layer", zIndex: "2", top: 5, left: 5, width: 50, height: 20 });
    expect(findOverlaps([base, layered], { tolerancePx: OVERLAP_TOLERANCE_PX })).toHaveLength(0);
  });

  it("an empty-text box is excluded even when its rect overlaps", () => {
    const withText = box({ selector: ".chq-visible", top: 0, left: 0, width: 200, height: 40 });
    const empty = box({ selector: ".chq-spacer", text: "   ", top: 5, left: 5, width: 50, height: 20 });
    expect(findOverlaps([withText, empty], { tolerancePx: OVERLAP_TOLERANCE_PX })).toHaveLength(0);
  });

  it("tolerance boundary: an intersection of exactly tolerancePx is absorbed (not reported)", () => {
    const tolerancePx = 1;
    // top box: top 0, height 20 -> bottom 20. bottom box: top 19, height 20
    // -> vertical intersection = 20-19 = 1px = tolerancePx exactly.
    const top = box({ selector: ".chq-top", top: 0, left: 0, width: 100, height: 20 });
    const bottom = box({ selector: ".chq-bottom", top: 19, left: 0, width: 100, height: 20 });
    expect(findOverlaps([top, bottom], { tolerancePx })).toHaveLength(0);
  });

  it("tolerance boundary: an intersection of tolerancePx + 1 is reported", () => {
    const tolerancePx = 1;
    // vertical intersection = 20-18 = 2px = tolerancePx + 1.
    const top = box({ selector: ".chq-top", top: 0, left: 0, width: 100, height: 20 });
    const bottom = box({ selector: ".chq-bottom", top: 18, left: 0, width: 100, height: 20 });
    const offenders = findOverlaps([top, bottom], { tolerancePx });
    expect(offenders).toHaveLength(1);
    expect(offenders[0]!.overlapHeight).toBe(2);
  });
});

describe("evaluateOverlapRoute / allOverlapsPassed / formatOverlapTable", () => {
  it("passes a route with zero offenders and fails one with offenders", () => {
    const clean = evaluateOverlapRoute(
      "/clean",
      [box({ selector: ".a", top: 0, height: 20 }), box({ selector: ".b", top: 30, height: 20 })],
      { tolerancePx: OVERLAP_TOLERANCE_PX },
    );
    const dirty = evaluateOverlapRoute(
      "/dirty",
      [
        box({ selector: ".chq-detail-byline", top: 285, left: 16, width: 150, height: 21 }),
        box({ selector: ".chq-detail-placement a", top: 292, left: 16, width: 250, height: 15 }),
      ],
      { tolerancePx: OVERLAP_TOLERANCE_PX },
    );
    expect(clean.ok).toBe(true);
    expect(dirty.ok).toBe(false);
    expect(dirty.failureReason).toContain(".chq-detail-byline");

    expect(allOverlapsPassed([clean])).toBe(true);
    expect(allOverlapsPassed([clean, dirty])).toBe(false);

    const table = formatOverlapTable([clean, dirty]);
    expect(table).toContain("/clean");
    expect(table).toContain("PASS");
    expect(table).toContain("/dirty");
    expect(table).toContain("FAIL");
  });
});

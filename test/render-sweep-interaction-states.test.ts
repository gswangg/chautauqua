// DEC-409 wave-35 amendment: unit tests for the pure B8 interaction-state
// evaluator/formatter trio (scripts/render-sweep-lib.ts) — exact-match,
// near-miss and legible-failure-message-names-the-selector coverage, same
// shape as the evaluateFontFloor/evaluateTypeRoleResult tests in
// test/render-sweep-lib.test.ts. The Playwright driving side
// (scripts/render-sweep.ts's measureFocusState/measureHoverState/
// measureDisabledState) only runs under `npm run gate:render-sweep` (CI),
// not here.

import { describe, expect, it } from "vitest";

import {
  allInteractionStatesPassed,
  evaluateInteractionState,
  formatInteractionStateTable,
  interactionStateErrorResult,
  interactionStateSummaryLine,
  type InteractionStateEntry,
} from "../scripts/render-sweep-lib";

const FOCUS_ENTRY: InteractionStateEntry = {
  kind: "focus",
  path: "/submit/devflow-conf-2027",
  selector: ".chq-cfp-step-next",
  role: "cfp-primary-focus",
  expected: { outlineWidthPx: 2, outlineStyle: "solid", outlineColorHex: "#4E5C31", outlineOffsetPx: 2 },
};

const HOVER_ENTRY: InteractionStateEntry = {
  kind: "hover",
  path: "/admin/content",
  selector: ".chq-content-row",
  role: "content-row-hover",
  expected: { backgroundColorHex: "#EFEBDF", noLayoutShift: true },
};

const DISABLED_ENTRY: InteractionStateEntry = {
  kind: "disabled",
  path: "/admin/review/plans/seed_evaluation_plan_0001",
  selector: ".chq-review-field-disabled .chq-review-checkbox-label",
  role: "review-anonymize-disabled",
  expected: { colorHex: "#7D7869", backgroundColorHex: "#DDD8C8" },
};

describe("evaluateInteractionState — FOCUS", () => {
  it("passes on an exact match (2px solid olive, 2px offset)", () => {
    const result = evaluateInteractionState(FOCUS_ENTRY, {
      outlineWidthPx: 2,
      outlineStyle: "solid",
      outlineColorHex: "#4E5C31",
      outlineOffsetPx: 2,
    });
    expect(result.ok).toBe(true);
    expect(result.failureReason).toBeUndefined();
  });

  it("passes when the observed color case differs (hex comparison is case-insensitive)", () => {
    const result = evaluateInteractionState(FOCUS_ENTRY, {
      outlineWidthPx: 2,
      outlineStyle: "solid",
      outlineColorHex: "#4e5c31",
      outlineOffsetPx: 2,
    });
    expect(result.ok).toBe(true);
  });

  it("fails a near-miss 1px outline and names the selector", () => {
    const result = evaluateInteractionState(FOCUS_ENTRY, {
      outlineWidthPx: 1,
      outlineStyle: "solid",
      outlineColorHex: "#4E5C31",
      outlineOffsetPx: 2,
    });
    expect(result.ok).toBe(false);
    expect(result.failureReason).toContain(".chq-cfp-step-next");
    expect(result.failureReason).toContain("outline-width 1px !== expected 2px");
  });

  it("fails when no outline was measured at all (outline: none) and names the selector", () => {
    const result = evaluateInteractionState(FOCUS_ENTRY, {
      outlineWidthPx: 0,
      outlineStyle: "none",
      outlineOffsetPx: 2,
    });
    expect(result.ok).toBe(false);
    expect(result.failureReason).toContain(".chq-cfp-step-next");
    expect(result.failureReason).toContain("outline-style none !== expected solid");
    expect(result.failureReason).toContain("outline-color not measured (expected #4E5C31)");
  });
});

describe("evaluateInteractionState — HOVER", () => {
  it("passes on the exact background and an unchanged box", () => {
    const result = evaluateInteractionState(HOVER_ENTRY, {
      backgroundColorHex: "#EFEBDF",
      boxBefore: { y: 120, height: 44 },
      boxAfter: { y: 120, height: 44 },
    });
    expect(result.ok).toBe(true);
  });

  it("tolerates sub-pixel rounding noise in the box measurement", () => {
    const result = evaluateInteractionState(HOVER_ENTRY, {
      backgroundColorHex: "#EFEBDF",
      boxBefore: { y: 120.2, height: 44 },
      boxAfter: { y: 120.4, height: 44.1 },
    });
    expect(result.ok).toBe(true);
  });

  it("fails a near-miss background and names the selector", () => {
    const result = evaluateInteractionState(HOVER_ENTRY, {
      backgroundColorHex: "#EFEBDE",
      boxBefore: { y: 120, height: 44 },
      boxAfter: { y: 120, height: 44 },
    });
    expect(result.ok).toBe(false);
    expect(result.failureReason).toContain(".chq-content-row");
    expect(result.failureReason).toContain("background-color #EFEBDE !== expected #EFEBDF");
  });

  it("fails a layout shift on hover and names the selector with before/after values", () => {
    const result = evaluateInteractionState(HOVER_ENTRY, {
      backgroundColorHex: "#EFEBDF",
      boxBefore: { y: 120, height: 44 },
      boxAfter: { y: 122, height: 46 },
    });
    expect(result.ok).toBe(false);
    expect(result.failureReason).toContain(".chq-content-row");
    expect(result.failureReason).toContain("element box shifted on hover");
    expect(result.failureReason).toContain("before y=120,h=44");
    expect(result.failureReason).toContain("after y=122,h=46");
  });
});

describe("evaluateInteractionState — DISABLED", () => {
  it("passes on the exact disabled-register color+background", () => {
    const result = evaluateInteractionState(DISABLED_ENTRY, {
      colorHex: "#7D7869",
      backgroundColorHex: "#DDD8C8",
    });
    expect(result.ok).toBe(true);
  });

  it("fails a near-miss text color and names the selector", () => {
    const result = evaluateInteractionState(DISABLED_ENTRY, {
      colorHex: "#7D7868",
      backgroundColorHex: "#DDD8C8",
    });
    expect(result.ok).toBe(false);
    expect(result.failureReason).toContain(".chq-review-field-disabled .chq-review-checkbox-label");
    expect(result.failureReason).toContain("color #7D7868 !== expected #7D7869");
  });

  it("fails a missing background measurement and names the selector", () => {
    const result = evaluateInteractionState(DISABLED_ENTRY, { colorHex: "#7D7869" });
    expect(result.ok).toBe(false);
    expect(result.failureReason).toContain(".chq-review-field-disabled .chq-review-checkbox-label");
    expect(result.failureReason).toContain("background-color not measured (expected #DDD8C8)");
  });
});

describe("interactionStateErrorResult", () => {
  it("marks an instrument-blocked FAIL row naming the selector and the thrown message", () => {
    const result = interactionStateErrorResult(FOCUS_ENTRY, "selector never resolved: .chq-cfp-step-next");
    expect(result.ok).toBe(false);
    expect(result.failureReason).toContain(".chq-cfp-step-next");
    expect(result.failureReason).toContain("instrument-blocked");
  });
});

describe("allInteractionStatesPassed / interactionStateSummaryLine", () => {
  const passing = evaluateInteractionState(FOCUS_ENTRY, {
    outlineWidthPx: 2,
    outlineStyle: "solid",
    outlineColorHex: "#4E5C31",
    outlineOffsetPx: 2,
  });
  const failing = evaluateInteractionState(HOVER_ENTRY, {
    backgroundColorHex: "#EFEBDE",
    boxBefore: { y: 0, height: 0 },
    boxAfter: { y: 0, height: 0 },
  });

  it("allInteractionStatesPassed is true only when every result passed", () => {
    expect(allInteractionStatesPassed([passing])).toBe(true);
    expect(allInteractionStatesPassed([passing, failing])).toBe(false);
  });

  it("interactionStateSummaryLine reports N/M passed", () => {
    expect(interactionStateSummaryLine([passing, failing])).toBe("1/2 interaction-state checks passed");
    expect(interactionStateSummaryLine([passing])).toBe("1/1 interaction-state checks passed");
  });

  it("formatInteractionStateTable renders one PASS/FAIL line per result, naming the selector", () => {
    const table = formatInteractionStateTable([passing, failing]);
    expect(table).toContain(".chq-cfp-step-next");
    expect(table).toContain("PASS");
    expect(table).toContain(".chq-content-row");
    expect(table).toContain("FAIL");
  });
});

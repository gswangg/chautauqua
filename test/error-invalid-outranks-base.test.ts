// DEC-124 (wave-14 amendment): the no-red invalid-control marker
// (`.chq-field-invalid`) is USELESS unless it wins the CSS cascade against
// src/views/theme.ts's base `input[type=...], select, textarea { border:
// ...; padding: ... }` group -- (0,1,0) loses to (0,1,1) regardless of
// source order (an attribute selector counts as a class for specificity
// purposes), so a bare single-class selector draws the ordinary hairline
// border and never the 3px ink left edge. This test proves the fix
// (`.chq-field-invalid.chq-field-invalid`, doubled to (0,2,0)) actually
// outranks EVERY copy of theme.ts's base group, by specificity arithmetic,
// not by reading the CSS text and assuming order helps. It must fail if
// someone reverts the selector back to a single class.
import { describe, expect, it } from "vitest";
import { ERROR_STATES_CSS } from "../src/views/error-states.css";
import { THEME_CSS } from "../src/views/theme";

type Specificity = [number, number, number];

/** Minimal CSS specificity counter: [# of ID selectors, # of class/
 * attribute/pseudo-class selectors, # of element/pseudo-element
 * selectors]. Good enough for the plain selectors these two stylesheets
 * use (no :not(), no nesting) -- not a general CSS parser. */
function specificity(selector: string): Specificity {
  let a = 0;
  let b = 0;
  let c = 0;
  let rest = selector;

  rest = rest.replace(/::[-\w]+/g, () => {
    c += 1;
    return " ";
  });
  rest = rest.replace(/#[-\w]+/g, () => {
    a += 1;
    return " ";
  });
  rest = rest.replace(/\.[-\w]+/g, () => {
    b += 1;
    return " ";
  });
  rest = rest.replace(/\[[^\]]*\]/g, () => {
    b += 1;
    return " ";
  });
  rest = rest.replace(/:[-\w]+(\([^)]*\))?/g, () => {
    b += 1;
    return " ";
  });
  const elements = rest.match(/[a-zA-Z][a-zA-Z0-9-]*/g) ?? [];
  c += elements.length;

  return [a, b, c];
}

function isHigher(x: Specificity, y: Specificity): boolean {
  if (x[0] !== y[0]) return x[0] > y[0];
  if (x[1] !== y[1]) return x[1] > y[1];
  return x[2] > y[2];
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Extracts every `selectorGroup { body }` rule from CSS text, in source
 * order, WITHOUT merging duplicate selector groups -- unlike the parity
 * scan, this test cares that a selector group appears more than once. */
function extractRules(css: string): { selectorGroup: string; body: string }[] {
  const cleaned = stripComments(css);
  const rules: { selectorGroup: string; body: string }[] = [];
  const ruleRe = /([^{}`]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = ruleRe.exec(cleaned))) {
    const selectorGroup = (match[1] ?? "").trim().replace(/\s+/g, " ");
    const body = (match[2] ?? "").trim();
    if (!selectorGroup) continue;
    rules.push({ selectorGroup, body });
  }
  return rules;
}

const THEME_RULES = extractRules(THEME_CSS);
const ERROR_RULES = extractRules(ERROR_STATES_CSS);

// theme.ts's base "input[type=...], select, textarea" group: identified by
// SHAPE (several comma-separated `input[type=...]` arms alongside `select`/
// `textarea`), not by which properties a given copy happens to declare --
// the phone media-query copy (theme.ts:495) restates the exact same
// selector list to add `min-height` only, but it is still a live copy of
// the group an invalid input matches, and a future third copy of this
// selector list must not slip past this test unnoticed.
const BASE_INPUT_GROUPS = THEME_RULES.filter((rule) => {
  const arms = rule.selectorGroup.split(",").map((s) => s.trim());
  const inputTypeArms = arms.filter((arm) => /^input\[type=[-\w]+\]$/.test(arm));
  return (
    inputTypeArms.length >= 4 &&
    arms.some((arm) => arm === "select") &&
    arms.some((arm) => arm === "textarea")
  );
});

describe("DEC-124 (wave-14 amendment): .chq-field-invalid outranks theme.ts's base input group", () => {
  it("finds theme.ts's base input[type=...]/select/textarea group in BOTH its declaration sites", () => {
    // One at src/views/theme.ts:175-186 (base rule, sets border/padding),
    // one at src/views/theme.ts:495 (phone media query, restates the same
    // selector list). A future third copy would push this past 2 and fail
    // the exact-count assertion below.
    expect(BASE_INPUT_GROUPS.length).toBe(2);
  });

  it("finds the .chq-field-invalid rule that draws the 3px ink left edge", () => {
    const matches = ERROR_RULES.filter(
      (rule) =>
        rule.selectorGroup.includes("field-invalid") &&
        /border-left:\s*3px solid var\(--chq-ink\)/.test(rule.body),
    );
    expect(matches.length).toBe(1);
  });

  it("the invalid-control selector's specificity strictly outranks every arm of every copy of theme.ts's base input group", () => {
    const invalidRule = ERROR_RULES.find(
      (rule) =>
        rule.selectorGroup.includes("field-invalid") &&
        /border-left:\s*3px solid var\(--chq-ink\)/.test(rule.body),
    );
    if (!invalidRule) throw new Error("invalid-control rule not found");

    const invalidSpecificity = specificity(invalidRule.selectorGroup);

    // Fails loudly if someone reverts the selector back to a bare
    // `.chq-field-invalid` (0,1,0), which does NOT outrank an
    // `input[type=...]` base arm at (0,1,1).
    expect(BASE_INPUT_GROUPS.length).toBeGreaterThan(0);
    for (const group of BASE_INPUT_GROUPS) {
      for (const arm of group.selectorGroup.split(",")) {
        const armSpecificity = specificity(arm.trim());
        expect(
          isHigher(invalidSpecificity, armSpecificity),
          `"${invalidRule.selectorGroup}" [${invalidSpecificity}] must outrank "${arm.trim()}" [${armSpecificity}]`,
        ).toBe(true);
      }
    }
  });

  it("a single-class selector would NOT outrank the base group (sanity check on the specificity helper)", () => {
    const singleClass = specificity(".chq-field-invalid");
    const baseArm = specificity("input[type=search]");
    expect(isHigher(singleClass, baseArm)).toBe(false);
  });
});

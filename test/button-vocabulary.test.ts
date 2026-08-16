// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { THEME_CSS } from "../src/views/theme";

// DEC-689: the three button tiers (.chq-btn-primary / -secondary /
// -tertiary) are the ONLY button vocabulary. A tier class must ALWAYS win
// over a bare element selector (button[type=submit]) -- see theme.ts:244's
// old `.chq-btn-primary, button[type=submit]` rule, which made every
// tertiary submit button (portal Sign out, mandate item 40b) render filled
// because the bare selector's specificity (0,1,1) beat the tertiary tier's
// (0,1,0). This test locks: no tier-class selector list is ever combined
// with a bare element selector, exactly three tiers exist, and the base
// button rule (which also matches `.chq-btn`, per mandate item 40c so
// `<a class="chq-btn">` renders identically to `<button class="chq-btn">`)
// kills the underline.

const REPO_ROOT = join(__dirname, "..");
const THEME_TS = readFileSync(join(REPO_ROOT, "src/views/theme.ts"), "utf8");
const APP_CSS = readFileSync(join(REPO_ROOT, "app/src/styles.css"), "utf8");

const TIER_RE = /chq-btn-(primary|secondary|tertiary)/;

/** Split a CSS(-in-template-literal) blob into `{ selectorList, body }` rule
 * pairs. Good enough for the flat, non-nested rules button styling lives in
 * (no @media containing selectors we care about union incorrectly, since we
 * inspect each rule independently regardless of nesting depth). */
function extractRules(css: string): { selectors: string; body: string }[] {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: { selectors: string; body: string }[] = [];
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(noComments)) !== null) {
    rules.push({ selectors: (m[1] ?? "").trim(), body: m[2] ?? "" });
  }
  return rules;
}

describe("button vocabulary is exactly three tiers, tier class always wins (DEC-689)", () => {
  for (const [label, css] of [
    ["src/views/theme.ts", THEME_TS],
    ["app/src/styles.css", APP_CSS],
  ] as const) {
    describe(label, () => {
      const rules = extractRules(css);
      const tierRules = rules.filter((r) => TIER_RE.test(r.selectors));

      it("no selector list naming a tier class also contains a bare element selector", () => {
        const violations = tierRules
          .map((r) => r.selectors)
          .filter((selectors) =>
            selectors
              .split(",")
              .map((s) => s.trim())
              .some((s) => /^(button|input|a)(\[|$|:)/.test(s) && !TIER_RE.test(s) && !s.includes("."))
          );
        expect(violations, `bare element selector combined with a tier class in: ${violations.join(" | ")}`).toEqual(
          []
        );
      });

      it("exactly the ruled tier classes are defined (no unruled tier)", () => {
        const tierNames = new Set<string>();
        for (const rule of tierRules) {
          for (const part of rule.selectors.split(",")) {
            const found = part.match(/chq-btn-([a-z]+)/);
            if (found?.[1]) tierNames.add(found[1]);
          }
        }
        // DEC-689 ruled exactly three tiers; DEC-383 (V11 B8 amendment,
        // DESIGN-RULINGS.md B8 tier table row 4) superseded that for the SPA
        // sheet by adding the destructive-tertiary register
        // (.chq-btn-destructive-tertiary: link-style, --chq-destructive ink,
        // darkens on hover). No fifth tier is permitted anywhere.
        const expected =
          label === "app/src/styles.css"
            ? ["destructive", "primary", "secondary", "tertiary"]
            : ["primary", "secondary", "tertiary"];
        expect([...tierNames].sort()).toEqual(expected);
      });
    });
  }

  it("theme.ts: base button rule sets text-decoration: none and matches .chq-btn", () => {
    const rules = extractRules(THEME_TS);
    const base = rules.find(
      (r) => /(^|,)\s*\.chq-btn\s*(,|$)/.test(r.selectors) && /button/.test(r.selectors)
    );
    expect(base, "no base button rule matching both `button` and `.chq-btn` found in theme.ts").toBeTruthy();
    expect(base!.body).toMatch(/text-decoration:\s*none/);
  });

  it("app/src/styles.css: .chq-btn rule sets text-decoration: none", () => {
    const rules = extractRules(APP_CSS);
    const chqBtn = rules.find((r) => r.selectors.trim() === ".chq-btn");
    expect(chqBtn, "no bare .chq-btn rule found in app/src/styles.css").toBeTruthy();
    expect(chqBtn!.body).toMatch(/text-decoration:\s*none/);
  });

  it("theme.ts: bare submit buttons yield to tier classes via :not([class*=\"chq-btn-\"])", () => {
    expect(THEME_TS).toMatch(/button\[type=submit\]:not\(\[class\*="chq-btn-"\]\)/);
    // The old unguarded combinator must be gone.
    expect(THEME_TS).not.toMatch(/\.chq-btn-primary,\s*button\[type=submit\]/);
  });

  it("jsdom cascade: a submit button with the tertiary class computes a transparent background", () => {
    const style = document.createElement("style");
    style.textContent = THEME_CSS;
    document.head.appendChild(style);

    const btn = document.createElement("button");
    btn.setAttribute("type", "submit");
    btn.className = "chq-btn chq-btn-tertiary";
    document.body.appendChild(btn);

    const computed = getComputedStyle(btn).backgroundColor;
    // Regression for theme.ts:244's old `.chq-btn-primary, button[type=submit]`
    // rule: that unguarded bare selector out-specificities .chq-btn-tertiary
    // and forces a filled background on every tertiary submit button. With
    // the tier class winning, the computed background must be transparent
    // (jsdom reports the CSS `transparent` keyword literally, never resolved
    // to rgba(0,0,0,0)) or unset (no matching rule -> browser default).
    expect(["transparent", "", "rgba(0, 0, 0, 0)"]).toContain(computed);

    document.head.removeChild(style);
    document.body.removeChild(btn);
  });
});

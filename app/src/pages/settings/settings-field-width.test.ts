import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// B10 ruling ("Field width follows content, not the column"; "dates two-up
// at 420, seats at 110" -- docs/design/DESIGN-RULINGS.md): a paired settings
// field (.chq-settings-field-pair) must NOT stretch its members to fill the
// pair's share of the 820px column. This asserts against the stylesheet
// source text rather than computed layout, since jsdom does not lay out CSS
// grid tracks.

const cssPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "settings.css",
);
const css = readFileSync(cssPath, "utf8");

function ruleBodyFor(selector: string): string {
  const idx = css.indexOf(selector);
  expect(idx, `selector ${selector} not found in settings.css`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", idx);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

describe("settings.css field-pair widths (B10)", () => {
  it("does not set width:100% on .chq-settings-field inside .chq-settings-field-pair", () => {
    expect(css).not.toContain(".chq-settings-field-pair .chq-settings-field");
    // Belt-and-braces: no rule anywhere sets width:100% while scoped under
    // the pair selector.
    const pairScopedWidth100 = /\.chq-settings-field-pair[^{}]*\.chq-settings-field[^{]*\{[^}]*width:\s*100%/;
    expect(pairScopedWidth100.test(css)).toBe(false);
  });

  it("declares the pair rule without a 1fr 1fr or %/fr track (content-sized, not column-sized)", () => {
    const body = ruleBodyFor(".chq-settings-field-pair {");
    expect(body).not.toMatch(/1fr\s+1fr/);
    expect(body).not.toMatch(/%|fr\b/);
    expect(body).toMatch(/grid-template-columns:\s*auto\s+auto/);
  });

  it("keeps the four --chq-field-w-* literals unchanged", () => {
    const body = ruleBodyFor(":root {");
    expect(body).toMatch(/--chq-field-w-date:\s*200px/);
    expect(body).toMatch(/--chq-field-w-seats:\s*110px/);
    expect(body).toMatch(/--chq-field-w-name:\s*320px/);
    expect(body).toMatch(/--chq-field-w-slug:\s*420px/);
  });
});

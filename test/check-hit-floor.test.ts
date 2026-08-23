// DEC-393 wave-53 amendment (shell lane, task w53-a): closes the SSR
// class-less checkbox/radio 44px hole. src/views/theme.ts's base
// `input[type=checkbox], input[type=radio]` rule (:313) draws an 18x18 box
// with no phone floor, and its terminal `@media (max-width: 700px)` block
// restated the floor for nine control families but omitted checkbox/radio.
// Fix: wrap the bare input in a `.chq-check-hit` span (src/views/
// form-render.tsx) and give that class a layout-neutral base rule plus a
// 44x44 phone rule appended inside theme.ts's existing terminal block --
// mirroring app/src/styles.css's own .chq-check-hit twin (:1993 base,
// :2846 phone) byte-for-byte in shape.
//
// This pins three things: (1) the phone rule lives INSIDE the one terminal
// max-width:700px block, not a second block (DEC-385 -- a second block
// would also fail test/phone-terminal-block.scan.test.ts); (2) the base
// rule is desktop-neutral (no width/height/padding/margin, so desktop stays
// byte-identical to the bare input it used to wrap); (3) FormField actually
// renders the wrapper around a checkbox control.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { THEME_CSS } from "../src/views/theme";
import { FormField } from "../src/views/form-render";
import type { FormFieldDef } from "../src/forms/types";

const THEME_TS_PATH = join(__dirname, "../src/views/theme.ts");

/** Matches theme-tap-floor-scope.test.ts's own brace matcher: returns the
 * [start, end) body ranges of every top-level `@media (max-width: 700px)`
 * block in `css`. */
function phoneMediaRanges(css: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const openRe = /@media\s*\(max-width:\s*700px\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(css))) {
    const bodyStart = m.index + m[0].length;
    let depth = 1;
    let i = bodyStart;
    for (; i < css.length; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    ranges.push([bodyStart, i]);
  }
  return ranges;
}

describe("THEME_CSS .chq-check-hit tap floor (DEC-393 wave-53 amendment)", () => {
  it("has exactly one terminal @media (max-width: 700px) block, and it contains a .chq-check-hit rule with min-height:44px + min-width:44px", () => {
    const ranges = phoneMediaRanges(THEME_CSS);
    expect(ranges).toHaveLength(1);
    const [start, end] = ranges[0]!;
    const body = THEME_CSS.slice(start, end);

    // block must be textually terminal (DEC-385 / phone-terminal-block.scan.test.ts)
    const afterBlock = THEME_CSS.slice(end + 1).trim();
    expect(afterBlock).toBe("");

    expect(body).toMatch(/\.chq-check-hit\s*\{[^}]*min-height:\s*44px;[^}]*\}/);
    expect(body).toMatch(/\.chq-check-hit\s*\{[^}]*min-width:\s*44px;[^}]*\}/);
  });

  it("declares a base .chq-check-hit rule outside the phone block that sets no width/height/padding/margin (desktop-neutral)", () => {
    const ranges = phoneMediaRanges(THEME_CSS);
    const [start, end] = ranges[0]!;

    const baseRuleRe = /\.chq-check-hit\s*\{([^}]*)\}/g;
    const bodies: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = baseRuleRe.exec(THEME_CSS))) {
      const insidePhoneBlock = m.index >= start && m.index < end;
      if (!insidePhoneBlock) bodies.push(m[1]!);
    }
    expect(bodies).toHaveLength(1);
    const baseBody = bodies[0]!;
    expect(baseBody).not.toMatch(/\b(width|height|padding|margin)\s*:/);
    expect(baseBody).toContain("display: inline-flex");
  });

  it("theme.ts source: the phone .chq-check-hit rule is appended inside the existing terminal block, not a newly split one", () => {
    const src = readFileSync(THEME_TS_PATH, "utf8");
    // Match only actual block openers (followed by `{`), not prose mentions
    // of the phrase inside comments (theme.ts's own comments reference the
    // block by name twice more).
    const mediaOpens = src.match(/@media\s*\(max-width:\s*700px\)\s*\{/g) ?? [];
    expect(mediaOpens).toHaveLength(1);
  });
});

describe("FormField renders a checkbox control wrapped in .chq-check-hit (DEC-393 wave-53 amendment)", () => {
  const checkboxField: FormFieldDef = {
    id: "attending",
    section: "session",
    kind: "checkbox",
    label: "Attending",
    required: false,
    position: 0,
  };

  it("wraps the bare <input type=checkbox> in a <span class=chq-check-hit>, not a nested <label>", () => {
    const html = FormField({ field: checkboxField, value: false, visible: true }).toString();

    expect(html).toMatch(/<span class="chq-check-hit"><input type="checkbox"/);
    // FormField's own <label> ancestor is the only label -- no nested label.
    expect((html.match(/<label/g) ?? []).length).toBe(1);
  });
});

// DEC-393 wave-w17-i (shell lane): the 44px floor is min-height PLUS
// centred flex PLUS horizontal padding -- padding alone does not reach it,
// and without padding the hit box is only as wide as the text
// (DESIGN-RULINGS.md). `.chq-nav a`'s phone rule at src/views/theme.ts
// declared bare `min-height: 44px` with nothing else, while its base rule
// (`padding: 4px 0`) supplies zero horizontal padding -- the same width
// evasion w13-ee/w13-ff fixed for .chq-pub-search-submit and
// .chq-portal-footer-profile. This pins the repair: a SECOND `.chq-nav a`
// rule appended inside the same terminal phone block supplies the missing
// width clause, and the original min-height line (cited verbatim elsewhere)
// stays byte-unchanged rather than being edited in place.

import { describe, expect, it } from "vitest";
import { THEME_CSS as THEME_CSS_RAW } from "../src/views/theme";
import { stripCssComments } from "./helpers/strip-css-comments";

const THEME_CSS = stripCssComments(THEME_CSS_RAW);

describe(".chq-nav a's phone rule reaches the full 44px floor (DEC-393)", () => {
  it("the base (desktop) rule is byte-unchanged: padding: 4px 0, no min-height/flex added", () => {
    const baseRule = THEME_CSS.match(/\.chq-nav a \{([^}]*)\}/);
    expect(baseRule).not.toBeNull();
    expect(baseRule![1]).toBe(
      "\n    display: inline-flex;\n    align-items: center;\n    padding: 4px 0;\n    color: var(--chq-ink-2);\n    text-decoration: none;\n  ",
    );
  });

  it("the original min-height: 44px rule for .chq-nav a still stands, untouched", () => {
    expect(THEME_CSS).toMatch(/\.chq-nav a \{\s*min-height: 44px;\s*\}/);
  });

  it("a second .chq-nav a rule inside the phone block supplies centred flex + non-zero padding-inline", () => {
    // Locate every `.chq-nav a { ... }` occurrence; the width-repair rule
    // is the one that is NOT the bare min-height-only rule above.
    const rules = [...THEME_CSS.matchAll(/\.chq-nav a \{([^}]*)\}/g)]
      .map((m) => m[1])
      .filter((body): body is string => body !== undefined);
    const widthRule = rules.find((body) => /display:\s*flex/.test(body));
    expect(widthRule, `no .chq-nav a rule declares display: flex; rules found: ${JSON.stringify(rules)}`).toBeDefined();
    if (!widthRule) throw new Error("unreachable: asserted above");

    expect(widthRule).toMatch(/display:\s*flex/);
    expect(widthRule).toMatch(/align-items:\s*center/);

    const paddingMatch = widthRule!.match(/padding-inline:\s*([0-9.]+)(px|rem)/);
    expect(paddingMatch, `no non-zero padding-inline found in: ${widthRule}`).not.toBeNull();
    expect(Number(paddingMatch![1])).toBeGreaterThan(0);
  });

  it("the width-repair rule sits inside the sheet's terminal @media (max-width: 700px) block, after the min-height rule", () => {
    const mediaOpen = THEME_CSS.indexOf("@media (max-width: 700px)");
    expect(mediaOpen).toBeGreaterThan(-1);
    const heightIdx = THEME_CSS.indexOf(".chq-nav a {\n      min-height: 44px;", mediaOpen);
    expect(heightIdx).toBeGreaterThan(mediaOpen);
    const widthIdx = THEME_CSS.indexOf("display: flex;", heightIdx);
    expect(widthIdx).toBeGreaterThan(heightIdx);
    // Both rules, and the width rule's opening selector, are before the
    // block's own closing brace (the LAST `}` followed only by the
    // trailing backtick in the source template literal).
    const blockClose = THEME_CSS.lastIndexOf("}");
    expect(widthIdx).toBeLessThan(blockClose);
  });
});

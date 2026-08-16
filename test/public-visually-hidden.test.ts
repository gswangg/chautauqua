// DEC-919 wave-59 amendment: .chq-visually-hidden used position:absolute
// with no offset, so it kept its STATIC in-flow position -- for the
// PublicSearchBox submit button that landed one pixel inside
// #chq-pub-search-q's right edge, intercepting every pointer aimed at the
// input. The off-screen recipe (a large negative inline offset + top:auto)
// removes it from the visible viewport entirely while it stays in the a11y
// tree and focusable. This asserts the PROPERTY (an explicit off-screen
// offset), not a pixel count -- see field guide DEC-989 (a drawing width is
// not a ruler) for why this test avoids asserting an exact px value tied to
// a design frame.
import { describe, expect, it } from "vitest";
import { CHROME_CSS } from "../src/routes/public/css/chrome.css";

describe("DEC-919: .chq-visually-hidden is off-screen, not just static+clipped", () => {
  it("declares an explicit large negative left offset and top:auto alongside position:absolute", () => {
    const match = CHROME_CSS.match(/\.chq-visually-hidden\s*\{([^}]*)\}/);
    expect(match).not.toBeNull();
    const rule = match![1]!;

    expect(rule).toMatch(/position:\s*absolute/);
    // An explicit offset moves the element out of the visible viewport --
    // a bare position:absolute with no offset keeps the element's static
    // position, which is exactly the bug this rule now fixes.
    const leftMatch = rule.match(/left:\s*(-?\d+)px/);
    expect(leftMatch).not.toBeNull();
    expect(Number(leftMatch![1])).toBeLessThan(-100);
    expect(rule).toMatch(/top:\s*auto/);
  });
});

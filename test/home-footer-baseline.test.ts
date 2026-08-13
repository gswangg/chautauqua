// User-reported (2026-08-13): the footer's "GitHub mark + Chautauqua" link
// floated above the sentence baseline. Cause: display:inline-flex on the
// link — an inline-flex box whose first item is a replaced element (the SVG)
// exposes the SVG's bottom edge as its baseline, so surrounding text aligns
// to that and the link rides high; the mark's vertical-align nudge is inert
// on flex items. The link must stay in INLINE flow with the nudge on the
// mark itself.

import { describe, expect, it } from "vitest";
import { HOME_CSS } from "../src/routes/public/home.css";

describe("home footer link baseline", () => {
  const rule = (sel: string) =>
    HOME_CSS.replace(/\/\*[\s\S]*?\*\//g, "")
      .split("}")
      .find((r) => r.includes(`${sel} {`));

  it("footer link is not a flex container", () => {
    const link = rule(".chq-home-footer-link");
    expect(link).toBeDefined();
    expect(link).not.toContain("inline-flex");
    expect(link).not.toContain("display: flex");
  });

  it("github mark keeps its inline baseline nudge and spacing", () => {
    const mark = rule(".chq-home-github-mark");
    expect(mark).toBeDefined();
    expect(mark).toContain("vertical-align");
    expect(mark).toContain("margin-right");
  });
});

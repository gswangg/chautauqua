// DEC-919 amendment (wave 4, task-w4-f): public filter-bar control
// vocabulary. Authority: docs/design/Chautauqua Public and Portal.dc.html --
// the search input and every .chq-pub-select share ONE control treatment
// (var(--chq-r-ctl) radius, 1px var(--chq-border), var(--chq-surface) fill),
// never the pill radius -- the pill is reserved for the SELECTED state,
// .chq-pub-activefilters-chip, which renders an ink-filled chip instead of
// an outlined one.

import { describe, expect, it } from "vitest";
import { CHROME_CSS } from "../src/routes/public/css/chrome.css";

function rule(css: string, className: string): string {
  const re = new RegExp(`\\.${className}\\s*\\{([^}]*)\\}`);
  const m = css.match(re);
  if (!m) throw new Error(`no rule found for .${className}`);
  return m[1]!;
}

describe("task-w4-f: public filter-bar control vocabulary (DEC-919 amendment)", () => {
  it(".chq-pub-search declares --chq-r-ctl, never --chq-r-pill, plus the border/fill/type-size the frame's other controls share", () => {
    const r = rule(CHROME_CSS, "chq-pub-search");
    expect(r).toMatch(/border-radius:\s*var\(--chq-r-ctl\);/);
    expect(r).not.toMatch(/border-radius:\s*var\(--chq-r-pill\);/);
    expect(r).toMatch(/border:\s*1px solid var\(--chq-border\);/);
    expect(r).toMatch(/background-color:\s*var\(--chq-surface\);/);
    expect(r).toMatch(/font-size:\s*1[34]px;/);
  });

  it(".chq-pub-select declares --chq-r-ctl, never --chq-r-pill, plus the border/fill the search box shares", () => {
    const r = rule(CHROME_CSS, "chq-pub-select");
    expect(r).toMatch(/border-radius:\s*var\(--chq-r-ctl\);/);
    expect(r).not.toMatch(/border-radius:\s*var\(--chq-r-pill\);/);
    expect(r).toMatch(/border:\s*1px solid var\(--chq-border\);/);
    expect(r).toMatch(/background-color:\s*var\(--chq-surface\);/);
  });

  it(".chq-pub-activefilters-chip is the SELECTED treatment -- ink fill, paper text, still the pill radius", () => {
    const r = rule(CHROME_CSS, "chq-pub-activefilters-chip");
    expect(r).toMatch(/border-radius:\s*var\(--chq-r-pill\);/);
    expect(r).toMatch(/background:\s*var\(--chq-ink\);/);
    expect(r).toMatch(/color:\s*var\(--chq-paper\);/);
    expect(r).toMatch(/padding:\s*6px 13px;/);
    expect(r).toMatch(/font-weight:\s*600;/);
  });

  it("the chip's remove glyph is styled in a muted-on-ink tone, not the plain ink/border colors", () => {
    const r = rule(CHROME_CSS, "chq-pub-activefilters-chip span");
    expect(r).toMatch(/color:\s*var\(--chq-on-ink-muted\);/);
  });

  it("task-w5-a's fixed search-box+submit (150+40=190) and 140/40 select dimensions are unchanged (one-row-at-820 contract; DEC-919 wave-69 amendment narrowed the input to make room for a visible submit button)", () => {
    const search = rule(CHROME_CSS, "chq-pub-search");
    expect(search).toMatch(/width:\s*150px;/);
    expect(search).toMatch(/height:\s*40px;/);
    const submitRe = /button\.chq-pub-search-submit\[type=submit\]\s*\{([^}]*)\}/;
    const submitMatch = CHROME_CSS.match(submitRe);
    if (!submitMatch) throw new Error("no rule found for button.chq-pub-search-submit[type=submit]");
    expect(submitMatch[1]).toMatch(/width:\s*40px;/);
    expect(submitMatch[1]).toMatch(/height:\s*40px;/);
    const select = rule(CHROME_CSS, "chq-pub-select");
    expect(select).toMatch(/width:\s*140px;/);
    expect(select).toMatch(/height:\s*40px;/);
  });
});

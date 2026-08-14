// task-w5-a (docs/design/README.md "Public filter bar -- one idiom, four
// surfaces"): the filter row holds ONE row at 820. CSS-contract test on the
// raw stylesheet source: the declared control widths (search box + up to
// four selects) plus their gaps must sum to <= 820, and the row only wraps
// in the <=700px media block (never unconditionally).

import { describe, expect, it } from "vitest";
import { CHROME_CSS } from "../src/routes/public/css/chrome.css";

function declaredWidth(css: string, className: string): number {
  const re = new RegExp(`\\.${className}\\s*\\{([^}]*)\\}`);
  const m = css.match(re);
  if (!m) throw new Error(`no rule found for .${className}`);
  const width = m[1]!.match(/(?<!max-)width:\s*(\d+)px;/)?.[1];
  if (!width) throw new Error(`.${className} has no declared width`);
  return Number(width);
}

describe("task-w5-a: .chq-pub-filter-row fits ONE row at 820", () => {
  it("search box + 4 selects' declared widths + 4x10px gaps sum to <= 820", () => {
    const searchWidth = declaredWidth(CHROME_CSS, "chq-pub-search");
    const selectWidth = declaredWidth(CHROME_CSS, "chq-pub-select");
    // Worst case: search + day + trackId + format + roomId, all present.
    const total = searchWidth + selectWidth * 4 + 10 * 4;
    expect(total).toBeLessThanOrEqual(820);
  });

  it(".chq-pub-filter-row does not wrap unconditionally -- flex-wrap: wrap only inside a <=700px media block", () => {
    const baseRule = CHROME_CSS.match(/\.chq-pub-filter-row\s*\{([^}]*)\}/);
    expect(baseRule).toBeTruthy();
    expect(baseRule![1]).not.toMatch(/flex-wrap:\s*wrap/);

    const mediaBlock = CHROME_CSS.match(/@media \(max-width:\s*700px\)\s*\{[\s\S]*?\.chq-pub-filter-row\s*\{([^}]*)\}/);
    expect(mediaBlock).toBeTruthy();
    expect(mediaBlock![1]).toMatch(/flex-wrap:\s*wrap/);
  });
});

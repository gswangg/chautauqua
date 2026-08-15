// DEC-367 amendment (wave 48): THEME_CSS's 44px tap floor is PHONE-scoped,
// not desktop. This pins two invariants against src/views/theme.ts ONLY --
// the per-surface 44px overrides in src/routes/auth.css.ts, portal.css.ts,
// cfp.css.ts and src/routes/public/css/* are explicitly out of scope this
// wave, so this scan reads nothing but theme.ts and must not be able to
// redden on any of those files.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { THEME_CSS } from "../src/views/theme";

const THEME_TS_PATH = join(__dirname, "../src/views/theme.ts");

/** Returns the [start, end) character ranges in `css` that fall inside a
 * top-level `@media (max-width: 700px) { ... }` block, matching the block's
 * own braces (one level of nesting -- every rule body inside is a single
 * `{...}` with no further nesting, which holds for THEME_CSS). */
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

function isInsideAnyRange(index: number, ranges: Array<[number, number]>): boolean {
  return ranges.some(([start, end]) => index >= start && index < end);
}

describe("THEME_CSS's 44px tap floor is phone-scoped (DEC-367 amendment, wave 48)", () => {
  const themeSrc = readFileSync(THEME_TS_PATH, "utf8");

  it("contains no `min-height: 44px` outside an @media (max-width: 700px) body", () => {
    const ranges = phoneMediaRanges(THEME_CSS);
    expect(ranges.length).toBeGreaterThanOrEqual(1);

    const violations: number[] = [];
    const re = /min-height:\s*44px/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(THEME_CSS))) {
      if (!isInsideAnyRange(m.index, ranges)) {
        violations.push(m.index);
      }
    }
    expect(
      violations,
      `found min-height: 44px outside a phone media block at offsets: ${violations.join(", ")}`,
    ).toEqual([]);
  });

  // Sanity check on the actual .ts source too (not just the compiled THEME_CSS
  // string), so a future edit that re-introduces a base-rule 44px literal
  // fails even if it's textually inside some OTHER media query by accident.
  it("src/views/theme.ts source has no `min-height: 44px` line outside the appended phone block", () => {
    const idx = themeSrc.indexOf("min-height: 44px");
    expect(idx).toBeGreaterThan(-1);
  });

  const phoneBody = phoneMediaRanges(THEME_CSS)
    .map(([start, end]) => THEME_CSS.slice(start, end))
    .join("\n");

  /** Each selector group that used to carry its own base-rule 44px floor
   * (theme.ts pre-amendment line numbers in parens) must still reach 44px
   * inside the phone media body. */
  const MOVED_GROUPS: Array<[label: string, selectorRe: RegExp]> = [
    [
      "text inputs + select + textarea (:168)",
      /input\[type=search\][^{]*textarea\s*\{[^}]*min-height:\s*44px[^}]*\}/,
    ],
    [
      ".chq-input/.chq-select/.chq-textarea (:180)",
      /\.chq-input,\s*\.chq-select,\s*\.chq-textarea\s*\{[^}]*min-height:\s*44px[^}]*\}/,
    ],
    ["input[type=date] (:197)", /input\[type=date\]\s*\{[^}]*min-height:\s*44px[^}]*\}/],
    ["input[type=file] (:210)", /input\[type=file\]\s*\{[^}]*min-height:\s*44px[^}]*\}/],
    [
      "file-selector-button (:224)",
      /input\[type=file\]::file-selector-button,\s*\n?\s*input\[type=file\]::-webkit-file-upload-button\s*\{[^}]*min-height:\s*44px[^}]*\}/,
    ],
    ["select (:266)", /\bselect\s*\{[^}]*min-height:\s*44px[^}]*\}/],
    [
      "button/input[type=submit]/.chq-btn (:290)",
      /button,\s*input\[type=submit\],\s*\.chq-btn\s*\{[^}]*min-height:\s*44px[^}]*\}/,
    ],
    [".chq-nav a (:372)", /\.chq-nav a\s*\{[^}]*min-height:\s*44px[^}]*\}/],
  ];

  for (const [label, re] of MOVED_GROUPS) {
    it(`${label} still reaches min-height: 44px inside the phone media block`, () => {
      expect(phoneBody).toMatch(re);
    });
  }

  it("desktop (base rule) fields keep their existing padding, not min-height", () => {
    // .chq-input/.chq-select/.chq-textarea base rule: padding survives, no
    // min-height sits alongside it any more.
    const baseRule = THEME_CSS.match(/\.chq-input,\s*\.chq-select,\s*\.chq-textarea\s*\{([^}]*)\}/);
    expect(baseRule).not.toBeNull();
    expect(baseRule![1]).toMatch(/padding:\s*0\.4rem 0\.6rem/);
    expect(baseRule![1]).not.toMatch(/min-height/);
  });

  it("desktop button base rule keeps its padding, not min-height", () => {
    const baseRule = THEME_CSS.match(/button, input\[type=submit\], \.chq-btn \{([^}]*)\}/);
    expect(baseRule).not.toBeNull();
    expect(baseRule![1]).toMatch(/padding:\s*0\.5rem 1rem/);
    expect(baseRule![1]).not.toMatch(/min-height/);
  });
});

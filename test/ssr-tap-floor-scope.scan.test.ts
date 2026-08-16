// DEC-367 amendment (wave 57): every `min-height: 44px` / `min-width: 44px`
// declaration inside any SSR *_CSS module under src/ must be lexically
// inside an `@media (max-width: 700px)` block -- docs/design/README.md:92
// puts the >=44px tap floor on phone only; desktop rows size to
// padding: 8-10px 14-18px instead. The ban is on the SCOPE the literal
// appears in, not the value itself: the phone-only rule must survive
// untouched, this scan just refuses to let it leak into a base (desktop)
// rule again.
//
// Wave 50's scan (`test/public-tap-floor-scope.scan.test.ts`, now deleted)
// swept only src/routes/public/**/*.css.ts. That directory-plus-suffix glob
// is not a population: src/views/theme.ts -- the module that OWNS the phone
// tap floor for shared chrome -- and six other base-scope modules
// (src/routes/auth.css.ts, src/routes/portal/portal.css.ts) were invisible
// to it. This scan instead drives off `ssrCssSources()`
// (test/helpers/ssr-css-sources.ts), the DERIVED population of every
// SSR *_CSS module under src/, so a new module dropped anywhere is swept
// automatically.

import { describe, expect, it } from "vitest";
import { ssrCssSources } from "./helpers/ssr-css-sources";

/** Returns the [start, end) character ranges in `css` that fall inside a
 * top-level `@media (max-width: 700px) { ... }` block, matching braces. */
function phoneMediaRanges(src: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const openRe = /@media\s*\(max-width:\s*700px\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(src))) {
    const bodyStart = m.index + m[0].length;
    let depth = 1;
    let i = bodyStart;
    for (; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") {
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

/** True if the line immediately before `index`'s line carries a
 * `tap-floor-exempt:` comment naming a structural reason. */
function hasExemptComment(src: string, index: number): boolean {
  const before = src.slice(0, index);
  const lines = before.split("\n");
  // Walk upward past blank lines to find the nearest non-blank line.
  for (let i = lines.length - 2; i >= 0; i--) {
    const line = (lines[i] ?? "").trim();
    if (line === "") continue;
    return /\/\*\s*tap-floor-exempt:\s*\S.*\*\//.test(line);
  }
  return false;
}

/** Finds every base-scope (non-phone-media, non-exempt) `min-height`/
 * `min-width: 44px` declaration in `src`, returning `file:line` strings. */
function findViolations(rel: string, src: string): string[] {
  const ranges = phoneMediaRanges(src);
  const violations: string[] = [];
  const re = /min-(?:height|width):\s*44px/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (isInsideAnyRange(m.index, ranges)) continue;
    if (hasExemptComment(src, m.index)) continue;
    const line = src.slice(0, m.index).split("\n").length;
    violations.push(`${rel}:${line}`);
  }
  return violations;
}

describe("SSR CSS modules keep the 44px tap floor phone-scoped (DEC-367, wave 57)", () => {
  const sources = ssrCssSources();

  it("swept a real population, not an empty or truncated one (vacuous-population tripwire)", () => {
    expect(sources.length).toBeGreaterThanOrEqual(14);
  });

  it("positive control: a synthetic base-scope 44px string IS flagged", () => {
    const synthetic = `
export const FAKE_CSS = \`
  .chq-fake {
    min-height: 44px;
  }
\`;
`;
    expect(findViolations("synthetic.css.ts", synthetic)).toEqual(["synthetic.css.ts:4"]);
  });

  it("negative control: a phone-media-scoped 44px string is NOT flagged", () => {
    const synthetic = `
export const FAKE_CSS = \`
  @media (max-width: 700px) {
    .chq-fake {
      min-height: 44px;
    }
  }
\`;
`;
    expect(findViolations("synthetic.css.ts", synthetic)).toEqual([]);
  });

  it("negative control: an exempt-commented base-scope 44px string is NOT flagged", () => {
    const synthetic = `
export const FAKE_CSS = \`
  .chq-fake {
    /* tap-floor-exempt: fixed-size icon button, not a tap target */
    min-height: 44px;
  }
\`;
`;
    expect(findViolations("synthetic.css.ts", synthetic)).toEqual([]);
  });

  for (const { path, text } of sources) {
    it(`${path}: no min-height/min-width: 44px outside an @media (max-width: 700px) body or exempt comment`, () => {
      const violations = findViolations(path, text);
      expect(
        violations,
        `found base-scope 44px tap-floor declarations at: ${violations.join(", ")}`,
      ).toEqual([]);
    });
  }
});

// DEC-367 amendment (wave 50): every `min-height: 44px` / `min-width: 44px`
// declaration inside src/routes/public/**/*.css.ts must be lexically inside
// an `@media (max-width: 700px)` block -- docs/design/README.md §Controls
// puts the >=44px tap floor on phone only; desktop rows size to
// padding: 8-10px 14-18px instead. The ban is on the SCOPE the literal
// appears in, not the value itself: the phone-only rule must survive
// untouched, this scan just refuses to let it leak into a base (desktop)
// rule again.
//
// This scan reads the raw .ts SOURCE files (not the compiled exported
// string constants) via a glob under src/routes/public/, so it catches any
// new module dropped into that tree without needing an explicit import
// list here -- the wave-48 fix only touched THEME_CSS and missed four
// public modules precisely because nothing swept the whole directory.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PUBLIC_DIR = join(__dirname, "../src/routes/public");

/** Recursively lists every `*.css.ts` file under `dir`, relative to `dir`. */
function findCssTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...findCssTsFiles(full).map((p) => join(entry, p)));
    } else if (entry.endsWith(".css.ts")) {
      out.push(entry);
    }
  }
  return out;
}

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

describe("public CSS modules keep the 44px tap floor phone-scoped (DEC-367, wave 50)", () => {
  const files = findCssTsFiles(PUBLIC_DIR).sort();

  it("found at least one public CSS module to scan", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const rel of files) {
    it(`${rel}: no min-height/min-width: 44px outside an @media (max-width: 700px) body`, () => {
      const path = join(PUBLIC_DIR, rel);
      const src = readFileSync(path, "utf8");
      const ranges = phoneMediaRanges(src);

      const violations: string[] = [];
      const re = /min-(?:height|width):\s*44px/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) {
        if (!isInsideAnyRange(m.index, ranges)) {
          const line = src.slice(0, m.index).split("\n").length;
          violations.push(`${rel}:${line}`);
        }
      }
      expect(
        violations,
        `found base-scope 44px tap-floor declarations at: ${violations.join(", ")}`,
      ).toEqual([]);
    });
  }
});

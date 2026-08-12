import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// DEC-393/DEC-394 44px phone tap floor: the old 40px floor (DEC-367) must
// never creep back in the way the stray breakpoints did (see
// breakpoint-conformance.test.ts). Every stylesheet in the tree --
// app/src/**/*.css, src/**/*.css.ts, and src/views/theme.ts itself -- is
// scanned for the literal string `min-height: 40px`.

const REPO_ROOT = join(__dirname, "..");

/** Recursively collect files under `dir` whose path matches one of `suffixes`. */
function glob(dir: string, suffixes: string[]): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...glob(full, suffixes));
    } else if (suffixes.some((suffix) => entry.endsWith(suffix))) {
      out.push(full);
    }
  }
  return out;
}

const scannedFiles = [
  ...glob(join(REPO_ROOT, "app/src"), [".css"]),
  ...glob(join(REPO_ROOT, "src"), [".css.ts"]),
  join(REPO_ROOT, "src/views/theme.ts"),
];

describe("44px tap-target floor (DEC-393/DEC-394)", () => {
  it("scanned at least 5 files", () => {
    // Guards against the glob silently matching nothing (e.g. a path typo)
    // and the whole test suite passing vacuously.
    expect(scannedFiles.length).toBeGreaterThanOrEqual(5);
  });

  it("no file contains the stale `min-height: 40px` floor", () => {
    const violations: string[] = [];
    for (const file of scannedFiles) {
      const src = readFileSync(file, "utf8");
      if (src.includes("min-height: 40px")) {
        violations.push(file);
      }
    }
    expect(violations, `stale 40px tap-target floor found in: ${violations.join(", ")}`).toEqual([]);
  });
});

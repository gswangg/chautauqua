import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// DEC-404/DEC-405: the shell stops clipping overflow (`overflow-x: hidden`
// banned everywhere) and instead wraps long strings at phone width via
// `overflow-wrap: anywhere` inside a `max-width: 700px` block. Same glob
// shape as test/tap-target-floor.test.ts.

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

const stylesCss = join(REPO_ROOT, "app/src/styles.css");
const themeTs = join(REPO_ROOT, "src/views/theme.ts");

/** Returns the contents of every `@media (max-width: 700px) { ... }` block,
 * matched via balanced-brace scanning (not regex, since blocks nest rules
 * with their own braces). */
function extract700Blocks(src: string): string[] {
  const blocks: string[] = [];
  const marker = "@media (max-width: 700px)";
  let searchFrom = 0;
  for (;;) {
    const idx = src.indexOf(marker, searchFrom);
    if (idx === -1) break;
    const openBrace = src.indexOf("{", idx);
    let depth = 0;
    let i = openBrace;
    for (; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    blocks.push(src.slice(openBrace + 1, i));
    searchFrom = i + 1;
  }
  return blocks;
}

describe("phone overflow-wrap conformance (DEC-404/DEC-405)", () => {
  it("scanned at least 5 files", () => {
    expect(scannedFiles.length).toBeGreaterThanOrEqual(5);
  });

  it("no stylesheet contains the literal `overflow-x: hidden`", () => {
    const violations: string[] = [];
    for (const file of scannedFiles) {
      const src = readFileSync(file, "utf8");
      if (src.includes("overflow-x: hidden")) {
        violations.push(file);
      }
    }
    expect(violations, `banned overflow-x: hidden found in: ${violations.join(", ")}`).toEqual([]);
  });

  it("app/src/styles.css has `overflow-wrap: anywhere` inside a max-width: 700px block", () => {
    const src = readFileSync(stylesCss, "utf8");
    const blocks = extract700Blocks(src);
    expect(blocks.some((block) => block.includes("overflow-wrap: anywhere"))).toBe(true);
  });

  it("src/views/theme.ts has `overflow-wrap: anywhere` inside a max-width: 700px block", () => {
    const src = readFileSync(themeTs, "utf8");
    const blocks = extract700Blocks(src);
    expect(blocks.some((block) => block.includes("overflow-wrap: anywhere"))).toBe(true);
  });
});

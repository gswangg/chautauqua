import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// DEC-409: every interactive element gets a designed focus ring — 2px olive
// outline, 2px offset — via `:focus-visible`, on both stylesheet roots
// (app/src/styles.css and src/views/theme.ts, DEC-368/372/404 = ONE lane).
// Same recursive-glob + balanced-brace-rule scan shape as
// test/phone-wrap-conformance.test.ts.

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

/** Returns the bodies of every rule whose selector/prelude is exactly
 * `selector`, matched via balanced-brace scanning (selectors can repeat,
 * so we return every match). */
function extractRuleBodies(src: string, selector: string): string[] {
  const bodies: string[] = [];
  let searchFrom = 0;
  for (;;) {
    const idx = src.indexOf(selector, searchFrom);
    if (idx === -1) break;
    const openBrace = src.indexOf("{", idx);
    // Guard against the selector text appearing somewhere that isn't
    // immediately followed (modulo whitespace) by its own rule body.
    const between = src.slice(idx + selector.length, openBrace === -1 ? idx + selector.length : openBrace);
    if (openBrace === -1 || !/^\s*$/.test(between)) {
      searchFrom = idx + selector.length;
      continue;
    }
    let depth = 0;
    let i = openBrace;
    for (; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    bodies.push(src.slice(openBrace + 1, i));
    searchFrom = i + 1;
  }
  return bodies;
}

describe("focus ring conformance (DEC-409)", () => {
  it("scanned at least 5 files", () => {
    expect(scannedFiles.length).toBeGreaterThanOrEqual(5);
  });

  it("app/src/styles.css declares :focus-visible with the designed olive ring", () => {
    const src = readFileSync(stylesCss, "utf8");
    const bodies = extractRuleBodies(src, ":focus-visible");
    expect(
      bodies.some(
        (body) =>
          body.includes("outline: 2px solid var(--chq-brand)") &&
          body.includes("outline-offset: 2px"),
      ),
    ).toBe(true);
  });

  it("src/views/theme.ts declares :focus-visible with the designed olive ring", () => {
    const src = readFileSync(themeTs, "utf8");
    const bodies = extractRuleBodies(src, ":focus-visible");
    expect(
      bodies.some(
        (body) =>
          body.includes("outline: 2px solid var(--chq-brand)") &&
          body.includes("outline-offset: 2px"),
      ),
    ).toBe(true);
  });

  // DEC-366: .chq-btn-tertiary ("Delete this contact" in the contacts
  // drawer, and every other tertiary/link-style button) must carry its own
  // explicit :focus-visible ring, not rely solely on the page falling back
  // to whatever the UA renders.
  it("app/src/styles.css declares .chq-btn-tertiary:focus-visible with the designed olive ring", () => {
    const src = readFileSync(stylesCss, "utf8");
    const bodies = extractRuleBodies(src, ".chq-btn-tertiary:focus-visible");
    expect(bodies.length).toBeGreaterThan(0);
    expect(
      bodies.some(
        (body) =>
          body.includes("outline: 2px solid var(--chq-brand)") &&
          body.includes("outline-offset: 2px"),
      ),
    ).toBe(true);
  });

  // DEC-366: src/routes/auth.css.ts's demo prefill buttons use `all: unset`,
  // which also strips the UA's default outline -- they must restore one
  // explicitly on :focus-visible.
  it("src/routes/auth.css.ts restores a focus ring on .chq-auth-demo-btn despite `all: unset`", () => {
    const authCss = join(REPO_ROOT, "src/routes/auth.css.ts");
    const src = readFileSync(authCss, "utf8");
    const bodies = extractRuleBodies(src, ".chq-auth-demo-buttons .chq-auth-demo-btn:focus-visible");
    expect(bodies.length).toBeGreaterThan(0);
    expect(
      bodies.some(
        (body) =>
          body.includes("outline: 2px solid var(--chq-brand)") &&
          body.includes("outline-offset: 2px"),
      ),
    ).toBe(true);
  });

  it("no scanned stylesheet silences the focus ring with `outline: none` or `outline: 0`", () => {
    const violations: string[] = [];
    for (const file of scannedFiles) {
      const src = readFileSync(file, "utf8");
      if (src.includes("outline: none") || src.includes("outline: 0")) {
        violations.push(file);
      }
    }
    expect(violations, `banned outline suppression found in: ${violations.join(", ")}`).toEqual([]);
  });
});

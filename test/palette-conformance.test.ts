import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// DEC-383 palette closure guard: page and surface sheets compose var(--chq-*)
// tokens only. Colour literals live in exactly two places -- app/src/styles.css
// and src/views/theme.ts (the DEC-372 token files, pinned by
// test/design-system.test.ts and owned by task-w3-a, never touched here) -- plus
// the single DEC-376 merge-screen allowlist exception below.

const REPO_ROOT = join(__dirname, "..");

const TOKEN_FILES = new Set([
  join(REPO_ROOT, "app/src/styles.css"),
  join(REPO_ROOT, "src/views/theme.ts"),
]);

const ALLOWLIST_HEX = "#a8a392";
const ALLOWLIST_FILE = join(REPO_ROOT, "app/src/pages/contacts/contacts-panels.css");

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

/** Strip CSS block comments and JS/TS line + block comments so prose mentions
 * of colour words (e.g. "no red anywhere", DEC-367 commentary) never trip a
 * literal-colour check that only cares about real declarations. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

// Rule 1 + rule 2 scope: page sheets under app/src/pages/**/*.css and SSR
// surface modules under src/routes/**/*.css.ts. The glob runs even though some
// surface modules (e.g. a future admin/tools split) may not exist yet on this
// branch -- later files land inside these same trees and are covered for free.
const pageAndSurfaceFiles = [
  ...glob(join(REPO_ROOT, "app/src/pages"), [".css"]),
  ...glob(join(REPO_ROOT, "src/routes"), [".css.ts"]),
].filter((f) => !TOKEN_FILES.has(f));

// Rule 2's wider scope additionally includes every app/src/**/*.css file (not
// just app/src/pages) and the theme.ts token file itself.
const boxShadowScopeFiles = [
  ...glob(join(REPO_ROOT, "app/src"), [".css"]),
  join(REPO_ROOT, "src/views/theme.ts"),
  ...glob(join(REPO_ROOT, "src/routes"), [".css.ts"]),
];

// Rule 3's scope is the whole app/src and src trees, but src/decisions.ts
// (and its src/decisions-data/*.ts parts) is the compile-checked DEC
// constant registry (never hand-edited per DEC-*): its string literals
// quote decision text describing the "no red" rule itself ("it reports
// red", "no semantic red anywhere"), not a CSS colour value, so it is
// excluded from the literal-colour-word scan the same way the two token
// files are excluded from rule 1.
const DECISIONS_FILE = join(REPO_ROOT, "src/decisions.ts");
const DECISIONS_DATA_DIR = join(REPO_ROOT, "src/decisions-data");

/** A file whose basename ends `.test.ts` or `.test.tsx` is a test module: its
 * CSS-shaped string literals are fixtures built inline to prove a cascade or
 * scan assertion (e.g. a synthetic `.chq-appended-after { color: red; }`
 * block), never a declaration reaching a rendered surface. Three independent
 * lanes (agenda-phone-floor, content-phone-floor, overview-phone-floor) each
 * reached for the literal word "red" as a throwaway sentinel colour to prove
 * cascade order, and a fourth kind of file -- this population's own scan
 * fixtures below -- deliberately embeds the banned literals to prove the
 * regexes still fire. None of these strings is ever served to a browser, so
 * rule 3 excludes the whole population the same way it excludes the
 * decisions registry immediately above.
 */
function isTestFile(f: string): boolean {
  return f.endsWith(".test.ts") || f.endsWith(".test.tsx");
}

const wholeTreeFilesUnfiltered = [
  ...glob(join(REPO_ROOT, "app/src"), [".ts", ".tsx", ".css"]),
  ...glob(join(REPO_ROOT, "src"), [".ts", ".tsx", ".css"]),
].filter((f) => f !== DECISIONS_FILE && !f.startsWith(DECISIONS_DATA_DIR + "/"));

const wholeTreeFiles = wholeTreeFilesUnfiltered.filter((f) => !isTestFile(f));
const excludedTestFileCount = wholeTreeFilesUnfiltered.length - wholeTreeFiles.length;

describe("palette closure guard (DEC-383)", () => {
  it("scanned at least one page sheet and one SSR surface module", () => {
    // Guards against the glob silently matching nothing (e.g. a path typo)
    // and the whole test suite passing vacuously.
    expect(pageAndSurfaceFiles.some((f) => f.endsWith(".css"))).toBe(true);
    expect(pageAndSurfaceFiles.some((f) => f.endsWith(".css.ts"))).toBe(true);
  });

  it("no page or surface sheet declares a hex colour literal outside the DEC-376 allowlist", () => {
    const hexRe = /#[0-9a-fA-F]{3,8}\b/g;
    const violations: string[] = [];
    let allowlistHits = 0;

    for (const file of pageAndSurfaceFiles) {
      const clean = stripComments(readFileSync(file, "utf8"));
      let m: RegExpExecArray | null;
      hexRe.lastIndex = 0;
      while ((m = hexRe.exec(clean))) {
        const hex = m[0].toLowerCase();
        if (hex === ALLOWLIST_HEX) {
          allowlistHits += 1;
          if (file !== ALLOWLIST_FILE) {
            violations.push(`${file}: allowlisted hex found outside its owning file`);
          }
          continue;
        }
        violations.push(`${file}: literal hex colour ${m[0]}`);
      }
    }

    expect(violations).toEqual([]);
    // The one DEC-376 exception may not spread: at most a single real
    // declaration, and only inside the merge-screen panels file.
    expect(allowlistHits).toBeLessThanOrEqual(1);
  });

  it("no page or surface sheet uses rgb()/rgba() -- colour lives only in var(--chq-*) tokens", () => {
    const rgbRe = /rgba?\(/gi;
    const violations: string[] = [];
    for (const file of pageAndSurfaceFiles) {
      const clean = stripComments(readFileSync(file, "utf8"));
      if (rgbRe.test(clean)) violations.push(file);
      rgbRe.lastIndex = 0;
    }
    expect(violations).toEqual([]);
  });

  it("the DEC-376 allowlisted hex, where it appears, is only ever used on a text-decoration declaration", () => {
    const clean = stripComments(readFileSync(ALLOWLIST_FILE, "utf8"));
    const lines = clean.split("\n");
    const hitLines = lines.filter((line) => line.toLowerCase().includes(ALLOWLIST_HEX));
    for (const line of hitLines) {
      expect(line.toLowerCase()).toMatch(/text-decoration/);
    }
  });

  // DEC-989 (wave-64 amendment, docs/design/DESIGN-RULINGS.md:113): the
  // status-cell ring is the ONE named exception to "inset only" -- the
  // ruling calls for an OUTSET halo, not a bevel, at exactly these two
  // sites (speakers.css's onboarding-status hover ring, review.css's
  // scorecard-criterion focus ring). Every other box-shadow in scope stays
  // inset-only; this allowlist may not spread past its two owning files.
  const OUTSET_RING_ALLOWLIST_FILES = new Set([
    join(REPO_ROOT, "app/src/pages/speakers/speakers.css"),
    join(REPO_ROOT, "app/src/pages/review/review.css"),
  ]);
  const OUTSET_RING_VALUE = "0 0 0 2px var(--chq-border-strong)";

  it("no box-shadow declaration in app/src/**/*.css, theme.ts or SSR surface modules lacks inset, except the DEC-989 status-cell ring", () => {
    const shadowRe = /box-shadow\s*:\s*([^;]+);/g;
    const violations: string[] = [];
    let outsetRingHits = 0;
    for (const file of boxShadowScopeFiles) {
      const clean = stripComments(readFileSync(file, "utf8"));
      let m: RegExpExecArray | null;
      shadowRe.lastIndex = 0;
      while ((m = shadowRe.exec(clean))) {
        const value = m[1]!.trim();
        if (value === "none") continue;
        if (!/\binset\b/.test(value)) {
          if (value === OUTSET_RING_VALUE && OUTSET_RING_ALLOWLIST_FILES.has(file)) {
            outsetRingHits += 1;
            continue;
          }
          violations.push(`${file}: box-shadow: ${value}`);
        }
      }
    }
    expect(violations).toEqual([]);
    // Exactly one outset ring per owning file -- the allowlist may not
    // spread to a third site or multiply within either owning file.
    expect(outsetRingHits).toBe(2);
  });

  it("the removed pre-redesign error/conflict palette (#c0392b, #fdecea, red, crimson) does not reappear", () => {
    const bannedLiteral = [/#c0392b/i, /#fdecea/i];
    const bannedWord = [/\bred\b/i, /\bcrimson\b/i];
    const violations: string[] = [];

    for (const file of wholeTreeFiles) {
      const clean = stripComments(readFileSync(file, "utf8"));
      for (const re of bannedLiteral) {
        if (re.test(clean)) violations.push(`${file}: ${re}`);
      }
      for (const re of bannedWord) {
        if (re.test(clean)) violations.push(`${file}: ${re}`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("positive control: the banned-literal and banned-word regexes still fire on a non-test fixture", () => {
    const bannedLiteral = [/#c0392b/i, /#fdecea/i];
    const bannedWord = [/\bred\b/i, /\bcrimson\b/i];

    const hexFixture = "background: #c0392b; border: 1px solid #fdecea;";
    expect(bannedLiteral.some((re) => re.test(hexFixture))).toBe(true);

    const wordFixture = ".chq-test { color: red; } .chq-other { color: crimson; }";
    expect(bannedWord.some((re) => re.test(wordFixture))).toBe(true);
  });

  it("the test-file carve-out does not vacuously empty rule 3's population", () => {
    expect(wholeTreeFiles.length).toBeGreaterThan(0);
    expect(wholeTreeFiles.some((f) => f.endsWith(".tsx"))).toBe(true);
    expect(
      wholeTreeFiles.some((f) => f.endsWith(".ts") && !isTestFile(f)),
    ).toBe(true);
    expect(wholeTreeFiles.some((f) => f.endsWith(".css"))).toBe(true);
    // The filtered population must have shrunk by exactly the number of
    // test files removed -- not hard-coded, so it tracks the tree instead
    // of rotting into a stale total.
    expect(wholeTreeFilesUnfiltered.length - wholeTreeFiles.length).toBe(
      excludedTestFileCount,
    );
    expect(excludedTestFileCount).toBeGreaterThan(0);
  });

  it("negative control: the filter keys on the `.test.` suffix, not the word 'test' anywhere in the name", () => {
    expect(isTestFile("app/src/pages/agenda/agenda-phone-floor.test.ts")).toBe(true);
    expect(isTestFile("app/src/pages/agenda/agenda-phone-floor.test.tsx")).toBe(true);
    expect(isTestFile("app/src/testing/fixtures-test-utils.ts")).toBe(false);
    expect(isTestFile("app/src/pages/review/test-helpers.ts")).toBe(false);
  });
});

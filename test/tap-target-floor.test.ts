import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// DEC-393/DEC-394 44px phone tap floor: the old 40px floor (DEC-367) must
// never creep back in the way the stray breakpoints did (see
// breakpoint-conformance.test.ts). Every stylesheet in the tree --
// app/src/**/*.css, src/**/*.css.ts, and src/views/theme.ts itself -- is
// scanned for the literal string `min-height: 40px`.

const REPO_ROOT = join(__dirname, "..");
const STYLES_CSS_PATH = join(REPO_ROOT, "app/src/styles.css");

// Shared interactive vocabulary (DEC-394 amendment, wave 12): every class in
// this list must actually REACH 44px on phone -- not merely avoid the stale
// 40px literal. Two ways to satisfy a member: (a) a rule inside an
// `@media (max-width: 700px)` block in app/src/styles.css whose selector
// mentions the class token (e.g. `.chq-tabbar .chq-nav-link` counts) and
// declares `min-height: 44px`, or (b) a written exemption below, mirroring
// NOT_PHONE_ONLY in app/src/phone-block-visibility.test.ts.
//
// All 12 requested classes exist in app/src (verified by grep), so none were
// dropped from the requested list.
const TAP_FLOOR_VOCAB = [
  "chq-btn",
  "chq-btn-primary",
  "chq-btn-secondary",
  "chq-btn-tertiary",
  "chq-input",
  "chq-select",
  "chq-textarea",
  "chq-file",
  "chq-pill",
  "chq-nav-link",
  "chq-rail-link",
  "chq-checkbox-label",
];

// Classes that never carry their own min-height rule because they are always
// rendered alongside `.chq-btn` in markup (grep confirms every
// `chq-btn-primary`/`chq-btn-secondary` usage in app/src is combined with
// `chq-btn` on the same element, e.g. `className="chq-btn chq-btn-primary"`)
// and their own CSS rules (styles.css lines ~529-546) only ever set
// color/font-weight/background, never height or padding that would override
// `.chq-btn`'s phone min-height: 44px rule.
export const TAP_FLOOR_EXEMPT: Array<[selector: string, reason: string]> = [
  [
    "chq-btn-primary",
    "always paired with .chq-btn in markup; only overrides color/font-weight, " +
      "inherits .chq-btn's phone min-height: 44px rule",
  ],
  [
    "chq-btn-secondary",
    "always paired with .chq-btn in markup; only overrides color/border/font-weight, " +
      "inherits .chq-btn's phone min-height: 44px rule",
  ],
];
const TAP_FLOOR_EXEMPT_SET = new Set(TAP_FLOOR_EXEMPT.map(([selector]) => selector));

/** CSS comments are stripped before any structural scan. Since the DEC-385
 * wave-100/102 forward-merges (v12m-w3-k for this sheet), the single terminal
 * phone block carries cascade-shadow receipts that quote CSS inline -- e.g.
 * `/* beats the desktop .chq-main{padding} at :487-491 *\/` at styles.css
 * :2538. Those literal braces sit INSIDE a rule body, so the brace-pair
 * grammar below could not match the block at all and phoneMediaBodies
 * returned zero bodies, failing every vocabulary member at once. Comments
 * carry no declarations, so dropping them first is both safe and necessary. */
const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Strips top-level @media {...} blocks (one level of nested braces), then
 * returns only the CONTENTS of every @media (max-width: 700px) block found
 * in the original source. Mirrors phone-block-visibility.test.ts's
 * stripMedia helper, but keeps the phone-query bodies instead of discarding
 * them. Callers must pass comment-stripped CSS (see stripComments). */
function phoneMediaBodies(css: string): string[] {
  const bodies: string[] = [];
  const re = /@media\s*\(max-width:\s*700px\)\s*\{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    if (m[1] !== undefined) bodies.push(m[1]);
  }
  return bodies;
}

/** All rule bodies within `css` whose selector list mentions `classToken`
 * (matched as a class token, e.g. `.chq-tabbar .chq-nav-link` matches
 * `chq-nav-link`) -- not requiring exact selector equality. */
function rulesMentioningClass(css: string, classToken: string): string[] {
  const bodies: string[] = [];
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(css))) {
    const selectorList = m[1];
    const body = m[2];
    if (selectorList === undefined || body === undefined) continue;
    if (new RegExp(`\\.${classToken}\\b`).test(selectorList)) {
      bodies.push(body);
    }
  }
  return bodies;
}

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

describe("44px tap-target floor is a POSITIVE invariant (DEC-394 amendment, wave 12)", () => {
  it("scanned at least 5 vocabulary members", () => {
    // Guards against this describe block passing vacuously if the
    // vocabulary list above is ever emptied.
    expect(TAP_FLOOR_VOCAB.length).toBeGreaterThanOrEqual(5);
  });

  const stylesCss = stripComments(readFileSync(STYLES_CSS_PATH, "utf8"));
  const phoneBodies = phoneMediaBodies(stylesCss).join("\n");

  it("found at least one phone block to scan", () => {
    // Fail loudly rather than vacuously: if the grammar above ever stops
    // matching styles.css (as it did before comments were stripped), every
    // per-token assertion below fails for the wrong reason.
    expect(phoneMediaBodies(stylesCss).length).toBeGreaterThanOrEqual(1);
  });

  for (const classToken of TAP_FLOOR_VOCAB) {
    it(`.${classToken} reaches min-height: 44px on phone (or is exempt)`, () => {
      if (TAP_FLOOR_EXEMPT_SET.has(classToken)) {
        return; // exempt: see TAP_FLOOR_EXEMPT for the reviewable reason
      }
      const bodies = rulesMentioningClass(phoneBodies, classToken);
      const hasFloor = bodies.some((body) => /min-height:\s*44px/.test(body));
      expect(
        hasFloor,
        `.${classToken} has no rule inside an @media (max-width: 700px) block in ` +
          `${STYLES_CSS_PATH} declaring min-height: 44px, and is not in TAP_FLOOR_EXEMPT`,
      ).toBe(true);
    });
  }
});

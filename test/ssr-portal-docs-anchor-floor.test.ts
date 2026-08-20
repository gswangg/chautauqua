// Docs / home / portal / error-state SSR anchor floor receipt (task w14-ee,
// DEC-393 wave-139 taxonomy, DEC-367 wave-138 padding-evasion mirror case).
//
// This pins the disposition the task's TOKENS list assigned to eleven
// tokens across four SSR CSS-in-TS modules: a REAL FLOOR (min-height >=44px
// + display:flex/inline-flex + align-items:center + non-zero horizontal
// padding, inside the sheet's one terminal `@media (max-width: 700px)`
// block, per DEC-385), or an explicit `tap-floor-exempt:` comment naming
// the sibling/base class it composes onto. Reuses the shared scanning
// primitives from app/src/phone-tap-target-scan/core.ts and ssr.ts rather
// than growing a second copy of the same grammar (DEC-613).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  hasMinHeightFloor,
  horizontalPaddingNonZero,
  narrowMediaRules,
  selectorMentionsToken,
  stripComments,
} from "../app/src/phone-tap-target-scan/core";
import { extractCssTsLiteral } from "../app/src/phone-tap-target-scan/ssr";

const REPO_ROOT = join(__dirname, "..");

function loadLiteral(relPath: string): string {
  const raw = readFileSync(join(REPO_ROOT, relPath), "utf-8");
  return extractCssTsLiteral(raw);
}

/** Every rule (top-level anywhere in the module's raw source, including
 * inside the terminal phone block) whose selector mentions `token` as a
 * real class boundary, immediately preceded -- with only whitespace
 * between -- by a `tap-floor-exempt:` block comment. Mirrors core.ts's
 * `hasExemptionForToken` grammar exactly (a literal `/* tap-floor-exempt:
 * ... *\/` immediately above a rule mentioning the token), applied to the
 * RAW (unstripped) text so the comment itself is visible. */
function hasExemptOverride(raw: string, token: string): boolean {
  const re = /\/\*\s*tap-floor-exempt:[^*]*\*\/\s*[^{}]*\{[^{}]*\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const chunk = m[0];
    const selectorPart = chunk.slice(0, chunk.indexOf("{"));
    // Strip the exemption comment itself out of the selector text before
    // testing for the token, mirroring core.ts's stripComments discipline.
    const selectorOnly = stripComments(selectorPart).trim();
    if (selectorMentionsToken(selectorOnly, token) || new RegExp(`\\.${token}(?![\\w-])`).test(selectorOnly)) {
      return true;
    }
  }
  return false;
}

/** core.ts's own `hasFlexCenter` requires `display: flex` verbatim, so it
 * is blind to `display: inline-flex` (a known predicate literal, field
 * guide DEC-976 w126/w138 "hasFlexCenter misses inline-flex"). This
 * receipt's population genuinely uses both shapes (error-states.css.ts
 * mirrors its SPA twin's `inline-flex` byte-for-byte for
 * test/error-vocabulary-parity.scan.test.ts), so the local check accepts
 * either -- broader than the production scan, never narrower. */
function hasFlexCenterLoose(body: string): boolean {
  return /display\s*:\s*(?:inline-)?flex/.test(body) && /align-items\s*:\s*center/.test(body);
}

/** True when SOME rule inside the sheet's <=700px block(s) reaching
 * `token` satisfies the full real-floor grammar: min-height>=44px,
 * display:flex/inline-flex + align-items:center, and non-zero horizontal
 * padding -- reusing core.ts's own predicates so this receipt cannot drift
 * from the production scan's definition of "floored" (DEC-613). */
function isReallyFloored(raw: string, token: string): boolean {
  const reaching = narrowMediaRules(raw, 700).filter((r) => selectorMentionsToken(r.selector, token));
  if (reaching.length === 0) return false;
  const body = reaching.map((r) => r.body).join(" ");
  return hasMinHeightFloor(body) && hasFlexCenterLoose(body) && horizontalPaddingNonZero(body);
}

/** True when SOME narrow-media rule reaching `token` declares a bare
 * `min-height: >=44px` (the DECLARED-floor grammar `.chq-portal-row` /
 * `.chq-portal-submission-row` need, per the task's own instruction --
 * a scan cannot infer a height from padding, so the declaration itself is
 * the receipt, independent of flex-center/padding). */
function hasDeclaredFloor(raw: string, token: string): boolean {
  const reaching = narrowMediaRules(raw, 700).filter((r) => selectorMentionsToken(r.selector, token));
  if (reaching.length === 0) return false;
  const body = reaching.map((r) => r.body).join(" ");
  return hasMinHeightFloor(body);
}

const HOME_CSS = loadLiteral("src/routes/public/home.css.ts");
const DOCS_CSS = loadLiteral("src/routes/docs-site.css.ts");
const ERROR_STATES_CSS = loadLiteral("src/views/error-states.css.ts");
const PORTAL_CSS = loadLiteral("src/routes/portal/portal.css.ts");

describe("task w14-ee: docs/home/portal/error-state SSR anchor floor disposition", () => {
  describe("REAL FLOOR tokens", () => {
    const cases: Array<[string, string, string]> = [
      ["home.css.ts", HOME_CSS, "chq-home-name"],
      ["home.css.ts", HOME_CSS, "chq-home-archive-name"],
      ["home.css.ts", HOME_CSS, "chq-home-footer-link"],
      ["docs-site.css.ts", DOCS_CSS, "chq-docs-wordmark"],
      ["docs-site.css.ts", DOCS_CSS, "chq-docs-nav-link"],
      ["docs-site.css.ts", DOCS_CSS, "chq-docs-article-title"],
      ["docs-site.css.ts", DOCS_CSS, "chq-docs-where-next-where"],
    ];
    for (const [file, css, token] of cases) {
      it(`${file}: .${token} carries min-height>=44px + flex-center + non-zero horizontal padding inside a <=700px block`, () => {
        expect(isReallyFloored(css, token)).toBe(true);
      });
    }
  });

  describe("MODIFIER / COMPOSITION exempt tokens", () => {
    const cases: Array<[string, string, string]> = [
      ["docs-site.css.ts", DOCS_CSS, "chq-docs-nav-link-active"],
      ["docs-site.css.ts", DOCS_CSS, "chq-docs-leaving-row-link"],
    ];
    for (const [file, css, token] of cases) {
      it(`${file}: .${token} carries an explicit tap-floor-exempt comment naming its base/sibling class`, () => {
        expect(hasExemptOverride(css, token)).toBe(true);
      });
    }

    // .chq-error-summary-link (error-states.css.ts): a REAL FLOOR is the
    // token's disposition per the TOKENS list, but this module is composed
    // into THREE sheets (CFP_CSS/PORTAL_CSS/AUTH_CSS) each of which owns
    // exactly one terminal @media block (DEC-385/test/phone-terminal-block
    // .scan.test.ts) -- giving this shared value-free module its OWN
    // @media block injects a second, earlier occurrence into every
    // composed sheet and breaks test/cfp-phone-frames.test.ts's own
    // DEC-385 ordering assertion (measured directly: adding the block
    // moved CFP_CSS's first "@media (max-width: 700px)" index from after
    // BARE_PAGE_CSS's desktop declarations to before them). Flagged as a
    // design gap outside this task's owned files (cfp.css.ts/auth.css.ts)
    // rather than widened into them; recorded here as an explicit
    // exemption so the gap is visible, not silently dropped.
    it("error-states.css.ts: .chq-error-summary-link carries an explicit tap-floor-exempt comment explaining the composition constraint (design gap, flagged not fixed)", () => {
      expect(hasExemptOverride(ERROR_STATES_CSS, "chq-error-summary-link")).toBe(true);
    });
  });

  describe("DECLARED min-height:44px tokens (whole-row links; padding alone is not a receipt)", () => {
    const cases: Array<[string, string, string]> = [
      ["portal.css.ts", PORTAL_CSS, "chq-portal-row"],
      ["portal.css.ts", PORTAL_CSS, "chq-portal-submission-row"],
    ];
    for (const [file, css, token] of cases) {
      it(`${file}: .${token} declares min-height:44px in the <=700px block`, () => {
        expect(hasDeclaredFloor(css, token)).toBe(true);
      });
    }
  });

  describe("DEC-367 wave-138 mirror case: .chq-portal-back / -footer-resources / -footer-profile", () => {
    const tokens = ["chq-portal-back", "chq-portal-footer-resources", "chq-portal-footer-profile"];
    for (const token of tokens) {
      it(`portal.css.ts: .${token} pairs min-height:44px with non-zero horizontal padding (the evasion the ruling names)`, () => {
        const reaching = narrowMediaRules(PORTAL_CSS, 700).filter((r) => selectorMentionsToken(r.selector, token));
        expect(reaching.length).toBeGreaterThan(0);
        const body = reaching.map((r) => r.body).join(" ");
        expect(hasMinHeightFloor(body)).toBe(true);
        expect(horizontalPaddingNonZero(body)).toBe(true);
      });
    }
  });

  describe("negative control: a synthetic bare min-height rule with no padding is NOT real-floored", () => {
    it("proves isReallyFloored/hasExemptOverride are not vacuously true", () => {
      const fixture = `
        @media (max-width: 700px) {
          .chq-fixture-bare { min-height: 44px; }
        }
      `;
      expect(isReallyFloored(fixture, "chq-fixture-bare")).toBe(false);
      expect(hasDeclaredFloor(fixture, "chq-fixture-bare")).toBe(true);
      expect(hasExemptOverride(fixture, "chq-fixture-bare")).toBe(false);
    });
    it("an ordinary (non-exemption) comment does not count as an exemption", () => {
      const fixture = `
        /* just a normal design comment, not an exemption */
        .chq-fixture-commented { color: red; }
      `;
      expect(hasExemptOverride(fixture, "chq-fixture-commented")).toBe(false);
    });
  });

  describe("DEC-367.md citation is drift-proof bare-path (no re-pointed :line)", () => {
    it("cites src/routes/portal/portal.css.ts by bare path with a verbatim-resolving quote, never portal.css.ts:<line>", () => {
      // Merge-train repair (wave-16 batch): this assertion used to pin the
      // literal quote `.chq-portal-footer-profile { min-height: 44px; }`.
      // That quote stopped resolving once the w13-ff width repair landed
      // (`min-width: 44px; padding: 0 8px;` joined the rule), so w16-cc
      // re-anchored DEC-367's citation onto a quote that DOES resolve --
      // and this assertion, keyed on the stale text, was the last thing
      // still demanding the broken one. It is now RESOLVED BY SEARCH rather
      // than hardcoded, which is DEC-967's own convention: whatever quote
      // the ruling carries must resolve verbatim in the cited file, so the
      // check survives the next edit to the rule instead of pinning one
      // wave's wording forever.
      const dec367 = readFileSync(join(REPO_ROOT, "src/decisions-data/DEC-367.md"), "utf-8");
      expect(dec367).not.toMatch(/portal\.css\.ts:\d+/);

      const quotes = [...dec367.matchAll(/portal\.css\.ts`([^`]+)`/g)].map((m) => m[1] ?? "");
      expect(quotes.length, "DEC-367.md carries no bare-path portal.css.ts citation at all").toBeGreaterThan(0);
      const resolving = quotes.filter((q) => PORTAL_CSS.includes(q));
      expect(
        resolving.length,
        `no bare-path portal.css.ts citation in DEC-367.md resolves verbatim in the sheet. Quotes found:\n${quotes.join("\n")}`,
      ).toBeGreaterThan(0);

      // The rule the ruling is ABOUT still declares its floor, whatever
      // wording the citation above happens to quote. (The floor+padding
      // grading this ruling actually requires is asserted by the "DEC-367
      // wave-138 mirror case" describe above, which is where that predicate
      // lives -- not repeated here under a stricter one.)
      expect(PORTAL_CSS).toContain(".chq-portal-footer-profile { min-height: 44px;");
    });
  });
});

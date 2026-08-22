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
import { stripCssComments } from "./helpers/strip-css-comments";

// DEC-367 wave-24 amendment, clause (a): findViolations() below used to run
// its declaration regex over RAW source, so the frame-quoting comment idiom
// this campaign uses everywhere (src/routes/portal/portal.css.ts:~327's
// DEC-576 comment, which quotes docs/design/Chautauqua Public and
// Portal.dc.html:541's `min-height:44px` VERBATIM as drift-proof citation
// text) manufactured a false positive: the literal sat inside a comment,
// never a declaration. Declarations are now matched against a
// comment-stripped copy (test/helpers/strip-css-comments.ts, DEC-613 --
// never a second private stripper). `stripCssComments` replaces a removed
// comment's body with the SAME COUNT of newlines it contained, so line
// numbers computed off the stripped text agree with the original file's
// line numbers even though byte offsets within a line do not; exemption
// and base-scope receipt comments are therefore looked up by LINE against
// the ORIGINAL (unstripped) source, never by character offset into the
// stripped one.

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

/** Walks upward from `lineIdx` (0-based, exclusive of `lineIdx` itself) past
 * blank lines AND a bare rule-opener line (a selector ending in `{` with no
 * comment on it -- the house idiom puts a `tap-floor-exempt:` comment
 * directly above the DECLARATION, inside the rule body, but a receipt
 * comment documenting the whole rule -- this campaign's `tap-floor-base-
 * scope:` shape -- sits above the SELECTOR, outside it) in `origLines` to
 * find the nearest real comment/content line, or undefined if none exists
 * above it. */
function nearestNonBlankAbove(origLines: string[], lineIdx: number): string | undefined {
  for (let i = lineIdx - 1; i >= 0; i--) {
    const line = (origLines[i] ?? "").trim();
    if (line === "") continue;
    if (/\{\s*$/.test(line) && !line.includes("/*")) continue;
    return line;
  }
  return undefined;
}

/** True if the line immediately before 1-based `line` carries a
 * `tap-floor-exempt:` comment naming a structural reason, read from the
 * ORIGINAL (unstripped) source so the comment itself is visible. */
function hasExemptComment(origLines: string[], line: number): boolean {
  const nearest = nearestNonBlankAbove(origLines, line - 1);
  return nearest !== undefined && /\/\*\s*tap-floor-exempt:\s*\S.*\*\//.test(nearest);
}

/** DEC-367 wave-24 amendment, clause (b): a SECOND receipt shape, legal
 * ONLY for files under src/routes/portal/ and ONLY when its stated reason
 * names DESIGN-RULINGS.md item 6 (the portal has no separate desktop
 * design, so a base-scope 44px control there is not a leak -- it is the
 * control's only floor). Any other file, or a receipt with no such
 * citation, is not recognised -- the narrow grammar this ruling asks for. */
function hasBaseScopeReceipt(rel: string, origLines: string[], line: number): boolean {
  if (!rel.startsWith("src/routes/portal/")) return false;
  const nearest = nearestNonBlankAbove(origLines, line - 1);
  if (nearest === undefined) return false;
  if (!/\/\*\s*tap-floor-base-scope:\s*\S.*\*\//.test(nearest)) return false;
  return /DESIGN-RULINGS\.md item 6/.test(nearest);
}

/** Finds every base-scope (non-phone-media, non-exempt, non-base-scope-
 * receipted) `min-height`/`min-width: 44px` declaration in `src`, returning
 * `file:line` strings. Declarations are matched against a comment-stripped
 * copy of `src` (a frame-quoting comment can contain the same literal
 * without being a declaration); exemption/receipt comments are read from
 * the ORIGINAL source by line number, since stripping removes them. */
function findViolations(rel: string, src: string): string[] {
  const stripped = stripCssComments(src);
  const origLines = src.split("\n");
  const ranges = phoneMediaRanges(stripped);
  const violations: string[] = [];
  const re = /min-(?:height|width):\s*44px/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped))) {
    if (isInsideAnyRange(m.index, ranges)) continue;
    const line = stripped.slice(0, m.index).split("\n").length;
    // A receipt/exemption comment may sit immediately above the
    // DECLARATION line (the house idiom when it is the rule's only/first
    // property) or immediately above the enclosing RULE's own selector
    // line (the house idiom for a receipt documenting the whole rule, e.g.
    // DEC-576's .chq-portal-headshot-pick, where min-height is one of
    // several properties) -- checked at both anchors, either is enough.
    const openBraceIdx = stripped.lastIndexOf("{", m.index);
    const selectorLine = openBraceIdx === -1 ? undefined : stripped.slice(0, openBraceIdx).split("\n").length;
    const exempt =
      hasExemptComment(origLines, line) || (selectorLine !== undefined && hasExemptComment(origLines, selectorLine));
    const receipted =
      hasBaseScopeReceipt(rel, origLines, line) ||
      (selectorLine !== undefined && hasBaseScopeReceipt(rel, origLines, selectorLine));
    if (exempt || receipted) continue;
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

  it("positive control (clause a): a commented-out base-scope 44px string is NOT flagged -- it is a frame-quoting citation, not a declaration", () => {
    const synthetic = `
export const FAKE_CSS = \`
  /* frame citation: docs/design/Some Frame.dc.html:1 draws
     \\\`min-height:44px\\\` on this control. */
  .chq-fake {
    background: red;
  }
\`;
`;
    expect(findViolations("synthetic.css.ts", synthetic)).toEqual([]);
  });

  it("negative control (clause b): a base-scope-receipted 44px string in a NON-portal file IS still flagged -- the receipt is legal only under src/routes/portal/", () => {
    const synthetic = `
export const FAKE_CSS = \`
  /* tap-floor-base-scope: DESIGN-RULINGS.md item 6 -- the portal has no separate desktop design */
  .chq-fake {
    min-height: 44px;
  }
\`;
`;
    expect(findViolations("src/routes/auth.css.ts", synthetic)).toEqual(["src/routes/auth.css.ts:5"]);
  });

  it("negative control (clause b): a base-scope-receipted 44px string under src/routes/portal/ citing DESIGN-RULINGS.md item 6 is NOT flagged", () => {
    const synthetic = `
export const FAKE_CSS = \`
  /* tap-floor-base-scope: DESIGN-RULINGS.md item 6 -- the portal has no separate desktop design */
  .chq-fake {
    min-height: 44px;
  }
\`;
`;
    expect(findViolations("src/routes/portal/portal.css.ts", synthetic)).toEqual([]);
  });

  it("negative control (clause b): a base-scope receipt under src/routes/portal/ that does NOT name item 6 is still flagged -- the reason must be stated, not just the shape", () => {
    const synthetic = `
export const FAKE_CSS = \`
  /* tap-floor-base-scope: it just looked right */
  .chq-fake {
    min-height: 44px;
  }
\`;
`;
    expect(findViolations("src/routes/portal/portal.css.ts", synthetic)).toEqual(["src/routes/portal/portal.css.ts:5"]);
  });

  // docs/design/Chautauqua Public and Portal.dc.html:541 draws `min-height:44px`
  it("the real portal sheet's receipted base-scope 44px floor is NOT flagged -- pays for this file's header-block scope citation into that frame with an assertion, not a comment (DEC-976)", () => {
    const portal = sources.find((s) => s.path === "src/routes/portal/portal.css.ts");
    expect(portal, "src/routes/portal/portal.css.ts must be in the swept SSR population").toBeDefined();
    expect(findViolations(portal!.path, portal!.text)).toEqual([]);
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

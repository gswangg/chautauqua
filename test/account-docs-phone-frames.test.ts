// Task w1-h: phone-geometry pins for the "Sign in · 390" and "Docs · an
// article · 390" frames, each receipted below at its own describe block
// (DEC-976: one quoted citation next to its expect(), not restated here
// with none nearby). Pure string scans of the stylesheet .ts modules --
// jsdom never evaluates @media rules, so this mirrors
// test/account-password-phone.test.ts's own source-scan style rather than
// asserting computed style.
//
// DEC-994 (wave 29): a pin that spells a rule's WHOLE selector list into a
// regex breaks the moment a correct lane adds or reorders a sibling
// selector on that same rule -- the drawn geometry gets more conformant
// and the pin reddens anyway. Repaired here by resolving the DECLARATION
// that governs a single named selector via
// `test/helpers/css-media-blocks.ts`'s `resolvePhoneDeclaration`, which
// contains that selector as a whole compound in the rule's selector list
// rather than matching the list's literal text. Converted under this
// ruling: the "card email/password inputs take the frame's 50px
// min-height" case (the file's one red) and the "prev/next pager is a
// filled, edge-to-edge button bar at 46px on phone" case's second
// assertion, which spelled the same two-selector-list shape.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolvePhoneDeclaration } from "./helpers/css-media-blocks";

const REPO_ROOT = join(__dirname, "..");
const AUTH_CSS_TS = readFileSync(join(REPO_ROOT, "src/routes/auth.css.ts"), "utf-8");
const DOCS_SITE_CSS_TS = readFileSync(join(REPO_ROOT, "src/routes/docs-site.css.ts"), "utf-8");

/** Extracts the contents of every `@media (max-width: 700px) { ... }` block
 * via balanced-brace scanning (mirrors account-password-phone.test.ts). */
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

// DEC-613 (wave-29 integration): the local terminal-block / rule-resolver
// pair wave 28 added here was a second copy of the vocabulary
// test/helpers/css-media-blocks.ts's `resolvePhoneDeclaration` already owns.
// Deleted rather than kept as a same-name, different-semantics twin.

describe('"Sign in · 390" phone geometry (docs/design/Chautauqua Account.dc.html:121 `<div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">`)', () => {
  const authBlocks = extract700Blocks(AUTH_CSS_TS);
  const combined = authBlocks.join("\n");

  it("wordmark is 26px on phone, not the desktop card's 28px", () => {
    expect(combined).toMatch(/\.chq-auth-wordmark\s*\{[^}]*font-size:\s*26px/);
  });

  // DEC-994 wave-28/29 amendments: resolve the DECLARATION that governs the
  // selector, never a hand-typed selector-pair regex -- a wave-26 lane
  // correctly added a third sibling (.chq-input) to this same rule to
  // close a real 48px-vs-50px offender, and the old literal-pair regex
  // went red although the drawn geometry got MORE conformant. Adding or
  // reordering a sibling selector in this rule can never redden this pin;
  // only deleting the min-height declaration can. The resolver lives in
  // test/helpers/css-media-blocks.ts, one shared home (DEC-613).
  it("card email/password inputs take the frame's 50px min-height (docs/design/Chautauqua Account.dc.html:130 `min-height:50px;`)", () => {
    expect(resolvePhoneDeclaration(AUTH_CSS_TS, ".chq-auth-card input[type=email]", "min-height")).toBe(
      "50px",
    );
    expect(resolvePhoneDeclaration(AUTH_CSS_TS, ".chq-auth-card input[type=password]", "min-height")).toBe(
      "50px",
    );
  });

  it("the submit control is full width at 50px/15px, stacked with the tertiary link below it", () => {
    expect(combined).toMatch(/\.chq-auth-card button\[type=submit\]\s*\{[^}]*width:\s*100%;[^}]*min-height:\s*50px;[^}]*font-size:\s*15px;/);
    expect(combined).toMatch(/\.chq-auth-submitrow\s*\{[^}]*flex-direction:\s*column-reverse;/);
  });

  it("the footer draws the frame's --chq-hairline rule at 18px and 15px links", () => {
    expect(combined).toMatch(/\.chq-auth-footer\s*\{[^}]*border-top-color:\s*var\(--chq-hairline\);[^}]*padding-top:\s*18px;/);
    expect(combined).toMatch(/\.chq-auth-footer-links a\s*\{[^}]*font-size:\s*15px;/);
  });

  // DEC-919 wave-116: the blessed deviation (DEVIATIONS.md:119-134) rules
  // /login KEEPS "Forgot your password?" at 390, re-lined beneath the
  // full-width Sign in button -- not hidden. Wave-101's
  // .chq-auth-stack-scoped `display: none` on .chq-auth-tertiary
  // out-specified the re-line and removed the link from the phone screen;
  // that rule is deleted. Pin the cascade so it cannot return under any
  // other selector, at any max-width, ever again.
  it("no selector naming .chq-auth-tertiary declares display:none inside any max-width media block, and the phone rule floors it at 44px", () => {
    const ALL_MAX_WIDTH_MARKER = /@media\s*\(max-width:\s*\d+px\)/g;
    const mediaBlockContents: string[] = [];
    let markerMatch: RegExpExecArray | null;
    while ((markerMatch = ALL_MAX_WIDTH_MARKER.exec(AUTH_CSS_TS)) !== null) {
      const openBrace = AUTH_CSS_TS.indexOf("{", markerMatch.index);
      let depth = 0;
      let i = openBrace;
      for (; i < AUTH_CSS_TS.length; i++) {
        if (AUTH_CSS_TS[i] === "{") depth++;
        else if (AUTH_CSS_TS[i] === "}") {
          depth--;
          if (depth === 0) break;
        }
      }
      mediaBlockContents.push(AUTH_CSS_TS.slice(openBrace + 1, i));
    }
    expect(mediaBlockContents.length).toBeGreaterThan(0);
    const allMaxWidthCss = mediaBlockContents.join("\n");
    // No rule whose selector names .chq-auth-tertiary (scoped or bare) may
    // pair that selector with display:none anywhere in a max-width block.
    for (const ruleMatch of allMaxWidthCss.matchAll(/([^{}]*\.chq-auth-tertiary[^{}]*)\{([^}]*)\}/g)) {
      const [, selector, body] = ruleMatch;
      expect(body, `selector "${(selector ?? "").trim()}" must not hide .chq-auth-tertiary`).not.toMatch(
        /display:\s*none/,
      );
    }
    expect(combined).toMatch(/\.chq-auth-tertiary\s*\{[^}]*min-height:\s*44px/);
  });
});

describe('"Docs · an article · 390" phone geometry (docs/design/Chautauqua Docs.dc.html:166 `<div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">`)', () => {
  it("H1 already lands at the frame's 28px (docs-site.css.ts's shared phone block)", () => {
    expect(DOCS_SITE_CSS_TS).toMatch(/\.chq-docs-article-head h1\s*\{[^}]*font-size:\s*28px/);
  });

  it("the figure goes edge to edge (100vw, -16px inline margin) with top/bottom-only hairlines", () => {
    expect(DOCS_SITE_CSS_TS).toMatch(/\.chq-docs-figure\s*\{[^}]*width:\s*100vw;[^}]*max-width:\s*100vw;[^}]*margin-inline:\s*-16px;/);
    expect(DOCS_SITE_CSS_TS).toMatch(/\.chq-docs-figure-frame\s*\{\s*border-left:\s*none;\s*border-right:\s*none;\s*border-radius:\s*0;\s*\}/);
  });

  // DEC-994 wave-28 amendment: the prev/next pair pin is the second
  // hand-typed selector-pair regex of this shape in the file (swept per
  // the amendment's instruction) -- rebuilt to resolve the DECLARATION
  // that governs each selector so a sibling addition/reorder can never
  // redden it.
  it("the prev/next pager is a filled, edge-to-edge button bar at 46px on phone", () => {
    expect(DOCS_SITE_CSS_TS).toMatch(
      /\.chq-docs-pager\s*\{[^}]*border-top:\s*1px solid var\(--chq-ink\);[^}]*background:\s*var\(--chq-surface-sunk\);[^}]*padding:\s*12px 16px 16px;/,
    );
    for (const selector of [".chq-docs-pager-prev", ".chq-docs-pager-next"]) {
      expect(resolvePhoneDeclaration(DOCS_SITE_CSS_TS, selector, "flex")).toBe("1");
      expect(resolvePhoneDeclaration(DOCS_SITE_CSS_TS, selector, "min-height")).toBe("46px");
      expect(resolvePhoneDeclaration(DOCS_SITE_CSS_TS, selector, "font-size")).toBe("13px");
      expect(resolvePhoneDeclaration(DOCS_SITE_CSS_TS, selector, "font-weight")).toBe("600");
    }
  });

  it("desktop pager stays a bare divider (max-width 680, --chq-rule top border) -- phone-only override", () => {
    const desktopRule = DOCS_SITE_CSS_TS.match(/\.chq-docs-pager\s*\{([^}]*)\}/);
    expect(desktopRule, "expected the desktop .chq-docs-pager rule").not.toBeNull();
    expect(desktopRule![1]).toMatch(/max-width:\s*680px/);
    expect(desktopRule![1]).toMatch(/border-top:\s*1px solid var\(--chq-rule\)/);
  });
});

// DEC-994 (wave 29) synthetic controls: over FIXTURE CSS this test writes
// itself, never over the live sheet -- a control run against the sheet a
// lane just fixed would eat its own repair and prove nothing (the
// "sentinel eats its own fix" trap).
describe("resolvePhoneDeclaration (DEC-994 repair contract)", () => {
  const FIXTURE_CSS = `
    .chq-widget {
      color: red;
    }
    @media (max-width: 700px) {
      .chq-thing-a input[type=email],
      .chq-thing-a input[type=password] {
        min-height: 50px;
      }
    }
  `;

  it("(a) adding a fourth sibling selector to the rule does not change the resolved value", () => {
    const before = resolvePhoneDeclaration(FIXTURE_CSS, ".chq-thing-a input[type=email]", "min-height");
    expect(before).toBe("50px");

    const withSibling = FIXTURE_CSS.replace(
      ".chq-thing-a input[type=email],\n      .chq-thing-a input[type=password] {",
      ".chq-thing-a input[type=email],\n      .chq-thing-a input[type=password],\n      .chq-thing-a .chq-input {",
    );
    // Confirm the fixture actually changed shape before trusting the result.
    expect(withSibling).not.toBe(FIXTURE_CSS);
    const after = resolvePhoneDeclaration(withSibling, ".chq-thing-a input[type=email]", "min-height");
    expect(after).toBe("50px");
    expect(
      resolvePhoneDeclaration(withSibling, ".chq-thing-a .chq-input", "min-height"),
    ).toBe("50px");
  });

  it("(b) deleting the min-height declaration makes the resolver fail loudly", () => {
    const withoutDeclaration = FIXTURE_CSS.replace("min-height: 50px;\n      }", "}");
    expect(withoutDeclaration).not.toBe(FIXTURE_CSS);
    expect(() =>
      resolvePhoneDeclaration(withoutDeclaration, ".chq-thing-a input[type=email]", "min-height"),
    ).toThrow(/declares no "min-height" property/);
  });

  it("throws (never returns undefined) when the selector names no rule in the phone block", () => {
    expect(() => resolvePhoneDeclaration(FIXTURE_CSS, ".chq-nonexistent", "min-height")).toThrow(
      /no rule in the phone block has/,
    );
  });
});

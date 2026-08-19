// Task w1-h: phone-geometry pins for the "Sign in · 390" and "Docs · an
// article · 390" frames, each receipted below at its own describe block
// (DEC-976: one quoted citation next to its expect(), not restated here
// with none nearby). Pure string scans of the stylesheet .ts modules --
// jsdom never evaluates @media rules, so this mirrors
// test/account-password-phone.test.ts's own source-scan style rather than
// asserting computed style.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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

describe('"Sign in · 390" phone geometry (docs/design/Chautauqua Account.dc.html:121 `<div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">`)', () => {
  const authBlocks = extract700Blocks(AUTH_CSS_TS);
  const combined = authBlocks.join("\n");

  it("wordmark is 26px on phone, not the desktop card's 28px", () => {
    expect(combined).toMatch(/\.chq-auth-wordmark\s*\{[^}]*font-size:\s*26px/);
  });

  it("card email/password inputs take the frame's 50px min-height", () => {
    expect(combined).toMatch(
      /\.chq-auth-card input\[type=email\],\s*\n\s*\.chq-auth-card input\[type=password\]\s*\{[^}]*min-height:\s*50px/,
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
});

describe('"Docs · an article · 390" phone geometry (docs/design/Chautauqua Docs.dc.html:166 `<div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">`)', () => {
  it("H1 already lands at the frame's 28px (docs-site.css.ts's shared phone block)", () => {
    expect(DOCS_SITE_CSS_TS).toMatch(/\.chq-docs-article-head h1\s*\{[^}]*font-size:\s*28px/);
  });

  it("the figure goes edge to edge (100vw, -16px inline margin) with top/bottom-only hairlines", () => {
    expect(DOCS_SITE_CSS_TS).toMatch(/\.chq-docs-figure\s*\{[^}]*width:\s*100vw;[^}]*max-width:\s*100vw;[^}]*margin-inline:\s*-16px;/);
    expect(DOCS_SITE_CSS_TS).toMatch(/\.chq-docs-figure-frame\s*\{\s*border-left:\s*none;\s*border-right:\s*none;\s*border-radius:\s*0;\s*\}/);
  });

  it("the prev/next pager is a filled, edge-to-edge button bar at 46px on phone", () => {
    expect(DOCS_SITE_CSS_TS).toMatch(
      /\.chq-docs-pager\s*\{[^}]*border-top:\s*1px solid var\(--chq-ink\);[^}]*background:\s*var\(--chq-surface-sunk\);[^}]*padding:\s*12px 16px 16px;/,
    );
    expect(DOCS_SITE_CSS_TS).toMatch(
      /\.chq-docs-pager-prev,\s*\n\s*\.chq-docs-pager-next\s*\{[^}]*flex:\s*1;[^}]*min-height:\s*46px;[^}]*font-size:\s*13px;[^}]*font-weight:\s*600;/,
    );
  });

  it("desktop pager stays a bare divider (max-width 680, --chq-rule top border) -- phone-only override", () => {
    const desktopRule = DOCS_SITE_CSS_TS.match(/\.chq-docs-pager\s*\{([^}]*)\}/);
    expect(desktopRule, "expected the desktop .chq-docs-pager rule").not.toBeNull();
    expect(desktopRule![1]).toMatch(/max-width:\s*680px/);
    expect(desktopRule![1]).toMatch(/border-top:\s*1px solid var\(--chq-rule\)/);
  });
});

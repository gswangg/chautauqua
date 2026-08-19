// v12m-w2-f: docs article at 390 (Tier 1, SSR; DEC-385) -- the "Docs · an
// article · 390" frame, receipted below at the describe block that actually
// exercises it (DEC-976: one quoted citation next to its expect(), not a
// second copy restated here with none nearby).
//
// Two kinds of coverage, mirroring test/account-password-phone.test.ts's
// split:
//   (a) a live GET /docs/:slug request, asserting the markup a phone
//       article needs is actually on the wire (back link, figure, pager).
//   (b) a source-scan of docs-site.css.ts's LAST @media (max-width: 700px)
//       block, proving the figure's edge-to-edge bleed, the pager's real
//       44px target pair, and the H1 drill-in register are declared there
//       and nowhere else (DEC-385: narrow overrides wide via max-width
//       media queries only, never a second scroll container or a wider
//       parent).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

vi.mock("../src/server/repo/public/home", () => ({
  getHubOrg: vi.fn(async () => null),
  listHubEvents: vi.fn(async () => ({ items: [], capped: false })),
}));

import { docsSiteRoutes } from "../src/routes/docs-site";
import { DOCS_ARTICLES } from "../src/routes/docs-content";
import { docsArticleNeighbours } from "../src/routes/docs-content/nav";
import { DOCS_SITE_CSS } from "../src/routes/docs-site.css";
import type { AppEnv } from "../src/server/env";

const REPO_ROOT = join(__dirname, "..");

// Mirrors test/docs-site.test.ts's buildApp — docsSiteRoutes is a Hono
// sub-app (DEC-012) that only resolves once mounted, and the search-hits
// no-match path needs `db` set even though this test never reaches it.
function buildApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", {} as AppEnv["Variables"]["db"]);
    await next();
  });
  app.route("/", docsSiteRoutes);
  return app;
}

// -----------------------------------------------------------------------
// (a) live-request coverage
// -----------------------------------------------------------------------

describe("GET /docs/:slug — phone article markup (docs/design/Chautauqua Docs.dc.html:166 `<div style=\"width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)\">`)", () => {
  it("renders the phone back link, an article figure, and (when neighbours exist) the pager", async () => {
    // An article with a real figure block, so the edge-to-edge-bleed
    // markup is actually exercised on the wire, not just in fixtures.
    const withFigure = DOCS_ARTICLES.find((a) => a.blocks.some((b) => b.kind === "figure")) ?? (() => { throw new Error("no fixture article carries a figure block"); })();
    const res = await buildApp().request(`/docs/${withFigure.slug}`); expect(res.status).toBe(200);
    const html = await res.text();

    // Head: the '‹ Docs' back link the phone chrome shows in place of the
    // desktop sticky nav (nav itself stays in the markup, hidden by CSS —
    // DEC-385 is CSS-only, never a server-side branch on viewport).
    expect(html).toContain('class="chq-docs-phone-back" href="/docs"');
    expect(html).toContain("‹ Docs");
    expect(html).toContain('class="chq-docs-nav"');

    // Body: the figure that must bleed edge to edge at 390.
    expect(html).toContain('class="chq-docs-figure"');
    expect(html).toContain('class="chq-docs-figure-caption"');

    // Footer: the pager, present because this fixture article has at
    // least one neighbour (docsArticleNeighbours mirrors DocsPager's own
    // guard, so this assertion can never pass on an article the renderer
    // itself would have skipped).
    const { prev, next } = docsArticleNeighbours(withFigure.slug);
    if (prev || next) {
      expect(html).toContain('class="chq-docs-pager"');
      if (prev) expect(html).toContain(`class="chq-docs-pager-prev" href="/docs/${prev.slug}"`);
      if (next) expect(html).toContain(`class="chq-docs-pager-next" href="/docs/${next.slug}"`);
    }
  });
});

// -----------------------------------------------------------------------
// (b) CSS source-scan
// -----------------------------------------------------------------------

/** Extracts the contents of every `@media (max-width: 700px) { ... }` block via balanced-brace scanning. */
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

describe("docs-site.css.ts phone block (DEC-385, source-scan)", () => {
  it("carries exactly one @media (max-width: 700px) block, and it is the LAST top-level construct in the file", () => {
    const blocks = extract700Blocks(DOCS_SITE_CSS);
    expect(blocks).toHaveLength(1);

    // A phone block declared before a later desktop rule loses at equal
    // specificity (field guide: content.css/comms.css both lost this
    // fight). Guard it here: nothing after the closing `}` of the 700px
    // block except the closing backtick of the template literal.
    const marker = "@media (max-width: 700px)";
    const idx = DOCS_SITE_CSS.indexOf(marker);
    const openBrace = DOCS_SITE_CSS.indexOf("{", idx);
    let depth = 0;
    let end = openBrace;
    for (; end < DOCS_SITE_CSS.length; end++) {
      if (DOCS_SITE_CSS[end] === "{") depth++;
      else if (DOCS_SITE_CSS[end] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    const trailing = DOCS_SITE_CSS.slice(end + 1);
    expect(trailing.trim()).toBe("");
  });

  it("the figure bleeds edge to edge with margin-inline on the figure itself, never a wider parent or a second scroll container", () => {
    const block = extract700Blocks(DOCS_SITE_CSS)[0]!;
    expect(block).toMatch(/\.chq-docs-figure\s*\{[^}]*margin-inline:\s*-16px/);
    expect(block).toMatch(/\.chq-docs-figure\s*\{[^}]*width:\s*100vw/);
    // The caption stays inset to the article's own gutter — only the
    // figure's own frame bleeds.
    expect(block).toMatch(/\.chq-docs-figure-caption\s*\{[^}]*padding-inline:\s*16px/);
    // No second scroll container introduced anywhere in the phone block.
    expect(block).not.toMatch(/overflow-(x|y)?:\s*(auto|scroll)/);
    // Never smuggled in via .chq-phone-* (DEC-385: SSR does not load
    // app/src/styles.css, so that vocabulary has no owner here).
    expect(DOCS_SITE_CSS).not.toMatch(/\.chq-phone-/);
  });

  it("the pager clears the 44px floor — min-height, centred flex, and real horizontal padding — for BOTH prev and next (docs/design/Chautauqua Docs.dc.html:201 `min-height:46px; display:flex; align-items:center; justify-content:center`)", () => {
    const block = extract700Blocks(DOCS_SITE_CSS)[0]!;
    const rule = block.match(/\.chq-docs-pager-prev,\s*\.chq-docs-pager-next\s*\{([^}]*)\}/);
    expect(rule).not.toBeNull();
    const body = rule![1]!;
    // The frame draws 46px, which already clears the 44px floor -- the
    // floor is a minimum, not a hand-authored literal to restate.
    expect(body).toMatch(/min-height:\s*46px/);
    expect(body).toMatch(/display:\s*flex/);
    expect(body).toMatch(/align-items:\s*center/);
    expect(body).toMatch(/justify-content:\s*center/);
    // Padding alone doesn't reach the floor (DESIGN-RULINGS.md), but its
    // absence is the more common evasion -- assert the real inset exists.
    expect(body).toMatch(/padding-inline:\s*16px/);
    expect(body).toMatch(/flex:\s*1/);
  });

  it("the article H1 is the frame's own 28px literal (docs/design/Chautauqua Docs.dc.html:175 `font-size:28px; font-weight:700; letter-spacing:-0.04em; line-height:1.08`), never the SPA shell's 25px drill-in token", () => {
    const block = extract700Blocks(DOCS_SITE_CSS)[0]!;
    expect(block).toMatch(/\.chq-docs-article-head h1\s*\{\s*font-size:\s*28px/);
    // The stale token must not be the DECLARED value any more, even
    // though it may still be named in surrounding prose explaining why.
    expect(block).not.toMatch(/font-size:\s*var\(--chq-type-page-title-phone-drill\)/);
  });
});

// -----------------------------------------------------------------------
// (c) the H1 register itself, and the 44px floor generally, are declared
// once in theme.ts and never restated here — mirrors
// test/account-password-phone.test.ts's (b) block.
// -----------------------------------------------------------------------

const THEME_TS = readFileSync(join(REPO_ROOT, "src/views/theme.ts"), "utf-8");

describe("docs-site.css.ts reuses theme.ts's phone H1 registers rather than restating a pixel value", () => {
  it("--chq-type-page-title-phone-drill is declared in theme.ts and is 25px", () => {
    const match = THEME_TS.match(/--chq-type-page-title-phone-drill:\s*([^;]+);/);
    expect(match).not.toBeNull();
    expect(match![1]!.trim()).toBe("25px");
  });
});

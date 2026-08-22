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
import { DOCS_SITE_CSS as DOCS_SITE_CSS_RAW } from "../src/routes/docs-site.css";
import type { AppEnv } from "../src/server/env";
import { stripCssComments } from "./helpers/strip-css-comments";

const REPO_ROOT = join(__dirname, "..");
const DOCS_SITE_CSS = stripCssComments(DOCS_SITE_CSS_RAW);
const DOCS_SITE_TSX = readFileSync(join(REPO_ROOT, "src/routes/docs-site.tsx"), "utf-8");

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

    // Head: the '‹ Docs' back link the phone chrome shows alongside a
    // 'Contents' disclosure (DEC-990 wave-128) -- both sit in one toolbar
    // row, the nav itself stays in the markup with its own id, hidden (and
    // re-lined) by CSS — DEC-385 is CSS-only, never a server-side branch
    // on viewport.
    expect(html).toContain('class="chq-docs-phone-toolbar"');
    expect(html).toContain('class="chq-docs-phone-back" href="/docs"');
    expect(html).toContain("‹ Docs");
    expect(html).toContain('id="chq-docs-nav" class="chq-docs-nav"');

    // The Contents disclosure: a native checkbox+label pair (no JS) whose
    // checkbox id matches its label's for=, and whose aria-controls points
    // at the SAME nav DocsNav already renders — no second nav (DEC-613).
    const checkboxMatch = html.match(/<input type="checkbox" id="(chq-docs-contents-[^"]+)" class="chq-docs-contents-checkbox" aria-controls="chq-docs-nav"/);
    expect(checkboxMatch).not.toBeNull();
    const checkboxId = checkboxMatch![1]!;
    expect(html).toContain(`class="chq-docs-contents-toggle" for="${checkboxId}"`);
    expect(html).toContain("Contents");

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

  it("the header stacks — brand run + leaving link on the bar, search full-width on its own row (docs/design/Chautauqua Docs.dc.html:167 `padding:14px 16px; flex-shrink:0; display:flex; align-items:center; gap:12px`)", () => {
    const block = extract700Blocks(DOCS_SITE_CSS)[0]!;
    // The bar wraps, so the search can take a row of its own.
    expect(block).toMatch(/\.chq-docs-header\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(block).toMatch(/\.chq-docs-header\s*\{[^}]*padding:\s*14px 16px/);
    // Search: last in visual order, and a 100% basis so it always breaks.
    const search = block.match(/\.chq-docs-search-compact\s*\{([^}]*)\}/);
    expect(search).not.toBeNull();
    expect(search![1]!).toMatch(/flex:\s*1 0 100%/);
    expect(search![1]!).toMatch(/order:\s*2/);
    // The leaving link rides the bar (order 1) and keeps its push-right,
    // which the base :has() rule zeroes whenever a search is present.
    expect(block).toMatch(/\.chq-docs-leaving\s*\{[^}]*order:\s*1/);
    expect(block).toMatch(/\.chq-docs-header:has\(\.chq-docs-search-compact\) \.chq-docs-leaving\s*\{\s*margin-left:\s*auto/);
    // The brand run is chrome at a fixed measure: it never shrinks, and it
    // opts out of theme.ts's DEC-404 `body { overflow-wrap: anywhere }`,
    // which otherwise collapses the wordmark's min-content contribution to
    // a single character (probe C measured a.chq-docs-wordmark at 23.8x140
    // on a 390 article — "chautauqua" set two letters to a line).
    expect(block).toMatch(/\.chq-docs-brandrow\s*\{[^}]*flex-shrink:\s*0/);
    const optOut = block.match(/((?:\s*\.chq-docs-[a-z-]+,)+\s*\.chq-docs-[a-z-]+)\s*\{\s*overflow-wrap:\s*normal;\s*\}/);
    expect(optOut).not.toBeNull();
    for (const sel of [".chq-docs-header", ".chq-docs-brandrow", ".chq-docs-wordmark", ".chq-docs-suffix", ".chq-docs-leaving"]) {
      expect(optOut![1]!).toContain(sel);
    }
    // ...and the opt-out stays on chrome: prose keeps inheriting `anywhere`
    // so a long URL in docs body text still breaks at 390.
    for (const proseSel of [".chq-docs-prose", ".chq-docs-list", ".chq-docs-deflist", ".chq-docs-article-head"]) {
      expect(optOut![1]!).not.toContain(proseSel);
    }
    // The prose rule itself is still owned by theme.ts (DEC-404), never
    // restated here — this block only opts chrome out of it.
    expect(THEME_TS).toMatch(/body\s*\{\s*overflow-wrap:\s*anywhere;\s*\}/);
  });

  it("the 'Contents' disclosure clears the 44px floor, is right-flushed, phone-only, and re-lines the SAME nav rather than replacing it", () => {
    const block = extract700Blocks(DOCS_SITE_CSS)[0]!;

    // docs/design/Chautauqua Docs.dc.html:167-169 draws the 390 header band as
    // `border-bottom:1px solid #1B1D17; padding:14px 16px; flex-shrink:0; display:flex; align-items:center; gap:12px`
    // -- two min-height:44px controls, the back link and a right-flushed
    // "Contents". Top-level, both new controls are off-screen by default
    // (DEC-385 — narrow overrides wide via max-width only).
    expect(DOCS_SITE_CSS).toMatch(/\.chq-docs-phone-toolbar\s*\{\s*display:\s*none;\s*\}/);
    expect(DOCS_SITE_CSS).toMatch(/\.chq-docs-contents-checkbox\s*\{\s*display:\s*none;\s*\}/);
    expect(DOCS_SITE_CSS).toMatch(/\.chq-docs-contents-toggle\s*\{\s*display:\s*none;\s*\}/);
    // Those top-level rules live BEFORE the (single) @media block.
    const mediaIdx = DOCS_SITE_CSS.indexOf("@media (max-width: 700px)");
    expect(DOCS_SITE_CSS.indexOf(".chq-docs-phone-toolbar")).toBeLessThan(mediaIdx);

    // Inside the phone block: the toolbar is a flex row pairing the back
    // link with the disclosure.
    expect(block).toMatch(/\.chq-docs-phone-toolbar\s*\{[^}]*display:\s*flex/);
    expect(block).toMatch(/\.chq-docs-phone-toolbar\s*\{[^}]*align-items:\s*center/);

    // The Contents label carries the frame's exact geometry: 44px floor,
    // centred flex, a real non-zero horizontal inset, right-flushed via
    // margin-left: auto, and the frame's 13px/700 type.
    const toggle = block.match(/\.chq-docs-contents-toggle\s*\{([^}]*)\}/);
    expect(toggle).not.toBeNull();
    const toggleBody = toggle![1]!;
    expect(toggleBody).toMatch(/display:\s*flex/);
    expect(toggleBody).toMatch(/align-items:\s*center/);
    expect(toggleBody).toMatch(/min-height:\s*44px/);
    expect(toggleBody).toMatch(/margin-left:\s*auto/);
    expect(toggleBody).toMatch(/padding-inline:\s*[1-9][0-9]*px/);
    expect(toggleBody).toMatch(/font-size:\s*13px/);
    expect(toggleBody).toMatch(/font-weight:\s*700/);

    // The checkbox itself never authors a sub-44px min-height and stays
    // reachable (visually-hidden, not display:none) once inside the phone
    // block — same sr-only technique as .chq-itinerary-toggle.
    const checkbox = block.match(/\.chq-docs-contents-checkbox\s*\{([^}]*)\}/);
    expect(checkbox).not.toBeNull();
    expect(checkbox![1]!).not.toMatch(/min-height/);
    expect(checkbox![1]!).toMatch(/position:\s*absolute/);

    // The disclosure: nav starts hidden, and a LATER, more specific rule
    // re-lines the SAME .chq-docs-nav (never a second nav element) the
    // instant the checkbox is checked -- DEC-919, not an exit to /docs.
    const navHiddenIdx = block.search(/\.chq-docs-nav\s*\{\s*display:\s*none;\s*\}/);
    expect(navHiddenIdx).toBeGreaterThan(-1);
    const disclosureIdx = block.search(/\.chq-docs-article-frame:has\(\.chq-docs-contents-checkbox:checked\)\s*\.chq-docs-nav\s*\{\s*display:\s*flex;\s*\}/);
    expect(disclosureIdx).toBeGreaterThan(-1);
    expect(disclosureIdx).toBeGreaterThan(navHiddenIdx);

    // No second copy of the nav vocabulary (DEC-613): exactly one <nav>
    // element in the whole route module -- the disclosure re-lines it,
    // it doesn't duplicate it.
    expect((DOCS_SITE_TSX.match(/<nav\b/g) ?? []).length).toBe(1);
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

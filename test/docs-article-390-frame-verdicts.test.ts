// task w30-b (DEC-976, DEC-385): "Docs · an article" at phone width, the
// frame at Chautauqua Docs.dc.html line 166 (extent 166 to EOF -- the last
// frame in the file; the strict citation form lives on the describe block
// below, next to its backtick quote). Grades the frame's DRAWN ANATOMY via a real
// `app.request('/docs/:slug')` SSR call, article prose excepted (owned by
// src/routes/docs-content/*.ts, content not geometry, graded by SHAPE) --
// see src/decisions-data/part4.ts's DEC_976 ("a phone-frame verdict grades
// the frame's DRAWN COPY, enumerated from its own extent -- a citation
// count is not a coverage measure").
//
// This file was measured, before landing, at 11/18 drawn literals
// asserted anywhere in the suite (the worst-instrumented frame in the Docs
// cluster). It is additive: it does not edit or replace
// test/docs-site-phone.test.ts or test/account-docs-phone-frames.test.ts.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { DEC_385, DEC_976 } from "../src/decisions";

void DEC_385;
void DEC_976;

vi.mock("../src/server/repo/public/home", () => ({
  getHubOrg: vi.fn(async () => null),
  listHubEvents: vi.fn(async () => ({ items: [], capped: false })),
}));

import type { AppEnv } from "../src/server/env";

const REPO_ROOT = join(__dirname, "..");
const DOCS_SITE_TSX = readFileSync(join(REPO_ROOT, "src/routes/docs-site.tsx"), "utf-8");
const DOCS_DESIGN_HTML = readFileSync(
  join(REPO_ROOT, "docs/design/Chautauqua Docs.dc.html"),
  "utf-8",
).split("\n");

function unescapeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// -----------------------------------------------------------------------
// (a) live SSR request -- the article's real content ("Call for papers
// and submissions", group "running-an-event" = frame's :174 group label
// "Running an event"; its figures are both in DOCS_SHOTS_AVAILABLE today,
// so this half exercises the CAPTURED-shot render path).
// -----------------------------------------------------------------------

async function buildRealApp() {
  const { docsSiteRoutes } = await import("../src/routes/docs-site");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", {} as AppEnv["Variables"]["db"]);
    await next();
  });
  app.route("/", docsSiteRoutes);
  return app;
}

describe('"Docs · an article · 390" anatomy — live request (docs/design/Chautauqua Docs.dc.html:166 `<div style="width:390px; height:844px; background:#F4F1E8; border:1px solid #D3CFC0; border-radius:20px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 18px 44px rgba(27,29,23,0.13)">`)', () => {
  it("renders every chrome element the frame draws, in order: back control, Contents control, group label, title, lede, prose, list, figure+caption, pager", async () => {
    const app = await buildRealApp();
    const res = await app.request("/docs/call-for-papers-and-submissions");
    expect(res.status).toBe(200);
    const html = await res.text();
    const unescaped = unescapeHtml(html);

    // ‹ Docs back control (:168 `<a href="#" ... >‹ Docs</a>`).
    expect(html).toContain('class="chq-docs-phone-back" href="/docs"');
    expect(unescaped).toContain("‹ Docs");

    // Contents control (:169 `Contents`).
    expect(html).toContain('class="chq-docs-contents-toggle"');
    expect(html).toContain("Contents");

    // Group label / eyebrow (:174 `Running an event`) -- this article's
    // real group ("running-an-event") resolves to DOCS_GROUP_META's own
    // label, so the frame's exact words happen to match here, but the
    // grading below is on the ELEMENT existing, not a hand-pinned literal
    // (DEC_976: content is owned by docs-content, not this test).
    expect(html).toContain('class="chq-docs-article-eyebrow"');
    expect(unescaped).toContain("Running an event");

    // Title (h1) and lede paragraph (:175/:176) -- shape only, the words
    // are docs-content's own (DEC_976).
    expect(html).toMatch(/class="chq-docs-article-head"[\s\S]*?<h1>[^<]+<\/h1>[\s\S]*?<p>/);

    // Body prose block exists (content owned by docs-content).
    expect(html).toContain('class="chq-docs-prose"');

    // A list block renders (this fixture article's own list -- the
    // frame's :192-196 <ol> is a SAMPLE numbered how-to that no shipped
    // article currently instantiates as `ordered: true`; see the
    // source-scan describe block below for that render branch's shape).
    expect(html).toContain('class="chq-docs-list"');

    // Figure + caption (:183-188).
    expect(html).toContain('class="chq-docs-figure"');
    expect(html).toContain('class="chq-docs-figure-caption"');

    // Pager (:200-203) -- DEVIATIONS.md ~277-283 rules that DocsPager
    // renders {prev.title}/{next.title} INSTEAD of the frame's literal
    // '‹ Previous' / 'Next ›' (the desktop rendering already names the
    // neighbour, and the geometry -- not the copy -- is what the frame
    // binds here). Asserting the frame's literal 'Next ›' text would be a
    // FALSE RED against a recorded, deliberate divergence; this asserts
    // the DEVIATION's actual shape instead.
    const { docsArticleNeighbours } = await import("../src/routes/docs-content/nav");
    const { prev, next } = docsArticleNeighbours("call-for-papers-and-submissions");
    expect(prev || next).toBeTruthy();
    expect(html).toContain('class="chq-docs-pager"');
    if (prev) {
      expect(html).toContain(`class="chq-docs-pager-prev" href="/docs/${prev.slug}"`);
      expect(unescaped).toContain(`‹ ${prev.title}`);
    }
    if (next) {
      expect(html).toContain(`class="chq-docs-pager-next" href="/docs/${next.slug}"`);
      expect(unescaped).toContain(`${next.title} ›`);
    }
  });
});

// -----------------------------------------------------------------------
// (b) live SSR request, shots-available mocked empty -- forces every
// figure onto the NOT-YET-CAPTURED placeholder branch, which is the
// branch the frame's own affordance line lives in (the pack's sample
// article never resolves to a real DOCS_ARTICLES slug -- exemplar-article
// .ts's own exclusions record that -- so this is the only way a real
// request reaches that branch today: every one of the 20 real figures
// already has a captured shot per DOCS_SHOTS_AVAILABLE).
// -----------------------------------------------------------------------

describe("figure NOT-YET-CAPTURED placeholder — phone tap-to-zoom affordance (docs/design/Chautauqua Docs.dc.html:185 `screenshot · 390 · tap to zoom`)", () => {
  it("renders the frame's phone affordance label alongside the existing desktop-oriented shotId label", async () => {
    vi.resetModules();
    vi.doMock("../src/routes/docs-content/shots-available", () => ({ DOCS_SHOTS_AVAILABLE: [] as readonly string[] }));
    const app = await buildRealApp();
    const res = await app.request("/docs/call-for-papers-and-submissions"); expect(res.status).toBe(200);
    const html = await res.text();
    const unescaped = unescapeHtml(html);

    // The pre-existing desktop-oriented label is still present (never
    // deleted -- desktop keeps its route/shotId text unchanged).
    expect(html).toContain('class="chq-docs-figure-placeholder"');
    expect(unescaped).toContain("screenshot ·");

    // The frame's own 390-affordance label: before this task, nothing in
    // src/ or app/src/ rendered this line under any name (grepped clean).
    // `hidden` is a native, stylesheet-free default-off state -- this
    // task's docs-site.css.ts edit is scoped to the terminal
    // @media(max-width:700px) block only (another lane owns the rest of
    // the file this wave, DEC-385 wave-30 amendment), so no base rule
    // outside that block could be added to hide a plain class instead.
    expect(html).toContain('class="chq-docs-figure-phone-affordance" hidden');
    expect(unescaped).toContain("screenshot · 390 · tap to zoom");

    vi.doUnmock("../src/routes/docs-content/shots-available");
    vi.resetModules();
  });
});

// -----------------------------------------------------------------------
// (c) CSS source-scan — the terminal @media(max-width:700px) block hides
// the desktop label and reveals the phone affordance, and does so via a
// plain `display` declaration (never `!important`, DEC-409) that beats the
// native `[hidden]` UA default on origin, not specificity.
// -----------------------------------------------------------------------

function extract700Block(src: string): string {
  const marker = "@media (max-width: 700px)";
  const idx = src.indexOf(marker);
  expect(idx).toBeGreaterThan(-1);
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
  return src.slice(openBrace + 1, i);
}

describe("docs-site.css.ts terminal phone block — figure affordance rules (DEC-385, source-scan)", () => {
  it("hides the desktop label and shows the phone affordance, additively, inside the single terminal block only", async () => {
    const { DOCS_SITE_CSS } = await import("../src/routes/docs-site.css");
    const block = extract700Block(DOCS_SITE_CSS);

    expect(block).toMatch(/\.chq-docs-figure-placeholder\s*\{\s*display:\s*none;\s*\}/);
    const affordance = block.match(/\.chq-docs-figure-phone-affordance\s*\{([^}]*)\}/);
    expect(affordance).not.toBeNull();
    expect(affordance![1]!).toMatch(/display:\s*block/);
    // The new selector (.chq-docs-figure-phone-affordance) has no rule at
    // all outside the terminal block -- its default-off state comes from
    // the `hidden` HTML attribute, not a base CSS rule. The pre-existing
    // desktop selector (.chq-docs-figure-placeholder) keeps its base
    // font/color rule untouched (this task adds no `display` to it there).
    const beforeBlock = DOCS_SITE_CSS.slice(0, DOCS_SITE_CSS.indexOf("@media (max-width: 700px)"));
    expect(beforeBlock).not.toContain(".chq-docs-figure-phone-affordance");
    const baseDesktopRule = beforeBlock.match(/\.chq-docs-figure-placeholder\s*\{([^}]*)\}/);
    expect(baseDesktopRule).not.toBeNull();
    expect(baseDesktopRule![1]!).not.toMatch(/display:/);

    // No !important anywhere in the file (DEC-409: argue by specificity).
    expect(DOCS_SITE_CSS).not.toMatch(/!important/);
  });
});

// -----------------------------------------------------------------------
// (d) ordered how-to section — SHAPE only. No shipped DOCS_ARTICLES entry
// carries `ordered: true` today (grepped: zero hits across
// src/routes/docs-content/*.ts), so a live request can never reach an
// <ol> — this is filed, not fixed (docs-content/*.ts is content, owned
// elsewhere, and out of this task's FILES-I-OWN scope). The render branch
// itself is graded by source shape: the same list token
// (`chq-docs-list`) the unordered branch above already exercises live,
// picking <ol> instead of <ul> when `block.ordered` is true
// (docs/design/Chautauqua Docs.dc.html:192 `<ol style="margin:0; padding-left:19px; display:flex; flex-direction:column; gap:8px; font-size:15px; line-height:1.6; color:#3F4237">`).
// -----------------------------------------------------------------------

describe("ordered how-to section — render-branch shape only (no live fixture, filed not fixed)", () => {
  it("the ordered-list branch renders the same list token, ol instead of ul", () => {
    expect(DOCS_SITE_TSX).toMatch(/block\.ordered[\s\S]{0,80}<ol class="chq-docs-list">/);
    expect(DOCS_SITE_TSX).toMatch(/<ul class="chq-docs-list">/);
  });

  it("no shipped article instantiates the ordered branch (documents the gap this test cannot close)", () => {
    const contentDir = join(REPO_ROOT, "src", "routes", "docs-content");
    const { readdirSync } = require("node:fs") as typeof import("node:fs");
    const files = readdirSync(contentDir).filter((f) => f.endsWith(".ts") && f !== "types.ts");
    const anyOrdered = files.some((f) => readFileSync(join(contentDir, f), "utf-8").includes("ordered: true"));
    expect(anyOrdered).toBe(false);
  });
});

// -----------------------------------------------------------------------
// (e) frame-truth guard for the DEVIATIONS citation above, and for the new
// affordance citation — both cited lines exist verbatim in the pack.
// -----------------------------------------------------------------------

describe("frame-truth: the cited lines exist verbatim in the pack", () => {
  it("line 185 is the affordance label this task added", () => {
    expect(DOCS_DESIGN_HTML[184]).toContain("screenshot · 390 · tap to zoom");
  });

  it("lines 201-202 are the frame's own '‹ Previous' / 'Next ›' literals -- the ones the recorded DEVIATION overrides, never asserted directly against product output", () => {
    expect(DOCS_DESIGN_HTML[200]).toContain("‹ Previous");
    expect(DOCS_DESIGN_HTML[201]).toContain("Next ›");
  });
});

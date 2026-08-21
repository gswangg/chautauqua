// DOCS DESKTOP — per-frame render verdict for "Docs · the element
// library" (task w26-i). MEASUREMENT ONLY (DEC-651 wave-26): this file
// fixes nothing, touches no route module and no .css.ts.
//
// FRAME: docs/design/Chautauqua Docs.dc.html:226-453, "Docs · the element
// library", subtitled "Nothing outside this set may appear in an article".
// This is 1 of Docs' 3 desktop frames -- v12m-w24-g owns the other two
// (:28 "Docs · an article" and :119 "Docs · the index"), full prose in
// docs/design/audit/docs-library-desktop-v12.md.
//
// HARNESS (DEC-613 wave-26): copies test/public-390-frame-verdicts.test.ts's
// Hono<AppEnv> + mounted route + registerErrorHandler + app.request() shape
// verbatim -- never a sixth mock stack -- mounting docsSiteRoutes
// (src/routes/docs-site.tsx). Asserts the returned HTML string's markup
// only.
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { docsSiteRoutes } from "../src/routes/docs-site";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";
import { DEC_032, DEC_518, DEC_613, DEC_651 } from "../src/decisions";

// DEC-613 (Amendment, wave 24, src/decisions-data/part3.ts): a desktop SSR
// verdict COPIES an existing buildApp harness verbatim.
// DEC-651 (Amendment, wave 24): ... MEASUREMENT ONLY, no route/.css.ts edits.
// DEC-032 (Amendment, wave 24): a deviation-deferred frame is UN-CITABLE --
// not applicable here (this frame is not inside a DEVIATIONS §6 extent),
// cited per task brief's "no Settings citations" guard-rail.
// DEC-518 (Amendment, wave 155): the derived-manifest citation grammar --
// DOCS_ARTICLES is a DERIVED registry (src/routes/docs-content/index.ts),
// never hand-mirrored, which is why this file dispatches real requests for
// its block-kind population check rather than re-listing article content.
// void-referenced so the dependency is compile-checked (src/decisions.ts).
void DEC_613;
void DEC_651;
void DEC_032;
void DEC_518;

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, "..");
const DESIGN_FILE = join(REPO_ROOT, "docs", "design", "Chautauqua Docs.dc.html");

/** DEC-967 shape: read the ACTUAL frame line and assert it byte-for-byte
 * matches the literal this file claims. */
function verbatimLine(lineNo: number, literal: string): void {
  const lines = readFileSync(DESIGN_FILE, "utf-8").split("\n");
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file has no line ${lineNo}`);
  expect(line).toBe(literal);
}

// ---------------------------------------------------------------------------
// Harness (mirrors test/public-390-frame-verdicts.test.ts's buildApp shape;
// docsSiteRoutes needs a db only for the 404 card's eyebrow resolution --
// GET /docs and GET /docs/:slug (found) never touch it).
// ---------------------------------------------------------------------------

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
  };
  return chain;
}

function buildApp() {
  const db = {
    select: () => makeChain([]), // getHubOrg -> null -> eyebrow "Not found", 404-only path
  } as unknown as AppEnv["Variables"]["db"];

  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  registerErrorHandler(app);
  app.route("/", docsSiteRoutes);
  return app;
}

describe("Docs desktop frame verdict — Chautauqua Docs.dc.html:226 'Docs · the element library'", () => {
  it("MATCHES: the frame's own title and subtitle lines are byte-identical to the pack", () => {
    verbatimLine(
      226,
      `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Docs · the element library</span>`,
    );
    verbatimLine(
      227,
      `      <span style="font-size:11px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:#565A4B">Nothing outside this set may appear in an article</span>`,
    );
    verbatimLine(
      244,
      `          <h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:32px; font-weight:700; letter-spacing:-0.04em; line-height:1.08">The element library</h1>`,
    );
    verbatimLine(
      245,
      `          <p style="margin:0; font-size:16px; line-height:1.7; color:#3F4237">Nine blocks. An article is a sequence of these and nothing else — a new kind of block is a change to this page first, not a one-off inside one article.</p>`,
    );
  });

  it("DIVERGES: GET /docs/elements-library (and every plausible slug for this page) 404s — there is no standalone element-library route", async () => {
    const app = buildApp();
    // docsSiteRoutes registers exactly GET /docs and GET /docs/:slug
    // (src/routes/docs-site.tsx's two `.get(...)` calls, confirmed by
    // grep against src/index.ts's mount list in the audit doc). No
    // DOCS_ARTICLES entry is titled or slugged for "the element library"
    // itself (it is the PACK's internal style-guide page for authors, not
    // a page an article slug ever resolves to) -- every candidate slug
    // below falls through to the generic 404, matching the shell but not
    // the frame's own content.
    for (const slug of ["elements-library", "element-library", "elements", "the-element-library"]) {
      const res = await app.request(`/docs/${slug}`);
      expect(res.status).toBe(404);
      const html = await res.text();
      // The generic 404 card, not the nine-section element library body.
      expect(html).not.toContain("01 · Prose");
      expect(html).not.toContain("The element library");
    }
  });

  it("DIVERGES: GET /docs (the index) does not draw the nine-section body either — the frame's body has no live route at all", async () => {
    const app = buildApp();
    const res = await app.request("/docs");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain("01 · Prose");
    expect(html).not.toContain("09 · Prev / next pager");
    expect(html).not.toContain("Nine blocks. An article is a sequence of these");
  });

  it("MATCHES: the block-KIND population — every one of the frame's 7 numbered content blocks (01 Prose … 07 Code) has a live renderer case, and every renderer case is one of the 7", async () => {
    const app = buildApp();
    // running-the-software exercises prose/heading/code/figure/deflist/aside
    // in one article; start-here exercises list (unordered). Together they
    // hit all 7 DocsBlock kind tags docs-site.tsx's DocsBlockView switches
    // on (src/routes/docs-content/types.ts's closed union) — a real
    // dispatched request per kind, not a source-only inference.
    const software = await app.request("/docs/running-the-software");
    expect(software.status).toBe(200);
    const softwareHtml = await software.text();
    expect(softwareHtml).toContain('class="chq-docs-prose"'); // 01 Prose
    expect(softwareHtml).toContain('class="chq-docs-h2"'); // 02 Headings (H2 case)
    expect(softwareHtml).toContain('class="chq-docs-deflist"'); // 06 Definition table
    expect(softwareHtml).toContain('class="chq-docs-code"'); // 07 Code and paths
    expect(softwareHtml).toContain('class="chq-docs-figure"'); // 05 Figure
    expect(softwareHtml).toMatch(/chq-docs-aside chq-docs-aside-(worth-knowing|cannot-be-undone)/); // 04 Aside

    const start = await app.request("/docs/start-here");
    expect(start.status).toBe(200);
    const startHtml = await start.text();
    expect(startHtml).toContain('class="chq-docs-list"'); // 03 Steps and lists (ul case)
    // Both pages also always carry the frame's 08/09 as STRUCTURAL
    // per-article furniture (DocsWhereNext/DocsPager), not an
    // author-chosen block kind — see the audit doc's population note.
    expect(softwareHtml).toContain('class="chq-docs-where-next"'); // 08 Where next
    expect(softwareHtml).toContain('class="chq-docs-pager"'); // 09 Prev/next pager
  });

  it("DIVERGES: the header's leaving-link glyph order is reversed — frame reads label-then-mark, the shipped header renders mark-then-label", async () => {
    verbatimLine(238, `          <a href="#" style="font-size:13px; font-weight:700; color:#565A4B">API reference ↗</a>`);
    const app = buildApp();
    const res = await app.request("/docs/running-the-software");
    const html = await res.text();
    const leavingOpen = html.indexOf('class="chq-docs-leaving"');
    expect(leavingOpen).toBeGreaterThan(-1);
    const leavingClose = html.indexOf("</a>", leavingOpen);
    const leavingMarkup = html.slice(leavingOpen, leavingClose);
    // The frame's anchor text is "API reference ↗" (label, then mark). The
    // shipped DocsHeader renders the aria-hidden mark span BEFORE the
    // label text.
    const markIdx = leavingMarkup.indexOf("↗"); // the JSX &#8599; entity renders as the literal glyph, not the entity text
    const labelIdx = leavingMarkup.indexOf("API reference");
    expect(markIdx).toBeGreaterThan(-1);
    expect(labelIdx).toBeGreaterThan(-1);
    expect(markIdx).toBeLessThan(labelIdx);
  });

  it("MATCHES: the header row otherwise matches — wordmark, 'Docs' suffix baseline run, and a search box precede the leaving link, same as the frame's :237-238", async () => {
    const app = buildApp();
    const res = await app.request("/docs/running-the-software");
    const html = await res.text();
    const wordmarkIdx = html.indexOf('class="chq-docs-wordmark"');
    const suffixIdx = html.indexOf('class="chq-docs-suffix"');
    const searchIdx = html.indexOf('class="chq-docs-search chq-docs-search-compact"');
    const leavingIdx = html.indexOf('class="chq-docs-leaving"');
    expect(wordmarkIdx).toBeGreaterThan(-1);
    expect(suffixIdx).toBeGreaterThan(wordmarkIdx);
    expect(searchIdx).toBeGreaterThan(suffixIdx);
    expect(leavingIdx).toBeGreaterThan(searchIdx);
  });
});

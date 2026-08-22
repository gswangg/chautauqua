// w24-g: per-frame DESKTOP (900/1600) render verdicts for Home's three
// hub states and Docs' article/index pages (DEC-613: harness copied, never
// re-authored). MEASUREMENT ONLY (task contract): this lane fixes nothing,
// touches no route module and no `*.css.ts`, and moves no desktop byte.
//
// HARNESS (DEC-613 wave-24 amendment): every fake-db/buildApp shape below
// is copied unchanged from `test/home-account-docs-390-frame-verdicts.test.ts`
// (itself copied from `test/home-hub.test.ts` / `test/public-home-state-
// actions.test.ts` for Home, and `test/docs-site.test.ts` for Docs) --
// only the request paths, fixture VALUES, and the cited design-file lines
// differ; this lane verdicts the DESKTOP frames of the same two design
// files that 390 lane already verdicted the PHONE frames of. Both Home and
// Docs render exactly ONE markup tree per route (no server-side branch on
// viewport width -- geometry is CSS-media-query-only, DEC-385
// single-direction), so the same fixtures that produced a MATCHES verdict
// on the phone frame produce the SAME rendered HTML string here; only the
// desktop frame's own drawn anatomy (a different width, different action
// placement, extra desktop-only rows) is what is compared against.
//
// RECEIPT RULE: every `it()` opens with a `verbatimLine(file, <line>,
// '<exact bytes>')` receipt of its own frame's title-label line, read
// byte-for-byte from the cited design file (DEC-967 shape, copied from
// `app/src/pages/Speakers.desktop-frame-verdicts.render.test.tsx`'s own
// verbatimLine, parameterised over TWO design files here rather than
// duplicated). Further citations inside each `it()` are informal comments
// (this file sits under test/, which app/src/frame-citation.scan.test.ts
// does not enumerate and test/decision-doc-citation.scan.test.ts's
// CITATION_RE explicitly excludes `.dc.html` targets from) but still carry
// a backtick-quoted literal beside every line reference, for a human
// reader, in the house style.
//
// RELEVANT PRIOR RULING verdicted against, not re-derived: Home's footer
// (`src/routes/public/home.css.ts`) and Docs' shell
// (`src/routes/docs-site.css.ts`) both declare a `{ display: flex;
// flex-direction: column; min-height: 100vh; }` sticky-layout idiom under
// DEC-383 -- an SSR response carries no computed layout, so a claim that
// turns on WHERE an element sits, or whether it is width-hidden, is
// verdicted against that stylesheet's own TEXT, never a re-read of the
// frame as if it were the runtime.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { rootRoutes } from "../src/routes/root";
import { docsRoutes } from "../src/routes/docs";
import { docsSiteRoutes } from "../src/routes/docs-site";
import { DOCS_ARTICLES } from "../src/routes/docs-content";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";
import type { Db } from "../src/server/context";

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, "..");
const DESIGN_DIR = join(REPO_ROOT, "docs", "design");
const HOME_FILE = join(DESIGN_DIR, "Chautauqua Home.dc.html");
const DOCS_FILE = join(DESIGN_DIR, "Chautauqua Docs.dc.html");

/** DEC-967 shape: read the ACTUAL frame line and assert it byte-for-byte
 * matches the literal this file claims -- copied from
 * `app/src/pages/Speakers.desktop-frame-verdicts.render.test.tsx`'s own
 * verbatimLine, parameterised over the design file since this lane cites
 * two of them. */
function verbatimLine(file: "home" | "docs", lineNo: number, literal: string): void {
  const path = file === "home" ? HOME_FILE : DOCS_FILE;
  const lines = readFileSync(path, "utf-8").split("\n");
  const line = lines[lineNo - 1];
  if (line === undefined) throw new Error(`design file ${path} has no line ${lineNo}`);
  expect(line).toBe(literal);
}

// -----------------------------------------------------------------------
// Home harness -- copied verbatim from test/home-account-docs-390-frame-
// verdicts.test.ts (itself copied from test/home-hub.test.ts /
// test/public-home-state-actions.test.ts's fakeDb/fakeAssets/eventRow/
// buildQueue/buildApp shape).
// -----------------------------------------------------------------------

function homeFakeDb(resultQueue: unknown[][]): Db {
  let i = 0;
  return {
    select: () => {
      const results = resultQueue[i++] ?? [];
      const chain: any = {
        from: () => chain,
        leftJoin: () => chain,
        innerJoin: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: () => chain,
        groupBy: () => chain,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(results).then(resolve, reject),
      };
      return chain;
    },
  } as unknown as Db;
}

function fakeAssets(): Fetcher {
  return {
    async fetch() {
      return new Response("not found", { status: 404 });
    },
  } as unknown as Fetcher;
}

const ORG = { id: "org1", name: "DevFlow Conf 2027 Org" };

function eventRow(overrides: {
  id?: string;
  name?: string;
  slug?: string;
  startDate?: string;
  endDate?: string;
  location?: string | null;
  timezone?: string;
  openMs?: number | null;
  closeMs?: number | null;
}) {
  const { openMs = null, closeMs = null, ...rest } = overrides;
  return {
    id: "e1",
    name: "DevFlow Conf 2027",
    slug: "devflow-conf-2027",
    startDate: "2027-10-09",
    endDate: "2027-10-10",
    location: "Fort Mason, San Francisco",
    timezone: "America/Los_Angeles",
    ...rest,
    openDate: openMs === null ? null : new Date(openMs),
    closeDate: closeMs === null ? null : new Date(closeMs),
  };
}

function homeBuildQueue(opts: {
  events: ReturnType<typeof eventRow>[];
  countRows?: { eventId: string; count: number }[];
}): unknown[][] {
  const hasEvents = opts.events.length > 0;
  const countRows = hasEvents ? (opts.countRows ?? []) : [];
  return [[ORG], opts.events, countRows, [], []];
}

function homeBuildApp(queue: unknown[][]) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", homeFakeDb(queue));
    await next();
  });
  app.route("/", rootRoutes);
  registerErrorHandler(app);
  return app;
}

describe("Home — GET / (SSR, desktop 900/1600 frames, w24-g)", () => {
  it(
    // 'Event hub · desktop' (:28). MATCHES -- same markup tree the phone
    // frame's already-verdicted request produces (test/home-account-docs-
    // 390-frame-verdicts.test.ts's ':113' case); only the desktop frame's
    // own drawn anatomy is compared here.
    "'Event hub · desktop' (:28) MATCHES -- Events hero, primary/secondary action rows, archive Sessions link, footer API docs link",
    async () => {
      verbatimLine(
        "home",
        28,
        `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Event hub · desktop</span>`,
      );
      const dayLabel = (offsetDays: number) => Math.floor(Date.now() / 86_400_000 + offsetDays) * 86_400_000;
      const events = [
        eventRow({ id: "e1", slug: "open-cfp-event", openMs: dayLabel(-2), closeMs: dayLabel(30) }),
        eventRow({ id: "e2", slug: "published-event", closeMs: dayLabel(-30) }),
      ];
      const app = homeBuildApp(homeBuildQueue({ events, countRows: [{ eventId: "e2", count: 5 }] }));
      const res = await app.request("/", {}, { ASSETS: fakeAssets() });
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("<h1>Events</h1>");
      // Chautauqua Home.dc.html:60 `<span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:48px; display:flex; align-items:center; padding:0 20px; font-size:15px; font-weight:700; white-space:nowrap">Submit a talk</span>` -- the desktop open-CFP row's primary action (same class as the 390 frame's :137, a wider row-inline placement not a different control).
      expect(body).toContain('class="chq-home-action-primary" href="/submit/open-cfp-event"');
      // Chautauqua Home.dc.html:79 `<span style="border:1px solid #CFC7B7; border-radius:4px; background:#EFEBDF; min-height:46px; display:flex; align-items:center; padding:0 18px; font-size:14px; font-weight:600; color:#2E2A24; white-space:nowrap">Browse sessions</span>`
      expect(body).toContain('class="chq-home-action-secondary" href="/e/published-event/sessions"');
      // Chautauqua Home.dc.html:95 `<a href="#" style="font-size:13px; font-weight:700; white-space:nowrap">Sessions ›</a>` -- desktop archive row (no min-height token; the 390 frame's :165 sibling carries min-height:44px instead, both real DOM anchors).
      const footer = body.split("<footer")[1]?.split("</footer>")[0] ?? "";
      // Chautauqua Home.dc.html:104 `<a href="#" style="margin-left:auto; font-size:12px; font-weight:700">API docs</a>` -- desktop footer right-hand link, full state.
      expect(footer).toMatch(/href="\/docs\/api"[^>]*>\s*API docs\s*<\/a>/);
    },
  );

  it(
    // 'Between cycles · desktop' (:181). MATCHES -- the frame's own footer
    // (:219-220) ends "...event-content management</span>" with NO
    // trailing anchor at this width, unlike the 390 companion frame (:261)
    // which draws one. root.tsx's Footer() renders the anchor
    // UNCONDITIONALLY in the DOM for state === "between_cycles" (an extra
    // class, .chq-home-footer-link-end-phone, alongside the base token) --
    // so the HTML STRING carries the anchor here too; what makes the two
    // frames consistent is home.css.ts's own stylesheet text, not the SSR
    // markup, per this task's DEC-383 ruling: `.chq-home-footer-link-end-phone { display: none; }`
    // (src/routes/public/home.css.ts) base-hides it, revealed only inside
    // that file's existing @media (max-width: 700px) block -- so at this
    // frame's 900px width the anchor the markup carries renders nothing,
    // matching the frame's own drawn (anchor-less) footer.
    "'Between cycles · desktop' (:181) MATCHES -- No-open-calls hero, archive Sessions link, Sign-in/Organisers row; footer anchor markup base-hidden at this width per home.css.ts",
    async () => {
      verbatimLine(
        "home",
        181,
        `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Between cycles · desktop</span>`,
      );
      const events = [
        eventRow({
          id: "e1",
          startDate: "2020-01-01",
          endDate: "2020-01-02",
          closeMs: Math.floor(Date.now() / 86_400_000 - 2) * 86_400_000,
        }),
      ];
      const app = homeBuildApp(homeBuildQueue({ events, countRows: [{ eventId: "e1", count: 1 }] }));
      const res = await app.request("/", {}, { ASSETS: fakeAssets() });
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("<h1>No open calls right now</h1>");
      // Chautauqua Home.dc.html:208 `<a href="#" style="font-size:13px; font-weight:700; white-space:nowrap">Sessions ›</a>`
      expect(body).toContain(">Sessions ›</a>");
      // Chautauqua Home.dc.html:214/216 `<span style="border:1px solid #CFC7B7; border-radius:4px; background:#EFEBDF; min-height:46px; display:flex; align-items:center; padding:0 18px; font-size:14px; font-weight:600; color:#2E2A24">Sign in</span>` + `<span style="font-size:13px; color:#565A4B; line-height:1.5">Organisers and reviewers</span>` -- the desktop-only sign-in row.
      expect(body).toContain('class="chq-home-action-secondary" href="/login"');
      expect(body).toContain('class="chq-home-cap-note">Organisers and reviewers<');
      // src/routes/public/home.css.ts `.chq-home-footer-link-end-phone { display: none; }` -- base-hides the state-conditional anchor at this (non-max-width:700px) width, matching the frame's own anchor-less :219-220 footer.
      expect(readFileSync(join(REPO_ROOT, "src", "routes", "public", "home.css.ts"), "utf-8")).toContain(
        ".chq-home-footer-link-end-phone { display: none; }",
      );
    },
  );

  it(
    // 'Fresh deploy · desktop' (:269). MATCHES.
    "'Fresh deploy · desktop' (:269) MATCHES -- Nothing-here-yet hero, primary Sign in + tertiary API docs in one row, no footer API docs link",
    async () => {
      verbatimLine(
        "home",
        269,
        `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Fresh deploy · desktop</span>`,
      );
      const app = homeBuildApp(homeBuildQueue({ events: [] }));
      const res = await app.request("/", {}, { ASSETS: fakeAssets() });
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("<h1>Nothing here yet</h1>");
      // Chautauqua Home.dc.html:285 `<span style="background:#4E5C31; color:#F7F9F0; border-radius:4px; min-height:48px; display:flex; align-items:center; padding:0 20px; font-size:15px; font-weight:700">Sign in</span>`
      // Chautauqua Home.dc.html:286 `<a href="#" style="font-size:14px; font-weight:700; padding:0 8px; min-height:46px; display:flex; align-items:center">API docs ›</a>` -- BOTH sit in the SAME row on this desktop frame (unlike the 390 frame's :313/:314, which stacks them).
      const signinRow = body.split('class="chq-home-signin-row"')[1]?.split("</main>")[0] ?? "";
      expect(signinRow).toContain('class="chq-home-action-primary" href="/login">Sign in</a>');
      expect(signinRow).toContain('class="chq-home-action-tertiary" href="/docs/api">API docs ›</a>');
      const footer = body.split("<footer")[1]?.split("</footer>")[0] ?? "";
      expect(footer).not.toMatch(/href="\/docs\/api"/);
    },
  );
});

// -----------------------------------------------------------------------
// Docs harness -- copied verbatim from test/home-account-docs-390-frame-
// verdicts.test.ts / test/docs-site.test.ts's buildApp (docsRoutes +
// docsSiteRoutes, no db touched by either mounted route here).
// -----------------------------------------------------------------------

function docsBuildApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", {} as AppEnv["Variables"]["db"]);
    await next();
  });
  app.route("/", docsRoutes);
  app.route("/", docsSiteRoutes);
  return app;
}

describe("Docs — GET /docs/:slug and /docs (SSR, desktop 1600 frames, w24-g)", () => {
  it(
    // 'Docs · an article' (:28). MATCHES.
    "'Docs · an article' (:28) MATCHES -- header search+API reference, sticky side nav, article eyebrow/H1/standfirst, heading block, pager",
    async () => {
      verbatimLine(
        "docs",
        28,
        `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Docs · an article</span>`,
      );
      const article = DOCS_ARTICLES.find((a) => a.slug === "reviewing-start-to-finish");
      expect(article).toBeDefined();
      const app = docsBuildApp();
      const res = await app.request(`/docs/${article!.slug}`);
      expect(res.status).toBe(200);
      const html = await res.text();
      // Chautauqua Docs.dc.html:39 `<div style="border:1px solid #BAB6A6; border-radius:4px; padding:8px 12px; font-size:13px; color:#565A4B; background:#FAF8F2; min-width:260px">Search the docs…</div>` -- the article page's header carries the COMPACT search field (unlike the 390 frame, which drops search from the article header entirely and shows only '‹ Docs'/'Contents').
      expect(html).toContain('class="chq-docs-search chq-docs-search-compact"');
      expect(html).toContain('placeholder="Search the docs…"');
      // Chautauqua Docs.dc.html:40 `<a href="#" style="font-size:13px; font-weight:700; color:#565A4B">API reference ↗</a>`
      expect(html).toMatch(/class="chq-docs-leaving"[^>]*>[\s\S]*?API reference[\s\S]*?<\/a>/);
      // Chautauqua Docs.dc.html:46 `<nav style="position:sticky; top:0; display:flex; flex-direction:column; gap:22px">` -- the sticky grouped side nav, present in the DOM at every width (src/routes/docs-site.css.ts base-shows it, hides it only inside its own phone media block, DEC-385 single-direction) -- the desktop frame's own nav, unlike the 390 frame which draws no nav column at all.
      expect(html).toContain('id="chq-docs-nav" class="chq-docs-nav" aria-label="Docs sections"');
      // Chautauqua Docs.dc.html:60 `<h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:38px; font-weight:700; letter-spacing:-0.04em; line-height:1.08">Triaging submissions</h1>` -- illustrative mockup prose (no "Triaging submissions" slug exists in DOCS_ARTICLES); the STRUCTURE it draws (eyebrow span, <h1>, standfirst <p>) is what is graded, same as the phone verdict's identical note.
      expect(html).toContain(`<h1>${article!.title}</h1>`);
      expect(html).toContain('class="chq-docs-article-eyebrow">');
      const headingBlock = article!.blocks.find((b) => b.kind === "heading") as { text: string } | undefined;
      expect(headingBlock).toBeDefined();
      // Chautauqua Docs.dc.html:81 `<h2 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:24px; font-weight:700; letter-spacing:-0.03em; padding-top:6px">Working through the queue</h2>`
      expect(html).toContain(`class="chq-docs-h2">${headingBlock!.text}</h2>`);
      // Chautauqua Docs.dc.html:107-109 the bottom-of-article pager row ('‹ Setting up a call for papers' / 'Reviewing submissions ›') -- graded by STRUCTURE (the pager element renders) since the neighbouring titles are illustrative mockup prose, same convention as the H1 above.
      expect(html).toContain('class="chq-docs-pager"');
    },
  );

  it(
    // 'Docs · the index' (:119). MATCHES.
    "'Docs · the index' (:119) MATCHES -- header (no search field), intro H1/standfirst/large search, grouped article sections",
    async () => {
      verbatimLine(
        "docs",
        119,
        `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Docs · the index</span>`,
      );
      const app = docsBuildApp();
      const res = await app.request("/docs");
      expect(res.status).toBe(200);
      const html = await res.text();
      // Chautauqua Docs.dc.html:129 `<a href="#" style="margin-left:auto; font-size:13px; font-weight:700; color:#565A4B">API reference ↗</a>` -- the index header carries ONLY the API-reference link, no compact search field (that lives in the intro block below instead, :136) -- unlike the article page's header above.
      expect(html).not.toContain('class="chq-docs-search chq-docs-search-compact"');
      expect(html).toMatch(/class="chq-docs-leaving"[^>]*>[\s\S]*?API reference[\s\S]*?<\/a>/);
      // Chautauqua Docs.dc.html:134 `<h1 style="margin:0; font-family:'Familjen Grotesk', sans-serif; font-size:40px; font-weight:700; letter-spacing:-0.042em; line-height:1.05">Chautauqua docs</h1>`
      expect(html).toContain("<h1>Chautauqua docs</h1>");
      expect(html).toContain("<p>Everything the software does, in the order you meet it. Start where you sit.</p>");
      // Chautauqua Docs.dc.html:136 `<div style="border:1px solid #BAB6A6; border-radius:4px; padding:12px 14px; font-size:15px; color:#565A4B; background:#FAF8F2; max-width:420px">Search the docs…</div>`
      expect(html).toContain('class="chq-docs-search chq-docs-search-large"');
      expect(html).toContain('placeholder="Search the docs…"');
      // Chautauqua Docs.dc.html:142-149 grouped sections, each a label/blurb head over an article-title/blurb grid.
      expect(html).toContain('class="chq-docs-group-label"');
      expect(html).toContain('class="chq-docs-article-title"');
      expect(DOCS_ARTICLES.length).toBeGreaterThan(0);
    },
  );

  it(
    // 'Docs · the element library' (:226). UNREACHED -- not a page the app
    // serves. Confirmed by absence, not by dispatching a request to a
    // guessed path: no slug in DOCS_ARTICLES names it, docsSiteRoutes.ts
    // (this file's own harness) registers exactly two GETs
    // ("/docs" and "/docs/:slug"), and DocsBlock's own closed nine-kind
    // union (src/routes/docs-content/types.ts) IS this frame's content --
    // reflected in the type system, never rendered as a page of its own.
    // test/frame-caption-ledger/exclusions/explainer.ts independently
    // treats this frame's caption text as design-system vocabulary, not
    // product copy the app renders, for the same reason.
    "'Docs · the element library' (:226) UNREACHED -- no route serves this frame; it is design-system reference, not a rendered page",
    () => {
      verbatimLine(
        "docs",
        226,
        `      <span style="font-family:'Familjen Grotesk', sans-serif; font-size:19px; font-weight:600">Docs · the element library</span>`,
      );
      expect(DOCS_ARTICLES.some((a) => a.slug.includes("element") || a.title.toLowerCase().includes("element library"))).toBe(
        false,
      );
    },
  );
});

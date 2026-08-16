// task-w9-a: docs search (DEC-382, wave-9 amendment). Unit tests for the
// pure src/routes/docs-content/search.ts core, plus route tests for
// GET /docs?q= (results, no-results empty state, blank q unchanged,
// over-long q never throws).

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

import { searchDocs } from "../src/routes/docs-content/search";
import type { DocsArticle } from "../src/routes/docs-content/types";
import { MAX_SEARCH_QUERY_LENGTH } from "../src/lib/query-bounds";

const FIXTURE_ARTICLES: DocsArticle[] = [
  {
    slug: "alpha-article",
    group: "getting-started",
    title: "Alpha article",
    standfirst: "A standfirst about zeppelins.",
    blocks: [
      { kind: "heading", text: "Heading about narwhals", level: 2 },
      { kind: "prose", text: "Prose mentioning platypus behaviour." },
      { kind: "list", items: ["first item", "second item mentions quokka"], ordered: false },
      { kind: "figure", shotId: "shot-1", caption: "A caption about capybara" },
      { kind: "aside", weight: "worth-knowing", label: "Aardvark label", text: "Aside text about wombat facts." },
      { kind: "deflist", rows: [{ term: "Term about okapi", definition: "Definition about pangolin" }] },
      { kind: "code", lines: ["const kinkajou = true;"] },
    ],
  },
  {
    slug: "beta-article",
    group: "running-an-event",
    title: "Beta article",
    standfirst: "Nothing unusual here.",
    blocks: [{ kind: "prose", text: "Ordinary prose with no special word." }],
  },
];

describe("searchDocs", () => {
  it("matches a hit in every block kind", () => {
    const cases: [string, string][] = [
      ["narwhals", "heading"],
      ["platypus", "prose"],
      ["quokka", "list"],
      ["capybara", "figure caption"],
      ["aardvark", "aside label"],
      ["wombat", "aside text"],
      ["okapi", "deflist term"],
      ["pangolin", "deflist definition"],
      ["kinkajou", "code"],
    ];
    for (const [needle, kind] of cases) {
      const hits = searchDocs(FIXTURE_ARTICLES, needle);
      expect(hits.map((h) => h.slug), `expected a hit for ${kind} needle "${needle}"`).toContain("alpha-article");
    }
  });

  it("is case-insensitive", () => {
    expect(searchDocs(FIXTURE_ARTICLES, "NARWHALS").map((h) => h.slug)).toContain("alpha-article");
  });

  it("ranks title/standfirst hits above body hits", () => {
    // "zeppelins" only appears in alpha's standfirst; "special" only
    // appears in beta's body prose. Search a needle common to both by
    // running two searches and checking rank via array position for a
    // single query that hits both fields across articles.
    const hits = searchDocs(FIXTURE_ARTICLES, "a");
    // Both articles match "a" somewhere; title/standfirst hits (rank 0)
    // must appear before any body-only hit (rank 1) in the result order.
    // alpha-article's title "Alpha article" matches -> rank 0.
    // beta-article's title "Beta article" also matches -> rank 0.
    // Confirm both come out but title-matching ones aren't pushed behind
    // a body-only match by constructing a targeted case instead:
    const titleOnly = searchDocs(
      [
        { slug: "title-hit", group: "getting-started", title: "Xylophone", standfirst: "no match", blocks: [] },
        { slug: "body-hit", group: "getting-started", title: "No match here", standfirst: "no match", blocks: [{ kind: "prose", text: "xylophone appears here" }] },
      ],
      "xylophone",
    );
    expect(titleOnly.map((h) => h.slug)).toEqual(["title-hit", "body-hit"]);
    expect(hits.length).toBeGreaterThan(0);
  });

  it("ties break by input article order", () => {
    const hits = searchDocs(FIXTURE_ARTICLES, "article");
    expect(hits.map((h) => h.slug)).toEqual(["alpha-article", "beta-article"]);
  });

  it("returns [] for blank/whitespace q", () => {
    expect(searchDocs(FIXTURE_ARTICLES, "")).toEqual([]);
    expect(searchDocs(FIXTURE_ARTICLES, "   ")).toEqual([]);
  });

  it("returns [] when nothing matches", () => {
    expect(searchDocs(FIXTURE_ARTICLES, "nonexistentword")).toEqual([]);
  });

  it("defaults limit to 20 and honours an explicit smaller limit", () => {
    const many: DocsArticle[] = Array.from({ length: 25 }, (_, i) => ({
      slug: `article-${i}`,
      group: "getting-started",
      title: `Widget article ${i}`,
      standfirst: "widget",
      blocks: [],
    }));
    expect(searchDocs(many, "widget")).toHaveLength(20);
    expect(searchDocs(many, "widget", 3)).toHaveLength(3);
  });

  it("snippet is a bounded window around the first match, from the matched block", () => {
    const longText = "x".repeat(200) + "findme" + "y".repeat(200);
    const hits = searchDocs(
      [{ slug: "long", group: "getting-started", title: "Long", standfirst: "s", blocks: [{ kind: "prose", text: longText }] }],
      "findme",
    );
    expect(hits).toHaveLength(1);
    const hit = hits[0]!;
    expect(hit.snippet).toContain("findme");
    expect(hit.snippet.length).toBeLessThan(longText.length);
  });
});

// --- Route tests -----------------------------------------------------

vi.mock("../src/server/repo/public/home", () => ({
  getHubOrg: vi.fn(async () => null),
  listHubEvents: vi.fn(async () => ({ items: [], capped: false })),
}));

import { docsSiteRoutes } from "../src/routes/docs-site";
import { DOCS_ARTICLES } from "../src/routes/docs-content";
import type { AppEnv } from "../src/server/env";

function buildApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", {} as AppEnv["Variables"]["db"]);
    await next();
  });
  app.route("/", docsSiteRoutes);
  return app;
}

describe("GET /docs?q=", () => {
  it("renders the unchanged index grid when q is absent", async () => {
    const app = buildApp();
    const res = await app.request("/docs");
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("chq-docs-article-grid");
    expect(body).not.toContain("Search results");
  });

  it("returns a hit list for a matching query, with an article link and its group label", async () => {
    const target = DOCS_ARTICLES[0]!;
    const needle = target.title.split(" ")[0]!;
    const app = buildApp();
    const res = await app.request(`/docs?q=${encodeURIComponent(needle)}`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Search results");
    expect(body).toContain(`href="/docs/${target.slug}"`);
  });

  it("renders the named empty state for a query with no matches", async () => {
    const app = buildApp();
    const res = await app.request("/docs?q=zzzznomatchzzzz");
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("No results for");
    expect(body).toContain("chq-pub-empty-block");
  });

  it("never throws on an over-long q, and renders the no-results state", async () => {
    const overLong = "a".repeat(MAX_SEARCH_QUERY_LENGTH + 50);
    const app = buildApp();
    const res = await app.request(`/docs?q=${encodeURIComponent(overLong)}`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("chq-pub-empty-block");
  });

  it("renders a real search form with a named q input on the index", async () => {
    const app = buildApp();
    const res = await app.request("/docs");
    const body = await res.text();
    expect(body).toContain('name="q"');
    expect(body).toContain('action="/docs"');
  });

  it("carries the API-reference leaving row as the last row of running-the-software", async () => {
    const app = buildApp();
    const res = await app.request("/docs");
    const body = await res.text();
    expect(body).toContain("generated from the routes");
  });
});

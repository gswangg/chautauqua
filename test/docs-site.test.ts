// task-w3-a: GET /docs (the index, grouped by DOCS_GROUP_META in
// DOCS_GROUPS order) and GET /docs/:slug (one article, rendering every
// DocsBlock kind). Mirrors test/public-not-found-card.test.ts's
// repo/public/home mock so publicNotFound's resolveNotFoundEyebrow (used by
// the unknown-slug 404) runs against a real db shape without touching D1.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

vi.mock("../src/server/repo/public/home", () => ({
  getHubOrg: vi.fn(async () => null),
  listHubEvents: vi.fn(async () => ({ items: [], capped: false })),
}));

import { docsSiteRoutes } from "../src/routes/docs-site";
import { docsRoutes } from "../src/routes/docs";
import { DOCS_GROUPS, DOCS_GROUP_META, DOCS_ARTICLES } from "../src/routes/docs-content";
import type { AppEnv } from "../src/server/env";

// hono/jsx HTML-escapes text children (&, <, >, ", '), so raw fixture
// prose containing an apostrophe or ampersand never appears byte-for-byte
// in the rendered body -- decode before substring-matching against it.
function unescapeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function buildApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", {} as AppEnv["Variables"]["db"]);
    await next();
  });
  app.route("/", docsRoutes);
  app.route("/", docsSiteRoutes);
  return app;
}

describe("GET /docs", () => {
  it("renders all six group labels in DOCS_GROUPS order", async () => {
    const app = buildApp();
    const res = await app.request("/docs");
    expect(res.status).toBe(200);
    const body = await res.text();
    let lastIndex = -1;
    for (const groupId of DOCS_GROUPS) {
      const label = DOCS_GROUP_META[groupId].label;
      expect(body).toContain(label);
      const idx = body.indexOf(label);
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
  });

  it("links every article at /docs/<slug> with its title and standfirst", async () => {
    const app = buildApp();
    const res = await app.request("/docs");
    const body = unescapeHtml(await res.text());
    for (const article of DOCS_ARTICLES) {
      expect(body).toContain(`href="/docs/${article.slug}"`);
      expect(body).toContain(article.title);
    }
  });

  it("carries the API reference as a labelled leaving link, never as an article", async () => {
    const app = buildApp();
    const res = await app.request("/docs");
    const body = await res.text();
    expect(body).toContain('href="/docs/api"');
    expect(body).toContain("Leaves the docs");
    expect(body).toContain("↗");
  });
});

describe("GET /docs/:slug", () => {
  it("reaches every article in DOCS_ARTICLES and renders each of its blocks", async () => {
    const app = buildApp();
    for (const article of DOCS_ARTICLES) {
      const res = await app.request(`/docs/${article.slug}`);
      expect(res.status).toBe(200);
      const body = unescapeHtml(await res.text());
      expect(body).toContain(article.title);
      expect(body).toContain(article.standfirst);
      for (const block of article.blocks) {
        if (block.kind === "heading" || block.kind === "prose") {
          expect(body).toContain(block.text);
        } else if (block.kind === "list") {
          for (const item of block.items) {
            expect(body).toContain(item);
          }
        } else if (block.kind === "aside") {
          expect(body).toContain(block.label);
          expect(body).toContain(block.text);
        } else if (block.kind === "deflist") {
          for (const row of block.rows) {
            expect(body).toContain(row.term);
            expect(body).toContain(row.definition);
          }
        } else if (block.kind === "code") {
          for (const line of block.lines) {
            expect(body).toContain(line);
          }
        } else {
          expect(body).toContain(block.shotId);
          expect(body).toContain(block.caption);
        }
      }
    }
  });

  it("prints a figure slot's shotId as a named placeholder, never an <img>", async () => {
    const withFigure = DOCS_ARTICLES.find((a) => a.blocks.some((b) => b.kind === "figure"));
    expect(withFigure).toBeDefined();
    const app = buildApp();
    const res = await app.request(`/docs/${withFigure!.slug}`);
    const body = await res.text();
    expect(body).not.toContain("<img");
    const figureBlock = withFigure!.blocks.find((b) => b.kind === "figure") as { shotId: string };
    expect(body).toContain(figureBlock.shotId);
  });

  it("404s on an unknown slug rather than redirecting", async () => {
    const app = buildApp();
    const res = await app.request("/docs/this-slug-does-not-exist");
    expect(res.status).toBe(404);
    const body = await res.text();
    expect(body).not.toContain("<meta http-equiv=\"refresh\"");
  });
});

describe("GET /docs/api", () => {
  it("still returns the API reference after mounting the docs site", async () => {
    const app = buildApp();
    const res = await app.request("/docs/api");
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("/api/v1");
  });
});

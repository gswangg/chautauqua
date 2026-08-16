// task-w4-b: article furniture -- the side nav (docs-content/nav.ts), the
// Where-next closer (docs-content/where-next.ts), and their wiring into
// docs-site.tsx's article page (nav column, where-next section, prev/next
// pager). Mirrors test/docs-site.test.ts's Hono mock for the render checks.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

vi.mock("../src/server/repo/public/home", () => ({
  getHubOrg: vi.fn(async () => null),
  listHubEvents: vi.fn(async () => ({ items: [], capped: false })),
}));

import { docsSiteRoutes } from "../src/routes/docs-site";
import { DOCS_ARTICLES } from "../src/routes/docs-content";
import { docsNavGroups, docsArticleNeighbours } from "../src/routes/docs-content/nav";
import { WHERE_NEXT_BY_SLUG } from "../src/routes/docs-content/where-next";
import type { AppEnv } from "../src/server/env";

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
  app.route("/", docsSiteRoutes);
  return app;
}

describe("WHERE_NEXT_BY_SLUG", () => {
  it("keys equal the DOCS_ARTICLES slug set in both directions", () => {
    const articleSlugs = new Set(DOCS_ARTICLES.map((a) => a.slug));
    const whereNextSlugs = new Set(Object.keys(WHERE_NEXT_BY_SLUG));
    for (const slug of articleSlugs) {
      expect(whereNextSlugs.has(slug), `article ${slug} has no Where-next rows`).toBe(true);
    }
    for (const slug of whereNextSlugs) {
      expect(articleSlugs.has(slug), `Where-next has rows for ${slug} but no such article exists`).toBe(true);
    }
  });

  it("gives every article 2-3 rows", () => {
    for (const article of DOCS_ARTICLES) {
      const rows = WHERE_NEXT_BY_SLUG[article.slug]!;
      expect(rows.length, article.slug).toBeGreaterThanOrEqual(2);
      expect(rows.length, article.slug).toBeLessThanOrEqual(3);
    }
  });

  it("every href is a real mounted path starting with /", () => {
    for (const rows of Object.values(WHERE_NEXT_BY_SLUG)) {
      for (const row of rows) {
        expect(row.href.startsWith("/"), row.href).toBe(true);
        expect(row.where.trim().length).toBeGreaterThan(0);
        expect(row.what.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe("docsNavGroups", () => {
  it("covers every DOCS_ARTICLES slug exactly once", () => {
    const navSlugs = docsNavGroups().flatMap((g) => g.articles.map((a) => a.slug));
    const articleSlugs = DOCS_ARTICLES.map((a) => a.slug);
    expect(new Set(navSlugs)).toEqual(new Set(articleSlugs));
    expect(navSlugs.length).toBe(articleSlugs.length);
  });
});

describe("docsArticleNeighbours", () => {
  it("forms a total order over the flattened nav with null only at the ends", () => {
    const flat = docsNavGroups().flatMap((g) => g.articles);
    expect(flat.length).toBe(DOCS_ARTICLES.length);

    for (let i = 0; i < flat.length; i++) {
      const { prev, next } = docsArticleNeighbours(flat[i]!.slug);
      if (i === 0) {
        expect(prev).toBeNull();
      } else {
        expect(prev?.slug).toBe(flat[i - 1]!.slug);
      }
      if (i === flat.length - 1) {
        expect(next).toBeNull();
      } else {
        expect(next?.slug).toBe(flat[i + 1]!.slug);
      }
    }
  });

  it("an unknown slug returns null at both ends", () => {
    expect(docsArticleNeighbours("does-not-exist")).toEqual({ prev: null, next: null });
  });
});

describe("docs article page furniture", () => {
  it("renders the nav, the where-next rows and both pager links for a middle article", async () => {
    const flat = docsNavGroups().flatMap((g) => g.articles);
    const middleSlug = flat[Math.floor(flat.length / 2)]!.slug;
    const { prev, next } = docsArticleNeighbours(middleSlug);
    expect(prev).not.toBeNull();
    expect(next).not.toBeNull();

    const app = buildApp();
    const res = await app.request(`/docs/${middleSlug}`);
    expect(res.status).toBe(200);
    const body = unescapeHtml(await res.text());

    // nav: every group label and every article title in the nav appear
    for (const group of docsNavGroups()) {
      expect(body).toContain(group.label);
      for (const article of group.articles) {
        expect(body).toContain(`href="/docs/${article.slug}"`);
      }
    }

    // where-next
    expect(body).toContain("Where next");
    for (const row of WHERE_NEXT_BY_SLUG[middleSlug]!) {
      expect(body).toContain(`href="${row.href}"`);
      expect(body).toContain(row.where);
    }

    // pager: both links present
    expect(body).toContain(`href="/docs/${prev!.slug}"`);
    expect(body).toContain(`href="/docs/${next!.slug}"`);
    expect(body).toContain(prev!.title);
    expect(body).toContain(next!.title);

    // phone back link
    expect(body).toContain('href="/docs"');
    expect(body).toContain("Docs");
  });

  it("omits the prev link on the first article and the next link on the last", async () => {
    const flat = docsNavGroups().flatMap((g) => g.articles);
    const firstSlug = flat[0]!.slug;
    const lastSlug = flat[flat.length - 1]!.slug;

    const app = buildApp();

    const firstBody = unescapeHtml(await (await app.request(`/docs/${firstSlug}`)).text());
    const { next: firstNext } = docsArticleNeighbours(firstSlug);
    expect(firstBody).toContain(`href="/docs/${firstNext!.slug}"`);
    expect(firstBody).not.toContain('class="chq-docs-pager-prev"');

    const lastBody = unescapeHtml(await (await app.request(`/docs/${lastSlug}`)).text());
    const { prev: lastPrev } = docsArticleNeighbours(lastSlug);
    expect(lastBody).toContain(`href="/docs/${lastPrev!.slug}"`);
    expect(lastBody).not.toContain('class="chq-docs-pager-next"');
  });
});

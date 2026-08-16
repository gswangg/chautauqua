// task-w4-a (DEC-518 amendment, wave 4): DOCS_SHOTS_AVAILABLE is the
// WRITTEN-BY-script gate that flips a docs figure from its named
// placeholder to a real <img>. Three things this file guards:
//   1. every id the (generated) manifest lists is a real figure-block
//      shotId somewhere in DOCS_ARTICLES -- no orphan image pointing at a
//      caption that doesn't exist;
//   2. an id absent from the manifest still renders the placeholder text,
//      never an <img>;
//   3. an id present in a stubbed manifest renders the real <img> (correct
//      src, caption unchanged, alt empty by design -- DESIGN-RULINGS.md:313);
//   4. wrangler.jsonc's assets.run_worker_first has no /docs entry, so
//      /docs/shots/*.png resolves from the assets binding before the
//      worker (the join scripts/docs-shots.ts's output feeds).
//
// Same repo/public/home mock idiom as test/docs-site.test.ts.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("../src/server/repo/public/home", () => ({
  getHubOrg: vi.fn(async () => null),
  listHubEvents: vi.fn(async () => ({ items: [], capped: false })),
}));

import { DOCS_ARTICLES } from "../src/routes/docs-content";
import { DOCS_SHOTS_AVAILABLE } from "../src/routes/docs-content/shots-available";
import type { AppEnv } from "../src/server/env";

// hono/jsx HTML-escapes text children (&, <, >, ", '), so raw fixture
// prose containing an apostrophe or ampersand never appears byte-for-byte
// in the rendered body -- decode before substring-matching against it.
// Same idiom as test/docs-site.test.ts.
function unescapeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function allFigureShotIds(): string[] {
  const ids: string[] = [];
  for (const article of DOCS_ARTICLES) {
    for (const block of article.blocks) {
      if (block.kind === "figure") ids.push(block.shotId);
    }
  }
  return ids;
}

function findArticleWithFigure() {
  const article = DOCS_ARTICLES.find((a) => a.blocks.some((b) => b.kind === "figure"));
  expect(article).toBeDefined();
  const block = article!.blocks.find((b) => b.kind === "figure") as { shotId: string; caption: string };
  return { article: article!, block };
}

async function buildAppWith(shotsAvailable: readonly string[]) {
  vi.resetModules();
  vi.doMock("../src/routes/docs-content/shots-available", () => ({
    DOCS_SHOTS_AVAILABLE: shotsAvailable,
  }));
  const { docsSiteRoutes } = await import("../src/routes/docs-site");
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", {} as AppEnv["Variables"]["db"]);
    await next();
  });
  app.route("/", docsSiteRoutes);
  return app;
}

describe("DOCS_SHOTS_AVAILABLE population", () => {
  it("is empty by default -- the file must never be hand-extended", () => {
    expect(DOCS_SHOTS_AVAILABLE).toEqual([]);
  });

  it("every listed id is a declared figure-block shotId somewhere in DOCS_ARTICLES (no orphan image)", () => {
    const declared = new Set(allFigureShotIds());
    for (const id of DOCS_SHOTS_AVAILABLE) {
      expect(declared.has(id)).toBe(true);
    }
  });
});

describe("figure block: placeholder vs real image", () => {
  it("renders the named placeholder and no <img> when the shotId is absent from the manifest", async () => {
    const { article, block } = findArticleWithFigure();
    const app = await buildAppWith([]);
    const res = await app.request(`/docs/${article.slug}`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).not.toContain("<img");
    expect(body).toContain(`screenshot · ${block.shotId}`);
  });

  it("renders a real <img> with the correct src and unchanged caption when the manifest lists the shotId", async () => {
    const { article, block } = findArticleWithFigure();
    const app = await buildAppWith([block.shotId]);
    const res = await app.request(`/docs/${article.slug}`);
    expect(res.status).toBe(200);
    const rawBody = await res.text();
    expect(rawBody).toContain(`src="/docs/shots/${block.shotId}.png"`);
    expect(rawBody).toContain('class="chq-docs-figure-img"');
    expect(rawBody).toContain('alt=""');
    expect(rawBody).not.toContain("screenshot ·");
    expect(unescapeHtml(rawBody)).toContain(block.caption);
  });
});

describe("wrangler.jsonc assets binding precedes the worker for /docs/shots", () => {
  it("assets.run_worker_first has no /docs entry", () => {
    const raw = readFileSync(join(__dirname, "..", "wrangler.jsonc"), "utf8");
    // wrangler.jsonc is JSONC: a full comment-stripping JSON parse would
    // also have to dodge "//" inside string values (e.g. the
    // PUBLIC_BASE_URL "https://..." a few lines down), so read the
    // run_worker_first array directly by its own grammar instead of
    // parsing the whole file.
    const match = raw.match(/"run_worker_first"\s*:\s*\[([^\]]*)\]/);
    expect(match).not.toBeNull();
    const arrayBody = match?.[1] ?? "";
    const entries = [...arrayBody.matchAll(/"([^"]*)"/g)].map((m) => m[1] ?? "");
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.startsWith("/docs")).toBe(false);
    }
  });
});

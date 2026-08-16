// Regression for task-w1-c: src/routes/docs-content/index.ts's DOCS_ARTICLES
// is a hand-listed array of imports, which is exactly the shape DEC-518 says
// desyncs -- an article module added to the directory without a matching
// entry in DOCS_ARTICLES would ship undocumented and this test would never
// notice unless it derives the population independently. So this test reads
// the directory itself (not DOCS_ARTICLES, not a hand-typed file list),
// dynamically imports every non-registry, non-type module in it, and
// compares the resulting slug set against DOCS_ARTICLES's slugs in both
// directions.

import { describe, expect, it, beforeAll } from "vitest";
import { readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DOCS_ARTICLES, DOCS_GROUPS } from "../src/routes/docs-content";
import type { DocsArticle } from "../src/routes/docs-content/types";

const CONTENT_DIR = resolve(fileURLToPath(import.meta.url), "../../src/routes/docs-content");

// Files in this directory that are infrastructure, not articles. nav.ts
// and where-next.ts are article FURNITURE (task-w4-b: side nav, Where-next
// closer, pager) -- pure data/derivation modules with no DocsArticle
// export of their own.
const NON_ARTICLE_FILES = new Set(["index.ts", "types.ts", "groups.ts", "nav.ts", "where-next.ts"]);

/** Finds the single DocsArticle-shaped named export of a dynamically
 * imported module (an object carrying `slug`, `group`, `title`). */
function findArticleExport(mod: Record<string, unknown>, fileName: string): DocsArticle {
  const candidates = Object.entries(mod).filter(
    ([, value]) =>
      typeof value === "object" &&
      value !== null &&
      "slug" in value &&
      "group" in value &&
      "title" in value &&
      "blocks" in value,
  );
  if (candidates.length !== 1) {
    throw new Error(
      `docs-content/${fileName}: expected exactly one DocsArticle-shaped named export, found ${candidates.length}`,
    );
  }
  const [, value] = candidates[0]!;
  return value as DocsArticle;
}

let derivedArticles: DocsArticle[];

beforeAll(async () => {
  const files = readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith(".ts") && !NON_ARTICLE_FILES.has(f))
    .sort();
  derivedArticles = [];
  for (const file of files) {
    const modUrl = pathToFileURL(resolve(CONTENT_DIR, file)).href;
    const mod = (await import(modUrl)) as Record<string, unknown>;
    derivedArticles.push(findArticleExport(mod, file));
  }
});

describe("docs content manifest (DEC-518: derived, not hand-mirrored)", () => {
  it("finds at least one article module on disk", () => {
    expect(derivedArticles.length).toBeGreaterThan(0);
  });

  it("DOCS_ARTICLES contains every article module in the directory, and no extra ones", () => {
    const derivedSlugs = new Set(derivedArticles.map((a) => a.slug));
    const registeredSlugs = new Set(DOCS_ARTICLES.map((a) => a.slug));
    for (const slug of derivedSlugs) {
      expect(registeredSlugs.has(slug), `directory has ${slug} but DOCS_ARTICLES does not`).toBe(true);
    }
    for (const slug of registeredSlugs) {
      expect(derivedSlugs.has(slug), `DOCS_ARTICLES has ${slug} but no file in the directory backs it`).toBe(true);
    }
    expect(registeredSlugs.size).toBe(DOCS_ARTICLES.length);
  });

  it("article slugs are unique", () => {
    const slugs = DOCS_ARTICLES.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every article's group is a declared DocsGroupId", () => {
    for (const article of DOCS_ARTICLES) {
      expect(DOCS_GROUPS as readonly string[], `${article.slug}: group "${article.group}"`).toContain(article.group);
    }
  });

  it("every article has a non-empty standfirst and at least one prose block", () => {
    for (const article of DOCS_ARTICLES) {
      expect(article.standfirst.trim().length, `${article.slug}: standfirst`).toBeGreaterThan(0);
      const hasProse = article.blocks.some((b) => b.kind === "prose" && b.text.trim().length > 0);
      expect(hasProse, `${article.slug}: at least one non-empty prose block`).toBe(true);
    }
  });

  it("every declared group has at least one article", () => {
    const groupsWithArticles = new Set(DOCS_ARTICLES.map((a) => a.group));
    for (const group of DOCS_GROUPS) {
      expect(groupsWithArticles.has(group), `DOCS_GROUPS declares "${group}" but no article in DOCS_ARTICLES has that group`).toBe(
        true,
      );
    }
  });

  it("every figure's shotId matches <group>-<slug>-nn and its own article's group/slug", () => {
    const shotIdPattern = /^([a-z-]+)-([a-z0-9-]+)-(\d{2})$/;
    for (const article of DOCS_ARTICLES) {
      const expectedPrefix = `${article.group}-${article.slug}-`;
      for (const block of article.blocks) {
        if (block.kind !== "figure") continue;
        expect(block.shotId, `${article.slug}: shotId shape`).toMatch(shotIdPattern);
        expect(
          block.shotId.startsWith(expectedPrefix),
          `${article.slug}: shotId "${block.shotId}" must start with "${expectedPrefix}"`,
        ).toBe(true);
        expect(block.caption.trim().length, `${article.slug}: figure caption`).toBeGreaterThan(0);
      }
    }
  });
});

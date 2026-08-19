// task-w4-c: DEC-650 (wave-4 amendment) states the drawn element library
// (docs/design/Chautauqua Docs.dc.html:226-346, `Docs · the element library`)
// is a CLOSED set of nine
// block kinds -- "Nothing outside this set may appear in an article". This
// test derives the set of block kinds actually used across DOCS_ARTICLES
// and asserts it is a subset of the declared nine-member union, asserts no
// heading declares a level of 4 or higher, and render-tests each new block
// kind's emitted element and class against the real registry (the
// running-the-software article, converted this wave, exercises all three).

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

vi.mock("../src/server/repo/public/home", () => ({
  getHubOrg: vi.fn(async () => null),
  listHubEvents: vi.fn(async () => ({ items: [], capped: false })),
}));

import { docsSiteRoutes } from "../src/routes/docs-site";
import { DOCS_ARTICLES } from "../src/routes/docs-content";
import type { AppEnv } from "../src/server/env";

const DECLARED_BLOCK_KINDS = new Set(["heading", "prose", "list", "figure", "aside", "deflist", "code"]);

function buildApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", {} as AppEnv["Variables"]["db"]);
    await next();
  });
  app.route("/", docsSiteRoutes);
  return app;
}

describe("docs block vocabulary (DEC-650: closed nine-block element library)", () => {
  it("every block kind used across DOCS_ARTICLES is a subset of the declared vocabulary", () => {
    const usedKinds = new Set<string>();
    for (const article of DOCS_ARTICLES) {
      for (const block of article.blocks) {
        usedKinds.add(block.kind);
      }
    }
    expect(usedKinds.size).toBeGreaterThan(0);
    for (const kind of usedKinds) {
      expect(DECLARED_BLOCK_KINDS.has(kind), `block kind "${kind}" is not in the declared nine`).toBe(true);
    }
  });

  it("the declared vocabulary itself has exactly seven typed members covering all nine drawn blocks (heading and list each carry a variant flag rather than a second kind)", () => {
    // The drawn library names nine blocks: prose, H2, H3, bulleted list,
    // numbered list, figure, aside (two weights counted as one block kind
    // in the type), definition list, code. DocsBlock encodes the two
    // heading levels and the two list orderings as optional fields on one
    // kind each rather than doubling the kind union, so the TYPE union has
    // seven members while the DRAWN vocabulary has nine.
    expect(DECLARED_BLOCK_KINDS.size).toBe(7);
  });

  it("no heading block declares a level of 4 or higher (an article needing H4 is two articles)", () => {
    for (const article of DOCS_ARTICLES) {
      for (const block of article.blocks) {
        if (block.kind !== "heading") continue;
        if (block.level === undefined) continue;
        expect(block.level, `${article.slug}: heading "${block.text}" level`).toBeLessThanOrEqual(3);
      }
    }
  });

  it("every aside declares exactly one of the two sanctioned weights", () => {
    for (const article of DOCS_ARTICLES) {
      for (const block of article.blocks) {
        if (block.kind !== "aside") continue;
        expect(["worth-knowing", "cannot-be-undone"], `${article.slug}: aside weight`).toContain(block.weight);
      }
    }
  });

  it("at least one article in the registry uses each of the three new block kinds (aside, deflist, code)", () => {
    const usedKinds = new Set<string>();
    for (const article of DOCS_ARTICLES) {
      for (const block of article.blocks) {
        usedKinds.add(block.kind);
      }
    }
    expect(usedKinds.has("aside")).toBe(true);
    expect(usedKinds.has("deflist")).toBe(true);
    expect(usedKinds.has("code")).toBe(true);
  });
});

describe("docs block vocabulary: new block kinds render with the expected element and class", () => {
  it("aside renders a div carrying its weight-suffixed class, label and text", async () => {
    const app = buildApp();
    const article = DOCS_ARTICLES.find((a) => a.blocks.some((b) => b.kind === "aside"));
    expect(article, "an article using an aside block").toBeDefined();
    const asideBlock = article!.blocks.find((b) => b.kind === "aside") as {
      weight: "worth-knowing" | "cannot-be-undone";
      label: string;
      text: string;
    };
    const res = await app.request(`/docs/${article!.slug}`);
    const body = await res.text();
    expect(body).toContain(`class="chq-docs-aside chq-docs-aside-${asideBlock.weight}"`);
    expect(body).toContain('class="chq-docs-aside-label"');
    expect(body).toContain(asideBlock.label);
  });

  it("deflist renders a dl with one term/definition row per entry", async () => {
    const app = buildApp();
    const article = DOCS_ARTICLES.find((a) => a.blocks.some((b) => b.kind === "deflist"));
    expect(article, "an article using a deflist block").toBeDefined();
    const deflistBlock = article!.blocks.find((b) => b.kind === "deflist") as {
      rows: { term: string; definition: string }[];
    };
    const res = await app.request(`/docs/${article!.slug}`);
    const body = await res.text();
    expect(body).toContain('<dl class="chq-docs-deflist">');
    expect(body).toContain('class="chq-docs-deflist-term"');
    expect(body).toContain('class="chq-docs-deflist-definition"');
    for (const row of deflistBlock.rows) {
      expect(body).toContain(row.term);
      expect(body).toContain(row.definition);
    }
  });

  it("code renders a pre>code element with lines joined, never as prose or a list", async () => {
    const app = buildApp();
    const article = DOCS_ARTICLES.find((a) => a.blocks.some((b) => b.kind === "code"));
    expect(article, "an article using a code block").toBeDefined();
    const codeBlock = article!.blocks.find((b) => b.kind === "code") as { lines: string[] };
    const res = await app.request(`/docs/${article!.slug}`);
    const body = await res.text();
    expect(body).toContain('<pre class="chq-docs-code">');
    expect(body).toContain("<code>");
    for (const line of codeBlock.lines) {
      expect(body).toContain(line);
    }
  });
});

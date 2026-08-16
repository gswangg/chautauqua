// DEC-650 amendment (USER RULING 2026-08-16, two-tier docs vocabulary):
// docs prose carries exactly two inline spans — `code` for machine-literal
// text and **bold** for an on-screen control or label named as a thing to
// find. This file unit-tests the parser (docsInlineSegments) directly —
// including the escape-safety rules: unpaired or empty markers are literal
// text, never a span — and render-tests the spans through the real
// registry so prose text, list items and figure captions all reach the
// <code>/<strong> elements, with no raw marker characters leaking into
// the rendered page.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

vi.mock("../src/server/repo/public/home", () => ({
  getHubOrg: vi.fn(async () => null),
  listHubEvents: vi.fn(async () => ({ items: [], capped: false })),
}));

import { docsSiteRoutes, docsInlineSegments } from "../src/routes/docs-site";
import { DOCS_ARTICLES } from "../src/routes/docs-content";
import type { AppEnv } from "../src/server/env";

// THEME_CSS carries backticks inside its own CSS comments, so the
// marker-leak assertions below look only at the page outside <style>.
function withoutStyles(body: string): string {
  return body.replace(/<style>[\s\S]*?<\/style>/g, "");
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

describe("docsInlineSegments: the two-span inline parser", () => {
  it("plain text is one text segment", () => {
    expect(docsInlineSegments("A task is something you need.")).toEqual([
      { kind: "text", text: "A task is something you need." },
    ]);
  });

  it("a `code` span becomes a code segment between its neighbours", () => {
    expect(docsInlineSegments("run `npm run seed` first")).toEqual([
      { kind: "text", text: "run " },
      { kind: "code", text: "npm run seed" },
      { kind: "text", text: " first" },
    ]);
  });

  it("a **bold** span becomes a strong segment", () => {
    expect(docsInlineSegments("select **Move to accept queue** in the bar")).toEqual([
      { kind: "text", text: "select " },
      { kind: "strong", text: "Move to accept queue" },
      { kind: "text", text: " in the bar" },
    ]);
  });

  it("both span kinds mix in one string, in order", () => {
    expect(docsInlineSegments("**Pending** rows come from `seed`.")).toEqual([
      { kind: "strong", text: "Pending" },
      { kind: "text", text: " rows come from " },
      { kind: "code", text: "seed" },
      { kind: "text", text: "." },
    ]);
  });

  it("a span at the very start or very end has no empty text neighbours", () => {
    expect(docsInlineSegments("`PUBLIC_BASE_URL`")).toEqual([{ kind: "code", text: "PUBLIC_BASE_URL" }]);
    expect(docsInlineSegments("**Sent**")).toEqual([{ kind: "strong", text: "Sent" }]);
  });

  it("an unpaired backtick renders as-is (escape safety, never a span)", () => {
    expect(docsInlineSegments("a ` alone stays literal")).toEqual([
      { kind: "text", text: "a ` alone stays literal" },
    ]);
  });

  it("unpaired asterisks render as-is (escape safety, never a span)", () => {
    expect(docsInlineSegments("2 ** 8 is not bold")).toEqual([{ kind: "text", text: "2 ** 8 is not bold" }]);
    expect(docsInlineSegments("**half open")).toEqual([{ kind: "text", text: "**half open" }]);
  });

  it("an empty pair is not a span", () => {
    expect(docsInlineSegments("`` and **** stay literal")).toEqual([
      { kind: "text", text: "`` and **** stay literal" },
    ]);
  });
});

describe("inline spans render through the real registry", () => {
  it("a prose block's **bold** and `code` spans render as <strong>/<code>, with no raw markers left", async () => {
    const app = buildApp();
    const res = await app.request("/docs/contacts-pipeline-and-comms");
    expect(res.status).toBe(200);
    const body = await res.text();
    // prose: Tier-1 UI label and Tier-2 machine literal
    expect(body).toContain("<strong>Import as new</strong>");
    expect(body).toContain("<code>{missing_field}</code>");
    // list item token
    expect(body).toContain("<strong>Sent</strong>");
    // figure caption token
    expect(body).toContain("<strong>Import as new</strong> beside one radio control");
    // no marker characters may survive into the rendered page
    expect(withoutStyles(body)).not.toContain("**");
    expect(withoutStyles(body)).not.toContain("`");
  });

  it("a code span inside running-the-software prose renders monospace, and the code BLOCK is untouched", async () => {
    const app = buildApp();
    const res = await app.request("/docs/running-the-software");
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("<code>PUBLIC_BASE_URL</code>");
    expect(body).toContain("<code>/dev/mailbox</code>");
    expect(body).toContain('<pre class="chq-docs-code">');
    expect(withoutStyles(body)).not.toContain("**");
    expect(withoutStyles(body)).not.toContain("`");
  });

  it("no article's rendered page leaks a marker character", async () => {
    const app = buildApp();
    for (const article of DOCS_ARTICLES) {
      const res = await app.request(`/docs/${article.slug}`);
      const body = withoutStyles(await res.text());
      expect(body, `${article.slug} leaks a backtick`).not.toContain("`");
      expect(body, `${article.slug} leaks **`).not.toContain("**");
    }
  });
});

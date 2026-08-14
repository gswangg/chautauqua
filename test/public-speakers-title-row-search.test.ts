// task-w5-a: the speakers surface's search joins the title-row cluster --
// [h1] ... [Search][All tracks v][List|Grid] -- on both the List
// (SpeakersContent, /speakers) and Grid (GalleryContent, /gallery) views.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { publicRoutes } from "../src/routes/public";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";

const EVENT_ROW = {
  id: "ev1",
  orgId: "org1",
  name: "Test Event",
  slug: "conf",
  startDate: "2026-08-10",
  endDate: "2026-08-11",
  location: null,
  timezone: "UTC",
  recordPrefix: "SES",
  brandingJson: null,
};

function fakeKv() {
  return {
    async get() {
      return null;
    },
    async put() {},
    async delete() {},
  };
}

function installFakeCaches(): void {
  (globalThis as any).caches = {
    default: {
      async match() {
        return undefined;
      },
      async put() {},
    },
  };
}

const TEST_ENV = { KV: fakeKv() } as unknown as AppEnv["Bindings"];

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    groupBy: () => chain,
    as: () => chain,
    limit: async (n?: number) => (typeof n === "number" ? rows.slice(0, n) : rows),
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

function buildSimpleApp(rowsBySelect: unknown[][]) {
  let selectCall = 0;
  const db = {
    select: () => {
      const rows = rowsBySelect[selectCall] ?? [];
      selectCall += 1;
      return makeChain(rows);
    },
    selectDistinct: () => makeChain([]),
  } as unknown as AppEnv["Variables"]["db"];
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  registerErrorHandler(app);
  app.route("/", publicRoutes);
  return app;
}

function titleRowHtml(html: string): string {
  const m = html.match(/<div class="chq-pub-title-row">[\s\S]*?<\/div>/);
  if (!m) throw new Error("no .chq-pub-title-row found in: " + html);
  return m[0];
}

describe("task-w5-a: speakers search is inside .chq-pub-title-row", () => {
  it("GET /e/conf/speakers renders the search form as a descendant of .chq-pub-title-row", async () => {
    installFakeCaches();
    const app = buildSimpleApp([
      [EVENT_ROW], // getPublicEventBySlug
      [{ count: 0 }], // total
      [], // speaker rows
    ]);
    // DEC-919 (wave 47 amendment): an empty AND filter-free result is now
    // 'fresh' and drops the search box entirely -- ?q= keeps this a
    // 'filtered' zero result so the search box stays mounted, which is
    // what this test is actually asserting the ordering of.
    const res = await app.request("/e/conf/speakers?q=ada", {}, TEST_ENV);
    const html = await res.text();
    const row = titleRowHtml(html);
    expect(row).toContain('<form class="chq-pub-searchform"');
    // Ordering: h1, then Search, then the track select/view toggle.
    expect(row.indexOf("chq-pub-surface-title")).toBeLessThan(row.indexOf("chq-pub-searchform"));
  });

  it("GET /e/conf/gallery renders the search form as a descendant of .chq-pub-title-row (Grid twin)", async () => {
    installFakeCaches();
    const app = buildSimpleApp([
      [EVENT_ROW], // getPublicEventBySlug
      [{ count: 0 }], // total
      [], // speaker rows
    ]);
    // DEC-919 (wave 47 amendment): see the /speakers case above -- ?q= keeps
    // this a 'filtered' zero result so the search box stays mounted.
    const res = await app.request("/e/conf/gallery?q=ada", {}, TEST_ENV);
    const html = await res.text();
    const row = titleRowHtml(html);
    expect(row).toContain('<form class="chq-pub-searchform"');
    expect(row.indexOf("chq-pub-surface-title")).toBeLessThan(row.indexOf("chq-pub-searchform"));
  });
});

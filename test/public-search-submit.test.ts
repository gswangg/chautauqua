// DEC-919 amendment (wave 69): the public search submit must be a real,
// clickable control -- filters.tsx used to render it visually-hidden
// (left:-9999px via .chq-visually-hidden), so a pointer could never hit it
// (only Enter from the input submitted the form). PublicSearchBox now
// renders a visible <button type="submit" class="chq-pub-search-submit">
// with an accessible name, on every surface that renders it (sessions,
// speakers, agenda/schedule via ItinerarySearchForm) -- one shared
// component, one fix, no forked search box.
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { publicRoutes } from "../src/routes/public";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";
import { CHROME_CSS } from "../src/routes/public/css/chrome.css";

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

function buildApp(rowsBySelect: unknown[][]) {
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

// Extracts the `<form class="chq-pub-searchform" ...>...</form>` block from
// a rendered page's HTML.
function searchForm(html: string): string {
  const m = html.match(/<form class="chq-pub-searchform"[^>]*role="search">[\s\S]*?<\/form>/);
  if (!m) throw new Error("no search form found in: " + html);
  return m[0];
}

function assertRealSubmit(form: string): void {
  const buttonMatch = form.match(/<button\b[^>]*type="submit"[^>]*>[\s\S]*?<\/button>/);
  expect(buttonMatch).not.toBeNull();
  const button = buttonMatch![0];
  expect(button).toContain('type="submit"');
  // Must NOT be off-screen/unreachable-by-pointer.
  expect(button).not.toContain("chq-visually-hidden");
  // Must carry an accessible name (aria-label, since the visible content is
  // an aria-hidden icon, not text).
  expect(button).toMatch(/aria-label="[^"]+"/);
}

describe("DEC-919 amendment (wave 69): public search submit is a real, clickable control", () => {
  it("sessions: the search form's submit is visible and has an accessible name", async () => {
    installFakeCaches();
    const app = buildApp([
      [EVENT_ROW], // getPublicEventBySlug
      [], // getPublicTracks
      [{ id: "room1", name: "Alpha" }], // getPublicRooms
      [], // getPublicFormatOptions
      [], // dayCounts
      [], // cfpWindow
      [{ count: 3 }], // total
    ]);
    const res = await app.request("/e/conf/sessions", {}, TEST_ENV);
    const html = await res.text();
    assertRealSubmit(searchForm(html));
  });

  it("speakers: the search form's submit is visible and has an accessible name", async () => {
    installFakeCaches();
    const app = buildApp([
      [EVENT_ROW], // getPublicEventBySlug
      [], // getPublicTracks
      [{ total: 3 }], // total
      [], // speaker rows
    ]);
    const res = await app.request("/e/conf/speakers", {}, TEST_ENV);
    const html = await res.text();
    assertRealSubmit(searchForm(html));
  });

  it("agenda: the search form's submit is visible and has an accessible name", async () => {
    installFakeCaches();
    const app = buildApp([
      [EVENT_ROW], // getPublicEventBySlug
      [{ id: "trk-a", name: "Track A", color: null }], // getPublicTracks
      [{ count: 0 }], // total
      [], // roomRows
    ]);
    const res = await app.request("/e/conf/agenda", {}, TEST_ENV);
    const html = await res.text();
    assertRealSubmit(searchForm(html));
  });

  it("the label stays visually-hidden -- a label is not an actionable control", async () => {
    installFakeCaches();
    const app = buildApp([
      [EVENT_ROW],
      [],
      [{ id: "room1", name: "Alpha" }],
      [],
      [],
      [],
      [{ count: 3 }],
    ]);
    const res = await app.request("/e/conf/sessions", {}, TEST_ENV);
    const html = await res.text();
    const form = searchForm(html);
    expect(form).toContain('<label class="chq-visually-hidden" for="chq-pub-search-q">Search</label>');
  });

  it("CHROME_CSS: .chq-pub-search is 150px and .chq-pub-search-submit is 40px (the pair still sums to 190)", () => {
    const searchMatch = CHROME_CSS.match(/\.chq-pub-search\s*\{([^}]*)\}/);
    expect(searchMatch).not.toBeNull();
    expect(searchMatch![1]).toMatch(/width:\s*150px;/);

    const submitMatch = CHROME_CSS.match(/button\.chq-pub-search-submit\[type=submit\]\s*\{([^}]*)\}/);
    expect(submitMatch).not.toBeNull();
    expect(submitMatch![1]).toMatch(/width:\s*40px;/);

    const searchWidth = Number(searchMatch![1]!.match(/width:\s*(\d+)px;/)![1]);
    const submitWidth = Number(submitMatch![1]!.match(/width:\s*(\d+)px;/)![1]);
    expect(searchWidth + submitWidth).toBe(190);
  });
});

// DEC-594 (EMB-5/EMB-6/EMB-7): closes the embed contract — `fields=` and
// `day=` are honored by BOTH the HTML dispatch and the .json twin, and
// every link/form rendered inside /embed stays inside /embed instead of
// breaking out to the full-chrome /e/... surface. Reuses the fake-db-chain
// harness established in test/public.test.ts (no local sqlite/D1 test
// driver is wired up — see package.json).

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { publicRoutes } from "../src/routes/public";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    offset: async () => rows,
    as: () => chain,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

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

// Two sessions, one per event day, each with a track (for `fields=`) and a
// description (so a fields projection that drops it is observable).
const SUB_ROWS = [
  { id: "sub1", seq: 1, title: "Day One Talk", description: "Day one description text.", icsSequence: 0 },
  { id: "sub2", seq: 2, title: "Day Two Talk", description: "Day two description text.", icsSequence: 0 },
];
const TRACK_ROWS = [{ submissionId: "sub1", id: "trk1", name: "Engineering", color: null }];
const SLOT_ROWS = [
  { submissionId: "sub1", day: "2026-08-10", startMin: 540, endMin: 600, roomName: "Main Hall" },
  { submissionId: "sub2", day: "2026-08-11", startMin: 540, endMin: 600, roomName: "Main Hall" },
];

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

// db.select() call order for /embed/:slug/sessions (HTML): 1 event,
// 2 getPublicTracks, 3-6 hydrateSessions (subRows/trackRows/speakerRows/
// slotRows), 7 countVisibleSubmissions. For /embed/:slug/sessions.json
// there is no getPublicTracks call, so it shifts down by one.
function buildApp(opts: { html: boolean }) {
  let selectCall = 0;
  const db = {
    select: () => {
      selectCall += 1;
      const offset = opts.html ? 1 : 0;
      if (selectCall === 1) return makeChain([EVENT_ROW]);
      if (opts.html && selectCall === 2) return makeChain([]); // getPublicTracks
      if (selectCall === 2 + offset) return makeChain(SUB_ROWS); // hydrateSessions subRows
      if (selectCall === 3 + offset) return makeChain(TRACK_ROWS); // hydrateSessions trackRows
      if (selectCall === 4 + offset) return makeChain([]); // hydrateSessions speakerRows
      if (selectCall === 5 + offset) return makeChain(SLOT_ROWS); // hydrateSessions slotRows
      return makeChain([{ count: SUB_ROWS.length }]); // countVisibleSubmissions
    },
    selectDistinct: () => makeChain(SUB_ROWS.map((r) => ({ id: r.id, title: r.title }))),
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

describe("EMB-6: fields= honored by the .json twin", () => {
  it("omits description when fields=track,time is requested", async () => {
    installFakeCaches();
    const app = buildApp({ html: false });
    const res = await app.request("/embed/conf/sessions.json?fields=track,time", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Record<string, unknown>[] };
    expect(body.items.length).toBeGreaterThan(0);
    for (const item of body.items) {
      expect(item).not.toHaveProperty("description");
      expect(item).not.toHaveProperty("speakers");
      // title/id always survive; the requested fields' keys survive too.
      expect(item).toHaveProperty("title");
      expect(item).toHaveProperty("id");
    }
  });
});

describe("EMB-5: day= honored by the sessions .json twin", () => {
  it("returns fewer items than unfiltered, all on the requested day", async () => {
    installFakeCaches();
    const unfilteredApp = buildApp({ html: false });
    const unfilteredRes = await unfilteredApp.request("/embed/conf/sessions.json", {}, TEST_ENV);
    const unfiltered = (await unfilteredRes.json()) as { items: unknown[]; total: number };
    expect(unfiltered.items.length).toBe(2);

    installFakeCaches();
    const filteredApp = buildApp({ html: false });
    const filteredRes = await filteredApp.request("/embed/conf/sessions.json?day=2026-08-10", {}, TEST_ENV);
    expect(filteredRes.status).toBe(200);
    const filtered = (await filteredRes.json()) as { items: { id: string; day: string }[]; total: number };
    expect(filtered.items.length).toBeLessThan(unfiltered.items.length);
    expect(filtered.items.map((i) => i.id)).toEqual(["sub1"]);
    expect(filtered.items.every((i) => i.day === "2026-08-10")).toBe(true);
    expect(filtered.total).toBe(filtered.items.length);
  });
});

describe("EMB-7: every embed link/form action stays inside /embed", () => {
  it("/embed/:slug/sessions HTML never links out to /e/...", async () => {
    installFakeCaches();
    const app = buildApp({ html: true });
    const res = await app.request("/embed/conf/sessions", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();

    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!);
    const actions = [...html.matchAll(/action="([^"]+)"/g)].map((m) => m[1]!);
    expect(hrefs.length + actions.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      // Anchor-only in-page fragments (e.g. #chq-day-...) are not surface
      // navigation and are exempt; every other href must stay under /embed/.
      if (href.startsWith("#")) continue;
      expect(href.startsWith("/embed/")).toBe(true);
    }
    for (const action of actions) {
      expect(action.startsWith("/embed/")).toBe(true);
    }
    // Sanity: the fixture actually rendered a track-filter pill and a
    // session-title drill-in link, not an empty page with no assertions.
    expect(html).toContain("Engineering");
    expect(html).toContain("Day One Talk");
  });
});

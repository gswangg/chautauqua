// DEC-968: the sessions-list row's track/format meta line collapses to a
// single caps line through .chq-pub-session-tag, and the abstract leaves the
// row's default fields. Fake-db-chain harness mirrors the established
// pattern in test/public-format.test.ts (no local sqlite/D1 test driver is
// wired up).

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
    groupBy: () => chain,
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

function fakeKv() {
  return {
    async get() {
      return null;
    },
    async put() {
      /* no-op */
    },
    async delete() {
      /* no-op */
    },
  };
}

function installFakeCaches(): void {
  (globalThis as any).caches = {
    default: {
      async match() {
        return undefined;
      },
      async put() {
        /* no-op */
      },
    },
  };
}

const TEST_ENV = { KV: fakeKv() } as unknown as AppEnv["Bindings"];

const DESCRIPTION = "A short session abstract used to verify byte-for-byte rendering.";
const SUB_ROW = { id: "sub1", seq: 1, title: "Fireside Chat", description: DESCRIPTION, icsSequence: 0 };
const TRACK_ROWS = [{ submissionId: "sub1", id: "trk1", name: "AI Engineering", color: null }];
const FORMAT_ROWS = [{ submissionId: "sub1", valueJson: JSON.stringify("Workshop") }];

function buildApp() {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  return app;
}

function withDb(app: Hono<AppEnv>, db: unknown) {
  app.use("*", async (c, next) => {
    c.set("db", db as AppEnv["Variables"]["db"]);
    await next();
  });
  app.route("/", publicRoutes);
  return app;
}

// Same call sequence as test/public-format.test.ts's sessions-list db(),
// with a track and a format answer wired up so the meta line has content
// on both sides.
function sessionsListDb() {
  let call = 0;
  return {
    select: () => {
      call += 1;
      if (call === 1) return makeChain([EVENT_ROW]); // getPublicEventBySlug
      if (call === 2) return makeChain([]); // getPublicTracks
      if (call === 3) return makeChain([]); // getPublicRooms (DEC-774)
      if (call === 4) return makeChain([]); // getPublicFormatOptions (DEC-774)
      if (call === 5) return makeChain([SUB_ROW]); // hydrateSessions subRows
      if (call === 6) return makeChain(TRACK_ROWS); // trackRows
      if (call === 7) return makeChain([]); // speakerRows
      if (call === 8) return makeChain([]); // slotRows
      if (call === 9) return makeChain(FORMAT_ROWS); // formatRows
      if (call === 10) return makeChain([{ count: 1 }]); // countVisibleSubmissions
      if (call === 11) return makeChain([]); // getPublicScheduleDayCounts
      return makeChain([]); // getPublicCfpWindow
    },
    selectDistinct: () => makeChain([{ id: "sub1", title: "Fireside Chat" }]),
  };
}

function detailDb() {
  let call = 0;
  return {
    select: () => {
      call += 1;
      if (call === 1) return makeChain([EVENT_ROW]); // getPublicEventBySlug
      if (call === 2) return makeChain([SUB_ROW]); // hydrateSessions subRows
      if (call === 3) return makeChain(TRACK_ROWS); // trackRows
      if (call === 4) return makeChain([]); // speakerRows
      if (call === 5) return makeChain([]); // slotRows
      if (call === 6) return makeChain(FORMAT_ROWS); // formatRows
      return makeChain([]); // getScheduleInfoForSubmissions slotRows
    },
    selectDistinct: () => makeChain([{ id: "sub1" }]), // getPublicSessionDetail visibleRows
  };
}

describe("DEC-968: sessions-list row default fields drop the abstract", () => {
  it("a default /e/:slug/sessions row has no <details>/'Show more' and no description text", async () => {
    installFakeCaches();
    const app = withDb(buildApp(), sessionsListDb());
    const res = await app.request("/e/conf/sessions", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain("<details");
    expect(html).not.toContain(DESCRIPTION);
  });

  it("its meta line renders through .chq-pub-session-tag with the track and format in caps text", async () => {
    installFakeCaches();
    const app = withDb(buildApp(), sessionsListDb());
    const res = await app.request("/e/conf/sessions", {}, TEST_ENV);
    const html = await res.text();
    expect(html).toContain('class="chq-pub-session-tags"');
    expect(html).toContain('class="chq-pub-session-tag"');
    expect(html).toContain('class="chq-pub-session-tag-dot"');
    expect(html).toContain("AI Engineering");
    expect(html).toContain("Workshop");
    // no colour-swatch track chip / old format chip classes on the list row
    expect(html).not.toContain('class="chq-pub-track-chip"');
    expect(html).not.toContain('class="chq-pub-format-chip"');
  });

  it("?fields=track,description restores the description byte-for-byte", async () => {
    installFakeCaches();
    const app = withDb(buildApp(), sessionsListDb());
    const res = await app.request("/e/conf/sessions?fields=track,description", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(DESCRIPTION);
  });

  it("/e/:slug/sessions/:id detail still renders the full description", async () => {
    installFakeCaches();
    const app = withDb(buildApp(), detailDb());
    const res = await app.request("/e/conf/sessions/sub1", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(DESCRIPTION);
  });
});

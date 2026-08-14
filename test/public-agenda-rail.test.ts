// DEC-683 amendment (wave 67-d): the public agenda gets its own designed
// rail (AgendaRail, src/routes/public/agenda-rail.tsx) and its Save/Saved
// control actually persists -- AgendaContent now renders ItineraryScript,
// which it never did before this task (Save/Saved on /e/<slug>/agenda
// updated no .ics link before this change). Mirrors the fake-db-chain route
// harness established in test/public.test.ts's "AgendaContent /
// ScheduleContent day switcher" describe block.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { publicRoutes } from "../src/routes/public";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";
import { itineraryStorageKey } from "../src/lib/itinerary";

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

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    groupBy: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    as: () => chain,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

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

const TEST_ENV = { KV: fakeKv(), DEV_MODE: "1" } as unknown as AppEnv["Bindings"];

// Three scheduled sessions on the event's first day, split across two rooms
// (two in Main Hall, one in Overflow Room) so "Rooms in use today" has more
// than one row to render/order.
const SLOT_ROWS = [
  { submissionId: "sub1", day: "2026-08-10", startMin: 540, endMin: 570, roomId: "room1" },
  { submissionId: "sub2", day: "2026-08-10", startMin: 600, endMin: 630, roomId: "room1" },
  { submissionId: "sub3", day: "2026-08-10", startMin: 570, endMin: 600, roomId: "room2" },
];

function buildApp() {
  let selectCall = 0;
  const db = {
    select: () => {
      selectCall += 1;
      // 1: getPublicEventBySlug
      if (selectCall === 1) return makeChain([EVENT_ROW]);
      // 2: getPublicTracks (DEC-804 track-highlight <select>)
      if (selectCall === 2) return makeChain([]);
      // 3: DEC-548 getPublicAgenda's total count(*) subquery
      if (selectCall === 3) return makeChain([{ count: SLOT_ROWS.length }]);
      // 4: getPublicAgenda's room lookup
      if (selectCall === 4) {
        return makeChain([
          { id: "room1", name: "Main Hall", position: 1 },
          { id: "room2", name: "Overflow Room", position: 2 },
        ]);
      }
      // 5: hydrateSessions subRows
      if (selectCall === 5) {
        return makeChain([
          { id: "sub1", seq: 1, title: "Talk One", description: null, icsSequence: 0 },
          { id: "sub2", seq: 2, title: "Talk Two", description: null, icsSequence: 0 },
          { id: "sub3", seq: 3, title: "Talk Three", description: null, icsSequence: 0 },
        ]);
      }
      // 6: hydrateSessions trackRows
      if (selectCall === 6) return makeChain([]);
      // 7: hydrateSessions speakerRows
      // 8+: hydrateSessions slotRows/formatRows, getPublicBreaksByDay -- all empty.
      return makeChain([]);
    },
    selectDistinct: () => makeChain(SLOT_ROWS),
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

describe("DEC-683 amendment (wave 67-d): public agenda rail + Save persistence", () => {
  it("GET /e/conf/agenda renders the agenda rail with a working Save control's markup", async () => {
    installFakeCaches();
    const app = buildApp();
    const res = await app.request("/e/conf/agenda", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();

    // The rail itself, in the shared list+rail pair.
    expect(html).toContain('class="chq-pub-agenda-rail"');

    // "Your schedule" -- the exact ids ItineraryScript drives.
    expect(html).toContain('id="chq-ics-count"');
    expect(html).toContain("0 picked");
    expect(html).toContain('id="chq-ics-link"');
    expect(html).toContain('href="/e/conf/schedule.ics"');
    expect(html).toContain('aria-disabled="true"');

    // "Rooms in use today" -- at least one row anchored at that room's
    // first block, never a ?roomId= link (DEC-851: room is not an agenda
    // facet).
    expect(html).toContain("Rooms in use today");
    const roomHrefs = [...html.matchAll(/<a href="(#chq-agenda-[^"]+)"/g)].map((m) => m[1]);
    expect(roomHrefs.length).toBeGreaterThan(0);
    for (const href of roomHrefs) {
      expect(href).toMatch(/^#chq-agenda-/);
    }
    expect(html).not.toContain("roomId=");

    // Printable programme out-link.
    expect(html).toContain('href="/e/conf/programme"');
    expect(html).toContain("Printable programme");

    // The dead-control defect: AgendaContent now emits the SAME inline
    // itinerary script every other itinerary surface renders (assert on
    // the stable storage-key literal rather than the whole script body).
    expect(html).toContain(JSON.stringify(itineraryStorageKey("conf")));
  });

  it("GET /embed/conf/agenda renders none of the rail markup and no itinerary script (DEC-672/683)", async () => {
    installFakeCaches();
    const app = buildApp();
    const res = await app.request("/embed/conf/agenda", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).not.toContain('class="chq-pub-agenda-rail"');
    expect(html).not.toContain('id="chq-ics-link"');
    expect(html).not.toContain('id="chq-ics-count"');
    expect(html).not.toContain("Rooms in use today");
    expect(html).not.toContain("Printable programme");
    expect(html).not.toContain(JSON.stringify(itineraryStorageKey("conf")));

    // DEC-672: chromeless surface is closed both ways -- no href may point
    // at the full-chrome /e/... surface or at /submit/....
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1] ?? "");
    for (const href of hrefs) {
      expect(href.startsWith("/e/") || href.startsWith("/submit/")).toBe(false);
    }
  });
});

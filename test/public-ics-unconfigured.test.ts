// DEC-947 (wave 58 amendment): the public/anonymous schedule.ics and
// agenda.ics exports must NOT 500 when mail isn't configured (MAIL_FROM_EMAIL
// unset, DEV_MODE not "1") -- they degrade by omitting ORGANIZER rather than
// throwing resolveIcsOrganizerEmail's loud config error, which stays reserved
// for the one-to-one REQUEST/invite path (src/routes/comms.ts). Harness
// mirrors test/public.test.ts's schedule.ics UID-stability describe block
// (fake-db-chain pattern, same call-order comments).

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { publicRoutes } from "../src/routes/public";
import { registerErrorHandler } from "../src/server/http";
import { buildIcsCalendar } from "../src/mail/ics";
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

// getPublicAgenda (src/server/repo/public/agenda.ts, no ?ids= so both
// schedule.ics and agenda.ics hit this path, not the id-scoped
// getPublicAgendaByIds) runs, in order: selectDistinct#1 (countQuery,
// wrapped in .as() as a subquery, rows never read directly) -> select#1
// (getPublicEventBySlug, actually fired first by the route handler before
// getPublicAgenda) -> select#2 (count(*) over the subquery) ->
// selectDistinct#2 (rowsQuery, the actual slot rows) -> select#3 (room
// lookup, since rowsQuery's roomId is non-null) -> hydrateSessions'
// select#4/5/6 (subRows/trackRows/speakerRows).
function buildApp() {
  let selectCall = 0;
  let selectDistinctCall = 0;
  const db = {
    selectDistinct: () => {
      selectDistinctCall += 1;
      if (selectDistinctCall === 1) return makeChain([]);
      return makeChain([{ submissionId: "sub1", day: "2026-08-10", startMin: 540, endMin: 600, roomId: "room1" }]);
    },
    select: () => {
      selectCall += 1;
      // 1: getPublicEventBySlug
      if (selectCall === 1) return makeChain([EVENT_ROW]);
      // 2: getPublicAgenda's count(*) over the countQuery subquery
      if (selectCall === 2) return makeChain([{ count: 1 }]);
      // 3: getPublicAgenda's room lookup
      if (selectCall === 3) return makeChain([{ id: "room1", name: "Main Hall" }]);
      // 4: hydrateSessions subRows
      if (selectCall === 4) {
        return makeChain([{ id: "sub1", seq: 1, title: "A Talk", description: null, icsSequence: 0 }]);
      }
      // 5: hydrateSessions trackRows
      if (selectCall === 5) return makeChain([]);
      // 6: hydrateSessions speakerRows
      return makeChain([]);
    },
  } as unknown as AppEnv["Variables"]["db"];

  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  registerErrorHandler(app);
  app.route("/", publicRoutes);
  installFakeCaches();
  return app;
}

describe.each([
  ["schedule.ics", "/e/conf/schedule.ics"],
  ["agenda.ics", "/e/conf/agenda.ics"],
])("GET /e/:eventSlug/%s under unconfigured mail (DEC-947 wave-58 amendment)", (_label, path) => {
  it("returns 200 text/calendar with NO ORGANIZER line when mail is unconfigured", async () => {
    const app = buildApp();
    const res = await app.request(path, {}, { KV: fakeKv(), DEV_MODE: "0", MAIL_FROM_EMAIL: undefined } as unknown as AppEnv["Bindings"]);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/calendar");
    const body = await res.text();
    expect(body).not.toMatch(/^ORGANIZER/m);
  });

  it("carries ORGANIZER when MAIL_FROM_EMAIL is configured", async () => {
    const app = buildApp();
    const res = await app.request(path, {}, {
      KV: fakeKv(),
      DEV_MODE: "0",
      MAIL_FROM_EMAIL: "organizer@example.com",
    } as unknown as AppEnv["Bindings"]);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/^ORGANIZER;CN="Test Event":mailto:organizer@example\.com/m);
  });
});

describe("buildIcsCalendar METHOD:REQUEST with no organizer", () => {
  it("throws loudly (DEC-947 wave-58 amendment)", () => {
    expect(() =>
      buildIcsCalendar(
        [
          {
            uidSubmissionId: "sub1",
            sequence: 0,
            title: "A Talk",
            startUtc: new Date("2026-08-10T09:00:00.000Z"),
            endUtc: new Date("2026-08-10T09:30:00.000Z"),
            dtstamp: new Date("2026-08-01T00:00:00.000Z"),
          },
        ],
        { method: "REQUEST", attendee: { email: "attendee@example.com" } },
      ),
    ).toThrow(/METHOD:REQUEST requires an organizer/);
  });
});

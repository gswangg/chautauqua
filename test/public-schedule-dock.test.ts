// DEC-576 (wave 110 amendment): my-schedule gets the docked action band its
// 390 frame draws (the "My schedule" frame's :884-887 band -- cited by
// path+line, quoted and receipted at the mount it() below, since a
// file-header citation can carry no expect(, DEC-976 wave-87)
// -- filled Download .ics + bordered All sessions, both re-siting
// capability the page already has (the SAME /schedule.ics route
// ScheduleRail's #chq-ics-link targets, and the SAME /sessions route the
// header's "Browse all sessions" link already targets). Mirrors the
// fake-db-chain route harness established in test/public.test.ts's
// "AgendaContent / ScheduleContent day switcher" describe block and
// test/public-agenda-rail.test.ts's sibling /agenda dock-band coverage.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { publicRoutes } from "../src/routes/public";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";
import { AGENDA_CSS } from "../src/routes/public/css/agenda.css";

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

// task-w1-d (DEC-555 amendment)'s dispatch sequence for "schedule" (no
// getPublicScheduleDayCounts read, unlike "agenda"): getPublicEventBySlug,
// getPublicTracks, getPublicAgenda's count(*) subquery, getPublicBreaksByDay,
// getPublicAgenda's room lookup, then hydrateSessions's sub/track/speaker/
// slot/format reads -- same shape as test/public.test.ts's buildApp("schedule").
function buildApp(embed = false) {
  let selectCall = 0;
  const db = {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([EVENT_ROW]);
      if (selectCall === 2) return makeChain([]);
      if (selectCall === 3) return makeChain([{ count: 1 }]);
      if (selectCall === 4) return makeChain([]);
      if (selectCall === 5) return makeChain([{ id: "room1", name: "Main Hall" }]);
      if (selectCall === 6) {
        return makeChain([{ id: "sub1", seq: 1, title: "Talk One", description: null, icsSequence: 0 }]);
      }
      return makeChain([]);
    },
    selectDistinct: () =>
      makeChain([{ submissionId: "sub1", day: "2026-08-10", startMin: 540, endMin: 600, roomId: "room1" }]),
  } as unknown as AppEnv["Variables"]["db"];

  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  registerErrorHandler(app);
  app.route("/", publicRoutes);
  installFakeCaches();
  return app.request(embed ? "/embed/conf/schedule" : "/e/conf/schedule", {}, TEST_ENV);
}

describe("DEC-576 (wave 110 amendment): my-schedule's SSR phone dock band", () => {
  it("GET /e/conf/schedule mounts .chq-pub-schedule-dock with a working .ics link (>=44px) and a bordered All sessions link (>=44px) to the SAME /sessions route the header's Browse link already targets", async () => {
    const res = await buildApp();
    expect(res.status).toBe(200);
    const html = await res.text();

    // docs/design/Chautauqua Public and Portal.dc.html:884-887.
    expect(html).toContain('class="chq-pub-schedule-dock"');

    // :886 `flex:1; ... min-height:48px; ...">Download .ics` -- a SECOND
    // .ics anchor (id chq-ics-link-dock) beside ScheduleRail's
    // #chq-ics-link, targeting the exact same route.
    const dockIcsMatch = html.match(/<a id="chq-ics-link-dock"[^>]*>([^<]*)<\/a>/);
    expect(dockIcsMatch).toBeTruthy();
    expect(dockIcsMatch![0]).toContain('href="/e/conf/schedule.ics"');
    expect(dockIcsMatch![0]).toContain('aria-disabled="true"');
    expect(dockIcsMatch![1]!.trim()).toBe("Download .ics");

    // :887 `border:1px solid #BAB6A6; ... min-height:48px; ...">All
    // sessions` -- the SAME /sessions route the header's "Browse all
    // sessions ›" link (chq-pub-schedule-browse-link) already targets.
    expect(html).toContain('class="chq-pub-schedule-dock-cross" href="/e/conf/sessions"');
    expect(html).toContain(">All sessions</a>");
    expect(html).toContain('class="chq-pub-schedule-browse-link chq-pub-accent-link" href="/e/conf/sessions"');

    // The 44px floor (DESIGN-RULINGS), checked against the CSS source
    // (no stylesheet is applied by jsdom here).
    const phoneBlock = AGENDA_CSS.slice(AGENDA_CSS.lastIndexOf("@media (max-width: 700px)"));
    const icsHeight = Number(phoneBlock.match(/\.chq-pub-schedule-dock-ics\s*\{[^}]*min-height:\s*(\d+)px/)?.[1]);
    const crossHeight = Number(phoneBlock.match(/\.chq-pub-schedule-dock-cross\s*\{[^}]*min-height:\s*(\d+)px/)?.[1]);
    expect(icsHeight).toBeGreaterThanOrEqual(44);
    expect(crossHeight).toBeGreaterThanOrEqual(44);
  });

  it("GET /embed/conf/schedule still mounts the dock band (ScheduleRail is not chromeless-closed, unlike /agenda's rail) with the .ics link opening in a new tab (DEC-672 same-origin iframe exception)", async () => {
    const res = await buildApp(true);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('class="chq-pub-schedule-dock"');
    const dockIcsMatch = html.match(/<a id="chq-ics-link-dock"[^>]*>/);
    expect(dockIcsMatch).toBeTruthy();
    expect(dockIcsMatch![0]).toContain('target="_blank"');
    expect(dockIcsMatch![0]).toContain('rel="noopener"');
  });
});

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

// DEC-774 wave-34 amendment: dispatch.tsx's agenda case now issues its
// reads as exactly TWO Promise.all waves -- wave 1 is
// [getPublicTracks, getPublicScheduleDayCounts] (both single-select, so
// they land at calls 2/3 exactly as the old serial chain did); wave 2 is
// [getPublicAgenda(effectiveDay), getPublicBreaksByDay(effectiveDay)],
// which now run CONCURRENTLY -- getPublicAgenda's own count(*) subquery
// (its first counted select; the id-query feeding it uses selectDistinct,
// which this harness never counts) fires in the same synchronous burst as
// getPublicBreaksByDay's one-shot select, ahead of getPublicAgenda's rows
// query/room lookup/hydrateSessions cascade (which only resume one
// microtask later, once each of getPublicAgenda's OWN preceding awaits
// resolves). See test/public-surface-round-trip-depth.test.ts for the
// behavioural proof this reordering is real concurrency.
function buildApp() {
  let selectCall = 0;
  const db = {
    select: () => {
      selectCall += 1;
      // 1: getPublicEventBySlug
      if (selectCall === 1) return makeChain([EVENT_ROW]);
      // 2: getPublicTracks (DEC-804 track-highlight <select>) -- wave 1.
      if (selectCall === 2) return makeChain([]);
      // 3: getPublicScheduleDayCounts -- wave 1, alongside getPublicTracks.
      if (selectCall === 3) return makeChain([{ day: "2026-08-10", count: SLOT_ROWS.length }]);
      // 4: DEC-548 getPublicAgenda's total count(*) subquery -- wave 2,
      // fires in the SAME synchronous burst as getPublicBreaksByDay's call
      // below (both are the first counted select of their own promise).
      if (selectCall === 4) return makeChain([{ count: SLOT_ROWS.length }]);
      // 5: getPublicBreaksByDay (listBreaksForEvent) -- wave 2, concurrent
      // with getPublicAgenda's count-subquery above.
      if (selectCall === 5) return makeChain([]);
      // 6: getPublicAgenda's room lookup (resumes after its own rows query,
      // which uses selectDistinct and so isn't counted here).
      if (selectCall === 6) {
        return makeChain([
          { id: "room1", name: "Main Hall", position: 1 },
          { id: "room2", name: "Overflow Room", position: 2 },
        ]);
      }
      // 7: hydrateSessions subRows
      if (selectCall === 7) {
        return makeChain([
          { id: "sub1", seq: 1, title: "Talk One", description: null, icsSequence: 0 },
          { id: "sub2", seq: 2, title: "Talk Two", description: null, icsSequence: 0 },
          { id: "sub3", seq: 3, title: "Talk Three", description: null, icsSequence: 0 },
        ]);
      }
      // 8: hydrateSessions trackRows
      // 9+: hydrateSessions speakerRows/slotRows/formatRows -- all empty.
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
    // G13 (frames 10--00/01/12): the scripted span carries the count alone;
    // the caption reads "<n> saved in this browser · no account needed".
    expect(html).toContain('<span id="chq-ics-count">0</span> saved in this browser');
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

    // w69-d (DEC-584 amendment): "a save control renders only where its
    // script does" -- non-embed /agenda now carries the Save toggle in
    // BOTH the desktop grid (.chq-pub-agenda-day) and the phone list
    // (.chq-pub-agenda-list), not just the grid.
    const gridMatch = html.match(/<div class="chq-pub-agenda-day">([\s\S]*?)<\/div>\s*<\/div>\s*<\/section>/);
    expect(gridMatch).toBeTruthy();
    expect(gridMatch![1]).toContain("chq-itinerary-toggle");
    const listMatch = html.match(/<ol class="chq-pub-agenda-list">([\s\S]*?)<\/ol>/);
    expect(listMatch).toBeTruthy();
    expect(listMatch![1]).toContain("chq-itinerary-toggle");
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
    // w69-d (DEC-584 amendment): a Save control never renders where its
    // script does not -- /embed mounts no ItineraryScript, so it must ship
    // zero chq-itinerary-toggle checkboxes (desktop grid AND phone list).
    // Matches the class ATTRIBUTE, not the bare selector text -- the
    // <style> block legitimately defines .chq-itinerary-toggle CSS rules
    // for every surface regardless of embed (see the comment above this
    // test's sibling assertions in public.test.ts).
    expect(html).not.toContain('class="chq-itinerary-toggle"');

    // DEC-672: chromeless surface is closed both ways -- no href may point
    // at the full-chrome /e/... surface or at /submit/....
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1] ?? "");
    for (const href of hrefs) {
      expect(href.startsWith("/e/") || href.startsWith("/submit/")).toBe(false);
    }
  });
});

// DEC-576 (wave 110 amendment): the SSR phone dock -- public agenda and
// my-schedule get the docked action band their 390 frames draw (the
// agenda/schedule dock bands -- receipted below, at the citation beside
// the actual geometry assertion). Both controls carry the SAME
// capability the page already renders (the
// rail's #chq-ics-link route, PublicShell's Speakers nav link / the
// header's "Browse all sessions" route) -- a second DOM instance switched
// by agenda.css.ts's >700px/<=700px pair, never a new destination.
describe("DEC-576 (wave 110 amendment): the SSR phone dock band", () => {
  it("GET /e/conf/agenda mounts .chq-pub-agenda-dock with a working .ics link (>=44px) and a bordered Speakers link (>=44px) to the SAME /speakers route the nav already renders", async () => {
    installFakeCaches();
    const app = buildApp();
    const res = await app.request("/e/conf/agenda", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();

    // docs/design/Chautauqua Public and Portal.dc.html:400-403: the band
    // itself, then its two children.
    expect(html).toContain('class="chq-pub-agenda-dock"');

    // :401 `flex:1; ... min-height:46px; ...">Download .ics` -- a SECOND
    // .ics anchor (id chq-ics-link-dock) beside the rail's #chq-ics-link,
    // targeting the exact same route.
    const dockIcsMatch = html.match(/<a id="chq-ics-link-dock"[^>]*>([^<]*)<\/a>/);
    expect(dockIcsMatch).toBeTruthy();
    expect(dockIcsMatch![0]).toContain('href="/e/conf/schedule.ics"');
    expect(dockIcsMatch![0]).toContain('aria-disabled="true"');
    expect(dockIcsMatch![1]!.trim()).toBe("Download .ics");

    // :402 `border:1px solid #BAB6A6; ... min-height:46px; ...">Speakers`
    // -- the SAME /speakers route PublicShell's <nav> already links.
    expect(html).toContain('class="chq-pub-agenda-dock-cross" href="/e/conf/speakers"');
    expect(html).toContain(">Speakers</a>");

    // The 44px floor (DESIGN-RULINGS): both children reach >=44px via the
    // sheet's own authored min-height, checked against the CSS source
    // rather than jsdom (no stylesheet is applied here).
    const { AGENDA_CSS } = await import("../src/routes/public/css/agenda.css");
    const phoneBlock = AGENDA_CSS.slice(AGENDA_CSS.lastIndexOf("@media (max-width: 700px)"));
    const icsHeight = Number(phoneBlock.match(/\.chq-pub-agenda-dock-ics\s*\{[^}]*min-height:\s*(\d+)px/)?.[1]);
    const crossHeight = Number(phoneBlock.match(/\.chq-pub-agenda-dock-cross\s*\{[^}]*min-height:\s*(\d+)px/)?.[1]);
    expect(icsHeight).toBeGreaterThanOrEqual(44);
    expect(crossHeight).toBeGreaterThanOrEqual(44);
  });

  it("GET /embed/conf/agenda renders no dock band (DEC-672/683: chromeless-closed, same gate as the rail)", async () => {
    installFakeCaches();
    const app = buildApp();
    const res = await app.request("/embed/conf/agenda", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain('class="chq-pub-agenda-dock"');
    expect(html).not.toContain("chq-ics-link-dock");
  });
});

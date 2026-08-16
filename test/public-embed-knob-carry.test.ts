// DEC-489 (wave-54 amendment), part 1 of 2 — the paginating surfaces this
// lane owns (sessions/speakers/gallery; task-w54-f owns agenda/schedule).
// EMBED_KNOB_TABLE declares fields+accent (sessions) / accent (speakers,
// gallery) as knobs the surface honors on arrival (dispatch.tsx). Honoring a
// param on arrival is only half the contract — every href the surface
// renders (the 'Show more' link AND a drill-in into a session/speaker) must
// carry the same knobs forward, or page 2 of a configured embed reverts to
// the default fields/accent. Reuses the fake-db-chain harness established in
// test/public-embed-knob-parity.test.ts.

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
    as: () => chain,
    limit: async (n: number) => rows.slice(0, n),
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

const TEST_ENV = { KV: fakeKv() } as unknown as AppEnv["Bindings"];

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
  brandingJson: JSON.stringify({ accentColor: "#123456" }),
};

function mountApp(db: unknown) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", db as AppEnv["Variables"]["db"]);
    await next();
  });
  registerErrorHandler(app);
  app.route("/", publicRoutes);
  return app;
}

// Same shape as test/public-embed-knob-parity.test.ts's buildSessionsApp,
// with no ?day= filtering — five sessions, so a `limit=1` request always has
// a page 2 to link to (hasMorePages(1, 5, 1, 1) === true).
function buildSessionsApp() {
  let selectCall = 0;
  const ALL_ROWS = Array.from({ length: 5 }, (_, i) => ({
    id: `sub${i + 1}`,
    seq: i + 1,
    title: `Talk ${i + 1}`,
    description: "A description long enough to show up in the card body.",
    icsSequence: 0,
  }));
  const db = {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([EVENT_ROW]); // getPublicEventBySlug
      if (selectCall === 2) return makeChain([]); // getPublicTracks
      if (selectCall === 3) return makeChain([]); // getPublicRooms (DEC-774)
      if (selectCall === 4) return makeChain([]); // getPublicFormatOptions (DEC-774)
      if (selectCall === 5) return makeChain(ALL_ROWS); // hydrateSessions subRows (limit-sliced below)
      if (selectCall === 6) return makeChain([]); // hydrateSessions trackRows
      if (selectCall === 7) return makeChain([]); // hydrateSessions speakerRows
      if (selectCall === 8) return makeChain([]); // hydrateSessions EMB-01 slotRows
      if (selectCall === 9) return makeChain([]); // hydrateSessions EMB-01/EMB-08 formatRows
      return makeChain([{ count: ALL_ROWS.length }]); // countVisibleSubmissions
    },
    selectDistinct: () => makeChain(ALL_ROWS.map((s) => ({ id: s.id, title: s.title }))),
  } as unknown as AppEnv["Variables"]["db"];
  return mountApp(db);
}

// Same shape as test/public-embed-knob-parity.test.ts's buildSpeakersApp.
const SPEAKERS = Array.from({ length: 5 }, (_, i) => ({
  contactId: `c${i + 1}`,
  firstName: "First",
  lastName: `Last${i + 1}`,
}));

function buildSpeakersApp() {
  let selectCall = 0;
  const idRows = SPEAKERS.map((s) => ({ contactId: s.contactId }));
  const countRows = [{ total: SPEAKERS.length }];
  const hydrationRows = SPEAKERS.map((s) => ({
    contactId: s.contactId,
    firstName: s.firstName,
    lastName: s.lastName,
    title: null,
    company: null,
    headshotUrl: null,
    bio: null,
    submissionId: `sub-${s.contactId}`,
    submissionTitle: `Talk for ${s.contactId}`,
  }));
  const db = {
    select: (_fields?: unknown) => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([EVENT_ROW]); // getPublicEventBySlug
      if (selectCall === 2) return makeChain([]); // getPublicTracks (facet select's options)
      if (selectCall === 3) return makeChain(countRows); // count query
      return makeChain(hydrationRows); // hydration query
    },
    selectDistinct: () => makeChain(idRows),
  } as unknown as AppEnv["Variables"]["db"];
  return mountApp(db);
}

describe("DEC-489 (wave-54 amendment): embed knobs carry onto every rendered href", () => {
  it("sessions: Show-more and a drill-in both carry accent+fields", async () => {
    installFakeCaches();
    const app = buildSessionsApp();
    const res = await app.request("/embed/conf/sessions?accent=ff0000&fields=title,room&limit=1", {}, TEST_ENV);
    const html = await res.text();

    // Show-more link: EMBED_KNOB_TABLE lists trackId/format/roomId/day/q/
    // limit/fields/accent for sessions -- `fields` here narrows to just
    // "room" (parseSessionListFields drops the unknown "title" name; title
    // itself is never part of the allowlist and always renders).
    const showMoreMatch = html.match(/<a class="chq-pub-accent-link" href="([^"]+)">\s*Show more/);
    expect(showMoreMatch).not.toBeNull();
    const showMoreHref = showMoreMatch![1];
    expect(showMoreHref).toContain("accent=ff0000");
    expect(showMoreHref).toContain("fields=room");
    expect(showMoreHref).toContain("limit=1");
    expect(showMoreHref).toContain("page=2");

    // Drill-in: the session title link.
    const drillInMatch = html.match(/class="chq-pub-session-title"\s+href="([^"]+)"/);
    expect(drillInMatch).not.toBeNull();
    const drillInHref = drillInMatch![1];
    expect(drillInHref).toContain("/embed/conf/sessions/sub1");
    expect(drillInHref).toContain("accent=ff0000");
    expect(drillInHref).toContain("fields=room");
  });

  it("speakers: Show-more and a drill-in both carry accent (no `fields` knob on this surface)", async () => {
    installFakeCaches();
    const app = buildSpeakersApp();
    const res = await app.request("/embed/conf/speakers?accent=ff0000&limit=1", {}, TEST_ENV);
    const html = await res.text();

    const showMoreMatch = html.match(/<a class="chq-pub-accent-link" href="([^"]+)">\s*Show more/);
    expect(showMoreMatch).not.toBeNull();
    const showMoreHref = showMoreMatch![1];
    expect(showMoreHref).toContain("accent=ff0000");
    expect(showMoreHref).toContain("limit=1");
    expect(showMoreHref).toContain("page=2");
    // speakers/gallery declare no `fields` knob -- never emitted even though
    // the underlying EmbedKnobValues bag never carries one for this surface.
    expect(showMoreHref).not.toContain("fields=");

    const drillInMatch = html.match(/class="chq-pub-speaker-name"\s+href="([^"]+)"/);
    expect(drillInMatch).not.toBeNull();
    const drillInHref = drillInMatch![1];
    expect(drillInHref).toContain("/embed/conf/speakers/c1");
    expect(drillInHref).toContain("accent=ff0000");
  });
});

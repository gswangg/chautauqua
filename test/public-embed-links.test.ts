// DEC-672 (half two: the links). A chromeless /embed/... surface must never
// render a link that breaks out of the iframe -- every `href="/..."` and
// `action="/..."` on the page must stay under `/embed/`, with exactly one
// allowed exception: the .ics download link, which by design (no /embed
// .ics route exists) keeps pointing at /e but must open in a new tab
// (target="_blank") so a calendar download can never replace the host
// page's iframe. Enumerated from SURFACES (./shell) -- never a hand-listed
// copy -- so a sixth surface added later is swept automatically.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { publicRoutes } from "../src/routes/public";
import { SURFACES } from "../src/routes/public/shell";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";
import * as schema from "../src/db/schema";

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
  brandingJson: null,
};

const SESSION_ROWS = Array.from({ length: 3 }, (_, i) => ({
  id: `sub${i + 1}`,
  seq: i + 1,
  title: `Talk ${i + 1}`,
  description: "A description long enough to show up in the card body.",
  icsSequence: 0,
}));

// DEC-022 amendment (wave 63): getPublicBreaksByDay's underlying select is
// keyed off .from(schema.scheduleBreak) regardless of the surrounding
// select() call's position -- table-shape-aware rather than position-
// counted, so it stays correct no matter where this new call lands in the
// sequence (this harness's existing position comments were already stale
// relative to DEC-804/DEC-851's tracks/formatOptions calls -- see the
// field guide's "hand-listed manifests desync" entries).
function makeChain(rows: unknown[]) {
  const chain: any = {
    from: (table?: unknown) => (table === schema.scheduleBreak ? emptyChain() : chain),
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    // DEC-768 (wave 67 amendment): getPublicScheduleDayCounts groups by day.
    groupBy: () => chain,
    limit: async (n: number) => rows.slice(0, n),
    offset: async () => rows,
    as: () => chain,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

function emptyChain() {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    groupBy: () => chain,
    limit: async () => [],
    offset: async () => [],
    as: () => chain,
    then: (resolve: (v: unknown[]) => void) => resolve([]),
  };
  return chain;
}

// sessions surface: getPublicEventBySlug, getPublicTracks, then
// hydrateSessions's four select() calls (sub/track/speaker/EMB-01 slot).
function buildSessionsApp() {
  let selectCall = 0;
  const db = {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([EVENT_ROW]); // getPublicEventBySlug
      if (selectCall === 2) return makeChain([]); // getPublicTracks
      if (selectCall === 3) return makeChain([]); // getPublicRooms (DEC-774)
      if (selectCall === 4) return makeChain([]); // getPublicFormatOptions (DEC-774)
      if (selectCall === 5) return makeChain(SESSION_ROWS); // hydrateSessions subRows
      if (selectCall === 6) {
        return makeChain(SESSION_ROWS.map((s) => ({ submissionId: s.id, id: "trk1", name: "Track A", color: "#f00", sortOrder: 0 })));
      }
      if (selectCall === 7) {
        return makeChain(
          SESSION_ROWS.map((s) => ({
            submissionId: s.id,
            contactId: `c-${s.id}`,
            firstName: "Ada",
            lastName: "Lovelace",
            title: null,
            company: null,
            sortOrder: 0,
          })),
        );
      }
      if (selectCall === 8) {
        return makeChain(
          SESSION_ROWS.map((s, i) => ({
            submissionId: s.id,
            day: "2026-08-10",
            startMin: 540 + i * 60,
            endMin: 600 + i * 60,
            roomName: "Main Hall",
          })),
        );
      }
      return makeChain([]); // hydrateSessions formatRows
    },
    selectDistinct: () => makeChain(SESSION_ROWS.map((s) => ({ id: s.id, title: s.title }))),
  } as unknown as AppEnv["Variables"]["db"];
  return buildApp(db);
}

// agenda/schedule surfaces: getPublicEventBySlug, then getPublicAgenda's
// selectDistinct (windowed scan) + select (count) + select (roomRows), then
// hydrateSessions's four select() calls.
function buildAgendaLikeApp() {
  let selectCall = 0;
  const AGENDA_ROWS = SESSION_ROWS.map((s, i) => ({
    submissionId: s.id,
    day: "2026-08-10",
    startMin: 540 + i * 60,
    endMin: 600 + i * 60,
    roomId: "room1",
  }));
  const db = {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([EVENT_ROW]); // getPublicEventBySlug
      if (selectCall === 2) return makeChain([{ count: AGENDA_ROWS.length }]); // getPublicTracks
      // DEC-768 (wave 67 amendment): /agenda is single-day by default, so
      // dispatch calls getPublicScheduleDayCounts on EVERY agenda request
      // (it supplies both the switcher's full day list and the default day)
      // -- one extra select() ahead of getPublicAgenda's own sequence.
      if (selectCall === 3) return makeChain([{ day: "2026-08-10", count: AGENDA_ROWS.length }]);
      if (selectCall === 4) return makeChain([{ id: "room1", name: "Main Hall" }]); // total count
      if (selectCall === 5) return makeChain(SESSION_ROWS); // roomRows
      if (selectCall === 6) {
        return makeChain(SESSION_ROWS.map((s) => ({ submissionId: s.id, id: "trk1", name: "Track A", color: "#f00" })));
      }
      if (selectCall === 7) {
        return makeChain(
          SESSION_ROWS.map((s) => ({
            submissionId: s.id,
            contactId: `c-${s.id}`,
            firstName: "Ada",
            lastName: "Lovelace",
            title: null,
            company: null,
          })),
        );
      }
      return makeChain([]); // hydrateSessions EMB-01 slotRows / formatRows
    },
    selectDistinct: () => makeChain(AGENDA_ROWS),
  } as unknown as AppEnv["Variables"]["db"];
  return buildApp(db);
}

// speakers/gallery surfaces: getPublicEventBySlug, then getPublicSpeakers's
// selectDistinct (id query) + select (count, `total` in fields) + select
// (hydration batch).
function buildSpeakersLikeApp() {
  let selectCall = 0;
  const SPEAKER_ROW = {
    contactId: "c1",
    firstName: "Ada",
    lastName: "Lovelace",
    title: "Engineer",
    company: "Acme",
    headshotUrl: null,
    bio: null,
    submissionId: "sub1",
    submissionTitle: "Talk 1",
  };
  const db = {
    select: (fields?: Record<string, unknown>) => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([EVENT_ROW]); // getPublicEventBySlug
      if (fields && "total" in fields) return makeChain([{ total: 1 }]); // count
      return makeChain([SPEAKER_ROW]); // hydration
    },
    selectDistinct: () => makeChain([{ contactId: "c1" }]),
  } as unknown as AppEnv["Variables"]["db"];
  return buildApp(db);
}

function buildApp(db: AppEnv["Variables"]["db"]) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  registerErrorHandler(app);
  app.route("/", publicRoutes);
  return app;
}

const APP_BUILDER: Record<(typeof SURFACES)[number], () => Hono<AppEnv>> = {
  sessions: buildSessionsApp,
  speakers: buildSpeakersLikeApp,
  gallery: buildSpeakersLikeApp,
  agenda: buildAgendaLikeApp,
  schedule: buildAgendaLikeApp,
};

/** Extracts every `href="..."` and `action="..."` attribute value that
 * begins with a leading `/` (a same-origin path) out of an HTML document,
 * along with whether that same tag also carries target="_blank". */
function extractPathLinks(html: string): { url: string; targetBlank: boolean }[] {
  const out: { url: string; targetBlank: boolean }[] = [];
  const tagRe = /<[a-z]+\b[^>]*(?:href|action)="\/[^"]*"[^>]*>/gi;
  for (const tagMatch of html.matchAll(tagRe)) {
    const tag = tagMatch[0];
    const attrMatch = tag.match(/(?:href|action)="(\/[^"]*)"/);
    const url = attrMatch?.[1];
    if (!url) continue;
    out.push({ url, targetBlank: /target="_blank"/.test(tag) });
  }
  return out;
}

describe("DEC-672: every /embed/<slug>/<surface> stays closed inside /embed/", () => {
  for (const surface of SURFACES) {
    it(`${surface}: every same-origin href/action begins with /embed/, except a .ics link (must be target=_blank)`, async () => {
      installFakeCaches();
      const app = APP_BUILDER[surface]();
      const res = await app.request(`/embed/conf/${surface}`, {}, TEST_ENV);
      expect(res.status).toBe(200);
      const html = await res.text();
      const links = extractPathLinks(html);
      expect(links.length).toBeGreaterThan(0);
      for (const { url, targetBlank } of links) {
        if (url.endsWith(".ics")) {
          expect(targetBlank).toBe(true);
          continue;
        }
        expect(url.startsWith("/embed/")).toBe(true);
      }
    });
  }
});

// DEC-679: the two /embed detail pages (session/speaker drill-ins,
// src/routes/public/index.tsx :235/:249) are chromeless twins the same way
// the five SURFACES pages above are -- DEC-672's own text calls them
// "/embed pages" too. test/public-embed-detail.test.ts already covers their
// 200/404/Back-link-prefix behavior via vi.mock(repo); this closes the same
// gap the SURFACES loop above closes -- every same-origin href on the page,
// not just the one Back link -- using this file's own fake-db (makeChain)
// technique so a future speaker/session link added to detail.tsx is swept
// automatically instead of being checked by hand.
const SESSION_DETAIL_ROW = { id: "sub1", seq: 1, title: "Talk 1", description: "A description.", icsSequence: 0 };

// getPublicSessionDetail: selectDistinct (visibleRows), then hydrateSessions's
// five select()s (subRows/trackRows/speakerRows/EMB-01 slotRows/formatRows),
// then getScheduleInfoForSubmissions's scheduleSlot select (unscheduled here,
// so roomIds stays empty and no room select follows).
function buildSessionDetailApp() {
  let selectCall = 0;
  const db = {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([EVENT_ROW]); // getPublicEventBySlug
      if (selectCall === 2) return makeChain([SESSION_DETAIL_ROW]); // hydrateSessions subRows
      if (selectCall === 3) return makeChain([{ submissionId: "sub1", id: "trk1", name: "Track A", color: "#f00" }]); // trackRows
      if (selectCall === 4) {
        return makeChain([
          {
            submissionId: "sub1",
            order: 0,
            contactId: "c1",
            firstName: "Ada",
            lastName: "Lovelace",
            title: null,
            company: null,
            headshotUrl: null,
            bio: null,
          },
        ]); // speakerRows
      }
      return makeChain([]); // EMB-01 slotRows / formatRows / getScheduleInfoForSubmissions scheduleSlot
    },
    selectDistinct: () => makeChain([{ id: "sub1" }]), // getPublicSessionDetail visibleRows
  } as unknown as AppEnv["Variables"]["db"];
  return buildApp(db);
}

// getPublicSpeakerDetail: select (participant/contact/submission join
// rows), then a trackRows batch select, then getScheduleInfoForSubmissions's
// scheduleSlot select (unscheduled here, no follow-up room select).
function buildSpeakerDetailApp() {
  let selectCall = 0;
  const db = {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([EVENT_ROW]); // getPublicEventBySlug
      if (selectCall === 2) {
        return makeChain([
          {
            contactId: "c1",
            firstName: "Ada",
            lastName: "Lovelace",
            title: null,
            company: null,
            bio: "A bio long enough to render.",
            headshotUrl: null,
            socialLinksJson: null,
            submissionId: "sub1",
            submissionTitle: "Talk 1",
          },
        ]); // getPublicSpeakerDetail main rows
      }
      return makeChain([]); // trackRows / getScheduleInfoForSubmissions scheduleSlot
    },
  } as unknown as AppEnv["Variables"]["db"];
  return buildApp(db);
}

describe("DEC-679: /embed detail pages (sessions/:id, speakers/:id) stay closed inside /embed/", () => {
  it("sessions/:id: every same-origin href begins with /embed/", async () => {
    installFakeCaches();
    const app = buildSessionDetailApp();
    const res = await app.request("/embed/conf/sessions/sub1", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();
    const links = extractPathLinks(html);
    expect(links.length).toBeGreaterThan(0);
    for (const { url } of links) {
      expect(url.startsWith("/embed/")).toBe(true);
    }
  });

  it("speakers/:id: every same-origin href begins with /embed/", async () => {
    installFakeCaches();
    const app = buildSpeakerDetailApp();
    const res = await app.request("/embed/conf/speakers/c1", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();
    const links = extractPathLinks(html);
    expect(links.length).toBeGreaterThan(0);
    for (const { url } of links) {
      expect(url.startsWith("/embed/")).toBe(true);
    }
  });
});

// EMB-15 (config half, DEC-289): embed query-param configuration — field
// selection, limit clamping, day filtering, and accent overrides. Mirrors
// the fake-db-chain harness established in test/public.test.ts.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { publicRoutes } from "../src/routes/public";
import { parseDay, parseLimit, parseCardFields, parseAccent, ALL_CARD_FIELDS } from "../src/routes/public/query";
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

// Five sessions, each with a track, a speaker, a schedule slot (in a room),
// and a description — so every gated field has something to hide.
const SESSION_ROWS = Array.from({ length: 5 }, (_, i) => ({
  id: `sub${i + 1}`,
  seq: i + 1,
  title: `Talk ${i + 1}`,
  description: "A description long enough to show up in the card body.",
  icsSequence: 0,
}));

function buildApp() {
  let selectCall = 0;
  const db = {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([EVENT_ROW]); // getPublicEventBySlug
      if (selectCall === 2) return makeChain([]); // getPublicTracks
      if (selectCall === 3) return makeChain(SESSION_ROWS); // hydrateSessions subRows
      if (selectCall === 4) {
        // hydrateSessions trackRows
        return makeChain(SESSION_ROWS.map((s) => ({ submissionId: s.id, id: "trk1", name: "Track A", color: "#f00", sortOrder: 0 })));
      }
      if (selectCall === 5) {
        // hydrateSessions speakerRows
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
      // hydrateSessions slotRows (EMB-01)
      return makeChain(
        SESSION_ROWS.map((s, i) => ({
          submissionId: s.id,
          day: "2026-08-10",
          startMin: 540 + i * 60,
          endMin: 600 + i * 60,
          roomName: "Main Hall",
        })),
      );
    },
    selectDistinct: () => makeChain(SESSION_ROWS.map((s) => ({ id: s.id, title: s.title }))),
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

// getPublicAgenda's shape differs from the sessions surface's query
// sequence: selectDistinct() for the scheduleSlot join, then select() for
// roomRows, then hydrateSessions's four select() calls (sub/track/speaker/
// EMB-01 slot lookup).
function buildAgendaApp() {
  let selectCall = 0;
  const db = {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([EVENT_ROW]); // getPublicEventBySlug
      if (selectCall === 2) return makeChain([{ id: "room1", name: "Main Hall" }]); // roomRows
      if (selectCall === 3) return makeChain(SESSION_ROWS); // hydrateSessions subRows
      if (selectCall === 4) {
        return makeChain(SESSION_ROWS.map((s) => ({ submissionId: s.id, id: "trk1", name: "Track A", color: "#f00" })));
      }
      if (selectCall === 5) {
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
      return makeChain([]); // hydrateSessions EMB-01 slotRows (unused by the agenda grid itself)
    },
    selectDistinct: () =>
      makeChain(
        SESSION_ROWS.map((s, i) => ({
          submissionId: s.id,
          day: "2026-08-10",
          startMin: 540 + i * 60,
          endMin: 600 + i * 60,
          roomId: "room1",
        })),
      ),
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

function cardFragment(html: string, submissionId: string): string {
  const start = html.indexOf(`id="chq-session-${submissionId}"`);
  expect(start).toBeGreaterThan(-1);
  const nextCard = html.indexOf('id="chq-session-', start + 1);
  return html.slice(start, nextCard === -1 ? undefined : nextCard);
}

describe("query.ts pure parsers (DEC-289 allowlists — never throw)", () => {
  it("parseDay accepts YYYY-MM-DD, rejects everything else to null", () => {
    expect(parseDay("2026-08-10")).toBe("2026-08-10");
    expect(parseDay(undefined)).toBeNull();
    expect(parseDay("")).toBeNull();
    expect(parseDay("08/10/2026")).toBeNull();
    expect(parseDay("2026-8-10")).toBeNull();
    expect(parseDay("not-a-day")).toBeNull();
  });

  it("parseLimit clamps to integer 1..100, else null", () => {
    expect(parseLimit("5")).toBe(5);
    expect(parseLimit("1")).toBe(1);
    expect(parseLimit("100")).toBe(100);
    expect(parseLimit("0")).toBeNull();
    expect(parseLimit("101")).toBeNull();
    expect(parseLimit("abc")).toBeNull();
    expect(parseLimit(undefined)).toBeNull();
    expect(parseLimit("5.5")).toBeNull();
  });

  it("parseCardFields: absent/empty is all-on", () => {
    expect(parseCardFields(undefined)).toEqual({ track: true, time: true, room: true, speaker: true, description: true });
    expect(parseCardFields("")).toEqual({ track: true, time: true, room: true, speaker: true, description: true });
  });

  it("parseCardFields: an explicit list turns on only the named, recognized fields", () => {
    expect(parseCardFields("track")).toEqual({ track: true, time: false, room: false, speaker: false, description: false });
    expect(parseCardFields("speaker,description")).toEqual({
      track: false,
      time: false,
      room: false,
      speaker: true,
      description: true,
    });
  });

  it("parseCardFields: an unknown field name is ignored (does not resurrect all-on)", () => {
    expect(parseCardFields("bogus")).toEqual({ track: false, time: false, room: false, speaker: false, description: false });
    expect(parseCardFields("track,bogus")).toEqual({
      track: true,
      time: false,
      room: false,
      speaker: false,
      description: false,
    });
  });

  it("ALL_CARD_FIELDS is exactly the DEC-289 allowlist", () => {
    expect([...ALL_CARD_FIELDS].sort()).toEqual(["description", "room", "speaker", "time", "track"]);
  });

  it("parseAccent: valid 6-hex normalizes to lowercase #rrggbb", () => {
    expect(parseAccent("AABBCC")).toBe("#aabbcc");
  });

  it("parseAccent: valid 3-hex expands and normalizes", () => {
    expect(parseAccent("abc")).toBe("#aabbcc");
  });

  it("parseAccent: garbage / CSS-injection attempts parse to null", () => {
    expect(parseAccent("red;background:url(x)")).toBeNull();
    expect(parseAccent("#aabbcc")).toBeNull(); // leading # not accepted per DEC-289
    expect(parseAccent("aabbccdd")).toBeNull();
    expect(parseAccent(undefined)).toBeNull();
    expect(parseAccent("")).toBeNull();
  });
});

describe("embed config: fields param gates card content (title always renders)", () => {
  it("fields=title-only hides speakers/description/track/time (title is not in the allowlist)", async () => {
    installFakeCaches();
    const app = buildApp();
    const res = await app.request("/embed/conf/sessions?fields=title", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();
    const fragment = cardFragment(html, "sub1");
    expect(fragment).toContain("Talk 1"); // title anchor always renders
    expect(fragment).not.toContain("Ada");
    expect(fragment).not.toContain("chq-session-when");
    expect(fragment).not.toContain("chq-track-chip");
    expect(fragment).not.toContain("A description long enough");
  });

  it("an unknown field name alongside a real one only turns on the recognized one", async () => {
    installFakeCaches();
    const app = buildApp();
    const res = await app.request("/embed/conf/sessions?fields=track,bogus", {}, TEST_ENV);
    const html = await res.text();
    const fragment = cardFragment(html, "sub1");
    expect(fragment).toContain("chq-track-chip");
    expect(fragment).not.toContain("chq-session-when");
    expect(fragment).not.toContain("Ada");
  });

  it("every param absent reproduces today's output byte-for-byte (all fields on)", async () => {
    installFakeCaches();
    const app = buildApp();
    const res = await app.request("/embed/conf/sessions", {}, TEST_ENV);
    const html = await res.text();
    const fragment = cardFragment(html, "sub1");
    expect(fragment).toContain("Talk 1");
    expect(fragment).toContain("Ada");
    expect(fragment).toContain("chq-session-when");
    expect(fragment).toContain("chq-track-chip");
    expect(fragment).toContain("A description long enough");
  });
});

describe("embed config: limit clamps and drives the sessions count", () => {
  it("limit=2 returns only 2 of the 5 fetched sessions", async () => {
    installFakeCaches();
    const app = buildApp();
    const res = await app.request("/embed/conf/sessions?limit=2", {}, TEST_ENV);
    const html = await res.text();
    expect(html).toContain('id="chq-session-sub1"');
    expect(html).toContain('id="chq-session-sub2"');
    expect(html).not.toContain('id="chq-session-sub3"');
  });

  it("an out-of-range limit is ignored (falls back to PER_PAGE, all 5 render)", async () => {
    installFakeCaches();
    const app = buildApp();
    const res = await app.request("/embed/conf/sessions?limit=0", {}, TEST_ENV);
    const html = await res.text();
    for (let i = 1; i <= 5; i++) {
      expect(html).toContain(`id="chq-session-sub${i}"`);
    }
  });
});

describe("embed config: day filters the agenda's fetched item array", () => {
  it("a day with no matching slots renders 'No sessions scheduled yet.'", async () => {
    installFakeCaches();
    const app = buildAgendaApp();
    const res = await app.request("/embed/conf/agenda?day=2099-01-01", {}, TEST_ENV);
    const html = await res.text();
    expect(html).toContain("No sessions scheduled yet.");
    expect(html).not.toContain("chq-agenda-sub1");
  });

  it("the matching day still renders its sessions", async () => {
    installFakeCaches();
    const app = buildAgendaApp();
    const res = await app.request("/embed/conf/agenda?day=2026-08-10", {}, TEST_ENV);
    const html = await res.text();
    expect(html).toContain("chq-agenda-sub1");
  });

  it("a malformed day param is ignored, not a 500 (unfiltered agenda renders)", async () => {
    installFakeCaches();
    const app = buildAgendaApp();
    const res = await app.request("/embed/conf/agenda?day=not-a-day", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("chq-agenda-sub1");
  });
});

describe("embed config: accent overrides EmbedShell branding, PublicShell ignores it", () => {
  it("a valid 6-hex accent lands in --chq-accent on the embed surface", async () => {
    installFakeCaches();
    const app = buildApp();
    const res = await app.request("/embed/conf/sessions?accent=ff0000", {}, TEST_ENV);
    const html = await res.text();
    expect(html).toContain("--chq-accent: #ff0000;");
  });

  it("a garbage accent (CSS injection attempt) never reaches the style block; falls back to event branding", async () => {
    installFakeCaches();
    const app = buildApp();
    const res = await app.request("/embed/conf/sessions?accent=red;background:url(x)", {}, TEST_ENV);
    const html = await res.text();
    expect(html).not.toContain("url(x)");
    expect(html).toContain("--chq-accent: #123456;"); // falls back to EVENT_ROW branding
  });

  it("PublicShell (/e/...) ignores the accent param entirely", async () => {
    installFakeCaches();
    const app = buildApp();
    const res = await app.request("/e/conf/sessions?accent=ff0000", {}, TEST_ENV);
    const html = await res.text();
    expect(html).not.toContain("--chq-accent: #ff0000;");
    expect(html).toContain("--chq-accent: #123456;"); // event branding, unaffected by accent
  });
});

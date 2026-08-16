// EMB-15 (config half, DEC-289): embed query-param configuration — field
// selection, limit clamping, day filtering, and accent overrides. Mirrors
// the fake-db-chain harness established in test/public.test.ts.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { publicRoutes } from "../src/routes/public";
import {
  parseDay,
  parseLimit,
  parseCardFields,
  parseAccent,
  parsePage,
  ALL_CARD_FIELDS,
} from "../src/routes/public/query";
import { MAX_PUBLIC_PAGE, MIN_EMBED_LIMIT, MAX_EMBED_LIMIT } from "../src/server/repo/public/bounds";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";
import * as schema from "../src/db/schema";

// DEC-418: getVisibleSubmissionIdsOrdered's id query now carries a real SQL
// LIMIT (see src/server/repo/public/sessions.ts) instead of the caller
// JS-slicing an unbounded result — so this fake, like a real driver, must
// honor the bound passed to .limit(n) rather than ignoring it.
//
// DEC-022 amendment (wave 63): getPublicBreaksByDay's select is routed by
// .from(schema.scheduleBreak) rather than by this harness's positional
// selectCall counters, so a new call added anywhere in the sequence always
// resolves to an empty (harmless) break set instead of colliding with
// whatever positionally-numbered branch happens to occupy that slot.
function makeChain(rows: unknown[]) {
  const chain: any = {
    from: (table?: unknown) => (table === schema.scheduleBreak ? emptyChain() : chain),
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    groupBy: () => chain,
    orderBy: () => chain,
    limit: async (n: number) => rows.slice(0, n),
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
    groupBy: () => chain,
    orderBy: () => chain,
    limit: async () => [],
    as: () => chain,
    then: (resolve: (v: unknown[]) => void) => resolve([]),
  };
  return chain;
}

// Walks a drizzle SQL condition tree just enough to pull out an eq()-bound
// literal day value (DEC-548: the ?day= filter now lives in the SQL WHERE,
// not a JS .filter() after the fact). Each single comparison node's own
// queryChunks array holds [op-agnostic prefix, the "day" column, an
// operator StringChunk (" >= "/" <= "/" = "), the bound Param, suffix] as
// immediate siblings — an eq() node is the one whose operator chunk is
// exactly " = " (gte/lte use " >= "/" <= " and must not match).
function extractDayFilter(node: unknown, depth = 0): string | undefined {
  if (depth > 12 || node === null || typeof node !== "object") return undefined;
  const n = node as { queryChunks?: unknown[]; name?: string; value?: unknown };
  if (Array.isArray(n.queryChunks)) {
    const chunks = n.queryChunks as { name?: string; value?: unknown }[];
    const isDayColumn = chunks.some((c) => c && typeof c === "object" && c.name === "day");
    const isEqOp = chunks.some((c) => c && typeof c === "object" && Array.isArray(c.value) && c.value[0] === " = ");
    if (isDayColumn && isEqOp) {
      const param = chunks.find(
        (c) => c && typeof c === "object" && typeof c.value === "string",
      ) as { value?: unknown } | undefined;
      if (param && typeof param.value === "string") return param.value;
    }
    for (const c of n.queryChunks) {
      const found = extractDayFilter(c, depth + 1);
      if (found) return found;
    }
  }
  return undefined;
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
      if (selectCall === 3) return makeChain([]); // getPublicRooms (DEC-774)
      if (selectCall === 4) return makeChain([]); // getPublicFormatOptions (DEC-774)
      if (selectCall === 5) return makeChain(SESSION_ROWS); // hydrateSessions subRows
      if (selectCall === 6) {
        // hydrateSessions trackRows
        return makeChain(SESSION_ROWS.map((s) => ({ submissionId: s.id, id: "trk1", name: "Track A", color: "#f00", sortOrder: 0 })));
      }
      if (selectCall === 7) {
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
      if (selectCall === 8) {
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
      }
      // hydrateSessions formatRows
      return makeChain([]);
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
// getPublicAgenda's shape differs from the sessions surface's query
// sequence: build sq via selectDistinct() (captures any ?day= eq filter),
// then select() for the DEC-548 total count(*), then (only when the count
// is nonzero) a second selectDistinct() for the real windowed scan, then
// select() for roomRows, then hydrateSessions's four select() calls
// (sub/track/speaker/EMB-01 slot lookup).
function buildAgendaApp() {
  let selectCall = 0;
  let dayFilter: string | undefined;
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
      if (selectCall === 2) return makeChain([]); // DEC-804 getPublicTracks (the track-HIGHLIGHT <select>)
      // DEC-851 (wave 64 amendment): format is not an agenda facet, so
      // getPublicFormatOptions is no longer called on this surface — this
      // positional harness must NOT reserve a slot for it.
      // DEC-768 (wave 67 amendment): /agenda is single-day by default, so
      // getPublicScheduleDayCounts now runs on EVERY agenda request (it
      // supplies the switcher's full day list AND the default day) ahead of
      // getPublicAgenda's own sequence.
      if (selectCall === 3) return makeChain([{ day: "2026-08-10", count: AGENDA_ROWS.length }]);
      if (selectCall === 4) {
        // DEC-548 getPublicAgenda's total count(*) subquery — reflects
        // whatever ?day= filter the just-built sq's where() captured.
        // DEC-774 wave-34 amendment: this fires in the SAME synchronous
        // burst as getPublicBreaksByDay's select below (wave 2's two
        // concurrent reads), ahead of getPublicAgenda's own rows query/
        // room lookup/hydrateSessions cascade. See test/public-surface-
        // round-trip-depth.test.ts for the behavioural proof.
        const filtered = dayFilter ? AGENDA_ROWS.filter((r) => r.day === dayFilter) : AGENDA_ROWS;
        return makeChain([{ count: filtered.length }]);
      }
      if (selectCall === 5) return makeChain([]); // getPublicBreaksByDay
      if (selectCall === 6) return makeChain([{ id: "room1", name: "Main Hall" }]); // roomRows
      if (selectCall === 7) return makeChain(SESSION_ROWS); // hydrateSessions subRows
      if (selectCall === 8) {
        return makeChain(SESSION_ROWS.map((s) => ({ submissionId: s.id, id: "trk1", name: "Track A", color: "#f00" })));
      }
      if (selectCall === 9) {
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
      if (selectCall === 10) return makeChain([]); // hydrateSessions EMB-01 slotRows (unused by the agenda grid itself)
      return makeChain([]); // hydrateSessions formatRows
    },
    selectDistinct: () => {
      const chain: any = {
        from: () => chain,
        innerJoin: () => chain,
        // DEC-783: getPublicAgenda now always left-joins participant/contact
        // (for the ?q= keyword search condition), same shape as the sessions
        // surface's query — the fake chain needs the same method whether or
        // not a given test actually sets ?q=.
        leftJoin: () => chain,
        where: (cond: unknown) => {
          const found = extractDayFilter(cond);
          if (found) dayFilter = found;
          return chain;
        },
        orderBy: () => chain,
        as: () => chain,
        limit: async (n: number) => {
          const filtered = dayFilter ? AGENDA_ROWS.filter((r) => r.day === dayFilter) : AGENDA_ROWS;
          return filtered.slice(0, n);
        },
        then: (resolve: (v: unknown[]) => void) => {
          const filtered = dayFilter ? AGENDA_ROWS.filter((r) => r.day === dayFilter) : AGENDA_ROWS;
          resolve(filtered);
        },
      };
      return chain;
    },
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

  // DEC-487 (wave 10 amendment): parseLimit's range is the same two symbols
  // the API refusal message describes — a value one past the declared
  // ceiling degrades to null (never throws), same as the bare "101" case
  // above, but expressed against the constant rather than a hand-typed
  // number so a future change to the constant can't silently desync this
  // assertion from the enforced bound.
  it("degrades to null one past MAX_EMBED_LIMIT and accepts exactly MIN_EMBED_LIMIT/MAX_EMBED_LIMIT", () => {
    expect(parseLimit(String(MIN_EMBED_LIMIT))).toBe(MIN_EMBED_LIMIT);
    expect(parseLimit(String(MAX_EMBED_LIMIT))).toBe(MAX_EMBED_LIMIT);
    expect(parseLimit(String(MAX_EMBED_LIMIT + 1))).toBeNull();
    expect(parseLimit(String(MIN_EMBED_LIMIT - 1))).toBeNull();
  });

  it("parseCardFields: absent/empty is all-on", () => {
    expect(parseCardFields(undefined)).toEqual({ track: true, time: true, room: true, speaker: true, description: true, format: true });
    expect(parseCardFields("")).toEqual({ track: true, time: true, room: true, speaker: true, description: true, format: true });
  });

  it("parseCardFields: an explicit list turns on only the named, recognized fields", () => {
    expect(parseCardFields("track")).toEqual({ track: true, time: false, room: false, speaker: false, description: false, format: false });
    expect(parseCardFields("speaker,description")).toEqual({
      track: false,
      time: false,
      room: false,
      speaker: true,
      description: true,
      format: false,
    });
  });

  it("parseCardFields: an unknown field name is ignored (does not resurrect all-on)", () => {
    expect(parseCardFields("bogus")).toEqual({ track: false, time: false, room: false, speaker: false, description: false, format: false });
    expect(parseCardFields("track,bogus")).toEqual({
      track: true,
      time: false,
      room: false,
      speaker: false,
      description: false,
      format: false,
    });
  });

  it("parsePage (DEC-433): non-integer/non-finite/<1 falls back to 1, above the cap clamps down to MAX_PUBLIC_PAGE", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-1")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("1e308")).toBe(MAX_PUBLIC_PAGE);
    expect(parsePage("1e400")).toBe(1); // Number("1e400") is Infinity, not Number.isInteger -> falls back to 1
    expect(parsePage("99999")).toBe(MAX_PUBLIC_PAGE);
    expect(parsePage("3")).toBe(3);
    expect(parsePage(String(MAX_PUBLIC_PAGE))).toBe(MAX_PUBLIC_PAGE);
  });

  it("ALL_CARD_FIELDS is exactly the DEC-289 allowlist", () => {
    expect([...ALL_CARD_FIELDS].sort()).toEqual(["description", "format", "room", "speaker", "time", "track"]);
  });

  it("parseAccent: valid 6-hex normalizes to lowercase #rrggbb", () => {
    expect(parseAccent("AABBCC")).toBe("#aabbcc");
  });

  it("parseAccent: valid 3-hex expands and normalizes", () => {
    expect(parseAccent("abc")).toBe("#aabbcc");
  });

  // DEC-817: the embed builder's own Accent color placeholder shows the '#'
  // form (`#4e5c31`) — a value copied verbatim must round-trip, so
  // parseAccent now tolerates exactly one leading '#' (still normalizing to
  // lowercase '#rrggbb'; DEC-374's value-free-CSS rule is untouched).
  it("parseAccent: one leading '#' is tolerated and normalized (DEC-817)", () => {
    expect(parseAccent("#aabbcc")).toBe("#aabbcc");
    expect(parseAccent("#ABC")).toBe("#aabbcc");
  });

  it("parseAccent: garbage / CSS-injection attempts parse to null", () => {
    expect(parseAccent("red;background:url(x)")).toBeNull();
    expect(parseAccent("##aabbcc")).toBeNull(); // more than one leading '#' still rejected
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
    expect(fragment).not.toContain("chq-pub-session-when");
    expect(fragment).not.toContain("chq-pub-session-tag");
    expect(fragment).not.toContain("A description long enough");
  });

  // DEC-968: the sessions-list row's meta line renders through the shared
  // .chq-pub-session-tag class (not the colour-swatch .chq-pub-track-chip,
  // which stays for the agenda blocks and detail page).
  it("an unknown field name alongside a real one only turns on the recognized one", async () => {
    installFakeCaches();
    const app = buildApp();
    const res = await app.request("/embed/conf/sessions?fields=track,bogus", {}, TEST_ENV);
    const html = await res.text();
    const fragment = cardFragment(html, "sub1");
    expect(fragment).toContain('class="chq-pub-session-tag"');
    expect(fragment).not.toContain("chq-pub-session-when");
    expect(fragment).not.toContain("Ada");
  });

  // DEC-968 as amended by the EMB-01 orchestrator ruling: an absent
  // ?fields= on the sessions surface defaults to SESSION_LIST_DEFAULT_FIELDS
  // with ALL SIX fields on — the description renders as a snippet with an
  // in-place "Show more" disclosure, and dropping it requires naming the
  // other fields explicitly.
  it("every param absent uses the sessions-list default (all six fields, description as snippet)", async () => {
    installFakeCaches();
    const app = buildApp();
    const res = await app.request("/embed/conf/sessions", {}, TEST_ENV);
    const html = await res.text();
    const fragment = cardFragment(html, "sub1");
    expect(fragment).toContain("Talk 1");
    expect(fragment).toContain("Ada");
    expect(fragment).toContain("chq-pub-session-when");
    expect(fragment).toContain('class="chq-pub-session-tag"');
    expect(fragment).toContain("A description long enough");
  });

  it("?fields=track,description restores the description alongside the default track/format meta line", async () => {
    installFakeCaches();
    const app = buildApp();
    const res = await app.request("/embed/conf/sessions?fields=track,description", {}, TEST_ENV);
    const html = await res.text();
    const fragment = cardFragment(html, "sub1");
    expect(fragment).toContain("A description long enough");
    expect(fragment).toContain('class="chq-pub-session-tag"');
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
  // DEC-768 (wave 67 amendment): with a day explicitly requested, the empty
  // state names THAT day rather than claiming the event has no schedule --
  // the bare "No sessions scheduled yet." is now reserved for an event with
  // no scheduled days at all (getPublicScheduleDayCounts came back empty).
  it("a day with no matching slots renders an empty state naming that day, not 'nothing scheduled'", async () => {
    installFakeCaches();
    const app = buildAgendaApp();
    const res = await app.request("/embed/conf/agenda?day=2099-01-01", {}, TEST_ENV);
    const html = await res.text();
    expect(html).toContain("No sessions match");
    expect(html).not.toContain("No sessions scheduled yet.");
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
  // DEC-371: the per-event recolour hook is --chq-brandable-accent (was
  // --chq-accent before THEME_CSS/ThemeStyles wiring, task-w1-b).
  it("a valid 6-hex accent lands in --chq-brandable-accent on the embed surface", async () => {
    installFakeCaches();
    const app = buildApp();
    const res = await app.request("/embed/conf/sessions?accent=ff0000", {}, TEST_ENV);
    const html = await res.text();
    expect(html).toContain("--chq-brandable-accent: #ff0000;");
  });

  it("a garbage accent (CSS injection attempt) never reaches the style block; falls back to event branding", async () => {
    installFakeCaches();
    const app = buildApp();
    const res = await app.request("/embed/conf/sessions?accent=red;background:url(x)", {}, TEST_ENV);
    const html = await res.text();
    expect(html).not.toContain("url(x)");
    expect(html).toContain("--chq-brandable-accent: #123456;"); // falls back to EVENT_ROW branding
  });

  it("PublicShell (/e/...) ignores the accent param entirely", async () => {
    installFakeCaches();
    const app = buildApp();
    const res = await app.request("/e/conf/sessions?accent=ff0000", {}, TEST_ENV);
    const html = await res.text();
    expect(html).not.toContain("--chq-brandable-accent: #ff0000;");
    expect(html).toContain("--chq-brandable-accent: #123456;"); // event branding, unaffected by accent
  });
});

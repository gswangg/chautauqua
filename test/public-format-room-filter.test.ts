// DEC-774: format/room chip filters on the public sessions surface.
// Covers: parseFormat/parseRoomId's trim/null parsing (mirrors parseTrackId),
// the repo layer threading format/roomId into getPublicSessions' WHERE as
// EXISTS predicates (mirrors test/public-day-filter.test.ts's walkCondition
// convention — no local sqlite/D1 test driver is wired up), and the
// sessions.tsx chip rendering (hrefs preserve every active filter param).

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { parseFormat, parseRoomId } from "../src/routes/public/query";
import { getPublicSessions } from "../src/server/repo/public";
import type { PublicEvent } from "../src/server/repo/public";
import { publicRoutes } from "../src/routes/public";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv } from "../src/server/env";

describe("parseFormat / parseRoomId (DEC-774): trim-or-null, mirrors parseTrackId", () => {
  it("parseFormat trims and nulls out blank/absent input", () => {
    expect(parseFormat(" Workshop ")).toBe("Workshop");
    expect(parseFormat("")).toBeNull();
    expect(parseFormat(undefined)).toBeNull();
    expect(parseFormat("   ")).toBeNull();
  });

  it("parseRoomId trims and nulls out blank/absent input", () => {
    expect(parseRoomId(" room1 ")).toBe("room1");
    expect(parseRoomId("")).toBeNull();
    expect(parseRoomId(undefined)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Repo-layer: format/roomId reach the WHERE clause as EXISTS predicates,
// alongside (never replacing) the visibility gate.
// ---------------------------------------------------------------------------

const EVENT: PublicEvent = {
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

function walkCondition(node: unknown, seen = new Set<unknown>(), depth = 0): string[] {
  if (depth > 12 || node === null || typeof node !== "object") return [];
  if (seen.has(node)) return [];
  seen.add(node);
  const n = node as Record<string, unknown>;
  const out: string[] = [];
  if (typeof n.name === "string") out.push(`col:${n.name}`);
  if (n.value !== undefined && typeof n.value !== "object") out.push(`val:${JSON.stringify(n.value)}`);
  if (Array.isArray(n.queryChunks)) {
    for (const c of n.queryChunks) {
      if (c !== null && typeof c !== "object") {
        out.push(`raw:${JSON.stringify(c)}`);
      } else {
        out.push(...walkCondition(c, seen, depth + 1));
      }
    }
  }
  return out;
}

function makeChain(rows: unknown[], onWhere?: (cond: unknown) => void) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: (cond: unknown) => {
      onWhere?.(cond);
      return chain;
    },
    groupBy: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    offset: async () => rows,
    as: () => chain,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

describe("getPublicSessions (DEC-774): format/roomId are EXISTS predicates on the WHERE, never a post-page filter", () => {
  it("format=<f> adds an EXISTS(submission_answer ... form_field_id ...) predicate alongside the visibility gate", async () => {
    let captured: unknown;
    const db = {
      selectDistinct: () => makeChain([], (cond) => (captured = cond)),
      select: () => makeChain([{ count: 0 }]),
    } as unknown as AppEnv["Variables"]["db"];

    await getPublicSessions(db, EVENT, { trackId: null, page: 1, perPage: 12, format: "Workshop" });
    const tokens = walkCondition(captured);
    // visibility gate still present
    expect(tokens).toContain('val:"accepted"');
    expect(tokens).toContain('val:"approved"');
    // DEC-592/DEC-755: the format predicate joins form_field and matches the
    // session_format ROLE -- never the old global-PK literal id, which only
    // the seed could ever satisfy -- plus the exact JSON-encoded value
    // (submission_answer.value_json stores JSON.stringify(format), so the
    // bound param itself is the quoted string '"Workshop"').
    expect(tokens).toContain("col:role");
    expect(tokens.some((t) => t.includes("session_format"))).toBe(true);
    expect(tokens.some((t) => t.includes("field_session_format"))).toBe(false);
    expect(tokens.some((t) => t.includes("Workshop"))).toBe(true);
  });

  it("roomId=<r> adds an EXISTS(schedule_slot ... room_id ...) predicate alongside the visibility gate", async () => {
    let captured: unknown;
    const db = {
      selectDistinct: () => makeChain([], (cond) => (captured = cond)),
      select: () => makeChain([{ count: 0 }]),
    } as unknown as AppEnv["Variables"]["db"];

    await getPublicSessions(db, EVENT, { trackId: null, page: 1, perPage: 12, roomId: "room1" });
    const tokens = walkCondition(captured);
    expect(tokens).toContain('val:"accepted"');
    expect(tokens).toContain('val:"approved"');
    expect(tokens.some((t) => t.includes("room1"))).toBe(true);
  });

  it("omits both predicates when format/roomId are absent", async () => {
    let captured: unknown;
    const db = {
      selectDistinct: () => makeChain([], (cond) => (captured = cond)),
      select: () => makeChain([{ count: 0 }]),
    } as unknown as AppEnv["Variables"]["db"];

    await getPublicSessions(db, EVENT, { trackId: null, page: 1, perPage: 12 });
    const tokens = walkCondition(captured);
    expect(tokens.some((t) => t.includes("field_session_format"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// sessions.tsx: format/room chips render alongside track chips, and every
// chip's href preserves the other two active filters.
// ---------------------------------------------------------------------------

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

const TEST_ENV = { KV: fakeKv() } as unknown as AppEnv["Bindings"];

function buildApp() {
  let selectCall = 0;
  const db = {
    select: () => {
      selectCall += 1;
      if (selectCall === 1) return makeChain([EVENT_ROW]); // getPublicEventBySlug
      if (selectCall === 2) return makeChain([{ id: "trk1", name: "Engineering", color: null }]); // getPublicTracks
      if (selectCall === 3) return makeChain([{ id: "room1", name: "Main Hall" }]); // getPublicRooms
      if (selectCall === 4) return makeChain([{ optionsJson: JSON.stringify(["Workshop", "Talk"]) }]); // getPublicFormatOptions
      // countVisibleSubmissions: a NON-ZERO count is load-bearing since the
      // DEC-919 wave-47 amendment — an unfiltered surface whose total is 0 is
      // 'fresh' and the caller hides the whole filter bar, so a zero here
      // would delete the very selects this test asserts. The page rows stay
      // empty (no session hydration needed for the chip assertions).
      if (selectCall === 5) return makeChain([{ count: 3 }]);
      return makeChain([{ count: 3 }]);
    },
    selectDistinct: () => makeChain([]),
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

describe("sessions.tsx (DEC-774): format/room filter chips", () => {
  it("renders format and room facet selects alongside the track select, all at their All state by default (v7 filter bar)", async () => {
    installFakeCaches();
    const app = buildApp();
    const res = await app.request("/e/conf/sessions", {}, TEST_ENV);
    expect(res.status).toBe(200);
    const html = await res.text();
    for (const name of ["trackId", "format", "roomId"]) {
      expect(html).toMatch(new RegExp(`<select class="chq-pub-select"[^>]*name="${name}"`));
    }
    expect(html).toContain('<option value="">All formats</option>');
    expect(html).toContain('<option value="Workshop">Workshop</option>');
    expect(html).toContain('<option value="Talk">Talk</option>');
    expect(html).toContain('<option value="room1">Main Hall</option>');
  });

  it("the format select's form carries the active trackId and roomId as hidden inputs (v7 facet composition)", async () => {
    installFakeCaches();
    const app = buildApp();
    const res = await app.request("/e/conf/sessions?trackId=trk1&roomId=room1", {}, TEST_ENV);
    const html = await res.text();
    const form = html.match(/<form class="chq-pub-select-form"[^>]*>(?:(?!<\/form>)[\s\S])*name="format"[\s\S]*?<\/form>/);
    expect(form).not.toBeNull();
    expect(form![0]).toContain('<input type="hidden" name="trackId" value="trk1"');
    expect(form![0]).toContain('<input type="hidden" name="roomId" value="room1"');
  });

  it("the search form carries the active format/roomId as hidden inputs", async () => {
    installFakeCaches();
    const app = buildApp();
    const res = await app.request("/e/conf/sessions?format=Workshop&roomId=room1", {}, TEST_ENV);
    const html = await res.text();
    expect(html).toContain('<input type="hidden" name="format" value="Workshop"');
    expect(html).toContain('<input type="hidden" name="roomId" value="room1"');
  });
});

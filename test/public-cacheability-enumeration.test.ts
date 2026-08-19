// DEC-099 wave-35 amendment: the wave-34 "Vary: Cookie" claim
// (src/routes/public/shell.tsx:103-107's setCacheHeaders) was proven only by
// test/pubcache.test.ts:132-167 (unit tests over servePublicGet) and by
// reading setCacheHeaders itself -- neither says anything about the ~15
// hand-placed setCacheHeaders(c) call sites in src/routes/public/index.tsx,
// src/routes/public/programme.tsx, src/routes/public/saved-embed.tsx and
// src/routes/root.tsx:426. This file gives that claim a DERIVED POPULATION:
// it composes the real publicRoutes sub-app (which mounts savedEmbedRoutes
// internally, ./saved-embed.tsx:62) and the real rootRoutes sub-app the same
// non-hand-typed way test/anonymous-route-probe.test.ts does (DEC-518
// technique) -- parsing the literal `app.route("<prefix>", <identifier>)`
// calls out of src/index.ts's own source and resolving each identifier
// through that file's own imports via test/helpers/index-mounts.ts's
// parseIndexMounts() -- rather than hand-listing "the public sub-app" and
// "the root route" as a fixed pair that could silently drift from
// src/index.ts's real mounts.
//
// Enumeration then keeps only the GET registrations under /e/*, /embed/*
// (which covers /e/:slug/programme and /embed/e/:embedId too) and the bare
// "/" -- src/index.ts also mounts rootRoutes' /admin and /admin/* under this
// same "/" prefix, which are organizer-gated SPA shells with no public
// cache contract and are deliberately excluded here (not this claim's
// population).
//
// The rule asserted on every driven response, in BOTH directions (a single
// closed predicate, not two independent checks -- DEC-099 wave-35): a
// response whose Cache-Control is anything other than "no-store" MUST carry
// Vary: Cookie, and a response carrying Vary: Cookie MUST be cacheable
// (Cache-Control not "no-store"). Each enumerated route is driven twice,
// anonymously, over the db-stub/app-harness idiom test/public-cors.test.ts
// and test/public-404-no-store.test.ts already use to drive these same
// routes (vi.mock(../src/server/repo/public) + a real Hono app, not a
// throwing stub -- these routes read real data before ever reaching a cache
// header, unlike the authz probe's synchronous-gate routes): once with a
// KNOWN event/embed id (the 200-shaped path) and once with an UNKNOWN one
// (the publicNotFound path, DEC-297/DEC-324). A dedicated case also drives
// publicRoutes.onError's thrown-error path.
//
// Finding from building this probe (wave 35): it FOUND a real violation.
// publicNotFound/publicErrorDocument/publicRoutes.onError all force
// Cache-Control: no-store on the way out to satisfy DEC-297/DEC-324, but
// setCacheHeaders(c) had already set Vary: Cookie earlier in the same
// handler -- c.header(name, value) only overwrites the header it names, so
// the no-store response still carried Vary: Cookie, violating this file's
// second direction (a Vary: Cookie response must be cacheable). Per this
// task's instruction ("if a real route violates the rule, FIX THE ROUTE --
// never add an allowlist entry"), all three call sites now also call
// c.header("Vary", undefined) (which deletes the header, per hono's
// node_modules/hono/dist/context.js) right alongside the Cache-Control
// override -- see src/routes/public/not-found.tsx and
// src/routes/public/index.tsx's onError.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "../src/server/env";
import type { KVStore } from "../src/lib/draft";
import { parseIndexMounts } from "./helpers/index-mounts";

vi.mock("../src/server/repo/public/home", () => ({
  getHubOrg: vi.fn(async () => null),
  listHubEvents: vi.fn(async () => ({ items: [], capped: false })),
}));

const EVENT: import("../src/server/repo/public").PublicEvent = {
  id: "ev1",
  orgId: "org1",
  name: "Test Event",
  slug: "conf",
  startDate: "2026-08-10",
  endDate: "2026-08-10",
  location: null,
  timezone: "UTC",
  recordPrefix: "SES",
  brandingJson: null,
};

const SPEAKER_DETAIL: import("../src/server/repo/public").PublicSpeakerDetail = {
  contactId: "contact1",
  firstName: "Ada",
  lastName: "Lovelace",
  title: null,
  company: null,
  bio: null,
  headshotUrl: null,
  socialLinks: [],
  sessions: [],
};

const SESSION_DETAIL: import("../src/server/repo/public").PublicSessionDetail = {
  id: "sess1",
  ref: "SES-1",
  title: "Test session",
  description: null,
  tracks: [],
  day: null,
  startMin: null,
  endMin: null,
  roomId: null,
  roomName: null,
  speakers: [],
  format: null,
};

vi.mock("../src/server/repo/public", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/public")>(
    "../src/server/repo/public",
  );
  return {
    ...actual,
    getPublicEventBySlug: vi.fn(async (_db: unknown, slug: string) => (slug === EVENT.slug ? EVENT : null)),
    getPublicEventById: vi.fn(async (_db: unknown, id: string) => (id === EVENT.id ? EVENT : null)),
    getPublicTracks: vi.fn(async () => []),
    getPublicRooms: vi.fn(async () => []),
    getPublicFormatOptions: vi.fn(async () => []),
    getPublicSessions: vi.fn(async () => ({ items: [], total: 0 })),
    getPublicSpeakers: vi.fn(async () => ({ items: [], total: 0 })),
    getPublicSpeakerDetail: vi.fn(async (_db: unknown, _event: unknown, contactId: string) =>
      contactId === SPEAKER_DETAIL.contactId ? SPEAKER_DETAIL : null,
    ),
    getPublicSessionDetail: vi.fn(async (_db: unknown, _event: unknown, sessionId: string) =>
      sessionId === SESSION_DETAIL.id ? SESSION_DETAIL : null,
    ),
    getPublicAgenda: vi.fn(async () => ({ items: [], total: 0 })),
    getPublicAgendaByIds: vi.fn(async () => []),
    getPublicScheduleDayCounts: vi.fn(async () => []),
    getPublicCfpWindow: vi.fn(async () => null),
    getPriorPublicEvent: vi.fn(async () => null),
    getPublicBreaksByDay: vi.fn(async () => new Map()),
  };
});

vi.mock("../src/server/repo/embeds", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/embeds")>(
    "../src/server/repo/embeds",
  );
  return {
    ...actual,
    getEmbedById: vi.fn(async (_db: unknown, id: string) =>
      id === "embed1"
        ? {
            id: "embed1",
            orgId: "org1",
            eventId: EVENT.id,
            name: "Test embed",
            surface: "sessions",
            format: "iframe",
            options: {},
            enabled: true,
            createdAt: 0,
            updatedAt: 0,
          }
        : null,
    ),
  };
});

class InMemoryKV implements KVStore {
  private store = new Map<string, string>();
  async get(key: string) {
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string) {
    this.store.set(key, value);
  }
  async delete(key: string) {
    this.store.delete(key);
  }
}

class InMemoryCache {
  private store = new Map<string, Response>();
  async match(request: Request) {
    return this.store.get(request.url);
  }
  async put(request: Request, response: Response) {
    this.store.set(request.url, response);
  }
  clear() {
    this.store.clear();
  }
}

const sharedCache = new InMemoryCache();
(globalThis as unknown as { caches: { default: InMemoryCache } }).caches = { default: sharedCache };

// ---------------------------------------------------------------------------
// Composition -- derived from src/index.ts's own source (DEC-518 technique),
// keeping only the two mounts this claim's population is about.
// ---------------------------------------------------------------------------

async function buildApp() {
  const mounts = await parseIndexMounts();
  const relevant = mounts.filter((m) => m.identifier === "publicRoutes" || m.identifier === "rootRoutes");
  // Never silently narrow: src/index.ts must still mount exactly these two
  // named sub-apps for this composition to mean what its header claims.
  expect(relevant.map((m) => m.identifier).sort()).toEqual(["publicRoutes", "rootRoutes"]);

  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    // The mocked repo functions above don't read `db` for anything this
    // file drives.
    c.set("db", {} as AppEnv["Variables"]["db"]);
    await next();
  });
  for (const { prefix, subApp } of relevant) {
    app.route(prefix, subApp);
  }

  const env = {
    KV: new InMemoryKV() as unknown as AppEnv["Bindings"]["KV"],
    DEV_MODE: "1",
  } as unknown as AppEnv["Bindings"];

  return {
    request: (path: string) => app.request(path, {}, env),
    app,
  };
}

// ---------------------------------------------------------------------------
// Route enumeration + literal substitution, scoped to this claim's
// population: GET registrations under /e/*, /embed/* and the bare "/".
// rootRoutes' /admin and /admin/* also live at prefix "/" and are excluded
// (organizer-gated SPA shell, no public cache contract).
// ---------------------------------------------------------------------------

function inPopulation(path: string): boolean {
  return path === "/" || path.startsWith("/e/") || path.startsWith("/embed/");
}

function enumerateGetPaths(app: Hono<AppEnv>): string[] {
  const paths = new Set<string>();
  for (const route of app.routes) {
    if (route.method !== "GET") continue;
    if (!inPopulation(route.path)) continue;
    paths.add(route.path);
  }
  return Array.from(paths).sort();
}

/** Picks a concrete request path for a route's Hono path pattern, in either
 * variant. "known" resolves every event/embed/detail id this file's mocks
 * recognize (driving the 200-shaped path); "unknown" substitutes an id none
 * of the mocks recognize (driving the publicNotFound path, DEC-297/DEC-324).
 * Regex-constrained :surface segments (the .json/.xml feed twins) always get
 * a literal satisfying their constraint AND naming a real surface
 * ("sessions") -- the KNOWN/UNKNOWN axis for those routes is carried
 * entirely by :eventSlug, exactly like every other route here. */
function toRequestPath(routePath: string, variant: "known" | "unknown"): string {
  return routePath
    .split("/")
    .map((segment) => {
      if (!segment.startsWith(":")) return segment;
      const name = segment.slice(1, segment.indexOf("{") === -1 ? undefined : segment.indexOf("{"));
      if (name === "eventSlug") return variant === "known" ? EVENT.slug : "does-not-exist";
      if (name === "embedId") return variant === "known" ? "embed1" : "does-not-exist";
      if (name === "sessionId") return variant === "known" ? SESSION_DETAIL.id : "does-not-exist";
      if (name === "contactId") return variant === "known" ? SPEAKER_DETAIL.contactId : "does-not-exist";
      if (name === "surface") {
        if (segment.includes(".json}")) return "sessions.json";
        if (segment.includes(".xml}")) return "sessions.xml";
        return "sessions";
      }
      throw new Error(`toRequestPath: no literal rule for param segment '${segment}' in route '${routePath}'`);
    })
    .join("/");
}

// ---------------------------------------------------------------------------
// The closed rule, asserted in both directions, with a violation list
// (rather than an inline expect()) so the same predicate can drive both the
// real-route assertions and the negative control below.
// ---------------------------------------------------------------------------

function cacheabilityViolations(res: Response, label: string): string[] {
  const cacheControl = res.headers.get("Cache-Control");
  const vary = res.headers.get("Vary");
  if (cacheControl === null) {
    return [`${label}: response has no Cache-Control header at all`];
  }
  const cacheable = cacheControl !== "no-store";
  const violations: string[] = [];
  if (cacheable && vary !== "Cookie") {
    violations.push(
      `${label}: Cache-Control="${cacheControl}" (cacheable) but Vary="${vary ?? "null"}" (must be "Cookie")`,
    );
  }
  if (vary === "Cookie" && !cacheable) {
    violations.push(
      `${label}: Vary="Cookie" but Cache-Control="${cacheControl}" (not cacheable -- a Vary: Cookie response must be cacheable)`,
    );
  }
  return violations;
}

describe("DEC-099 wave-35: public-surface cacheability is a closed Cache-Control/Vary rule", () => {
  it("enumerates at least the routes this claim's population is expected to cover (floor, DEC-550 technique)", async () => {
    const { app } = await buildApp();
    const getPaths = enumerateGetPaths(app);
    // 19 real GET routes under /e/*, /embed/* and "/" as of wave 35 (see this
    // file's header comment for the enumerated list) -- a floor, not an
    // allowlist, so this probe can never silently narrow to fewer routes.
    expect(getPaths.length).toBeGreaterThanOrEqual(19);
    expect(getPaths).toContain("/");
    expect(getPaths).toContain("/embed/e/:embedId");
  });

  it("every enumerated GET route, known-id and unknown-id, satisfies the closed rule", async () => {
    const { app, request } = await buildApp();
    const getPaths = enumerateGetPaths(app);
    const violations: string[] = [];
    let sawCacheable = false;
    let sawNoStore = false;

    for (const routePath of getPaths) {
      for (const variant of ["known", "unknown"] as const) {
        const requestPath = toRequestPath(routePath, variant);
        const res = await request(requestPath);
        const label = `GET ${routePath} [${variant}] (requested ${requestPath}) -> ${res.status}`;
        violations.push(...cacheabilityViolations(res, label));
        const cacheControl = res.headers.get("Cache-Control");
        if (cacheControl === "no-store") sawNoStore = true;
        else if (cacheControl !== null) sawCacheable = true;
      }
    }

    expect(violations).toEqual([]);
    // Sanity: the probe actually exercised both sides of the rule -- if
    // every response were no-store (or every response were cacheable), the
    // "both directions" assertion above would be vacuous.
    expect(sawCacheable).toBe(true);
    expect(sawNoStore).toBe(true);
  });

  it("publicRoutes.onError's thrown-error path also satisfies the closed rule (DEC-324)", async () => {
    const repo = await import("../src/server/repo/public");
    vi.mocked(repo.getPublicEventBySlug).mockImplementationOnce(async () => {
      throw new Error("boom");
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // The prior test already stored a cache-hit for /e/conf/speakers's known
    // path (versionedCacheKey drops any query param not in the closed
    // PUBLIC_CACHE_KEY_PARAMS allowlist, pubcache.ts, so a query-string
    // suffix alone would not bust it) -- clear the shared InMemoryCache so
    // publicCacheMiddleware actually calls through to the handler (and this
    // mockImplementationOnce throw) instead of serving the earlier 200.
    sharedCache.clear();
    const { request } = await buildApp();
    const res = await request("/e/conf/speakers");

    expect(res.status).toBe(500);
    expect(cacheabilityViolations(res, "onError 500")).toEqual([]);
    // The specific DEC-297/DEC-324 contract this rule protects: onError must
    // still force no-store, not merely "carry no Vary".
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Vary")).toBeNull();

    consoleErrorSpy.mockRestore();
  });

  it("NEGATIVE CONTROL: a synthetic cacheable-but-Vary-less route is caught by the rule (DEC-518 technique)", () => {
    // A throwaway route that gets the rule wrong on purpose -- proves
    // cacheabilityViolations actually fires rather than vacuously passing on
    // real routes that all happen to already comply.
    const res = new Response("ok", {
      status: 200,
      headers: { "Cache-Control": "public, max-age=60" },
    });
    const violations = cacheabilityViolations(res, "negative control");
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('Cache-Control="public, max-age=60"');
    expect(violations[0]).toContain("must be");
  });

  it("NEGATIVE CONTROL: a synthetic Vary:Cookie-but-no-store response is also caught (other direction)", () => {
    const res = new Response("nope", {
      status: 404,
      headers: { "Cache-Control": "no-store", Vary: "Cookie" },
    });
    const violations = cacheabilityViolations(res, "negative control 2");
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("must be cacheable");
  });
});

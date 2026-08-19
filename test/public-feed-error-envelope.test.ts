// DEC-841 (wave 17 amendment): a feed/machine surface (the .json/.xml embed
// twins, schedule.ics) that throws an error must get http.ts's JSON
// errorEnvelope, not the HTML public chrome (test/public-error-shell.test.ts
// covers HTML navigations) and not a second, hand-rolled JSON body. The
// classification is a single derived list (FEED_EXTENSIONS + isFeedPath in
// src/routes/public/index.tsx) so a future feed extension can't be forgotten
// the way .json quietly was.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

vi.mock("../src/server/repo/public/home", () => ({
  getHubOrg: vi.fn(async () => null),
  listHubEvents: vi.fn(async () => ({ items: [], capped: false })),
}));

vi.mock("../src/server/repo/public", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/public")>(
    "../src/server/repo/public",
  );

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

  return {
    ...actual,
    getPublicEventBySlug: vi.fn(async (_db: unknown, slug: string) => (slug === EVENT.slug ? EVENT : null)),
    getPublicTracks: vi.fn(async () => []),
    getPublicRooms: vi.fn(async () => []),
    getPublicFormatOptions: vi.fn(async () => []),
    getPublicSessions: vi.fn(async () => ({ items: [], total: 0 })),
    getPublicSpeakers: vi.fn(async () => ({ items: [], total: 0 })),
    getPublicSpeakerDetail: vi.fn(async () => null),
    getPublicAgenda: vi.fn(async () => ({ items: [], total: 0 })),
    getPublicScheduleDayCounts: vi.fn(async () => []),
    getPublicCfpWindow: vi.fn(async () => null),
    getPriorPublicEvent: vi.fn(async () => null),
  };
});

import { publicRoutes, FEED_EXTENSIONS, isFeedPath } from "../src/routes/public";
import { registerErrorHandler } from "../src/server/http";
import { MAX_ITINERARY_IDS } from "../src/lib/itinerary";
import type { AppEnv } from "../src/server/env";
import type { KVStore } from "../src/lib/draft";

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
}

(globalThis as unknown as { caches: { default: InMemoryCache } }).caches = { default: new InMemoryCache() };

function buildApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", {} as AppEnv["Variables"]["db"]);
    await next();
  });
  registerErrorHandler(app);
  app.route("/", publicRoutes);
  const env = { KV: new InMemoryKV() as unknown as AppEnv["Bindings"]["KV"] };
  return {
    request: (path: string, init?: RequestInit) => app.request(path, init, env),
  };
}

function expectFeedEnvelope(body: unknown) {
  expect(body).toMatchObject({
    error: {
      code: expect.any(String),
      message: expect.any(String),
    },
  });
  const bodyText = JSON.stringify(body);
  expect(bodyText).not.toContain("chq-auth-card");
}

describe("FEED_EXTENSIONS derivation guard", () => {
  it("every extension appearing in a registered public route path is covered by FEED_EXTENSIONS", () => {
    // Walks the actual registered Hono routes (including inside a `{...}`
    // param constraint, e.g. `:surface{[a-z]+\.json}`) rather than a
    // hand-typed list, so a future .csv/.rss feed route can't silently fall
    // outside the JSON-envelope classification the way .json did.
    const found = new Set<string>();
    for (const route of publicRoutes.routes) {
      const matches = route.path.match(/\.[a-z]+(?=[}/]|$)/gi) ?? [];
      for (const m of matches) found.add(m.toLowerCase());
    }
    // Sanity: this guard is only meaningful if it actually found extensions
    // to check (a regression that broke route registration would otherwise
    // pass vacuously).
    expect(found.size).toBeGreaterThan(0);
    for (const ext of found) {
      expect(FEED_EXTENSIONS as readonly string[]).toContain(ext);
    }
  });

  it("isFeedPath agrees with FEED_EXTENSIONS for each known feed path", () => {
    expect(isFeedPath("/e/conf/schedule.ics")).toBe(true);
    expect(isFeedPath("/e/conf/agenda.ics")).toBe(true);
    expect(isFeedPath("/embed/conf/sessions.json")).toBe(true);
    expect(isFeedPath("/embed/conf/sessions.xml")).toBe(true);
    expect(isFeedPath("/e/conf/sessions")).toBe(false);
    expect(isFeedPath("/embed/conf/sessions")).toBe(false);
  });
});

describe("DEC-841 (wave 17 amendment): a feed path's thrown error gets the JSON envelope", () => {
  it("a thrown ApiError on /embed/conf/sessions.json returns the JSON envelope, not the public chrome", async () => {
    const { ApiError } = await import("../src/server/http");
    const repo = await import("../src/server/repo/public");
    vi.mocked(repo.getPublicSessions).mockImplementationOnce(async () => {
      throw new ApiError("invalid", "Bad request on purpose");
    });

    const app = buildApp();
    const res = await app.request("/embed/conf/sessions.json");

    expect(res.status).toBe(400);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("content-type")).toMatch(/application\/json/);

    const body = await res.json();
    expect(body).toEqual({ error: { code: "invalid", message: "Bad request on purpose" } });
    expectFeedEnvelope(body);
  });

  it("a thrown ApiError on /embed/conf/sessions.xml returns the JSON envelope, not the public chrome", async () => {
    const { ApiError } = await import("../src/server/http");
    const repo = await import("../src/server/repo/public");
    vi.mocked(repo.getPublicSessions).mockImplementationOnce(async () => {
      throw new ApiError("forbidden", "Nope on purpose");
    });

    const app = buildApp();
    const res = await app.request("/embed/conf/sessions.xml");

    expect(res.status).toBe(403);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("content-type")).toMatch(/application\/json/);

    const body = await res.json();
    expect(body).toEqual({ error: { code: "forbidden", message: "Nope on purpose" } });
    expectFeedEnvelope(body);
  });

  it("the over-cap /e/conf/schedule.ics?ids=... case returns the JSON envelope, not the public chrome", async () => {
    const app = buildApp();
    const ids = Array.from({ length: MAX_ITINERARY_IDS + 1 }, (_, i) => `sub-${i}`).join(",");
    const res = await app.request(`/e/conf/schedule.ics?ids=${ids}`);

    expect(res.status).toBe(400);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("content-type")).toMatch(/application\/json/);

    const body = await res.json();
    expect(body).toMatchObject({ error: { code: "invalid", message: expect.stringContaining("Too many ids") } });
    expectFeedEnvelope(body);
  });

  it("an unexpected (non-ApiError) throw on a feed path logs and returns the internal envelope at 500", async () => {
    const repo = await import("../src/server/repo/public");
    vi.mocked(repo.getPublicSessions).mockImplementationOnce(async () => {
      throw new Error("boom");
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const app = buildApp();
    const res = await app.request("/embed/conf/sessions.json");

    expect(res.status).toBe(500);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("content-type")).toMatch(/application\/json/);

    const body = await res.json();
    expect(body).toEqual({ error: { code: "internal", message: "Internal server error" } });
    expectFeedEnvelope(body);
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});

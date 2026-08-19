// DEC-297: public surfaces must never emit a cacheable non-200. This
// mirrors the vi.mock(../src/server/repo/public) pattern established in
// test/itinerary-roundtrip.test.ts (no local sqlite/D1 test driver is wired
// up — see test/agenda-room-ownership.test.ts) so route handlers, including
// publicNotFound's header override, run for real. getPublicEventBySlug
// returns null for an unknown slug and a real event for a known one.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

// DEC-635 amendment: publicNotFound now resolves its eyebrow via
// resolveNotFoundEyebrow (src/server/not-found.tsx), which reads
// repo/public/home.ts directly -- a separate module from repo/public's
// index below, so it needs its own mock against the {} test db.
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
    // DEC-774: dispatch.tsx's sessions case fetches these two unconditionally
    // (like getPublicTracks above) for the filter chips.
    getPublicRooms: vi.fn(async () => []),
    getPublicFormatOptions: vi.fn(async () => []),
    getPublicSessions: vi.fn(async () => ({ items: [], total: 0 })),
    getPublicSpeakers: vi.fn(async () => ({ items: [], total: 0 })),
    getPublicSpeakerDetail: vi.fn(async () => null),
    getPublicAgenda: vi.fn(async () => ({ items: [], total: 0 })),
    // DEC-683: dispatch.tsx's sessions case fetches these two unconditionally
    // for !embed — mocked here like every other repo call in this file so
    // an unmocked real query never runs against the {} test db.
    getPublicScheduleDayCounts: vi.fn(async () => []),
    getPublicCfpWindow: vi.fn(async () => null),
    getPriorPublicEvent: vi.fn(async () => null),
  };
});

import { publicRoutes } from "../src/routes/public";
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
    // Never reached: the mocked repo functions above don't touch `db`.
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

describe("DEC-297: public 404s are never cacheable", () => {
  it("an unknown event slug's 404 carries Cache-Control: no-store, not max-age=60", async () => {
    const app = buildApp();
    const res = await app.request("/e/does-not-exist/sessions");

    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Cache-Control")).not.toContain("max-age=60");
  });

  it("an unknown speaker's 404 carries Cache-Control: no-store", async () => {
    const app = buildApp();
    const res = await app.request("/e/conf/speakers/nope");

    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("an unknown embed surface's 404 carries Cache-Control: no-store", async () => {
    const app = buildApp();
    const res = await app.request("/embed/conf/not-a-surface");

    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("a known event/surface's 200 still carries the full 60s client cache header", async () => {
    const app = buildApp();
    const res = await app.request("/e/conf/sessions");

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=60, stale-while-revalidate=300");
  });
});

describe("DEC-324: public onError overrides the 60s cache header on non-200s", () => {
  it("an over-cap ?ids= request on schedule.ics is a 400 with Cache-Control: no-store", async () => {
    const app = buildApp();
    const ids = Array.from({ length: MAX_ITINERARY_IDS + 1 }, (_, i) => `sub-${i}`).join(",");
    const res = await app.request(`/e/conf/schedule.ics?ids=${ids}`);

    expect(res.status).toBe(400);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Cache-Control")).not.toContain("max-age=60");
    // DEC-841 (wave 17 amendment): schedule.ics is a FEED path, so its body is
    // the DEC-013 JSON envelope. The no-store header above is what this
    // DEC-324 case is actually about, and it holds either way.
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.message).toContain("Too many ids");
  });

  it("an unexpected repo throw on a public surface is a 500 with Cache-Control: no-store", async () => {
    const repo = await import("../src/server/repo/public");
    vi.mocked(repo.getPublicEventBySlug).mockImplementationOnce(async () => {
      throw new Error("boom");
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const app = buildApp();
    const res = await app.request("/e/conf/speakers");

    expect(res.status).toBe(500);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    // DEC-841 (wave 14): HTML surface -> rendered page, no JSON envelope.
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const body = await res.text();
    expect(body).toContain("Internal server error");

    consoleErrorSpy.mockRestore();
  });
});

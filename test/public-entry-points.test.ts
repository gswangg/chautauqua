// DEC-661: every public surface gets a guessable root. A bare /e/:eventSlug
// or /embed/:eventSlug (no surface segment) must redirect into the sessions
// surface rather than falling through to the app-wide 404 handler. Mirrors
// the vi.mock(../src/server/repo/public) pattern established in
// test/public-404-no-store.test.ts (no local sqlite/D1 test driver is wired
// up — see test/agenda-room-ownership.test.ts).

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

// DEC-635 amendment: publicNotFound now resolves its eyebrow via
// resolveNotFoundEyebrow (src/server/not-found.tsx), which reads
// repo/public/home.ts directly -- a separate module from repo/public's
// index mocked below.
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
    // DEC-745 (wave-107 amendment): the sessions fresh-empty branch's
    // "Last year" probe -- mocked here like every other repo call in this
    // file so an unmocked real query never runs against the {} test db.
    getPriorPublicEvent: vi.fn(async () => null),
  };
});

import { publicRoutes } from "../src/routes/public";
import { registerErrorHandler } from "../src/server/http";
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

describe("DEC-661: guessable public entry-point roots", () => {
  it("GET /e/:eventSlug redirects 302 to the sessions surface for a known event", async () => {
    const app = buildApp();
    const res = await app.request("/e/conf", { redirect: "manual" });

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/e/conf/sessions");
  });

  it("GET /e/:eventSlug 404s (not a redirect) for an unknown event", async () => {
    const app = buildApp();
    const res = await app.request("/e/does-not-exist", { redirect: "manual" });

    expect(res.status).toBe(404);
    expect(res.headers.get("Location")).toBeNull();
  });

  it("GET /embed/:eventSlug redirects 302 to the embed sessions surface for a known event", async () => {
    const app = buildApp();
    const res = await app.request("/embed/conf", { redirect: "manual" });

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/embed/conf/sessions");
  });

  it("GET /embed/:eventSlug 404s (not a redirect) for an unknown event", async () => {
    const app = buildApp();
    const res = await app.request("/embed/does-not-exist", { redirect: "manual" });

    expect(res.status).toBe(404);
    expect(res.headers.get("Location")).toBeNull();
  });
});

describe("DEC-661 regression guard: existing surface routes still resolve unchanged", () => {
  it("GET /e/:eventSlug/sessions still returns 200 (surface loop route untouched)", async () => {
    const app = buildApp();
    const res = await app.request("/e/conf/sessions");

    expect(res.status).toBe(200);
  });

  it("GET /e/:eventSlug/speakers/:contactId still returns 404 for an unknown speaker (route untouched)", async () => {
    const app = buildApp();
    const res = await app.request("/e/conf/speakers/nope");

    expect(res.status).toBe(404);
  });
});

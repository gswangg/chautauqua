// DEC-553: the JSON feed the embed builder advertises (/embed/:slug/
// sessions.json) must actually be fetchable cross-origin from a page like
// ai.engineer, so every public/embed surface's setCacheHeaders() now also
// sets Access-Control-Allow-Origin: *. Mirrors the vi.mock(../src/server/
// repo/public) + Hono app harness established in
// test/public-404-no-store.test.ts (no local sqlite/D1 test driver is
// wired up in this repo).

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

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
    getPublicAgendaByIds: vi.fn(async () => []),
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
import { createBaseApp } from "../src/server/app";
import { CLIENT_CACHE_CONTROL } from "../src/server/pubcache";
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
  // DEC-947: the .ics surfaces resolve their ORGANIZER via
  // resolveIcsOrganizerEmail, which requires MAIL_FROM_EMAIL or
  // DEV_MODE="1" and otherwise throws (DEC-547 policy).
  const env = {
    KV: new InMemoryKV() as unknown as AppEnv["Bindings"]["KV"],
    DEV_MODE: "1",
  } as unknown as AppEnv["Bindings"];
  return {
    request: (path: string, init?: RequestInit) => app.request(path, init, env),
  };
}

describe("DEC-553: public/embed surfaces are cross-origin readable", () => {
  it("an /e/:slug HTML surface carries Access-Control-Allow-Origin: *", async () => {
    const app = buildApp();
    const res = await app.request("/e/conf/sessions");
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("an /embed/:slug/:surface HTML embed carries Access-Control-Allow-Origin: *", async () => {
    const app = buildApp();
    const res = await app.request("/embed/conf/sessions");
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("/embed/:slug/sessions.json carries Access-Control-Allow-Origin: *", async () => {
    const app = buildApp();
    const res = await app.request("/embed/conf/sessions.json");
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("/e/:slug/agenda.ics carries Access-Control-Allow-Origin: *", async () => {
    const app = buildApp();
    const res = await app.request("/e/conf/agenda.ics");
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("/e/:slug/schedule.ics carries Access-Control-Allow-Origin: *", async () => {
    const app = buildApp();
    const res = await app.request("/e/conf/schedule.ics");
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("does not alter the Cache-Control header alongside the new ACAO header", async () => {
    const app = buildApp();
    const res = await app.request("/e/conf/sessions");
    expect(res.headers.get("Cache-Control")).toBe(CLIENT_CACHE_CONTROL);
  });
});

describe("DEC-553: /api/v1 responses never carry Access-Control-Allow-Origin", () => {
  it("the base app's /api/v1 meta endpoint has no ACAO header", async () => {
    const app = createBaseApp();
    const res = await app.request("/api/v1", undefined, {
      KV: new InMemoryKV() as unknown as AppEnv["Bindings"]["KV"],
    } as AppEnv["Bindings"]);
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});

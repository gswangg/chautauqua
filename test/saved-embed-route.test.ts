// DEC-785: GET /embed/e/:embedId resolves the saved embed row -- missing or
// disabled 404s with the SAME designed "not found" page every other unknown
// public route uses; enabled renders the saved surface. Mirrors the
// vi.mock(../src/server/repo/public) + vi.mock(../src/server/repo/embeds)
// pattern established in test/public-404-no-store.test.ts (no local
// sqlite/D1 test driver is wired up).

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

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

const ENABLED_EMBED = {
  id: "emb1",
  orgId: "org1",
  eventId: "ev1",
  name: "Homepage widget",
  surface: "sessions",
  format: "iframe",
  optionsJson: "{}",
  enabled: true,
  createdAt: 1,
  updatedAt: 1,
};

const DISABLED_EMBED = { ...ENABLED_EMBED, id: "emb2", enabled: false };

vi.mock("../src/server/repo/public", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/public")>("../src/server/repo/public");
  return {
    ...actual,
    getPublicEventById: vi.fn(async (_db: unknown, id: string) => (id === EVENT.id ? EVENT : null)),
    getPublicTracks: vi.fn(async () => []),
    getPublicSessions: vi.fn(async () => ({ items: [], total: 0 })),
    getPublicSpeakers: vi.fn(async () => ({ items: [], total: 0 })),
    getPublicScheduleDayCounts: vi.fn(async () => []),
    getPublicCfpWindow: vi.fn(async () => null),
    // DEC-774: the sessions surface also queries the room / format filter
    // vocabularies, so this stub db (which has no .select) must cover them
    // too -- every repo call renderSurfaceContent makes for the saved
    // surface has to be stubbed, or the route 500s.
    getPublicRooms: vi.fn(async () => []),
    getPublicFormatOptions: vi.fn(async () => []),
  };
});

vi.mock("../src/server/repo/embeds", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/embeds")>("../src/server/repo/embeds");
  return {
    ...actual,
    getEmbedById: vi.fn(async (_db: unknown, id: string) => {
      if (id === ENABLED_EMBED.id) return ENABLED_EMBED;
      if (id === DISABLED_EMBED.id) return DISABLED_EMBED;
      return null;
    }),
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

describe("DEC-785: GET /embed/e/:embedId", () => {
  it("404s the designed not-found page for an unknown embed id", async () => {
    const app = buildApp();
    const res = await app.request("/embed/e/does-not-exist");

    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain("That page isn");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("404s the designed not-found page for a disabled embed, not a silently-served page", async () => {
    const app = buildApp();
    const res = await app.request(`/embed/e/${DISABLED_EMBED.id}`);

    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain("That page isn");
  });

  it("renders the saved surface for an enabled embed", async () => {
    const app = buildApp();
    const res = await app.request(`/embed/e/${ENABLED_EMBED.id}`);

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(EVENT.name);
  });

  it("does not collide with the generic /embed/:eventSlug/:surface route (registration order)", async () => {
    const app = buildApp();
    const res = await app.request(`/embed/e/${ENABLED_EMBED.id}`);
    // A generic-route collision would 404 via "Unknown embed surface" (slug
    // "e" isn't a known event) instead of resolving the saved embed.
    expect(res.status).toBe(200);
  });
});

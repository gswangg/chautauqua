// DEC-785/DEC-822/DEC-839: GET /embed/e/:embedId resolves the saved embed
// row -- an unknown id 404s with the SAME designed "not found" page every
// other unknown public route uses; a DISABLED embed returns an empty 200
// (DEC-822's explicit override of DEC-785 -- a page the organiser switched
// off must not shout "not found" on a customer's site); enabled renders the
// saved surface. Mirrors the vi.mock(../src/server/repo/public) +
// vi.mock(../src/server/repo/embeds) pattern established in
// test/public-404-no-store.test.ts (no local sqlite/D1 test driver is wired
// up).

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
  options: {},
  enabled: true,
  createdAt: 1,
  updatedAt: 1,
};

const DISABLED_EMBED = { ...ENABLED_EMBED, id: "emb2", enabled: false };

// DEC-635 amendment: the unknown-embed-id 404 routes through publicNotFound,
// which now resolves its eyebrow via resolveNotFoundEyebrow
// (src/server/not-found.tsx) -- reads repo/public/home.ts directly, a
// separate module from repo/public's index mocked below.
vi.mock("../src/server/repo/public/home", () => ({
  getHubOrg: vi.fn(async () => null),
  listHubEvents: vi.fn(async () => ({ items: [], capped: false })),
}));

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

  // DEC-822 overrides DEC-785: a disabled embed is an intentional blank
  // (an organiser switched it off), not a 404 — a 404 inside someone
  // else's iframe would read as a broken customer page. Wave-59 amendment:
  // the blank is a MINIMAL designed document (a single quiet line), not a
  // literal empty body, and it must never name the event or the surface
  // (the check runs before getPublicEventById -- a withdrawn embed leaks
  // nothing).
  it("returns a minimal designed 200 for a disabled embed -- an intentional blank, not a 404 (DEC-822)", async () => {
    const app = buildApp();
    const res = await app.request(`/embed/e/${DISABLED_EMBED.id}`);

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("This embed has been turned off.");
    expect(html).not.toContain("That page isn");
    expect(html).not.toContain(EVENT.name);
    // The body (not the shared, value-free stylesheet, which legitimately
    // mentions surface names in unrelated class names/comments) must name
    // neither the event nor the surface -- the check runs before
    // getPublicEventById, so this is a body-content assertion, not a
    // full-document one.
    const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)![1]!;
    expect(body).not.toContain(DISABLED_EMBED.surface);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    // DEC-822: a switched-off embed keeps the same cache headers as a live
    // one -- unlike publicNotFound, which forces no-store.
    expect(res.headers.get("Cache-Control")).not.toBeNull();
    expect(res.headers.get("Cache-Control")).not.toBe("no-store");
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

// DEC-850: the saved id resolves in its SAVED format, not always HTML.
describe("DEC-850: GET /embed/e/:embedId honours the saved format", () => {
  const JSON_EMBED = {
    ...ENABLED_EMBED,
    id: "emb-json",
    format: "json",
    options: { trackId: "trk1", sessionFormat: "talk", roomId: "room1", day: "2026-08-10", q: "keynote", limit: 5, fields: ["room", "track"], accent: "#ff0000" },
  };
  const XML_EMBED = { ...JSON_EMBED, id: "emb-xml", format: "xml" };
  const ICS_EMBED = { ...ENABLED_EMBED, id: "emb-ics", surface: "agenda", format: "ics", options: { day: "2026-08-10", accent: "#ff0000" } };
  const IFRAME_EMBED = { ...ENABLED_EMBED, id: "emb-iframe", format: "iframe" };

  it("json format redirects to the surface's .json feed twin with saved options as query params", async () => {
    // extend the mocked getEmbedById to also resolve this embed id
    const repo = await import("../src/server/repo/embeds");
    vi.mocked(repo.getEmbedById).mockImplementation(async (_db: unknown, id: string) => {
      if (id === JSON_EMBED.id) return JSON_EMBED as any;
      if (id === XML_EMBED.id) return XML_EMBED as any;
      if (id === ICS_EMBED.id) return ICS_EMBED as any;
      if (id === IFRAME_EMBED.id) return IFRAME_EMBED as any;
      if (id === ENABLED_EMBED.id) return ENABLED_EMBED as any;
      if (id === DISABLED_EMBED.id) return DISABLED_EMBED as any;
      return null;
    });

    const app = buildApp();
    const res = await app.request(`/embed/e/${JSON_EMBED.id}`, { redirect: "manual" });

    expect(res.status).toBe(302);
    const location = res.headers.get("Location")!;
    expect(location.startsWith("/embed/conf/sessions.json?")).toBe(true);
    const params = new URLSearchParams(location.split("?")[1]);
    expect(params.get("trackId")).toBe("trk1");
    expect(params.get("format")).toBe("talk");
    expect(params.get("roomId")).toBe("room1");
    expect(params.get("day")).toBe("2026-08-10");
    expect(params.get("q")).toBe("keynote");
    expect(params.get("limit")).toBe("5");
    expect(params.get("fields")).toBe("room,track");
    expect(params.get("accent")).toBe("ff0000");
  });

  it("xml format redirects to the surface's .xml feed twin", async () => {
    const app = buildApp();
    const res = await app.request(`/embed/e/${XML_EMBED.id}`, { redirect: "manual" });

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toMatch(/^\/embed\/conf\/sessions\.xml\?/);
  });

  it("ics format redirects to the fixed whole-agenda route, ignoring surface-specific options", async () => {
    const app = buildApp();
    const res = await app.request(`/embed/e/${ICS_EMBED.id}`, { redirect: "manual" });

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/e/conf/agenda.ics");
  });

  it("iframe format still renders inline as before", async () => {
    const app = buildApp();
    const res = await app.request(`/embed/e/${IFRAME_EMBED.id}`);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain(EVENT.name);
  });
});

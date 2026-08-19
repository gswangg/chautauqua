// DEC-635 (amendment): ONE not-found card, one component. Both 404
// surfaces -- the app.notFound() catch-all (src/server/not-found.tsx) and
// the public routes' publicNotFound (src/routes/public/not-found.tsx) --
// render the exact same NotFoundDocument: same title, same noindex meta,
// exactly one <main class="chq-bare-page chq-auth-card-notice"> (DEC-945
// wave-48 amendment: the bare 820px reading-page shell, no card border)
// with no wrapping <div class="chq-auth-card">, and both footer links. Mirrors the
// vi.mock(../src/server/repo/public) pattern from
// test/public-404-no-store.test.ts so route handlers, including
// publicNotFound's header override, run for real.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

// resolveNotFoundEyebrow (src/server/not-found.tsx) reads
// repo/public/home.ts directly -- a separate module from repo/public's
// index, so it needs its own mock; the fake db set below has no real
// select() to run getHubOrg/listHubEvents against.
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

import { publicRoutes } from "../src/routes/public";
import { registerErrorHandler } from "../src/server/http";
import { registerNotFoundHandler } from "../src/server/not-found";
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
  registerNotFoundHandler(app);
  const env = { KV: new InMemoryKV() as unknown as AppEnv["Bindings"]["KV"] };
  return {
    request: (path: string, init?: RequestInit) => app.request(path, init, env),
  };
}

/** Shared assertions both 404 surfaces must satisfy: same title, same
 * noindex meta, exactly one card <main>, no wrapping <div class="chq-auth-
 * card">, and both footer links -- i.e. ONE NOT-FOUND CARD, ONE COMPONENT. */
function expectSharedCardMarkup(body: string) {
  expect(body).toContain("<title>Not found - Chautauqua</title>");
  expect(body).toContain('<meta name="robots" content="noindex"');
  expect(body).not.toContain('<div class="chq-auth-card"');
  const mainMatches = body.match(/<main class="chq-bare-page chq-auth-card-notice">/g) ?? [];
  expect(mainMatches).toHaveLength(1);
  expect(body).toContain('href="/">Go to the homepage');
  expect(body).toContain('href="/login">Log in');
}

describe("DEC-635 amendment: one not-found card, one component", () => {
  it("the app.notFound() catch-all (unmatched path) renders the shared card", async () => {
    const app = buildApp();
    const res = await app.request("/this-route-does-not-exist");

    expect(res.status).toBe(404);
    const body = await res.text();
    expectSharedCardMarkup(body);
  });

  it("the public routes' 404 (bad event slug) is a 404 with no-store and the shared card", async () => {
    const app = buildApp();
    const res = await app.request("/e/does-not-exist/sessions");

    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("no-store");

    const body = await res.text();
    expect(body).toContain("That page isn&#39;t here");
    expectSharedCardMarkup(body);
  });
});

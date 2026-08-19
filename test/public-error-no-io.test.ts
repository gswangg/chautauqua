// DEC-635 (wave 17 amendment): publicErrorDocument must render with ZERO
// database reads. onError may be firing BECAUSE the database is unreachable
// -- if the error card itself awaited a DB read for its eyebrow (as it used
// to, via resolveNotFoundEyebrow(c.var.db)), that read would also reject,
// turning the card into a rejected promise and handing the visitor the
// runtime's bare 500 instead. This test proves the card renders even when
// the hub readers (getHubOrg/listHubEvents) throw, and that they are never
// even called on this path.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

vi.mock("../src/server/repo/public/home", () => ({
  getHubOrg: vi.fn(async () => {
    throw new Error("hub org read boom");
  }),
  listHubEvents: vi.fn(async () => {
    throw new Error("hub events read boom");
  }),
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

describe("DEC-635 (wave 17 amendment): the public error card renders with zero database reads", () => {
  it("a repo throw still renders the error card even when the hub readers also throw, and never calls them", async () => {
    const repo = await import("../src/server/repo/public");
    vi.mocked(repo.getPublicEventBySlug).mockImplementationOnce(async () => {
      throw new Error("boom");
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const app = buildApp();
    const res = await app.request("/e/conf/speakers");

    expect(res.status).toBe(500);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("content-type")).toMatch(/text\/html/);

    const body = await res.text();
    expect(body).toContain('role="alert"');
    expect(body).toContain("Something went wrong");
    const mainMatches =
      body.match(/<main class="chq-bare-page chq-auth-card-notice">/g) ?? [];
    expect(mainMatches).toHaveLength(1);
    expect(body).toContain('href="/e/conf/sessions">Back to the event');
    expect(body).toContain('href="/">Go to the homepage');
    expect(body).toContain('href="/login">Log in');

    const home = await import("../src/server/repo/public/home");
    expect(home.getHubOrg).not.toHaveBeenCalled();
    expect(home.listHubEvents).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});

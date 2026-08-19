// DEC-841 (wave 16 amendment): a public 500/thrown error wears the SAME
// public chrome publicNotFound's 404 does -- not http.ts's bare <p
// role=alert> document. Mirrors the vi.mock(../src/server/repo/public)
// pattern from test/public-404-no-store.test.ts so route handlers,
// including the onError override, run for real.

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

/** The same chrome markers test/public-not-found-card.test.ts's
 * expectSharedCardMarkup asserts for the 404 twin: exactly one card <main>,
 * no wrapping <div class="chq-auth-card">, and both anonymous footer links
 * present (the error card also includes an event-back link ahead of them). */
function expectPublicChrome(body: string) {
  expect(body).not.toContain('<div class="chq-auth-card"');
  const mainMatches =
    body.match(/<main class="chq-bare-page chq-auth-card-notice">/g) ?? [];
  expect(mainMatches).toHaveLength(1);
  expect(body).toContain('href="/">Go to the homepage');
  expect(body).toContain('href="/login">Log in');
}

describe("DEC-841 (wave 16 amendment): a public 500 wears the public shell", () => {
  it("an unexpected repo throw on a public HTML surface renders the full public chrome, not a bare error page", async () => {
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
    expect(body).not.toContain('{"error":');
    expect(body).toContain('role="alert"');
    expect(body).toContain("Internal server error");
    expect(body).toContain('href="/e/conf/sessions">Back to the event');
    expectPublicChrome(body);

    consoleErrorSpy.mockRestore();
  });

  it("a thrown ApiError on a public HTML surface renders the chrome at the ApiError's own status", async () => {
    // schedule.ics itself is a feed path (excluded below), so exercise the
    // same ApiError('invalid', ...) path through an ordinary HTML surface by
    // forcing getPublicEventBySlug's caller (the sessions route) to throw an
    // ApiError instead of a bare Error.
    const { ApiError } = await import("../src/server/http");
    const repo = await import("../src/server/repo/public");
    vi.mocked(repo.getPublicEventBySlug).mockImplementationOnce(async () => {
      throw new ApiError("invalid", "Bad request on purpose");
    });

    const app = buildApp();
    const res = await app.request("/e/conf/speakers");

    expect(res.status).toBe(400);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("content-type")).toMatch(/text\/html/);

    const body = await res.text();
    expect(body).not.toContain('{"error":');
    expect(body).toContain('role="alert"');
    expect(body).toContain("Bad request on purpose");
    expectPublicChrome(body);
  });

  it("a non-HTML public path (.ics over the id cap) gets the JSON envelope, not the HTML chrome or bare page", async () => {
    // DEC-841 (wave 17 amendment): a feed path is a machine surface -- it
    // gets http.ts's errorEnvelope JSON body, never an HTML document (bare
    // or chromed).
    const app = buildApp();
    const ids = Array.from({ length: MAX_ITINERARY_IDS + 1 }, (_, i) => `sub-${i}`).join(",");
    const res = await app.request(`/e/conf/schedule.ics?ids=${ids}`);

    expect(res.status).toBe(400);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("content-type")).toMatch(/application\/json/);

    const body = await res.json();
    expect(body).toMatchObject({ error: { code: "invalid", message: expect.stringContaining("Too many ids") } });
    const bodyText = JSON.stringify(body);
    expect(bodyText).not.toContain("chq-auth-card");
  });
});

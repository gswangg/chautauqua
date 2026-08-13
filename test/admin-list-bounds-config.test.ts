// DEC-460/DEC-461 coverage: the three per-user/per-event config list
// endpoints (saved views, API tokens, comms templates) previously returned
// every row unbounded with a cosmetic { page: 1, perPage: items.length }
// envelope. Each now takes real page/perPage query params, clamps perPage
// to [1, 200] with a site default of 200 (not clampPerPage's own 50) when
// the param is absent or invalid, and reports a `total` from an independent
// count that ignores the current page slice.
//
// Route-level, repo functions mocked (this repo's test harness runs vitest
// in plain node with no D1/miniflare binding — see test/resource-file.test.ts
// and friends: every repo module is tested only at its pure boundary or via
// a mocked repo, never against a live Db). The tokens list route runs its
// query inline (no repo fn) so it's exercised against a minimal fake
// query-builder standing in for `Db` instead.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";
const AUTH: AuthInfo = { userId: "u1", role: "organizer", orgId: ORG_A };

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

// ---------------------------------------------------------------------------
// GET /api/v1/events/:eventId/views
// ---------------------------------------------------------------------------

describe("GET /api/v1/events/:eventId/views (DEC-460/461 bounds)", () => {
  const allViews = Array.from({ length: 5 }, (_, i) => ({
    id: `view-${i}`,
    eventId: "event-a",
    name: `View ${i}`,
    config: { q: "", status: [], trackId: null, sort: "newest", columns: [] },
    createdAt: i,
    updatedAt: i,
  }));

  async function buildApp() {
    vi.doMock("../src/server/repo/submissions", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/submissions")>(
        "../src/server/repo/submissions",
      );
      return { ...actual, getEventOrgId: vi.fn(async () => ORG_A) };
    });
    vi.doMock("../src/server/repo/views", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/views")>("../src/server/repo/views");
      return {
        ...actual,
        listSavedViews: vi.fn(
          async (
            _db: unknown,
            _eventId: string,
            _viewerUserId: string,
            page?: { limit: number; offset: number },
          ) => (page ? allViews.slice(page.offset, page.offset + page.limit) : allViews),
        ),
        countSavedViews: vi.fn(async () => allViews.length),
      };
    });
    const { viewsRoutes } = await import("../src/routes/api/views");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", AUTH);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/v1", viewsRoutes);
    return app;
  }

  it("perPage=100000 is clamped to at most 200 (would return all 5 seeded rows unclamped)", async () => {
    const app = await buildApp();
    const res = await app.request("/api/v1/events/event-a/views?perPage=100000");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[]; total: number; page: number; perPage: number };
    expect(body.perPage).toBe(200);
    expect(body.items.length).toBeLessThanOrEqual(200);
  });

  it("perPage=abc (non-numeric) falls back to the 200 default, not clampPerPage's own 50", async () => {
    const app = await buildApp();
    const res = await app.request("/api/v1/events/event-a/views?perPage=abc");
    const body = (await res.json()) as { perPage: number };
    expect(body.perPage).toBe(200);
  });

  it("page=2 offsets into the result set", async () => {
    const app = await buildApp();
    const res = await app.request("/api/v1/events/event-a/views?perPage=2&page=2");
    const body = (await res.json()) as { items: { id: string }[] };
    expect(body.items.map((v) => v.id)).toEqual(["view-2", "view-3"]);
  });

  it("total reflects the full count regardless of the page slice", async () => {
    const app = await buildApp();
    const res = await app.request("/api/v1/events/event-a/views?perPage=2&page=1");
    const body = (await res.json()) as { total: number; items: unknown[] };
    expect(body.total).toBe(5);
    expect(body.items.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/events/:eventId/templates
// ---------------------------------------------------------------------------

describe("GET /api/v1/events/:eventId/templates (DEC-460/461 bounds)", () => {
  const allTemplates = Array.from({ length: 5 }, (_, i) => ({
    id: `tpl-${i}`,
    eventId: "event-a",
    name: `Template ${i}`,
    subject: "Hi",
    bodyText: "Body",
    createdAt: i,
    updatedAt: i,
  }));

  async function buildApp() {
    vi.doMock("../src/server/repo/events", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
      return {
        ...actual,
        getEventForOrg: vi.fn(async () => ({
          id: "event-a",
          orgId: ORG_A,
          name: "Event A",
          slug: "event-a",
          startDate: "2026-06-01",
          endDate: "2026-06-03",
          location: null,
          timezone: "UTC",
          recordPrefix: "A",
          branding: null,
          createdAt: 0,
          updatedAt: 0,
        })),
      };
    });
    vi.doMock("../src/server/repo/comms", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/comms")>("../src/server/repo/comms");
      return {
        ...actual,
        listTemplates: vi.fn(async (_db: unknown, _eventId: string, page?: { limit: number; offset: number }) =>
          page ? allTemplates.slice(page.offset, page.offset + page.limit) : allTemplates,
        ),
        countTemplates: vi.fn(async () => allTemplates.length),
      };
    });
    // DEC-890: the templates list also joins a "Last used" aggregate --
    // mocked here (not exercised by this file's page/perPage bounds focus).
    vi.doMock("../src/server/repo/email", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/email")>("../src/server/repo/email");
      return {
        ...actual,
        listTemplateLastUsedAt: vi.fn(async () => new Map<string, number>()),
      };
    });
    const { commsRoutes } = await import("../src/routes/comms");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", AUTH);
      c.set("db", {} as never);
      await next();
    });
    app.route("/", commsRoutes);
    return app;
  }

  it("perPage=100000 is clamped to at most 200", async () => {
    const app = await buildApp();
    const res = await app.request("/api/v1/events/event-a/templates?perPage=100000");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { perPage: number; items: unknown[] };
    expect(body.perPage).toBe(200);
    expect(body.items.length).toBeLessThanOrEqual(200);
  });

  it("perPage=abc falls back to the 200 default", async () => {
    const app = await buildApp();
    const res = await app.request("/api/v1/events/event-a/templates?perPage=abc");
    const body = (await res.json()) as { perPage: number };
    expect(body.perPage).toBe(200);
  });

  it("page=2 offsets into the result set", async () => {
    const app = await buildApp();
    const res = await app.request("/api/v1/events/event-a/templates?perPage=2&page=2");
    const body = (await res.json()) as { items: { id: string }[] };
    expect(body.items.map((t) => t.id)).toEqual(["tpl-2", "tpl-3"]);
  });

  it("total reflects the full count regardless of the page slice", async () => {
    const app = await buildApp();
    const res = await app.request("/api/v1/events/event-a/templates?perPage=2&page=1");
    const body = (await res.json()) as { total: number; items: unknown[] };
    expect(body.total).toBe(5);
    expect(body.items.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/tokens — inline org-scoped query (no repo fn), exercised
// against a minimal fake query-builder standing in for Db.
// ---------------------------------------------------------------------------

interface FakeTokenRow {
  id: string;
  name: string;
  tokenPrefix: string;
  lastUsedAt: null;
  orgId: string;
}

function makeFakeTokenDb(rows: FakeTokenRow[]) {
  return {
    select(fields: Record<string, unknown>) {
      const isCount = "count" in fields;
      return {
        from(_table: unknown) {
          return {
            where(_cond: unknown) {
              if (isCount) {
                return Promise.resolve([{ count: rows.length }]);
              }
              return {
                orderBy(..._cols: unknown[]) {
                  return {
                    limit(n: number) {
                      return {
                        offset(o: number) {
                          return Promise.resolve(rows.slice(o, o + n));
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

describe("GET /api/v1/tokens (DEC-460/461 bounds)", () => {
  const allTokens: FakeTokenRow[] = Array.from({ length: 5 }, (_, i) => ({
    id: `tok-${i}`,
    name: `Token ${i}`,
    tokenPrefix: `chq_${i}`,
    lastUsedAt: null,
    orgId: ORG_A,
  }));

  async function buildApp() {
    const { tokensRoutes } = await import("../src/routes/api/tokens");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", AUTH);
      c.set("db", makeFakeTokenDb(allTokens) as never);
      await next();
    });
    app.route("/", tokensRoutes);
    return app;
  }

  it("perPage=100000 is clamped to at most 200", async () => {
    const app = await buildApp();
    const res = await app.request("/api/v1/tokens?perPage=100000");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { perPage: number; items: unknown[] };
    expect(body.perPage).toBe(200);
    expect(body.items.length).toBeLessThanOrEqual(200);
  });

  it("perPage=abc falls back to the 200 default", async () => {
    const app = await buildApp();
    const res = await app.request("/api/v1/tokens?perPage=abc");
    const body = (await res.json()) as { perPage: number };
    expect(body.perPage).toBe(200);
  });

  it("page=2 offsets into the result set", async () => {
    const app = await buildApp();
    const res = await app.request("/api/v1/tokens?perPage=2&page=2");
    const body = (await res.json()) as { items: { id: string }[] };
    expect(body.items.map((t) => t.id)).toEqual(["tok-2", "tok-3"]);
  });

  it("total reflects the full count regardless of the page slice", async () => {
    const app = await buildApp();
    const res = await app.request("/api/v1/tokens?perPage=2&page=1");
    const body = (await res.json()) as { total: number; items: unknown[] };
    expect(body.total).toBe(5);
    expect(body.items.length).toBe(2);
  });
});

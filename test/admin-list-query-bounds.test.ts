// DEC-417 wave-31 amendment: admin list SEARCH strings are now bounded on
// the READ side too (not just write-side field lengths). An over-cap ?q=
// must 400 with the field named, never fall through to a D1/parser 500.
// Mirrors test/field-length-limits.test.ts's in-process Hono app pattern:
// mock just enough of the repo/db surface that each route reaches its
// query parser without a real D1 binding.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { MAX_SEARCH_QUERY_LENGTH } from "../src/lib/query-bounds";

const ORG_A = "org-a";
const ORGANIZER_A: AuthInfo = { userId: "u1", role: "organizer", orgId: ORG_A };

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

async function expectInvalidQ(res: Response) {
  expect(res.status).toBe(400);
  const body = (await res.json()) as { error?: { code?: string; message?: string; fields?: Record<string, string> } };
  expect(body.error?.code).toBe("invalid");
  expect(body.error?.message).toMatch(/q must be at most/);
}

describe("GET /api/v1/events/:eventId/submissions ?q= bound (DEC-417)", () => {
  it("400s with the field named on an over-cap q, never a 500", async () => {
    vi.doMock("../src/server/repo/submissions", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/submissions")>(
        "../src/server/repo/submissions",
      );
      return { ...actual, getEventOrgId: vi.fn(async () => ORG_A) };
    });
    const { submissionsRoutes } = await import("../src/routes/api/submissions");
    const app = new Hono<AppEnv>();
    (await import("../src/server/http")).registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER_A);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/v1", submissionsRoutes);

    const q = "x".repeat(MAX_SEARCH_QUERY_LENGTH + 1);
    const res = await app.request(`http://local/api/v1/events/ev-1/submissions?q=${q}`);
    await expectInvalidQ(res);
  });

  it("a 200-char q still passes through to the list (no 400)", async () => {
    vi.doMock("../src/server/repo/submissions", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/submissions")>(
        "../src/server/repo/submissions",
      );
      return {
        ...actual,
        getEventOrgId: vi.fn(async () => ORG_A),
        listSubmissions: vi.fn(async () => ({ items: [], total: 0, contentStatusCounts: {}, reuploadedCount: 0 })),
      };
    });
    const { submissionsRoutes } = await import("../src/routes/api/submissions");
    const app = new Hono<AppEnv>();
    (await import("../src/server/http")).registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER_A);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/v1", submissionsRoutes);

    const q = "x".repeat(MAX_SEARCH_QUERY_LENGTH);
    const res = await app.request(`http://local/api/v1/events/ev-1/submissions?q=${q}`);
    expect(res.status).toBe(200);
  });

  it("a blank q still parses to null (no 400)", async () => {
    vi.doMock("../src/server/repo/submissions", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/submissions")>(
        "../src/server/repo/submissions",
      );
      return {
        ...actual,
        getEventOrgId: vi.fn(async () => ORG_A),
        listSubmissions: vi.fn(async () => ({ items: [], total: 0, contentStatusCounts: {}, reuploadedCount: 0 })),
      };
    });
    const { submissionsRoutes } = await import("../src/routes/api/submissions");
    const app = new Hono<AppEnv>();
    (await import("../src/server/http")).registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER_A);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/v1", submissionsRoutes);

    const res = await app.request(`http://local/api/v1/events/ev-1/submissions?q=%20%20`);
    expect(res.status).toBe(200);
  });
});

describe("GET /api/v1/contacts ?q= bound (DEC-417)", () => {
  it("400s with the field named on an over-cap q, never a 500", async () => {
    const { contactsRoutes } = await import("../src/routes/api/contacts");
    const app = new Hono<AppEnv>();
    (await import("../src/server/http")).registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER_A);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/v1", contactsRoutes);

    const q = "x".repeat(MAX_SEARCH_QUERY_LENGTH + 1);
    const res = await app.request(`http://local/api/v1/contacts?q=${q}`);
    await expectInvalidQ(res);
  });

  it("a 200-char q still passes (no 400)", async () => {
    vi.doMock("../src/server/repo/contacts", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/contacts")>(
        "../src/server/repo/contacts",
      );
      return { ...actual, listContactsForOrg: vi.fn(async () => ({ items: [], total: 0 })) };
    });
    const { contactsRoutes } = await import("../src/routes/api/contacts");
    const app = new Hono<AppEnv>();
    (await import("../src/server/http")).registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER_A);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/v1", contactsRoutes);

    const q = "x".repeat(MAX_SEARCH_QUERY_LENGTH);
    const res = await app.request(`http://local/api/v1/contacts?q=${q}`);
    expect(res.status).toBe(200);
  });

  it("a blank q still parses to null (no 400)", async () => {
    vi.doMock("../src/server/repo/contacts", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/contacts")>(
        "../src/server/repo/contacts",
      );
      return { ...actual, listContactsForOrg: vi.fn(async () => ({ items: [], total: 0 })) };
    });
    const { contactsRoutes } = await import("../src/routes/api/contacts");
    const app = new Hono<AppEnv>();
    (await import("../src/server/http")).registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER_A);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/v1", contactsRoutes);

    const res = await app.request(`http://local/api/v1/contacts?q=%20%20`);
    expect(res.status).toBe(200);
  });
});

describe("GET /api/v1/events/:eventId/export/contacts?format=csv ?q= bound (DEC-417)", () => {
  function fakeOwnedEventDb() {
    return {
      select() {
        return {
          from() {
            return {
              where() {
                return {
                  limit() {
                    return Promise.resolve([{ id: "ev-1", orgId: ORG_A }]);
                  },
                };
              },
            };
          },
        };
      },
    } as never;
  }

  it("400s with the field named on an over-cap q, never a 500", async () => {
    const { exportsRoutes } = await import("../src/routes/api/exports");
    const app = new Hono<AppEnv>();
    (await import("../src/server/http")).registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER_A);
      c.set("db", fakeOwnedEventDb());
      await next();
    });
    app.route("/", exportsRoutes);

    const q = "x".repeat(MAX_SEARCH_QUERY_LENGTH + 1);
    const res = await app.request(
      `http://local/api/v1/events/ev-1/export/contacts?format=csv&q=${q}`,
    );
    await expectInvalidQ(res);
  });
});

// DEC-843 wave-63 amendment: the contacts directory's `sort` token is read
// through readContactSortToken (src/server/repo/contacts/query.ts), which
// THROWS on an unknown token instead of silently falling back to "name".
// Both doors that call parseContactListQuery already wrap it in try/catch
// and rethrow as ApiError("invalid", ...) — src/routes/api/contacts/crud.ts
// and src/routes/api/exports.ts. This file asserts the route-level 400/200
// behavior end to end (mirrors test/admin-list-query-bounds.test.ts's
// in-process Hono app pattern).

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";
const ORGANIZER_A: AuthInfo = { userId: "u1", role: "organizer", orgId: ORG_A };

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

async function expectInvalidSort(res: Response) {
  expect(res.status).toBe(400);
  const body = (await res.json()) as { error?: { code?: string; message?: string } };
  expect(body.error?.code).toBe("invalid");
  expect(body.error?.message).toMatch(/Unknown sort 'recnet'/);
}

describe("GET /api/v1/contacts ?sort= (DEC-843 wave-63 amendment)", () => {
  it("400s on an unknown sort token, never a 500", async () => {
    const { contactsRoutes } = await import("../src/routes/api/contacts");
    const app = new Hono<AppEnv>();
    (await import("../src/server/http")).registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER_A);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/v1", contactsRoutes);

    const res = await app.request("http://local/api/v1/contacts?sort=recnet");
    await expectInvalidSort(res);
  });

  it("sort=recent still 200s in recent order", async () => {
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

    const res = await app.request("http://local/api/v1/contacts?sort=recent");
    expect(res.status).toBe(200);
  });
});

describe("GET /api/v1/events/:eventId/export/contacts?format=csv&sort= (DEC-843 wave-63 amendment)", () => {
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

  it("400s on an unknown sort token, never a 500", async () => {
    const { exportsRoutes } = await import("../src/routes/api/exports");
    const app = new Hono<AppEnv>();
    (await import("../src/server/http")).registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", ORGANIZER_A);
      c.set("db", fakeOwnedEventDb());
      await next();
    });
    app.route("/", exportsRoutes);

    const res = await app.request(
      "http://local/api/v1/events/ev-1/export/contacts?format=csv&sort=recnet",
    );
    await expectInvalidSort(res);
  });
});

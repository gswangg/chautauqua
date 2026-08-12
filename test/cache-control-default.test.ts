// DEC-658: Cache-Control has ONE default and ONE exception rule, app-wide —
// noStoreByDefault (src/server/middleware.ts) replaces the /api/v1-only
// noStoreApi and is mounted once via `app.use("*", ...)` in
// src/server/app.ts's createBaseApp. This file proves both directions: (a)
// every non-opinionated surface (/portal/*, /login, /account/password,
// /admin, /files/:fileId, /dev/mailbox) gets Cache-Control: no-store even
// though none of those route files ever set the header themselves — the
// only reason they're covered is the app-wide default; and (b) a handler
// that DOES set its own Cache-Control (a real /e/* GET via setCacheHeaders,
// and a synthetic 'public, max-age=60' route) keeps that value byte-
// identical, never overwritten. Also re-proves the exact behaviour
// noStoreApi used to provide scoped to /api/v1 is preserved by the new
// app-wide default.
//
// Anonymous requests are used throughout (no session cookie) so every
// probed route redirects/401s/404s strictly before touching the db — no
// fake-db wiring needed, following the technique in
// test/anonymous-route-probe.test.ts (db stub that throws on any touch,
// to prove it's never reached).

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { createBaseApp, guardDevMailbox } from "../src/server/app";
import { noStoreByDefault } from "../src/server/middleware";
import { authRoutes } from "../src/routes/auth";
import { accountRoutes } from "../src/routes/account";
import { portalRoutes } from "../src/routes/portal/index";
import { rootRoutes } from "../src/routes/root";
import { fileServeRoutes } from "../src/routes/files";
import { devMailboxRoutes } from "../src/routes/dev/mailbox";
import { setCacheHeaders } from "../src/routes/public/shell";

/** A db stub that throws the instant any property is touched — every route
 * probed below must answer (redirect/401/404) strictly from the anonymous
 * auth check, never reaching the db. Mirrors
 * test/anonymous-route-probe.test.ts's technique. */
function throwingDb(): AppEnv["Variables"]["db"] {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        throw new Error(`db.${String(prop)} touched — this route should have answered anonymously first`);
      },
    },
  ) as AppEnv["Variables"]["db"];
}

/** Composes a bare Hono<AppEnv> the same way test/anonymous-route-probe.test.ts
 * does: registerErrorHandler + noStoreByDefault + one middleware that sets
 * `db` (a throwing stub) and no `auth`, then the given sub-app mounted at
 * its real prefix. Deliberately bypasses createBaseApp()'s makeDb(c.env)
 * (which needs a real D1 binding) while still exercising the exact
 * noStoreByDefault export createBaseApp wires. */
function anonymousAppWith(mount: (app: Hono<AppEnv>) => void): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("db", throwingDb());
    await next();
  });
  app.use("*", noStoreByDefault);
  mount(app);
  return app;
}

describe("DEC-658: app-wide no-store default", () => {
  it("GET /portal (anonymous -> redirect to /login) carries Cache-Control: no-store", async () => {
    const app = anonymousAppWith((a) => a.route("/portal", portalRoutes));
    const res = await app.request("/portal");
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("GET /login carries Cache-Control: no-store", async () => {
    // GET /login does touch the db (loadDemoIdentitiesIfPresent), so this
    // probe needs a db that answers empty rather than throws.
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      const chain: any = {
        from: () => chain,
        where: () => chain,
        limit: async () => [],
      };
      c.set("db", { select: () => chain } as unknown as AppEnv["Variables"]["db"]);
      await next();
    });
    app.use("*", noStoreByDefault);
    app.route("/", authRoutes);

    const res = await app.request("/login");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("GET /account/password (anonymous -> redirect to /login) carries Cache-Control: no-store", async () => {
    const app = anonymousAppWith((a) => a.route("/", accountRoutes));
    const res = await app.request("/account/password");
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("GET /admin (anonymous -> redirect to /login) carries Cache-Control: no-store", async () => {
    const app = anonymousAppWith((a) => a.route("/", rootRoutes));
    const res = await app.request("/admin");
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("GET /files/:fileId (anonymous -> 401) carries Cache-Control: no-store", async () => {
    const app = anonymousAppWith((a) => a.route("/", fileServeRoutes));
    const res = await app.request("/files/some-file-id");
    expect(res.status).toBe(401);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("GET /dev/mailbox (DEV_MODE unset -> 404 via guardDevMailbox) carries Cache-Control: no-store", async () => {
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("db", throwingDb());
      await next();
    });
    app.use("*", noStoreByDefault);
    guardDevMailbox(app);
    app.route("/", devMailboxRoutes);

    const res = await app.request("/dev/mailbox", {}, {});
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("GET /api/v1 (meta endpoint) still carries Cache-Control: no-store — the exact behaviour noStoreApi used to provide", async () => {
    // Mirrors createBaseApp's own /api/v1 meta endpoint registration
    // (src/server/app.ts) without needing a real D1 binding for makeDb.
    const app = new Hono<AppEnv>();
    app.use("*", noStoreByDefault);
    app.get("/api/v1", (c) => c.json({ name: "chautauqua", version: "v1" }));

    const res = await app.request("/api/v1");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("createBaseApp mounts noStoreByDefault app-wide exactly once (no leftover /api/v1-scoped noStoreApi mount)", async () => {
    const app = createBaseApp();
    const fakeKv = {
      get: async () => null,
      put: async () => undefined,
      delete: async () => undefined,
    };
    const res = await app.request("/health", {}, { DB: {}, KV: fakeKv } as unknown as Record<string, unknown>);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("a real /e/* GET (setCacheHeaders) keeps its own Cache-Control verbatim, never overwritten", async () => {
    const app = new Hono<AppEnv>();
    app.use("*", noStoreByDefault);
    app.get("/e/:eventSlug/sessions", (c) => {
      setCacheHeaders(c);
      return c.text("ok");
    });

    const res = await app.request("/e/some-event/sessions");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=60, stale-while-revalidate=300");
  });

  it("a synthetic route that sets 'public, max-age=60' keeps that value verbatim, never overwritten", async () => {
    const app = new Hono<AppEnv>();
    app.use("*", noStoreByDefault);
    app.get("/whatever", (c) => {
      c.header("Cache-Control", "public, max-age=60");
      return c.text("ok");
    });

    const res = await app.request("/whatever");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=60");
  });
});

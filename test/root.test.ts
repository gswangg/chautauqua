// DEC-049: /admin served through the Worker with role redirects; GET / is
// an SSR landing. Route/query-gate verification against real D1 happens via
// wrangler dev per DEC-012 (see test/public.test.ts) — this exercises the
// rootRoutes sub-app directly with a fake ASSETS fetcher and injected auth,
// same style as the FakeSessions/FakeUsers stubs in
// test/server-middleware.test.ts.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { rootRoutes } from "../src/routes/root";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { Db } from "../src/server/context";

function fakeAssets(): Fetcher {
  return {
    async fetch(input: RequestInfo | URL) {
      const url = typeof input === "string" || input instanceof URL ? new URL(input) : new URL(input.url);
      if (url.pathname === "/admin/index.html") {
        return new Response("<html>admin shell</html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }
      return new Response("not found", { status: 404 });
    },
  } as unknown as Fetcher;
}

function fakeDbWithSlug(slug: string | null): Db {
  return {
    select: () => ({
      from: () => ({
        orderBy: () => ({
          limit: async () => (slug ? [{ slug }] : []),
        }),
      }),
    }),
  } as unknown as Db;
}

function buildApp(opts: { auth?: AuthInfo; slug?: string | null; devMode?: string }) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", fakeDbWithSlug(opts.slug ?? null));
    if (opts.auth) c.set("auth", opts.auth);
    await next();
  });
  app.route("/", rootRoutes);
  return app;
}

const ORGANIZER: AuthInfo = { userId: "u1", role: "organizer", orgId: "o1" };
const SPEAKER: AuthInfo = { userId: "u2", role: "speaker", orgId: "o1", contactId: "c1" };

describe("GET /admin and /admin/*", () => {
  it("redirects anonymous requests to /login", async () => {
    const app = buildApp({});
    const res = await app.request("/admin/submissions", {}, { ASSETS: fakeAssets() });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login");
  });

  it("redirects a speaker session to /portal", async () => {
    const app = buildApp({ auth: SPEAKER });
    const res = await app.request("/admin/submissions", {}, { ASSETS: fakeAssets() });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/portal");
  });

  it("serves the admin shell for an organizer session", async () => {
    const app = buildApp({ auth: ORGANIZER });
    const res = await app.request("/admin/submissions", {}, { ASSETS: fakeAssets() });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("admin shell");
  });

  it("serves the bare /admin route for a reviewer session too", async () => {
    const app = buildApp({ auth: { userId: "u3", role: "reviewer", orgId: "o1" } });
    const res = await app.request("/admin", {}, { ASSETS: fakeAssets() });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("admin shell");
  });

  it("proxies /admin/assets/* to ASSETS regardless of auth", async () => {
    const app = buildApp({});
    const res = await app.request("/admin/assets/index-abc.js", {}, { ASSETS: fakeAssets() });
    // fakeAssets 404s anything but /admin/index.html — the point here is
    // that it was never redirected to /login.
    expect(res.status).toBe(404);
  });
});

describe("GET /", () => {
  it("returns 200 with a link to /admin", async () => {
    const app = buildApp({ slug: null });
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('href="/admin"');
    expect(body).toContain('href="/portal"');
  });

  it("links to /submit/<slug> and /e/<slug>/sessions when an event exists", async () => {
    const app = buildApp({ slug: "devcon-2026" });
    const res = await app.request("/", {}, { ASSETS: fakeAssets() });
    const body = await res.text();
    expect(body).toContain('href="/submit/devcon-2026"');
    expect(body).toContain('href="/e/devcon-2026/sessions"');
  });
});

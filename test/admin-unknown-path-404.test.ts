// DEC-154/DEC-945 (amendment, wave 53): an unknown /admin path must be a
// real, chromeless 404 -- not the SPA shell at 200 with the client-side
// catch-all drawing NotFound inside the full nav chrome. Mirrors
// test/root.test.ts's fake ASSETS/Db harness.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { rootRoutes } from "../src/routes/root";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { Db } from "../src/server/context";
import { registerErrorHandler } from "../src/server/http";

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

/** Same generic drizzle-shaped query-chain fake as test/root.test.ts:
 * resolveNotFoundEyebrow calls getHubOrg (1 select) then listHubEvents
 * (up to 4 more selects when events exist) -- an empty org/events queue
 * makes it fall back to the "Not found" eyebrow, which is all this file
 * needs to assert. */
function fakeDb(resultQueue: unknown[][]): Db {
  let i = 0;
  return {
    select: () => {
      const results = resultQueue[i++] ?? [];
      const chain: any = {
        from: () => chain,
        leftJoin: () => chain,
        innerJoin: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: () => chain,
        groupBy: () => chain,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(results).then(resolve, reject),
      };
      return chain;
    },
  } as unknown as Db;
}

function buildApp(opts: { auth?: AuthInfo }) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", fakeDb([[], []]));
    if (opts.auth) c.set("auth", opts.auth);
    await next();
  });
  app.route("/", rootRoutes);
  registerErrorHandler(app);
  return app;
}

const ORGANIZER: AuthInfo = { userId: "u1", role: "organizer", orgId: "o1" };
const SPEAKER: AuthInfo = { userId: "u2", role: "speaker", orgId: "o1", contactId: "c1" };

describe("GET /admin/* -- unknown path is a real 404 (DEC-154/DEC-945)", () => {
  it("an organizer session hitting an unknown path gets a 404 with the designed card, no admin shell markup", async () => {
    const app = buildApp({ auth: ORGANIZER });
    const res = await app.request("/admin/nope", {}, { ASSETS: fakeAssets() });
    expect(res.status).toBe(404);
    const body = await res.text();
    expect(body).toContain("That page isn&#39;t here");
    expect(body).not.toContain("admin shell");
  });

  it("a :id pattern still resolves to the shell (200)", async () => {
    const app = buildApp({ auth: ORGANIZER });
    const res = await app.request("/admin/submissions/abc123", {}, { ASSETS: fakeAssets() });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("admin shell");
  });

  it("the /review/* suffix wildcard still resolves to the shell (200)", async () => {
    const app = buildApp({ auth: ORGANIZER });
    const res = await app.request("/admin/review/plans/xyz", {}, { ASSETS: fakeAssets() });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("admin shell");
  });

  it("a known static path still resolves to the shell (200)", async () => {
    const app = buildApp({ auth: ORGANIZER });
    const res = await app.request("/admin/overview", {}, { ASSETS: fakeAssets() });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("admin shell");
  });

  it("an unauthenticated request to an unknown path still redirects to /login (never leaks route existence)", async () => {
    const app = buildApp({});
    const res = await app.request("/admin/nope", {}, { ASSETS: fakeAssets() });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login");
  });

  it("a speaker session hitting an unknown path still redirects to /portal?from=admin", async () => {
    const app = buildApp({ auth: SPEAKER });
    const res = await app.request("/admin/nope", {}, { ASSETS: fakeAssets() });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/portal?from=admin");
  });
});

// DEC-295: a 304 Not Modified from the ASSETS binding on /admin/index.html
// is a successful conditional-GET revisit (the browser's If-None-Match on
// c.req.raw matches the outer /admin response's ETag, which byte-for-byte
// proxies index.html), not a missing bundle -- fetchAdminShell must return
// it untouched rather than throwing the DEC-268 ApiError. Any other non-ok
// status (e.g. a genuinely missing bundle) must keep failing loudly with the
// exact same DEC-268 message. Mounted the same way test/api-route-
// composition.test.ts and test/spa-contract-sweep.test.ts mount sub-apps.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { rootRoutes } from "../src/routes/root";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";

const ORGANIZER: AuthInfo = { userId: "u1", role: "organizer", orgId: "o1" };

function buildApp(assetsFetch: Fetcher["fetch"]) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", ORGANIZER);
    await next();
  });
  app.route("/", rootRoutes);
  const assets = { fetch: assetsFetch } as unknown as Fetcher;
  return { app, assets };
}

describe("fetchAdminShell conditional GET (DEC-295)", () => {
  it("returns a 304 untouched for GET /admin instead of a 500", async () => {
    const { app, assets } = buildApp(async () => new Response(null, { status: 304 }));
    const res = await app.request("/admin", {}, { ASSETS: assets });
    expect(res.status).toBe(304);
    expect(await res.text()).toBe("");
  });

  it("returns a 304 untouched for GET /admin/agenda instead of a 500", async () => {
    const { app, assets } = buildApp(async () => new Response(null, { status: 304 }));
    const res = await app.request("/admin/agenda", {}, { ASSETS: assets });
    expect(res.status).toBe(304);
    expect(await res.text()).toBe("");
  });

  it("still fails loudly with a 500 naming the missing bundle for a real 404", async () => {
    const { app, assets } = buildApp(async () => new Response("x", { status: 404 }));
    const res = await app.request("/admin", {}, { ASSETS: assets });
    expect(res.status).toBe(500);
    const body = await res.text();
    expect(body).toContain("Admin SPA bundle missing");
  });

  it("passes through a normal 200 with its body", async () => {
    const { app, assets } = buildApp(async () => new Response("<html>admin shell</html>", { status: 200 }));
    const res = await app.request("/admin", {}, { ASSETS: assets });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("<html>admin shell</html>");
  });
});

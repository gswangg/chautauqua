// DEC-056: public, no-login API docs page. Static/hand-maintained SSR — no
// db or auth context needed, unlike rootRoutes.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { docsRoutes } from "../src/routes/docs";
import type { AppEnv } from "../src/server/env";

function buildApp() {
  const app = new Hono<AppEnv>();
  app.route("/", docsRoutes);
  return app;
}

describe("GET /docs/api", () => {
  it("returns 200 and documents auth, envelopes, and the /api/v1 surface", async () => {
    const app = buildApp();
    const res = await app.request("/docs/api");
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Bearer");
    expect(body).toContain("/api/v1");
    expect(body).toContain("error");
    expect(body).toContain("items");
    expect(body).toContain("total");
    expect(body).toContain("page");
    expect(body).toContain("perPage");
  });

  it("documents the DEC-055 showflow export route alongside the DEC-027 export kinds", async () => {
    const app = buildApp();
    const res = await app.request("/docs/api");
    const body = await res.text();
    expect(body).toContain("/api/v1/events/:eventId/exports/showflow.csv");
    expect(body).toContain("/api/v1/events/:eventId/export/:kind?format=csv|json");
  });

  it("requires no login (no auth set on context)", async () => {
    const app = buildApp();
    const res = await app.request("/docs/api");
    expect(res.status).toBe(200);
  });

  it("ships a viewport meta tag and a scrollable table wrapper (DEC-311/253 mobile overflow fix)", async () => {
    const app = buildApp();
    const res = await app.request("/docs/api");
    const body = await res.text();
    expect(body).toContain('<meta name="viewport" content="width=device-width, initial-scale=1"');
    expect(body).toContain("chq-tool-table-wrap");
    expect(body).toContain("overflow-x: auto");
    expect(body).toContain("overflow-wrap: anywhere");
  });
});

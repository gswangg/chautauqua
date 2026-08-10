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

  it("requires no login (no auth set on context)", async () => {
    const app = buildApp();
    const res = await app.request("/docs/api");
    expect(res.status).toBe(200);
  });
});

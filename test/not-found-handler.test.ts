import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler, ApiError } from "../src/server/http";
import { registerNotFoundHandler } from "../src/server/not-found";
import type { AppEnv } from "../src/server/env";

// DEC-635: one 404 handler -- the API prefix gets the http.ts envelope
// shape, every other path gets an HTML page. Built the same minimal way
// test/admin-shell-conditional-get.test.ts does (registerErrorHandler on a
// bare Hono<AppEnv>), rather than createBaseApp(), so no D1 binding is
// needed for these routing-only assertions.

function buildApp() {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  // A stand-in route that behaves exactly like a real matched route
  // throwing ApiError('not_found', ...) — e.g. events.ts's "Event not
  // found" -- to prove app.notFound() never intercepts a route that DID
  // match but whose handler threw.
  app.get("/api/v1/probe/:id", () => {
    throw new ApiError("not_found", "Event not found");
  });
  registerNotFoundHandler(app);
  return app;
}

describe("registerNotFoundHandler (DEC-635)", () => {
  it("answers unmatched /api/v1 paths with the shared JSON envelope", async () => {
    const app = buildApp();
    const res = await app.request("/api/v1/definitely-not-a-route");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("not_found");
    expect(body.error.message).toContain("GET");
    expect(body.error.message).toContain("/api/v1/definitely-not-a-route");
  });

  it("answers unmatched non-API paths with an HTML 404 page", async () => {
    const app = buildApp();
    const res = await app.request("/definitely-not-a-page");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const html = await res.text();
    expect(html).toContain("Page not found");
    expect(html).toContain('href="/login"');
    expect(html).toContain('name="robots" content="noindex"');
  });

  it("leaves an ApiError thrown by a matched route unchanged", async () => {
    const app = buildApp();
    const res = await app.request("/api/v1/probe/xyz");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error).toEqual({ code: "not_found", message: "Event not found" });
  });
});

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler, ApiError } from "../src/server/http";
import type { AppEnv } from "../src/server/env";

// DEC-841: an HTML navigation gets an HTML error, regardless of whether the
// throwing route happens to run behind a form-POST CSRF middleware (the
// only place htmlSurface is set) -- classification also falls back to the
// same isApiPath predicate the 404 handler uses. Built the same minimal way
// test/not-found-handler.test.ts does: registerErrorHandler on a bare
// Hono<AppEnv>, no createBaseApp() (no db/session wiring needed here).
function buildApp() {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.get("/portal/x", () => {
    throw new Error("boom");
  });
  app.get("/api/v1/x", () => {
    throw new Error("boom");
  });
  app.get("/portal/nf", () => {
    throw new ApiError("not_found", "Widget not found");
  });
  return app;
}

describe("HTML vs API error shape (DEC-841)", () => {
  it("GET /portal/x -> 500 text/html with the message in the body", async () => {
    const app = buildApp();
    const res = await app.request("/portal/x");
    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const html = await res.text();
    expect(html).toContain("Internal server error");
  });

  it("GET /api/v1/x -> 500 JSON envelope", async () => {
    const app = buildApp();
    const res = await app.request("/api/v1/x");
    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body).toEqual({ error: { code: "internal", message: "Internal server error" } });
  });

  it("ApiError('not_found') on a public (non-API) path -> 404 text/html", async () => {
    const app = buildApp();
    const res = await app.request("/portal/nf");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const html = await res.text();
    expect(html).toContain("Widget not found");
  });

  it("a JSON fetch to /api/v1 is byte-unchanged from today", async () => {
    const app = buildApp();
    app.get("/api/v1/probe", () => {
      throw new ApiError("not_found", "Event not found");
    });
    const res = await app.request("/api/v1/probe");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body).toEqual({ error: { code: "not_found", message: "Event not found" } });
  });
});

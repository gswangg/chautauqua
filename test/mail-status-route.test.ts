// DEC-996 amendment (wave 57): GET /api/v1/mail-status surfaces
// mailConfigStatus() so a missing EMAIL binding is discoverable in Settings
// without a 500. organizer-only (requireOrganizer); the response body must
// never echo binding internals, whatever else it contains.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";
import { mailStatusRoutes } from "../src/routes/api/mail-status";

function buildApp(role: "organizer" | "speaker") {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("auth", { userId: "u1", role, orgId: "org1" });
    await next();
  });
  registerErrorHandler(app);
  app.route("/api/v1", mailStatusRoutes);
  return app;
}

const FAKE_EMAIL_BINDING = { send: async () => {} };

describe("GET /api/v1/mail-status (DEC-996 amendment, wave 57)", () => {
  it("200s for an organizer with the mailConfigStatus shape", async () => {
    const app = buildApp("organizer");
    const res = await app.request(
      "/api/v1/mail-status",
      {},
      { KV: {}, EMAIL: FAKE_EMAIL_BINDING, MAIL_FROM_EMAIL: "cfp@example.org" },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ provider: "email-binding", configured: true, fromEmail: "cfp@example.org" });
  });

  it("403s for a speaker", async () => {
    const app = buildApp("speaker");
    const res = await app.request(
      "/api/v1/mail-status",
      {},
      { KV: {}, EMAIL: FAKE_EMAIL_BINDING, MAIL_FROM_EMAIL: "cfp@example.org" },
    );
    expect(res.status).toBe(403);
  });

  it("never echoes binding internals anywhere in the response body, in any provider state", async () => {
    const app = buildApp("organizer");

    const boundRes = await app.request(
      "/api/v1/mail-status",
      {},
      { KV: {}, EMAIL: FAKE_EMAIL_BINDING, MAIL_FROM_EMAIL: "cfp@example.org" },
    );
    const boundText = await boundRes.text();
    expect(boundText).not.toContain("function");

    const devRes = await app.request(
      "/api/v1/mail-status",
      {},
      { KV: {}, DEV_MODE: "1", EMAIL: FAKE_EMAIL_BINDING },
    );
    const devBody = await devRes.json();
    expect(devBody).toEqual({ provider: "dev-sink", configured: true, fromEmail: null });

    const noneRes = await app.request("/api/v1/mail-status", {}, { KV: {} });
    const noneBody = await noneRes.json();
    expect(noneBody).toEqual({ provider: "none", configured: false, fromEmail: null });
  });
});

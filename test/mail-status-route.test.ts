// DEC-996 amendment (wave 43): GET /api/v1/mail-status surfaces
// mailConfigStatus() so a missing key is discoverable in Settings without
// a 500. organizer-only (requireOrganizer); the response body must never
// echo any part of RESEND_API_KEY, whatever else it contains.

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

const SECRET_KEY = "re_super_secret_key_should_never_leak";

describe("GET /api/v1/mail-status (DEC-996 amendment, wave 43)", () => {
  it("200s for an organizer with the mailConfigStatus shape", async () => {
    const app = buildApp("organizer");
    const res = await app.request(
      "/api/v1/mail-status",
      {},
      { KV: {}, RESEND_API_KEY: SECRET_KEY, MAIL_FROM_EMAIL: "cfp@example.org" },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ provider: "resend", configured: true, fromEmail: "cfp@example.org" });
  });

  it("403s for a speaker", async () => {
    const app = buildApp("speaker");
    const res = await app.request(
      "/api/v1/mail-status",
      {},
      { KV: {}, RESEND_API_KEY: SECRET_KEY, MAIL_FROM_EMAIL: "cfp@example.org" },
    );
    expect(res.status).toBe(403);
  });

  it("never echoes the key anywhere in the response body, in any provider state", async () => {
    const app = buildApp("organizer");

    const resendRes = await app.request(
      "/api/v1/mail-status",
      {},
      { KV: {}, RESEND_API_KEY: SECRET_KEY, MAIL_FROM_EMAIL: "cfp@example.org" },
    );
    const resendText = await resendRes.text();
    expect(resendText).not.toContain(SECRET_KEY);

    const devRes = await app.request(
      "/api/v1/mail-status",
      {},
      { KV: {}, DEV_MODE: "1", RESEND_API_KEY: SECRET_KEY },
    );
    const devBody = await devRes.json();
    expect(devBody).toEqual({ provider: "dev-sink", configured: true, fromEmail: null });
    expect(JSON.stringify(devBody)).not.toContain(SECRET_KEY);

    const noneRes = await app.request("/api/v1/mail-status", {}, { KV: {} });
    const noneBody = await noneRes.json();
    expect(noneBody).toEqual({ provider: "none", configured: false, fromEmail: null });
  });
});

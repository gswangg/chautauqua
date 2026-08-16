// DEC-945 (wave-65 amendment): a speaker GET on a missing/foreign submission
// id must render the shared branded 404 card (portalNotFound), not a bare
// text/plain "Not found" -- same existence-hiding 404 status, styled chrome
// and a way back into the portal.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { registerErrorHandler } from "../src/server/http";

vi.mock("../src/server/repo/portal-edit", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal-edit")>(
    "../src/server/repo/portal-edit",
  );
  return {
    ...actual,
    // Missing/foreign submission: the repo read returns null exactly as it
    // would for a stale link or another speaker's id (object-level ownership
    // check happens inside the query itself).
    loadEditableSubmission: vi.fn(async () => null),
  };
});

vi.mock("../src/server/not-found", async () => {
  const actual = await vi.importActual<typeof import("../src/server/not-found")>("../src/server/not-found");
  return {
    ...actual,
    // No fake db in this suite -- stub the eyebrow resolver directly rather
    // than wiring a fake getHubOrg/listHubEvents pair.
    resolveNotFoundEyebrow: vi.fn(async () => "Not found"),
  };
});

const { portalEditRoutes } = await import("../src/routes/portal/edit");

function buildApp() {
  const app = new Hono<AppEnv>();
  const auth: AuthInfo = { userId: "u1", role: "speaker", orgId: "org1", contactId: "c1" };
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    await next();
  });
  registerErrorHandler(app);
  app.route("/portal", portalEditRoutes);
  return app;
}

describe("GET /portal/submissions/:id/edit -- missing/foreign submission (DEC-945)", () => {
  it("renders the shared branded 404 card, not a bare text/plain body", async () => {
    const app = buildApp();
    const res = await app.request("/portal/submissions/does-not-exist/edit");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("That page isn");
    // The speaker back-link vocabulary (DEC-914): href and label agree.
    expect(html).toContain('href="/portal"');
    expect(html).toContain("Your portal");
  });
});

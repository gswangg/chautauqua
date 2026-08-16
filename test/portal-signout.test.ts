// DEC-154: every /portal/* page renders through the shared PortalLayout
// shell (src/routes/portal/shared.tsx), which now carries a "Sign out"
// form posting to /logout. This asserts the rendered HTML for the portal
// dashboard actually contains that form — regression coverage for the
// shell, not per-page duplication.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

vi.mock("../src/server/repo/portal", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
  return {
    ...actual,
    getPortalData: vi.fn(async () => ({
      branding: {
        eventId: "evt-1",
        eventName: "Arbitrary Con",
        welcomeMessage: null,
        accentColor: null,
        logoUrl: null,
      },
      submissions: [],
      tasks: [],
      showResourcesByEventId: { "evt-1": true },
    })),
    getMySessions: vi.fn(async () => []),
    getMyInvitations: vi.fn(async () => []),
    getMyTaskAssignments: vi.fn(async () => []),
    getMySubmissions: vi.fn(async () => []),
  };
});

const speakerAuth: AuthInfo = { userId: "u-1", role: "speaker", orgId: "org-1", contactId: "ct-1" };

async function buildApp() {
  const { portalRoutes } = await import("../src/routes/portal/index");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", speakerAuth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/portal", portalRoutes);
  return app;
}

describe("portal shell sign-out", () => {
  it("GET /portal renders a POST /logout form in the shared shell", async () => {
    const app = await buildApp();
    const res = await app.request("/portal");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<form method="post" action="/logout"');
    expect(html).toMatch(/Sign out/);
    // DEC-181: the sign-out form now carries a CSRF double-submit field.
    expect(html).toMatch(/<input type="hidden" name="chq_csrf" value="[^"]+"\s*\/?>/);
    // w2-g (DEC-590): demoted out of the masthead into a quiet tertiary
    // footer link -- placement only, the POST target/CSRF proof above is
    // unchanged. Assert the sign-out form now lives inside <footer>, after
    // </main> closes, not inside <header>.
    const mainCloseIndex = html.indexOf("</main>");
    const footerIndex = html.indexOf("<footer");
    const formIndex = html.indexOf('<form method="post" action="/logout"');
    expect(mainCloseIndex).toBeGreaterThan(-1);
    expect(footerIndex).toBeGreaterThan(mainCloseIndex);
    expect(formIndex).toBeGreaterThan(footerIndex);
  });
});

// DEC-945 (amendment, wave 69): a role-blocked /admin bounce says why. A
// speaker hitting /admin or /admin/* now redirects to /portal?from=admin
// (instead of a bare /portal), and the portal home page renders exactly one
// explanatory line when that marker is present -- validated against a
// closed, one-member vocabulary so the raw query value is never echoed.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { rootRoutes } from "../src/routes/root";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { Db } from "../src/server/context";

const NOTICE_TEXT = "The organizer dashboard";

const speakerAuth: AuthInfo = { userId: "u-1", role: "speaker", orgId: "org-1", contactId: "ct-1" };
const organizerAuth: AuthInfo = { userId: "u-2", role: "organizer", orgId: "org-1" };

function fakeAssets(): Fetcher {
  return {
    async fetch(input: RequestInfo | URL) {
      const url = typeof input === "string" || input instanceof URL ? new URL(input) : new URL(input.url);
      if (url.pathname === "/admin/index.html") {
        return new Response("<html>admin shell</html>", { status: 200, headers: { "content-type": "text/html" } });
      }
      return new Response("not found", { status: 404 });
    },
  } as unknown as Fetcher;
}

function buildRootApp(opts: { auth?: AuthInfo }) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", {} as Db);
    if (opts.auth) c.set("auth", opts.auth);
    await next();
  });
  app.route("/", rootRoutes);
  registerErrorHandler(app);
  return app;
}

describe("GET /admin and /admin/* — speaker bounce carries a reason marker", () => {
  it("a speaker session hitting bare /admin redirects to /portal?from=admin", async () => {
    const app = buildRootApp({ auth: speakerAuth });
    const res = await app.request("/admin", {}, { ASSETS: fakeAssets() });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/portal?from=admin");
  });

  it("a speaker session hitting /admin/anything redirects to /portal?from=admin", async () => {
    const app = buildRootApp({ auth: speakerAuth });
    const res = await app.request("/admin/anything", {}, { ASSETS: fakeAssets() });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/portal?from=admin");
  });

  it("an anonymous request to /admin still redirects to /login", async () => {
    const app = buildRootApp({});
    const res = await app.request("/admin", {}, { ASSETS: fakeAssets() });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login");
  });

  it("an organizer session is untouched (serves the admin shell)", async () => {
    const app = buildRootApp({ auth: organizerAuth });
    const res = await app.request("/admin", {}, { ASSETS: fakeAssets() });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("admin shell");
  });
});

// --- portal home page render ---

import { vi } from "vitest";

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
      contactName: "Priya Raman",
      contactCompany: null,
      showResourcesByEventId: { "evt-1": true },
    })),
    getMySessions: vi.fn(async () => []),
    getMyInvitations: vi.fn(async () => []),
    getMyTaskAssignments: vi.fn(async () => []),
    getMySubmissions: vi.fn(async () => []),
    listLatestDeliverables: vi.fn(async () => new Map()),
  };
});

async function buildPortalApp(): Promise<Hono<AppEnv>> {
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

describe("GET /portal?from=admin — the bounce notice (DEC-945 amendment, wave 69)", () => {
  it("renders the notice exactly once for a speaker bounced from /admin", async () => {
    const app = await buildPortalApp();
    const res = await app.request("/portal?from=admin");
    expect(res.status).toBe(200);
    const html = await res.text();
    const occurrences = html.split(NOTICE_TEXT).length - 1;
    expect(occurrences).toBe(1);
    expect(html).toContain('role="status"');
  });

  it("renders no notice on a plain /portal visit", async () => {
    const app = await buildPortalApp();
    const res = await app.request("/portal");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain(NOTICE_TEXT);
  });

  it("renders no notice and never echoes an unrecognized ?from= value", async () => {
    const app = await buildPortalApp();
    const res = await app.request("/portal?from=%3Cscript%3E");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain(NOTICE_TEXT);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("&lt;script&gt;");
  });
});

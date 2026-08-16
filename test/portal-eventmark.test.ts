// DEC-884: the portal header prints the customer's event name verbatim (no
// lowercase transform) via a dedicated .chq-eventmark class, distinct from
// the operator-surface .chq-wordmark (which stays lowercase — see
// test/tools-surfaces.test.ts). The header also no longer carries the
// welcomeMessage tagline; it moves to the first body block of /portal.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const EVENT_NAME = "DevFlow Conf 2027";
const WELCOME = "Welcome to the speaker portal!";

vi.mock("../src/server/repo/portal", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
  return {
    ...actual,
    getPortalData: vi.fn(async () => ({
      branding: {
        eventId: "evt-1",
        eventName: EVENT_NAME,
        welcomeMessage: WELCOME,
        accentColor: null,
        logoUrl: null,
      },
      submissions: [],
      tasks: [],
      contactName: "Ada Lovelace",
      contactCompany: null,
      showResourcesByEventId: { "evt-1": true },
    })),
    getMySessions: vi.fn(async () => []),
    getMyInvitations: vi.fn(async () => []),
    getMyTaskAssignments: vi.fn(async () => []),
    getMySubmissions: vi.fn(async () => []),
    getLatestDeliverable: vi.fn(async () => null),
  };
});

const speakerAuth: AuthInfo = { userId: "u-1", role: "speaker", orgId: "org-1", contactId: "ct-1" };

describe("GET /portal renders the event name verbatim, not lowercased (DEC-884)", () => {
  it("carries the mixed-case event name in .chq-eventmark, and the welcome message in the body, not the header", async () => {
    const { portalRoutes } = await import("../src/routes/portal/index");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", speakerAuth);
      c.set("db", {} as never);
      await next();
    });
    app.route("/portal", portalRoutes);

    const res = await app.request("/portal");
    expect(res.status).toBe(200);
    const html = await res.text();

    // The event name appears verbatim inside the eventmark span.
    expect(html).toContain(`<span class="chq-eventmark">`);
    const eventmarkMatch = html.match(/<span class="chq-eventmark">([\s\S]*?)<\/span>/);
    expect(eventmarkMatch).not.toBeNull();
    expect(eventmarkMatch![1]).toContain(EVENT_NAME);

    // The header (everything up to </header>) contains no welcomeMessage
    // paragraph.
    const headerMatch = html.match(/<header[\s\S]*?<\/header>/);
    expect(headerMatch).not.toBeNull();
    expect(headerMatch![0]).not.toContain(WELCOME);
    expect(headerMatch![0]).not.toContain("chq-meta");

    // The welcome message renders as a body block instead, outside the
    // header.
    expect(html).toContain(WELCOME);
    const mainIdx = html.indexOf("<main>");
    const welcomeIdx = html.indexOf(WELCOME);
    expect(welcomeIdx).toBeGreaterThan(mainIdx);
  });
});

describe("no CSS rule reaching .chq-eventmark declares text-transform (DEC-884)", () => {
  it("theme.ts's .chq-eventmark rule carries no text-transform", () => {
    const themeSource = readFileSync(join(__dirname, "..", "src", "views", "theme.ts"), "utf8");
    const match = themeSource.match(/\.chq-eventmark\s*\{([^}]*)\}/);
    expect(match).not.toBeNull();
    expect(match![1]).not.toMatch(/text-transform/);
  });

  it(".chq-wordmark is untouched and still lowercases (operator surfaces mean it)", () => {
    const themeSource = readFileSync(join(__dirname, "..", "src", "views", "theme.ts"), "utf8");
    const match = themeSource.match(/\.chq-wordmark\s*\{([^}]*)\}/);
    expect(match).not.toBeNull();
    expect(match![1]).toMatch(/text-transform:\s*lowercase/);
  });
});

describe("PortalLayout no longer exposes showTagline (DEC-884)", () => {
  it("the shared.tsx source contains no showTagline reference", () => {
    const source = readFileSync(join(__dirname, "..", "src", "routes", "portal", "shared.tsx"), "utf8");
    expect(source).not.toContain("showTagline");
  });
});

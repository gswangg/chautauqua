// DEC-988 (wave-56 amendment): the producer's "Show resources" toggle
// (portal_settings.show_resources) was written, stored, validated and
// threaded onto PortalBranding/PortalBrandingChrome — and read by nothing
// under src/routes/portal/. This file proves every surface now has a
// reader: server-side 404 refusal on both resource routes when the flag is
// off, link suppression on the portal home page and its footer, and the
// organizer preview replacing the Resources section body rather than
// silently rendering the real list. It also carries a schema-derived scan
// so a future boolean column on portal_settings can't ship the same way.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { getTableColumns } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { registerErrorHandler } from "../src/server/http";
import { registerNotFoundHandler } from "../src/server/not-found";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { PortalInvitation, PortalSession, PortalTaskAssignment } from "../src/server/repo/portal";

// ---------------------------------------------------------------------------
// (a) route-level 404 + link-suppression assertions, both states
// ---------------------------------------------------------------------------

let mockShowResources = true;

// DEC-945 (wave-65 amendment): the two showResources=false 404s below now
// render via portalNotFound (src/routes/portal/shared.tsx), which resolves
// its eyebrow via resolveNotFoundEyebrow(c.var.db) -- this suite's db fake
// is `{}`, so the real resolver would throw. Stubbed since the eyebrow
// lookup is not this suite's concern.
vi.mock("../src/server/not-found", async () => {
  const actual = await vi.importActual<typeof import("../src/server/not-found")>("../src/server/not-found");
  return {
    ...actual,
    resolveNotFoundEyebrow: vi.fn(async () => "Not found"),
  };
});

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
        get showResources() {
          return mockShowResources;
        },
      },
      submissions: [],
      tasks: [],
      contactName: "Priya Raman",
      contactCompany: null,
    })),
    getMySessions: vi.fn(
      async (): Promise<PortalSession[]> => [
        {
          submissionId: "sub-1",
          ref: "SES-001",
          title: "Accepted talk",
          day: null,
          startMin: null,
          endMin: null,
          roomName: null,
          trackName: null,
          acceptedAt: null,
          eventName: "Arbitrary Con",
          timezone: "UTC",
          overlaps: [],
        },
      ],
    ),
    getMyInvitations: vi.fn(async (): Promise<PortalInvitation[]> => []),
    getMyTaskAssignments: vi.fn(async (): Promise<PortalTaskAssignment[]> => []),
    getLatestDeliverable: vi.fn(async () => null),
    listLatestDeliverables: vi.fn(async () => new Map()),
    getMySubmissions: vi.fn(async () => []),
    getMyResources: vi.fn(async () => [
      { eventId: "evt-1", eventName: "Arbitrary Con", resources: [{ id: "res-1", kind: "wiki", title: "Notes", content: "hi", fileId: null }] },
    ]),
    getResourceDownloadScope: vi.fn(async () => ({
      eventId: "evt-1",
      r2Key: "k",
      contentType: "text/plain",
      filename: "f.txt",
    })),
  };
});

const speakerAuth: AuthInfo = { userId: "u-1", role: "speaker", orgId: "org-1", contactId: "ct-1" };

async function buildPortalApp() {
  const { portalRoutes } = await import("../src/routes/portal/index");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", speakerAuth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/portal", portalRoutes);
  registerNotFoundHandler(app);
  return app;
}

async function buildResourcesApp() {
  const { portalResourcesRoutes } = await import("../src/routes/portal/tasks/resources");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", speakerAuth);
    c.set("db", {} as never);
    c.env = { FILES: {} } as never;
    await next();
  });
  app.route("/portal", portalResourcesRoutes);
  registerNotFoundHandler(app);
  return app;
}

describe("DEC-988: showResources server-side reader", () => {
  it("showResources=true: GET /portal/resources is 200 and the home page links to it", async () => {
    mockShowResources = true;
    const resourcesApp = await buildResourcesApp();
    const res = await resourcesApp.request("/portal/resources");
    expect(res.status).toBe(200);

    const portalApp = await buildPortalApp();
    const home = await portalApp.request("/portal");
    const html = await home.text();
    expect(html).toContain('class="chq-portal-footer-resources"');
    expect(html).toContain(">Read notes<");
  });

  it("showResources=false: GET /portal/resources is 404 before any resource read", async () => {
    mockShowResources = false;
    const app = await buildResourcesApp();
    const res = await app.request("/portal/resources");
    expect(res.status).toBe(404);
    // DEC-945 (wave-65 amendment): the refusal now renders the shared
    // branded 404 card (portalNotFound), not a bare text/plain body.
    expect(res.headers.get("content-type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain("That page isn");
  });

  it("showResources=false: GET /portal/resources/:id/download is 404 before the download-scope query", async () => {
    mockShowResources = false;
    const { getResourceDownloadScope } = await import("../src/server/repo/portal");
    const spy = vi.mocked(getResourceDownloadScope);
    spy.mockClear();
    const app = await buildResourcesApp();
    const res = await app.request("/portal/resources/res-1/download");
    expect(res.status).toBe(404);
    expect(spy).not.toHaveBeenCalled();
  });

  it("showResources=false: home page suppresses both the footer link and the session card's Read notes link", async () => {
    mockShowResources = false;
    const app = await buildPortalApp();
    const res = await app.request("/portal");
    const html = await res.text();
    expect(html).not.toContain('class="chq-portal-footer-resources"');
    expect(html).not.toContain(">Read notes<");
    // Everything else on the session card still renders.
    expect(html).toContain("Accepted talk");
  });
});

// ---------------------------------------------------------------------------
// organizer preview
// ---------------------------------------------------------------------------

describe("DEC-988: GET /portal/preview shows what the speaker sees", () => {
  const EVENT_ID = "evt-1";
  const ORG_ID = "org-1";
  const ORGANIZER: AuthInfo = { userId: "u1", role: "organizer", orgId: ORG_ID };

  function fakeDb(showResources: boolean) {
    return {
      select: () => ({
        from: (table: unknown) => {
          if (table === schema.event) {
            return {
              where: () => ({
                limit: async () => [
                  {
                    id: EVENT_ID,
                    orgId: ORG_ID,
                    name: "Test Conf",
                    slug: "test-conf",
                    startDate: "2026-01-01",
                    endDate: "2026-01-02",
                    location: null,
                    timezone: "America/Chicago",
                    recordPrefix: "TC",
                    brandingJson: null,
                    createdAt: new Date(0),
                    updatedAt: new Date(0),
                  },
                ],
              }),
            };
          }
          if (table === schema.portalSettings) {
            return {
              where: () => ({
                limit: async () => [
                  {
                    id: "ps-1",
                    eventId: EVENT_ID,
                    logoUrl: null,
                    accentColor: null,
                    welcomeMessage: "Welcome, speakers!",
                    showResources,
                    createdAt: new Date(0),
                    updatedAt: new Date(0),
                  },
                ],
              }),
            };
          }
          if (table === schema.resource) {
            return {
              where: () => ({
                orderBy: async () => [
                  {
                    id: "res-1",
                    eventId: EVENT_ID,
                    kind: "wiki",
                    title: "Travel info",
                    content: "Fly into AUS.",
                    fileId: null,
                    position: 0,
                    createdAt: new Date(0),
                    updatedAt: new Date(0),
                  },
                ],
              }),
            };
          }
          if (table === schema.org) {
            return { orderBy: () => ({ limit: async () => [] }) };
          }
          return { where: () => ({ limit: async () => [] }) };
        },
      }),
    } as never;
  }

  async function buildPreviewApp(showResources: boolean) {
    const { portalPreviewRoutes } = await import("../src/routes/portal/preview");
    const app = new Hono<AppEnv>();
    app.use("*", async (c, next) => {
      c.set("db", fakeDb(showResources));
      c.set("auth", ORGANIZER);
      await next();
    });
    registerErrorHandler(app);
    app.route("/portal", portalPreviewRoutes);
    registerNotFoundHandler(app);
    return app;
  }

  it("showResources=true: renders the real resource list", async () => {
    const app = await buildPreviewApp(true);
    const res = await app.request(`/portal/preview?eventId=${EVENT_ID}`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Travel info");
  });

  it("showResources=false: replaces the section body with one organizer-facing line, never the real list", async () => {
    const app = await buildPreviewApp(false);
    const res = await app.request(`/portal/preview?eventId=${EVENT_ID}`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).not.toContain("Travel info");
    expect(body).toContain("Hidden from speakers by the Speaker portal");
  });
});

// ---------------------------------------------------------------------------
// (b) schema-derived population scan: every boolean column on
// portal_settings must be named under src/routes/portal/, or carry a
// written exemption below.
// ---------------------------------------------------------------------------

describe("DEC-988: portal_settings boolean-column population scan", () => {
  // Structural exemptions only (never a branch note) — none today.
  const EXEMPT_COLUMNS: ReadonlySet<string> = new Set();

  it("every boolean column on portal_settings is named somewhere under src/routes/portal/, or exempt", () => {
    const columns = getTableColumns(schema.portalSettings);
    const booleanColumns = Object.entries(columns)
      .filter(([, col]) => (col as { dataType?: string }).dataType === "boolean")
      .map(([key]) => key);

    expect(booleanColumns).toContain("showResources");

    const portalDir = path.join(__dirname, "..", "src", "routes", "portal");
    const filesToScan = [
      "index.tsx",
      "preview.tsx",
      "tasks/resources.tsx",
      "tasks/shared.ts",
      "shared.tsx",
    ].map((f) => path.join(portalDir, f));
    const corpus = filesToScan.map((f) => readFileSync(f, "utf8")).join("\n");

    for (const colKey of booleanColumns) {
      if (EXEMPT_COLUMNS.has(colKey)) continue;
      expect(corpus.includes(colKey), `boolean column '${colKey}' has no reader under src/routes/portal/`).toBe(
        true,
      );
    }
  });
});

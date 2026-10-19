// DEC-988 (wave-56 amendment): the producer's "Show resources" toggle
// (portal_settings.show_resources) was written, stored, validated and
// threaded onto PortalBranding/PortalBrandingChrome — and read by nothing
// under src/routes/portal/. This file proves every surface now has a
// reader: server-side 404 refusal on both resource routes when the flag is
// off, link suppression on the portal home page and its footer, and the
// organizer preview replacing the Resources section body rather than
// silently rendering the real list. It also carries a schema-derived scan
// so a future boolean column on portal_settings can't ship the same way.
//
// Multi-portal decision 74: the switch itself is gone (each portal lists
// its own resources) and the portal data loader no longer reads it, so
// every event a person takes part in reads true. The route gating below
// still holds: the per-event map is how a resource route knows the person
// takes part in that event at all. The organizer preview section went with
// the general /portal/preview page.

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
  const __m: any = {
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
      get showResourcesByEventId() {
        return { "evt-1": mockShowResources };
      },
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
          format: null,
          acceptedAt: null,
          eventId: "evt-1",
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
  const { homeFromLegacy } = await import("./helpers/person-view-fixture");
  __m.getPortalHome = vi.fn(async () =>
    homeFromLegacy({
      sessions: await __m.getMySessions(),
      tasks: await __m.getMyTaskAssignments(),
      invitations: await __m.getMyInvitations(),
    }),
  );
  return __m;
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

  it("showResources=false: GET /portal/resources/:id/download is 404 before any bytes stream", async () => {
    // DEC-988 (wave-74 amendment): gating moved to the RESOURCE's own
    // event, resolved from the scope itself — getResourceDownloadScope IS
    // called (it's the only source of the resource's eventId), but the
    // route still refuses before the file store is ever touched.
    mockShowResources = false;
    const { getResourceDownloadScope } = await import("../src/server/repo/portal");
    const spy = vi.mocked(getResourceDownloadScope);
    spy.mockClear();
    const app = await buildResourcesApp();
    const res = await app.request("/portal/resources/res-1/download");
    expect(res.status).toBe(404);
    expect(spy).toHaveBeenCalled();
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
// (b) schema-derived population scan: every boolean column on
// portal_settings must be named under src/routes/portal/, or carry a
// written exemption below.
// ---------------------------------------------------------------------------

describe("DEC-988: portal_settings boolean-column population scan", () => {
  // Structural exemptions only (never a branch note). show_resources is
  // retired, not forgotten: multi-portal decision 74 removed the event-wide
  // switch (each portal lists the resources its people see), so the column
  // stays stored and unread -- test/portal-resources-retired-switch.test.ts
  // pins that a stored "off" no longer hides anything.
  const EXEMPT_COLUMNS: ReadonlySet<string> = new Set(["showResources"]);

  it("every boolean column on portal_settings is named somewhere under src/routes/portal/, or exempt", () => {
    const columns = getTableColumns(schema.portalSettings);
    const booleanColumns = Object.entries(columns)
      .filter(([, col]) => (col as { dataType?: string }).dataType === "boolean")
      .map(([key]) => key);

    expect(booleanColumns).toContain("showResources");

    const portalDir = path.join(__dirname, "..", "src", "routes", "portal");
    const filesToScan = [
      "index.tsx",
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

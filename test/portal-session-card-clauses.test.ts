// DEC-908 (wave-150 amendment): closes
// Chautauqua Public and Portal.dc.html:444/:445 -- the portal home
// SessionCard's format-first meta clause (sessionFormatLabel over the
// submission's own session_format-role answer, PortalSession.format) and
// its deliverable's version + review-status clause (PortalDeliverable.
// versionNo, read by listLatestDeliverables). Proves both render when the
// data is present and both are OMITTED (never a fabricated default) when
// it is absent -- format null, format with no parseable duration
// (sessionFormatLabel(raw) === raw), and no deliverable at all.

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { PortalDeliverable, PortalInvitation, PortalSession, PortalTaskAssignment } from "../src/server/repo/portal";

let mockSession: PortalSession;
let mockDeliverable: PortalDeliverable | null;

function baseSession(overrides: Partial<PortalSession>): PortalSession {
  return {
    submissionId: "sub-1",
    ref: "SES-001",
    title: "Taming 40-Minute CI",
    day: null,
    startMin: null,
    endMin: null,
    roomName: null,
    trackName: "Platform & Infra",
    format: null,
    acceptedAt: null,
    eventId: "evt-1",
    eventName: "Arbitrary Con",
    timezone: "UTC",
    overlaps: [],
    ...overrides,
  };
}

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
    getMySessions: vi.fn(async (): Promise<PortalSession[]> => [mockSession]),
    getMyInvitations: vi.fn(async (): Promise<PortalInvitation[]> => []),
    getMyTaskAssignments: vi.fn(async (): Promise<PortalTaskAssignment[]> => []),
    getLatestDeliverable: vi.fn(async () => null),
    listLatestDeliverables: vi.fn(async () => {
      const out = new Map<string, PortalDeliverable>();
      if (mockDeliverable) out.set("sub-1", mockDeliverable);
      return out;
    }),
    getMySubmissions: vi.fn(async () => []),
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
  return app;
}

describe("DEC-908: portal home SessionCard's format and deliverable clauses", () => {
  it("renders the format-first meta clause when the session has a parseable format answer", async () => {
    mockSession = baseSession({ format: "Talk (30 min)" });
    mockDeliverable = null;
    const app = await buildPortalApp();
    const html = await (await app.request("/portal")).text();
    expect(html).toContain("Talk, 30 min · Platform &amp; Infra");
  });

  it("omits the format clause entirely when the session has no session_format answer", async () => {
    mockSession = baseSession({ format: null });
    mockDeliverable = null;
    const app = await buildPortalApp();
    const html = await (await app.request("/portal")).text();
    expect(html).not.toContain("Talk,");
    // trackName still renders on its own -- only the format clause is gated.
    expect(html).toContain("Platform &amp; Infra");
  });

  it("omits the format clause when the stored label carries no parseable duration (sessionFormatLabel returns it unchanged)", async () => {
    mockSession = baseSession({ format: "Panel (in Spanish)" });
    mockDeliverable = null;
    const app = await buildPortalApp();
    const html = await (await app.request("/portal")).text();
    expect(html).not.toContain("Panel (in Spanish)");
  });

  it("renders the deliverable's version + review-status clause when a deliverable exists", async () => {
    mockSession = baseSession({});
    mockDeliverable = { id: "file-1", filename: "Slides", sizeBytes: 100, uploadedAt: 0, versionNo: 3 };
    const app = await buildPortalApp();
    const html = await (await app.request("/portal")).text();
    expect(html).toContain("Slides v3 · with the organisers");
  });

  it("renders nothing for the deliverable clause when there is no deliverable", async () => {
    mockSession = baseSession({});
    mockDeliverable = null;
    const app = await buildPortalApp();
    const html = await (await app.request("/portal")).text();
    expect(html).not.toContain("with the organisers");
  });

  it("fails loudly rather than defaulting when a returned deliverable has a null version", async () => {
    mockSession = baseSession({});
    mockDeliverable = { id: "file-1", filename: "Slides", sizeBytes: 100, uploadedAt: 0, versionNo: null };
    const app = await buildPortalApp();
    const res = await app.request("/portal");
    // registerErrorHandler turns the thrown error into a non-200 response
    // rather than silently rendering a fabricated "v1".
    expect(res.status).not.toBe(200);
  });
});

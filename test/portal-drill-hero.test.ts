// DEC-576 (wave-16 amendment): every back-linked /portal/* H1 gets the
// frame's 25px drill register (chq-portal-hero-drill, already declared at
// src/routes/portal/portal.css.ts:934). The dashboard landing H1
// (index.tsx, the "N things to do" hero) has no back link and must NOT
// carry the modifier.
//
// Harness copied from test/portal-page-headings.test.ts's vi.mock blocks
// and buildApp() shape (DEC-613: no second mock stack) -- real Hono
// sub-apps, real app.request() dispatches, no source-scan shortcuts
// (DEC-976: an SSR claim is proven by a request, not a grep).

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { EditableSubmissionData } from "../src/server/repo/portal-edit";
import type { FormFieldDef } from "../src/forms/types";
import type { ContactProfile } from "../src/server/repo/profile";

const speakerAuth: AuthInfo = { userId: "u-1", role: "speaker", orgId: "org-1", contactId: "ct-1" };

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
    getMyTaskAssignments: vi.fn(async () => [
      {
        id: "assign-1",
        taskId: "task-1",
        eventId: "evt-1",
        kind: "general",
        title: "Confirm bio",
        description: null,
        dueDate: null,
        assignedAt: 0,
        required: false,
        status: "pending",
        formId: null,
        deliverableKind: null,
        fileId: null,
        responseJson: null,
        timezone: "UTC",
        completedAt: null,
      },
    ]),
    getAssignmentScope: vi.fn(async () => null),
    getLatestDeliverable: vi.fn(async () => null),
    getMySubmissions: vi.fn(async () => []),
    getPortalSubmissionDetail: vi.fn(async (_db: unknown, id: string) =>
      id === "sub-mine"
        ? {
            id: "sub-mine",
            eventId: "evt-1",
            ref: "SES-004",
            title: "Mine",
            description: "desc",
            status: "pending",
            statusLabel: "Under review",
            submittedAt: 4,
            timezone: "UTC",
            answers: [],
            trackName: null,
            format: null,
            day: null,
            startMin: null,
            endMin: null,
            roomName: null,
          }
        : null,
    ),
    getMyResources: vi.fn(async () => []),
  };
});

vi.mock("../src/server/repo/forms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/forms")>("../src/server/repo/forms");
  return {
    ...actual,
    listFields: vi.fn(async () => []),
  };
});

vi.mock("../src/server/repo/portal-edit", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal-edit")>(
    "../src/server/repo/portal-edit",
  );
  return {
    ...actual,
    loadEditableSubmission: vi.fn(async (): Promise<EditableSubmissionData | null> => ({
      submission: { id: "s1", status: "pending", title: "Talk title", description: "desc" },
      form: { id: "f1", closeDate: null, timezone: "America/Los_Angeles" },
      fields: [
        { id: "first_name", section: "speaker", kind: "text", label: "First name", required: true, position: 0 },
      ] as FormFieldDef[],
      answers: { first_name: "Jane" },
      offeredTrackIds: [],
      allTracks: [],
      selectedTrackIds: [],
      formatLabel: null,
    })),
    getPortalParticipants: vi.fn(async () => []),
    getAllSubmissionParticipants: vi.fn(async () => []),
  };
});

vi.mock("../src/server/repo/profile", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/profile")>("../src/server/repo/profile");
  const profile: ContactProfile = {
    id: "ct-1",
    firstName: "Priya",
    lastName: "Raman",
    title: null,
    company: null,
    bio: null,
    headshotUrl: null,
    socialLinks: { twitter: "", linkedin: "", github: "", website: "" },
  };
  return {
    ...actual,
    getContactProfile: vi.fn(async () => profile),
  };
});

async function buildApp(): Promise<Hono<AppEnv>> {
  const { portalRoutes } = await import("../src/routes/portal/index");
  const { portalTasksRoutes } = await import("../src/routes/portal/tasks");
  const { portalEditRoutes } = await import("../src/routes/portal/edit");
  const { portalProfileRoutes } = await import("../src/routes/portal/profile");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", speakerAuth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/portal", portalRoutes);
  app.route("/portal", portalTasksRoutes);
  app.route("/portal", portalEditRoutes);
  app.route("/portal", portalProfileRoutes);
  return app;
}

/** Extracts the h1 tag's own `class="..."` attribute value from an HTML
 * response, asserting exactly one h1 is present so the class match is
 * unambiguous. */
function h1Class(html: string): string {
  const matches = [...html.matchAll(/<h1 class="([^"]*)"/g)];
  expect(matches.length).toBe(1);
  return matches[0]![1]!;
}

describe("portal drill-hero register (DEC-576 wave-16 amendment)", () => {
  it("GET /portal/profile renders 'Your profile' with both chq-portal-hero and chq-portal-hero-drill", async () => {
    const app = await buildApp();
    const res = await app.request("/portal/profile");
    expect(res.status).toBe(200);
    const html = await res.text();
    // docs/design/Chautauqua Public and Portal.dc.html:534 draws the H1
    // `Your profile` behind the back link -- the profile page's H1 copy
    // is corrected to this frame literal (DEC-576 wave-16 amendment).
    expect(html).toContain(">Your profile<");
    const cls = h1Class(html);
    expect(cls).toContain("chq-portal-hero");
    expect(cls).toContain("chq-portal-hero-drill");
  });

  it("GET /portal/submissions/sub-mine ('Your session') carries both classes", async () => {
    const app = await buildApp();
    const res = await app.request("/portal/submissions/sub-mine");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(">Your session<");
    const cls = h1Class(html);
    expect(cls).toContain("chq-portal-hero");
    expect(cls).toContain("chq-portal-hero-drill");
  });

  it("GET /portal/submissions ('Your submissions') carries both classes", async () => {
    const app = await buildApp();
    const res = await app.request("/portal/submissions");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(">Your submissions<");
    const cls = h1Class(html);
    expect(cls).toContain("chq-portal-hero");
    expect(cls).toContain("chq-portal-hero-drill");
  });

  it("GET /portal/tasks ('Your tasks') carries both classes", async () => {
    const app = await buildApp();
    const res = await app.request("/portal/tasks");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(">Your tasks<");
    const cls = h1Class(html);
    expect(cls).toContain("chq-portal-hero");
    expect(cls).toContain("chq-portal-hero-drill");
  });

  it("GET /portal/resources ('Resources') carries chq-portal-hero-drill alongside the existing resources modifier", async () => {
    const app = await buildApp();
    const res = await app.request("/portal/resources");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(">Resources<");
    const cls = h1Class(html);
    expect(cls).toContain("chq-portal-hero");
    expect(cls).toContain("chq-portal-hero-drill");
    expect(cls).toContain("chq-portal-resources-hero");
  });

  it("GET /portal (dashboard landing) carries chq-portal-hero WITHOUT chq-portal-hero-drill", async () => {
    const app = await buildApp();
    const res = await app.request("/portal");
    expect(res.status).toBe(200);
    const html = await res.text();
    const cls = h1Class(html);
    expect(cls).toContain("chq-portal-hero");
    expect(cls).not.toContain("chq-portal-hero-drill");
  });
});

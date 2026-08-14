// DEC-777 (wave 4 amendment): the speaker's own submission-detail read view
// names who else is on the session, sourced from the SAME getPortalParticipants
// read edit.tsx uses (one call, never a per-participant query), with the
// viewer's own row excluded and a parenthesised role only when it isn't the
// plain "speaker" role. Absent entirely when there's nobody else.

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
        showResources: true,
      },
      submissions: [],
      tasks: [],
      contactName: "Priya Raman",
      contactCompany: null,
    })),
    getMySessions: vi.fn(async () => []),
    getMyInvitations: vi.fn(async () => []),
    getMyTaskAssignments: vi.fn(async () => []),
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
  };
});

const getPortalParticipantsMock = vi.fn(async () => [] as unknown[]);

vi.mock("../src/server/repo/portal-edit", () => ({
  loadEditableSubmission: vi.fn(async () => null),
  getPortalParticipants: getPortalParticipantsMock,
}));

const speakerAuth: AuthInfo = { userId: "u-1", role: "speaker", orgId: "org-1", contactId: "ct-1" };

async function buildApp(auth: AuthInfo | undefined) {
  const { portalRoutes } = await import("../src/routes/portal/index");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    if (auth) c.set("auth", auth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/portal", portalRoutes);
  return app;
}

describe("GET /portal/submissions/:id — co-presenter 'With' line (DEC-777 wave 4 amendment)", () => {
  it("renders a With line naming other participants, excluding the viewer's own row", async () => {
    getPortalParticipantsMock.mockResolvedValueOnce([
      { id: "p-1", contactId: "ct-1", name: "Priya Raman", email: "priya@example.com", role: "speaker", roleLabel: "Speaker", visible: true },
      { id: "p-2", contactId: "ct-2", name: "Dana Ito", email: "dana@example.com", role: "speaker", roleLabel: "Speaker", visible: true },
      { id: "p-3", contactId: "ct-3", name: "Sam Whitfield", email: "sam@example.com", role: "speaker", roleLabel: "Speaker", visible: true },
    ]);
    const app = await buildApp(speakerAuth);
    const res = await app.request("/portal/submissions/sub-mine");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("With Dana Ito, Sam Whitfield");
    expect(html).not.toContain("With Priya Raman");
  });

  it("suffixes a parenthesised role when it isn't the plain speaker role", async () => {
    getPortalParticipantsMock.mockResolvedValueOnce([
      { id: "p-1", contactId: "ct-1", name: "Priya Raman", email: "priya@example.com", role: "speaker", roleLabel: "Speaker", visible: true },
      { id: "p-2", contactId: "ct-2", name: "Dana Ito", email: "dana@example.com", role: "moderator", roleLabel: "Moderator", visible: true },
    ]);
    const app = await buildApp(speakerAuth);
    const res = await app.request("/portal/submissions/sub-mine");
    const html = await res.text();
    expect(html).toContain("With Dana Ito (moderator)");
  });

  it("renders no line at all when the viewer is the only participant", async () => {
    getPortalParticipantsMock.mockResolvedValueOnce([
      { id: "p-1", contactId: "ct-1", name: "Priya Raman", email: "priya@example.com", role: "speaker", roleLabel: "Speaker", visible: true },
    ]);
    const app = await buildApp(speakerAuth);
    const res = await app.request("/portal/submissions/sub-mine");
    const html = await res.text();
    expect(html).not.toContain("With ");
  });

  it("renders no line at all when getPortalParticipants returns nothing", async () => {
    getPortalParticipantsMock.mockResolvedValueOnce([]);
    const app = await buildApp(speakerAuth);
    const res = await app.request("/portal/submissions/sub-mine");
    const html = await res.text();
    expect(html).not.toContain("With ");
  });
});

// DEC-729 (w1-c) route-level: GET /portal/submissions renders the full
// list, speaker-gated like every other /portal/* page; GET
// /portal/submissions/:id 404s for a submission id the caller doesn't own
// (scoping is absolute — no IDOR). Mocking pattern mirrors
// test/portal.test.ts / test/portal-signout.test.ts.

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
    getMySubmissions: vi.fn(async () => [
      { id: "sub-pending", ref: "SES-001", title: "Pending talk", statusLabel: "Under review", submittedAt: 1, trackName: null, format: null },
      { id: "sub-accepted", ref: "SES-002", title: "Accepted talk", statusLabel: "Accepted", submittedAt: 2, trackName: "Platform", format: "Talk" },
      { id: "sub-declined", ref: "SES-003", title: "Declined talk", statusLabel: "Not accepted", submittedAt: 3, trackName: null, format: null },
    ]),
    getPortalSubmissionDetail: vi.fn(async (_db: unknown, id: string) => (id === "sub-mine" ? {
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
    } : null)),
  };
});

vi.mock("../src/server/repo/portal-edit", () => ({
  loadEditableSubmission: vi.fn(async () => null),
  getPortalParticipants: vi.fn(async () => []),
}));

// DEC-945 (wave-65 amendment): the 404 exercised below now renders via
// portalNotFound (src/routes/portal/shared.tsx), which resolves its eyebrow
// via resolveNotFoundEyebrow(c.var.db) -- this suite's db fake is `{}`, so
// the real resolver would throw. Stubbed since the eyebrow lookup is not
// this suite's concern.
vi.mock("../src/server/not-found", async () => {
  const actual = await vi.importActual<typeof import("../src/server/not-found")>("../src/server/not-found");
  return {
    ...actual,
    resolveNotFoundEyebrow: vi.fn(async () => "Not found"),
  };
});

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

describe("GET /portal/submissions (DEC-729)", () => {
  it("lists all owned submissions with their public status labels, each linked to its detail page", async () => {
    const app = await buildApp(speakerAuth);
    const res = await app.request("/portal/submissions");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Pending talk");
    expect(html).toContain("Accepted talk");
    expect(html).toContain("Declined talk");
    expect(html).toContain("Under review");
    expect(html).toContain("Not accepted");
    expect(html).toContain('href="/portal/submissions/sub-pending"');
    expect(html).toContain('href="/portal/submissions/sub-accepted"');
    expect(html).toContain('href="/portal/submissions/sub-declined"');
  });

  it("is speaker-gated: no session redirects to /login, a non-speaker session redirects to /admin", async () => {
    const noAuthApp = await buildApp(undefined);
    const noAuthRes = await noAuthApp.request("/portal/submissions", { redirect: "manual" });
    expect(noAuthRes.status).toBe(302);
    expect(noAuthRes.headers.get("location")).toBe("/login");

    const organizerAuth: AuthInfo = { userId: "u-2", role: "organizer", orgId: "org-1" };
    const organizerApp = await buildApp(organizerAuth);
    const organizerRes = await organizerApp.request("/portal/submissions", { redirect: "manual" });
    expect(organizerRes.status).toBe(302);
    expect(organizerRes.headers.get("location")).toBe("/admin");
  });
});

describe("GET /portal/submissions/:id scoping (DEC-729)", () => {
  it("404s for a submission id the caller doesn't own", async () => {
    const app = await buildApp(speakerAuth);
    const res = await app.request("/portal/submissions/not-mine");
    expect(res.status).toBe(404);
  });

  it("200s and renders the detail for an owned submission, with a back link to the submissions list", async () => {
    const app = await buildApp(speakerAuth);
    const res = await app.request("/portal/submissions/sub-mine");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Mine");
    expect(html).toContain('href="/portal/submissions"');
  });
});

// DEC-777: block-level rows, event-timezone placement (never raw
// detail.day/toISOString), an honest "To be announced" fallback (DEC-666:
// the one room-absence vocabulary), and no
// Participants/Answers dump on this READ view (both stay reachable via
// /portal/submissions/:id/edit, which this task doesn't touch).
describe("GET /portal/submissions/:id — DEC-777 detail rebuild", () => {
  it("formats a placed session's placement line through the event-time helpers, in event-timezone, and announces a null room honestly", async () => {
    const { getPortalSubmissionDetail } = await import("../src/server/repo/portal");
    vi.mocked(getPortalSubmissionDetail).mockResolvedValueOnce({
      id: "sub-placed",
      eventId: "evt-1",
      ref: "SES-005",
      title: "Placed talk",
      description: "An abstract",
      status: "accepted",
      statusLabel: "Accepted",
      submittedAt: Date.UTC(2027, 2, 1),
      timezone: "UTC",
      answers: [],
      trackName: "Platform",
      format: "Talk",
      day: "2027-05-12",
      startMin: 600, // 10:00
      endMin: 660,
      roomName: null,
    });
    const app = await buildApp(speakerAuth);
    const res = await app.request("/portal/submissions/sub-placed");
    expect(res.status).toBe(200);
    const html = await res.text();
    // Same calendar-day treatment as formatCalendarDate (event-time.ts) —
    // never the raw '2027-05-12' string, never toISOString.
    expect(html).not.toContain("2027-05-12");
    expect(html).toContain("May");
    expect(html).toContain("10:00");
    expect(html).toContain("To be announced");
  });

  it("never renders the Participants heading — that capability lives at /portal/submissions/:id/edit instead", async () => {
    const { loadEditableSubmission } = await import("../src/server/repo/portal-edit");
    vi.mocked(loadEditableSubmission).mockResolvedValueOnce({
      submission: { id: "sub-mine", status: "accepted", title: "Mine", description: "desc" },
      form: { id: "form-1", closeDate: null, timezone: "UTC" },
      fields: [],
      answers: {},
      offeredTrackIds: [],
      allTracks: [],
      selectedTrackIds: [],
    });
    const app = await buildApp(speakerAuth);
    const res = await app.request("/portal/submissions/sub-mine");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain("Participants");
    expect(html).not.toContain("Answers");
    expect(html).toContain('href="/portal/submissions/sub-mine/edit"');
  });

  it("puts the back link, status badge and title each on their own block-level row", async () => {
    const app = await buildApp(speakerAuth);
    const res = await app.request("/portal/submissions/sub-mine");
    const html = await res.text();
    expect(html).toContain('class="chq-portal-back-row"');
    expect(html).toContain('class="chq-portal-status-row"');
  });

  it("never shows the welcome tagline on a submission-detail subpage, even when branding sets one", async () => {
    const { getPortalData } = await import("../src/server/repo/portal");
    vi.mocked(getPortalData).mockResolvedValueOnce({
      branding: {
        eventId: "evt-1",
        eventName: "Arbitrary Con",
        welcomeMessage: "Welcome to the speaker portal!",
        accentColor: null,
        logoUrl: null,
      },
      submissions: [],
      tasks: [],
      contactName: "Priya Raman",
      contactCompany: null,
      showResourcesByEventId: { "evt-1": true },
    });
    const app = await buildApp(speakerAuth);
    const res = await app.request("/portal/submissions/sub-mine");
    const html = await res.text();
    expect(html).not.toContain("Welcome to the speaker portal!");
  });
});

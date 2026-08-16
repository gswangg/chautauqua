// w13-d: ONE portal placement grammar (DEC-777) — the portal home's
// "you speak <...>" subline and the submission detail's placement line must
// print the SAME day+time text, never the raw 'YYYY-MM-DD' schedule_slot.day
// column. Also covers the worklist row's dropped task.description field
// (DEC-590).

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import {
  speakerStatusLabel,
  type PortalInvitation,
  type PortalSession,
  type PortalSubmissionDetail,
  type PortalTaskAssignment,
} from "../src/server/repo/portal";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

let mockTasks: PortalTaskAssignment[] = [];
let mockSessions: PortalSession[] = [];
let mockDetail: PortalSubmissionDetail | null = null;

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
      contactCompany: "Latticework Systems",
      showResourcesByEventId: { "evt-1": true },
    })),
    getMySessions: vi.fn(async () => mockSessions),
    getMyInvitations: vi.fn(async () => [] as PortalInvitation[]),
    getMyTaskAssignments: vi.fn(async () => mockTasks),
    getLatestDeliverable: vi.fn(async () => null),
    getMySubmissions: vi.fn(async () => []),
    getPortalSubmissionDetail: vi.fn(async () => mockDetail),
    listDeliverableCandidatesForEvents: vi.fn(async () => new Map()),
    listLatestDeliverables: vi.fn(async () => new Map()),
  };
});

vi.mock("../src/server/repo/portal-edit", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/portal-edit")>(
    "../src/server/repo/portal-edit",
  );
  return {
    ...actual,
    loadEditableSubmission: vi.fn(async () => null),
    getPortalParticipants: vi.fn(async () => []),
  };
});

vi.mock("../src/server/repo/files", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
  return {
    ...actual,
    getFileVersionNumber: vi.fn(async () => null),
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

function taskFixture(overrides: Partial<PortalTaskAssignment>): PortalTaskAssignment {
  return {
    id: "assign-1",
    taskId: "task-1",
    eventId: "evt-1",
    kind: "general",
    title: "Untitled task",
    description: null,
    instructions: null,
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
    ...overrides,
  };
}

const placedSession: PortalSession = {
  submissionId: "sub-1",
  ref: "SES-001",
  title: "A great talk",
  day: "2026-05-12",
  startMin: 600, // 10:00
  endMin: 660,
  roomName: "Room 2A",
  trackName: null,
  acceptedAt: null,
  eventId: "evt-1",
  eventName: "Arbitrary Con",
  timezone: "America/Chicago",
  overlaps: [],
};

const placedDetail: PortalSubmissionDetail = {
  id: "sub-1",
  eventId: "evt-1",
  ref: "SES-001",
  title: "A great talk",
  description: null,
  status: "accepted",
  statusLabel: speakerStatusLabel("accepted"),
  submittedAt: 0,
  timezone: "America/Chicago",
  answers: [],
  trackName: null,
  format: null,
  day: "2026-05-12",
  startMin: 600,
  endMin: 660,
  roomName: "Room 2A",
};

describe("w13-d: portal home + submission detail share ONE placement grammar", () => {
  it("the home subline reads 'you speak Tue 12 May, 10:00' — never the raw YYYY-MM-DD column", async () => {
    mockTasks = [];
    mockSessions = [placedSession];
    mockDetail = null;
    const app = await buildPortalApp();
    const res = await app.request("/portal");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("you speak Tue 12 May, 10:00");
    expect(html).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("the submission detail page's placement line carries the same day+time text as the home subline", async () => {
    mockTasks = [];
    mockSessions = [placedSession];
    mockDetail = placedDetail;
    const app = await buildPortalApp();
    const detailRes = await app.request("/portal/submissions/sub-1");
    expect(detailRes.status).toBe(200);
    const detailHtml = await detailRes.text();
    expect(detailHtml).toContain("Tue 12 May, 10:00");
    expect(detailHtml).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("a task assignment's description renders on the portal home worklist row", async () => {
    mockTasks = [
      taskFixture({
        id: "a1",
        title: "Sign the W-9",
        status: "pending",
        description: "Attach a completed W-9 so we can pay your honorarium.",
      }),
    ];
    mockSessions = [];
    mockDetail = null;
    const app = await buildPortalApp();
    const res = await app.request("/portal");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Attach a completed W-9 so we can pay your honorarium.");
  });
});

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import {
  assertSpeakerContactId,
  isOwnedByContact,
  speakerStatusLabel,
  type PortalInvitation,
  type PortalTaskAssignment,
} from "../src/server/repo/portal";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

// DEC-590: PortalPage becomes a worklist — h1's count must equal exactly
// the rendered pending-task + pending-invitation row count. Mocked the same
// way as test/portal-signout.test.ts (vi.importActual + targeted overrides)
// so the plain unit tests above stay on the real implementations.
let mockTasks: PortalTaskAssignment[] = [];
let mockInvitations: PortalInvitation[] = [];

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
    })),
    getMySessions: vi.fn(async () => []),
    getMyInvitations: vi.fn(async () => mockInvitations),
    getMyTaskAssignments: vi.fn(async () => mockTasks),
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
    kind: "general",
    title: "Untitled task",
    description: null,
    dueDate: null,
    required: false,
    status: "pending",
    formId: null,
    fileId: null,
    responseJson: null,
    timezone: "UTC",
    ...overrides,
  };
}

const inviteFixture: PortalInvitation = {
  participantId: "part-1",
  submissionId: "sub-1",
  ref: "SES-014",
  title: "Panel talk",
  eventName: "Arbitrary Con",
};

describe("PortalPage worklist headline (DEC-590)", () => {
  it("counts exactly the rendered rows: two pending tasks + one pending invitation -> '3 things to do'", async () => {
    mockTasks = [
      taskFixture({ id: "a1", title: "Sign the W-9", status: "pending" }),
      taskFixture({ id: "a2", title: "Upload headshot", kind: "file_request", status: "complete" }),
      taskFixture({ id: "a3", title: "Confirm hotel stay", kind: "form", status: "pending" }),
    ];
    mockInvitations = [inviteFixture];
    const app = await buildPortalApp();
    const res = await app.request("/portal");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/<h1[^>]*>\s*3 things to do\s*<\/h1>/);
    // exactly the pending rows render — the completed task never shows up
    // in the worklist section.
    expect(html).toContain("Sign the W-9");
    expect(html).toContain("Confirm hotel stay");
    expect(html).not.toContain("Upload headshot");
    // invitation row keeps its existing accept/decline forms + CSRF field.
    expect(html).toContain('<form method="post" action="/portal/invitations/part-1">');
    expect(html).toMatch(/<input type="hidden" name="chq_csrf" value="[^"]+"\s*\/?>/);
    expect(html).toMatch(/<input type="hidden" name="action" value="accept"/);
    expect(html).toMatch(/<input type="hidden" name="action" value="decline"/);
  });

  it("reads '1 thing to do' (singular) when exactly one row is pending", async () => {
    mockTasks = [taskFixture({ id: "a1", title: "Only task", status: "pending" })];
    mockInvitations = [];
    const app = await buildPortalApp();
    const res = await app.request("/portal");
    const html = await res.text();
    expect(html).toMatch(/<h1[^>]*>\s*1 thing to do\s*<\/h1>/);
  });

  it("reads '0 things to do' when nothing is pending", async () => {
    mockTasks = [taskFixture({ id: "a1", title: "Done already", status: "complete" })];
    mockInvitations = [];
    const app = await buildPortalApp();
    const res = await app.request("/portal");
    const html = await res.text();
    expect(html).toMatch(/<h1[^>]*>\s*0 things to do\s*<\/h1>/);
  });
});

describe("speakerStatusLabel", () => {
  it("collapses all three queue-ish statuses to 'Under review' — internal queue states must never leak", () => {
    expect(speakerStatusLabel("pending")).toBe("Under review");
    expect(speakerStatusLabel("accept_queue")).toBe("Under review");
    expect(speakerStatusLabel("decline_queue")).toBe("Under review");
  });

  it("maps the two decided statuses to speaker-friendly text", () => {
    expect(speakerStatusLabel("accepted")).toBe("Accepted");
    expect(speakerStatusLabel("declined")).toBe("Not accepted");
  });

  it("throws on an unknown status literal — fail loudly, no silent default", () => {
    expect(() => speakerStatusLabel("bogus" as any)).toThrow();
  });
});

describe("assertSpeakerContactId", () => {
  it("returns the contactId for a well-formed speaker auth", () => {
    expect(assertSpeakerContactId({ role: "speaker", contactId: "c1" })).toBe("c1");
  });

  it("throws when auth is undefined", () => {
    expect(() => assertSpeakerContactId(undefined)).toThrow();
  });

  it("throws when role isn't speaker", () => {
    expect(() => assertSpeakerContactId({ role: "organizer", contactId: "c1" })).toThrow();
  });

  it("throws when a speaker session is missing contactId — data corruption, fail loudly", () => {
    expect(() => assertSpeakerContactId({ role: "speaker" })).toThrow();
  });
});

describe("isOwnedByContact", () => {
  it("is true when the contactId is among the submission's participants", () => {
    expect(isOwnedByContact(["c1", "c2"], "c2")).toBe(true);
  });

  it("is false for a contactId not in the participant list — no IDOR", () => {
    expect(isOwnedByContact(["c1", "c2"], "c3")).toBe(false);
  });

  it("is false for an empty participant list", () => {
    expect(isOwnedByContact([], "c1")).toBe(false);
  });
});

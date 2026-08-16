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
      },
      submissions: [],
      tasks: [],
      contactName: "Priya Raman",
      contactCompany: "Latticework Systems",
      showResourcesByEventId: { "evt-1": true },
    })),
    getMySessions: vi.fn(async () => []),
    getMyInvitations: vi.fn(async () => mockInvitations),
    getMyTaskAssignments: vi.fn(async () => mockTasks),
    getLatestDeliverable: vi.fn(async () => null),
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
    // the completed task renders in "Done" (w15-b), never inside the
    // "Waiting on you" worklist section — check by position, not absence.
    const waitingSection = html.slice(html.indexOf("Waiting on you"), html.indexOf("Your session"));
    expect(waitingSection).not.toContain("Upload headshot");
    expect(html.slice(html.indexOf(">Done<"))).toContain("Upload headshot");
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

// DEC-826: the worklist's "Due" label and overdue mark must reflect the
// effective (assignment-aware) due date, not the raw task.dueDate — a
// speaker added after a task's raw due date is given a deadline they can
// still meet, the same one the organizer's grid/reminder email use.
describe("portal worklist due date (DEC-826 effective date)", () => {
  it("prints the effective due date (assignedAt + grace), not the raw task.dueDate, and is not marked overdue", async () => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const nowApprox = Date.now();
    // Task's raw due date is far in the past — if rendered raw, this row
    // would be badly overdue. The assignment was created 2 days ago, well
    // after that raw date, so the effective due date (assignedAt + 7-day
    // grace, ASSIGNED_LATE_GRACE_DAYS) is ~5 days in the future — not
    // overdue at all.
    const rawTaskDueDate = nowApprox - 365 * DAY_MS;
    const assignedAt = nowApprox - 2 * DAY_MS;
    const expectedEffectiveDue = assignedAt + 7 * DAY_MS;
    mockTasks = [
      taskFixture({
        id: "a1",
        title: "Confirm bio",
        status: "pending",
        dueDate: rawTaskDueDate,
        assignedAt,
      }),
    ];
    mockInvitations = [];
    const app = await buildPortalApp();
    const res = await app.request("/portal");
    const html = await res.text();
    const { formatCalendarDate } = await import("../src/lib/event-time");
    expect(html).toContain(`Due ${formatCalendarDate(expectedEffectiveDue)}`);
    expect(html).not.toContain(`Due ${formatCalendarDate(rawTaskDueDate)}`);
    // not overdue: the effective date is in the future, so no flag renders
    // for this row's title.
    const rowStart = html.indexOf("Confirm bio");
    const rowEnd = html.indexOf("chq-portal-actions", rowStart);
    expect(html.slice(rowStart, rowEnd)).not.toContain("Overdue");
  });

  // DEC-801 (wave 58 amendment, J6): task.dueDate is a UTC-midnight day
  // label, not an instant. A raw compare flags a task overdue as soon as
  // UTC midnight of the due day passes — hours before that calendar day
  // has actually elapsed in a non-UTC event's own timezone. The due day is
  // "16 Jan" (day label = Jan 16 00:00 UTC); this request happens later
  // that same UTC day (Jan 16 18:00 UTC), which the old raw `dueDate < now`
  // compare would already call overdue, but the event's own timezone
  // (America/Los_Angeles, PST/UTC-8) doesn't finish 16 Jan locally until
  // Jan 17 08:00 UTC — so the worklist must not mark it overdue yet.
  it("does not mark a task overdue before its due day has elapsed in the event's own (non-UTC) timezone", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 0, 16, 18, 0, 0));
    try {
      const dueDate = Date.UTC(2026, 0, 16);
      const assignedAt = Date.UTC(2026, 0, 1);
      mockTasks = [
        taskFixture({
          id: "a1",
          title: "Submit slides",
          status: "pending",
          dueDate,
          assignedAt,
          timezone: "America/Los_Angeles",
        }),
      ];
      mockInvitations = [];
      const app = await buildPortalApp();
      const res = await app.request("/portal");
      const html = await res.text();
      const rowStart = html.indexOf("Submit slides");
      const rowEnd = html.indexOf("chq-portal-actions", rowStart);
      expect(html.slice(rowStart, rowEnd)).not.toContain("Overdue");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("portal home rebuild to the mock (w15-b)", () => {
  it("emits no pipe-separated Nav and no <table> — the shell is the mock's card layout, not the old bar+table", async () => {
    mockTasks = [taskFixture({ id: "a1", title: "Sign the W-9", status: "pending" })];
    mockInvitations = [];
    const app = await buildPortalApp();
    const res = await app.request("/portal");
    const html = await res.text();
    expect(html).not.toMatch(/Dashboard<\/a>\s*\|/);
    expect(html).not.toContain("<table");
  });

  it("renders the three section labels in order: Waiting on you, Your session, Done", async () => {
    mockTasks = [taskFixture({ id: "a1", title: "Sign the W-9", status: "pending" })];
    mockInvitations = [];
    const app = await buildPortalApp();
    const res = await app.request("/portal");
    const html = await res.text();
    const waitingIdx = html.indexOf("Waiting on you");
    const sessionIdx = html.indexOf("Your session");
    const doneIdx = html.indexOf(">Done<");
    expect(waitingIdx).toBeGreaterThan(-1);
    expect(sessionIdx).toBeGreaterThan(waitingIdx);
    expect(doneIdx).toBeGreaterThan(sessionIdx);
  });

  it("worklist count in the hero still equals exactly the rendered pending rows", async () => {
    mockTasks = [
      taskFixture({ id: "a1", title: "Sign the W-9", status: "pending" }),
      taskFixture({ id: "a2", title: "Upload headshot", kind: "file_request", status: "complete" }),
    ];
    mockInvitations = [inviteFixture];
    const app = await buildPortalApp();
    const res = await app.request("/portal");
    const html = await res.text();
    expect(html).toMatch(/<h1[^>]*>\s*2 things to do\s*<\/h1>/);
    expect(html).toContain("Sign the W-9");
    expect(html).toContain(inviteFixture.title);
    // the completed task shows up in Done, not the worklist count.
    expect(html).toContain("Upload headshot");
  });

  it("keeps /portal/tasks, /portal/profile, /portal/resources reachable", async () => {
    mockTasks = [];
    mockInvitations = [];
    const app = await buildPortalApp();
    const res = await app.request("/portal");
    const html = await res.text();
    expect(html).toContain('href="/portal/tasks"');
    expect(html).toContain('href="/portal/profile"');
    expect(html).toContain('href="/portal/resources"');
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

// DEC-777: the welcome tagline is confined to the portal home route, so
// subpages lead with the wordmark + identity instead of displacing it.
describe("portal home tagline (DEC-777)", () => {
  it("renders the welcome tagline on GET /portal", async () => {
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
    mockTasks = [];
    mockInvitations = [];
    const app = await buildPortalApp();
    const res = await app.request("/portal");
    const html = await res.text();
    expect(html).toContain("Welcome to the speaker portal!");
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

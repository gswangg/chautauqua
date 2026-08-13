import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import {
  assertOwnAssignment,
  canTransitionInvite,
  isParticipantInEvent,
  nextInviteStatus,
  type PortalAssignmentScope,
} from "../src/server/repo/portal";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

// DEC-590/w2-g: /portal/tasks renders through the same shared PortalLayout
// footer as the dashboard — sign-out demotion is placement-only and must
// survive here too, byte-identical in POST behaviour.
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
    getMyTaskAssignments: vi.fn(async () => []),
    getAssignmentScope: vi.fn(),
  };
});

vi.mock("../src/server/repo/tasks", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/tasks")>("../src/server/repo/tasks");
  return {
    ...actual,
    updateAssignmentStatus: vi.fn(async () => ({})),
  };
});

const speakerAuth: AuthInfo = { userId: "u-1", role: "speaker", orgId: "org-1", contactId: "ct-1" };

describe("portal tasks page shell sign-out", () => {
  it("GET /portal/tasks still renders the demoted POST /logout footer form", async () => {
    const { portalTasksRoutes } = await import("../src/routes/portal/tasks");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", speakerAuth);
      c.set("db", {} as never);
      await next();
    });
    app.route("/portal", portalTasksRoutes);

    const res = await app.request("/portal/tasks");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<form method="post" action="/logout"');
    expect(html).toMatch(/<input type="hidden" name="chq_csrf" value="[^"]+"\s*\/?>/);
    const mainCloseIndex = html.indexOf("</main>");
    const formIndex = html.indexOf('<form method="post" action="/logout"');
    expect(formIndex).toBeGreaterThan(mainCloseIndex);
  });
});

// DEC-953: display copy only — assignment status pills read "To do"/"Done"
// on screen while the underlying status stays pending|complete on the wire
// (DB column, updateAssignmentStatus argument, and POST route untouched).
describe("portal tasks page — DEC-953 status pill wording", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders 'To do' for a pending assignment and 'Done' for a complete one, with the wire status untouched", async () => {
    const { getMyTaskAssignments } = await import("../src/server/repo/portal");
    vi.mocked(getMyTaskAssignments).mockResolvedValue([
      {
        id: "assign-pending",
        taskId: "task-1",
        eventId: "event-1",
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
      {
        id: "assign-complete",
        taskId: "task-2",
        eventId: "event-1",
        kind: "general",
        title: "Sign release",
        description: null,
        dueDate: null,
        assignedAt: 0,
        required: false,
        status: "complete",
        formId: null,
        deliverableKind: null,
        fileId: null,
        responseJson: null,
        timezone: "UTC",
        completedAt: 1,
      },
    ]);

    const { portalTasksRoutes } = await import("../src/routes/portal/tasks");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", speakerAuth);
      c.set("db", {} as never);
      await next();
    });
    app.route("/portal", portalTasksRoutes);

    const res = await app.request("/portal/tasks");
    expect(res.status).toBe(200);
    const html = await res.text();

    // display copy: "To do" / "Done", not "Pending" / "Completed"
    expect(html).toContain("To do");
    expect(html).toContain("Done");
    expect(html).not.toMatch(/>Pending</);
    expect(html).not.toMatch(/>Completed</);
    // class hooks and the summary line stay stable, just the count word changes
    expect(html).toContain("chq-flag chq-portal-flag-done");
    expect(html).toContain("1 of 2 done");
    // the "Mark complete" button label and the POST endpoint are unchanged
    expect(html).toContain(">Mark complete<");
    expect(html).toContain('action="/portal/tasks/assign-pending/complete"');
  });

  it("POST /portal/tasks/:id/complete still calls updateAssignmentStatus with the literal 'complete' status", async () => {
    const { getAssignmentScope } = await import("../src/server/repo/portal");
    vi.mocked(getAssignmentScope).mockResolvedValue({
      id: "assign-pending",
      taskId: "task-1",
      eventId: "event-1",
      kind: "general",
      formId: null,
      deliverableKind: null,
      contactId: "ct-1",
      orgId: "org-1",
      status: "pending",
      fileId: null,
    });

    const { updateAssignmentStatus } = await import("../src/server/repo/tasks");
    const { portalTasksRoutes } = await import("../src/routes/portal/tasks");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", speakerAuth);
      c.set("db", {} as never);
      await next();
    });
    app.route("/portal", portalTasksRoutes);

    const form = new URLSearchParams();
    form.set("chq_csrf", "tok-1");
    const res = await app.request("/portal/tasks/assign-pending/complete", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: "chq_csrf=tok-1",
      },
      body: form.toString(),
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/portal/tasks");
    expect(vi.mocked(updateAssignmentStatus)).toHaveBeenCalledWith(
      expect.anything(),
      "assign-pending",
      "complete",
      speakerAuth.userId,
      expect.any(Date),
    );
  });
});

describe("assertOwnAssignment", () => {
  const scope: PortalAssignmentScope = {
    id: "a1",
    taskId: "t1",
    eventId: "e1",
    kind: "general",
    formId: null,
    deliverableKind: null,
    contactId: "c1",
    orgId: "org1",
    status: "pending",
    fileId: null,
  };

  it("does not throw when the assignment belongs to the contact", () => {
    expect(() => assertOwnAssignment(scope, "c1")).not.toThrow();
  });

  it("throws when the assignment belongs to a different contact — no IDOR", () => {
    expect(() => assertOwnAssignment(scope, "c2")).toThrow();
  });
});

describe("canTransitionInvite", () => {
  it("allows a transition only from 'invited'", () => {
    expect(canTransitionInvite("invited")).toBe(true);
  });

  it("rejects transitions from 'none', 'accepted', or 'declined'", () => {
    expect(canTransitionInvite("none")).toBe(false);
    expect(canTransitionInvite("accepted")).toBe(false);
    expect(canTransitionInvite("declined")).toBe(false);
  });
});

describe("nextInviteStatus", () => {
  it("maps 'accept' -> 'accepted' and 'decline' -> 'declined'", () => {
    expect(nextInviteStatus("accept")).toBe("accepted");
    expect(nextInviteStatus("decline")).toBe("declined");
  });
});

describe("isParticipantInEvent", () => {
  it("is true when the resource's event is among the speaker's events", () => {
    expect(isParticipantInEvent(["e1", "e2"], "e2")).toBe(true);
  });

  it("is false for an event the speaker doesn't participate in — no IDOR across events", () => {
    expect(isParticipantInEvent(["e1", "e2"], "e3")).toBe(false);
  });

  it("is false for an empty event list", () => {
    expect(isParticipantInEvent([], "e1")).toBe(false);
  });
});

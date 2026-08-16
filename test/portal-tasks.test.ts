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
    listDeliverableCandidates: vi.fn(async () => []),
    // DEC-891 (wave 34 amendment): loadTasksPageData now reads candidates
    // via the batched-over-event-ids form, not once per event.
    listDeliverableCandidatesForEvents: vi.fn(async () => new Map()),
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
      },
      {
        id: "assign-complete",
        taskId: "task-2",
        eventId: "event-1",
        kind: "general",
        title: "Sign release",
        description: null,
        instructions: null,
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
    expect(html).not.toContain("1 of 2 done"); // G13 (frame 10--05): the undrawn progress bar is retired
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
      speakerAuth.contactId,
    );
  });
});

// DEC-020 amendment (wave 10): a submission-linked re-upload silently
// reopens content review (see test/task-upload-content.test.ts for the
// reopenContentReview call itself) — the portal must say so before the
// upload and confirm it after.
describe("portal tasks page — DEC-020 amendment: re-upload review notice", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  function assignment(overrides: Partial<Record<string, unknown>>) {
    return {
      id: "assign-file",
      taskId: "task-1",
      eventId: "event-1",
      kind: "file_request",
      title: "Upload your slides",
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

  it("renders the reopen-review notice for a submission-linked (deliverableKind set) file_request assignment", async () => {
    const { getMyTaskAssignments } = await import("../src/server/repo/portal");
    vi.mocked(getMyTaskAssignments).mockResolvedValue([
      assignment({ deliverableKind: "presentation" }) as never,
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
    expect(html).toContain("sends it back to the producer for review");
    expect(html).toContain("will not appear on the public schedule");
  });

  it("renders NO notice for a plain handout (deliverableKind null) file_request assignment", async () => {
    const { getMyTaskAssignments } = await import("../src/server/repo/portal");
    vi.mocked(getMyTaskAssignments).mockResolvedValue([assignment({ deliverableKind: null }) as never]);

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
    expect(html).not.toContain("sends it back to the producer for review");
    expect(html).not.toContain("will not appear on the public schedule");
  });

  it("renders a post-upload receipt naming the assignment when ?uploaded=<id> is present", async () => {
    const { getMyTaskAssignments } = await import("../src/server/repo/portal");
    vi.mocked(getMyTaskAssignments).mockResolvedValue([
      assignment({ id: "assign-file", title: "Upload your slides", deliverableKind: "presentation" }) as never,
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

    const res = await app.request("/portal/tasks?uploaded=assign-file");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Received your file");
    expect(html).toContain("Upload your slides");
    expect(html).toMatch(/off the public schedule pending the producer/);
  });

  it("renders no receipt banner without the ?uploaded= flag", async () => {
    const { getMyTaskAssignments } = await import("../src/server/repo/portal");
    vi.mocked(getMyTaskAssignments).mockResolvedValue([
      assignment({ id: "assign-file", title: "Upload your slides", deliverableKind: "presentation" }) as never,
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
    expect(html).not.toContain("Received your file");
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

// DEC-029 amendment: assertOwnAssignmentOr403's catch must only relabel the
// ONE legitimate ownership mismatch (ForeignAssignmentError) as a 403 — any
// other exception from assertOwnAssignment is an internal fault and must
// surface untouched (not be mislabeled as "does not belong to you").
describe("assertOwnAssignmentOr403 (DEC-029 amendment)", () => {
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

  it("the genuine foreign-contact case still throws a 403 ApiError", async () => {
    const { assertOwnAssignmentOr403 } = await import("../src/routes/portal/tasks/shared");
    try {
      assertOwnAssignmentOr403(scope, "c2");
      expect.unreachable();
    } catch (err) {
      expect((err as { status?: number }).status).toBe(403);
      expect((err as Error).message).toBe("This task assignment does not belong to you");
    }
  });

  it("a non-ownership exception from assertOwnAssignment surfaces untouched, not mislabeled as 403", async () => {
    vi.resetModules();
    vi.doMock("../src/server/repo/portal", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/portal")>("../src/server/repo/portal");
      return {
        ...actual,
        assertOwnAssignment: () => {
          throw new TypeError("internal fault, not an ownership mismatch");
        },
      };
    });
    const { assertOwnAssignmentOr403 } = await import("../src/routes/portal/tasks/shared");
    expect(() => assertOwnAssignmentOr403(scope, "c1")).toThrow(TypeError);
    expect(() => assertOwnAssignmentOr403(scope, "c1")).toThrow("internal fault, not an ownership mismatch");
    vi.doUnmock("../src/server/repo/portal");
    vi.resetModules();
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

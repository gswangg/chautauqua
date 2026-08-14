// DEC-009 amendment (wave 59): a pending 'general' assignment whose task
// title is PROFILE_TASK_TITLE ("Finalize bio + headshot") renders a card
// linking to /portal/profile, never a bare mark-done checkbox and never a
// file-upload widget/deliverable-kind picker. Mirrors
// test/portal-tasks.test.ts's mock-repo GET /portal/tasks pattern.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { PROFILE_TASK_TITLE } from "../src/domain/acceptance";

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

describe("DEC-009 amendment: portal task card for PROFILE_TASK_TITLE", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders a profile link, not a mark-done checkbox or upload widget, for a pending 'Finalize bio + headshot' assignment", async () => {
    const { getMyTaskAssignments } = await import("../src/server/repo/portal");
    vi.mocked(getMyTaskAssignments).mockResolvedValue([
      {
        id: "assign-profile",
        taskId: "task-1",
        eventId: "event-1",
        kind: "general",
        title: PROFILE_TASK_TITLE,
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

    expect(html).toContain('href="/portal/profile"');
    expect(html).toContain("Update your bio and headshot");
    // No mark-done checkbox/button for this specific task's row.
    expect(html).not.toContain(`action="/portal/tasks/assign-profile/complete"`);
    // No upload widget for this row (kind='general', so this is also
    // guaranteed structurally, but pin it explicitly against regressions).
    expect(html).not.toContain(`action="/portal/tasks/assign-profile/upload"`);
    expect(html).not.toMatch(/name="file"[^>]*required/);
  });

  it("a different general task still renders the ordinary mark-done form", async () => {
    const { getMyTaskAssignments } = await import("../src/server/repo/portal");
    vi.mocked(getMyTaskAssignments).mockResolvedValue([
      {
        id: "assign-other",
        taskId: "task-2",
        eventId: "event-1",
        kind: "general",
        title: "Announce participation",
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
    expect(html).toContain(`action="/portal/tasks/assign-other/complete"`);
  });
});

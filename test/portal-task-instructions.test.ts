// CNT-01: a task carries INSTRUCTIONS end to end -- the speaker's own task
// row renders them in plain body ink, never behind a disclosure. Same mock
// pattern as test/portal-tasks.test.ts.

import { afterEach, describe, expect, it, vi } from "vitest";
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
    })),
    getMyTaskAssignments: vi.fn(async () => [
      {
        id: "assign-1",
        taskId: "task-1",
        eventId: "event-1",
        kind: "file_request" as const,
        title: "Upload your slides",
        description: null,
        instructions: "16:9, under 20 MB, PDF or Keynote",
        dueDate: null,
        assignedAt: 0,
        required: true,
        status: "pending",
        formId: null,
        deliverableKind: null,
        fileId: null,
        responseJson: null,
        timezone: "UTC",
        completedAt: null,
      },
    ]),
    getAssignmentScope: vi.fn(),
    listDeliverableCandidates: vi.fn(async () => []),
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

afterEach(() => {
  vi.clearAllMocks();
});

describe("portal /portal/tasks — CNT-01 instructions render on the row", () => {
  it("renders the task's instructions in plain body ink, not behind a disclosure (no <details>)", async () => {
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

    expect(html).toContain("16:9, under 20 MB, PDF or Keynote");
    expect(html).toContain("chq-portal-instructions");
    // never behind a disclosure
    expect(html).not.toMatch(/<details[^>]*>[\s\S]*16:9, under 20 MB, PDF or Keynote/);
  });
});

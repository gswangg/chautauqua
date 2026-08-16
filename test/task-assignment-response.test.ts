// DEC-291 regression: GET /api/v1/task-assignments/:id/response is the only
// organizer-facing read path for a kind='form' task_assignment's saved
// answers. Route-level test with the repo layer mocked, same pattern as
// test/tasks-assign-org-scope.test.ts (Hono app mounted directly with a
// stamped auth var, no D1/wrangler dependency in stage 1).

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { AssignmentResponseDetail } from "../src/server/repo/tasks";

const ORG_A = "org-a";
const ORG_B = "org-b";

const ASSIGNMENT_FORM = "assignment-form-1";
const ASSIGNMENT_GENERAL = "assignment-general-1";
const ASSIGNMENT_OTHER_ORG = "assignment-other-org-1";

interface AssignmentOwnershipRow {
  eventId: string;
  orgId: string;
  contactId: string;
  kind: string;
  responseJson: string | null;
  fileId: string | null;
}

const OWNERSHIP_ROWS: Record<string, AssignmentOwnershipRow> = {
  [ASSIGNMENT_FORM]: {
    eventId: "event-1",
    orgId: ORG_A,
    contactId: "contact-1",
    kind: "form",
    responseJson: '{"f1":"The Grand","f2":"yes"}',
    fileId: null,
  },
  [ASSIGNMENT_GENERAL]: {
    eventId: "event-1",
    orgId: ORG_A,
    contactId: "contact-1",
    kind: "general",
    responseJson: null,
    fileId: null,
  },
  [ASSIGNMENT_OTHER_ORG]: {
    eventId: "event-2",
    orgId: ORG_B,
    contactId: "contact-2",
    kind: "form",
    responseJson: "{}",
    fileId: null,
  },
};

const DETAIL: AssignmentResponseDetail = {
  assignmentId: ASSIGNMENT_FORM,
  taskTitle: "Hotel stay requirement form",
  contact: { id: "contact-1", name: "Ada Lovelace", email: "ada@example.com" },
  status: "complete",
  completedAt: 1700000000000,
  fields: [
    { label: "Hotel name", value: "The Grand" },
    { label: "Special requests", value: "" },
  ],
};

vi.mock("../src/server/repo/tasks", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/tasks")>("../src/server/repo/tasks");
  return {
    ...actual,
    getAssignmentOwnership: vi.fn(async (_db: unknown, assignmentId: string) => OWNERSHIP_ROWS[assignmentId] ?? null),
    getAssignmentResponseDetail: vi.fn(async (_db: unknown, assignmentId: string) =>
      assignmentId === ASSIGNMENT_FORM ? DETAIL : null,
    ),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

async function buildApp(auth: AuthInfo) {
  const { taskRoutes } = await import("../src/routes/tasks");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/api/v1", taskRoutes);
  return app;
}

const ORGANIZER_A: AuthInfo = { userId: "u1", role: "organizer", orgId: ORG_A };

function getResponseRequest(assignmentId: string) {
  return new Request(`http://test/api/v1/task-assignments/${assignmentId}/response`);
}

describe("DEC-291: GET /task-assignments/:id/response", () => {
  it("200s with fields in listFields order, blank value for unanswered fields", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(getResponseRequest(ASSIGNMENT_FORM));
    expect(res.status).toBe(200);
    const body = (await res.json()) as AssignmentResponseDetail;
    expect(body.fields).toEqual([
      { label: "Hotel name", value: "The Grand" },
      { label: "Special requests", value: "" },
    ]);
    expect(body.contact.name).toBe("Ada Lovelace");
  });

  it("404s an assignment belonging to a different org (existence-hiding)", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(getResponseRequest(ASSIGNMENT_OTHER_ORG));
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("not_found");
  });

  it("404s an assignment id that does not exist at all", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(getResponseRequest("does-not-exist"));
    expect(res.status).toBe(404);
  });

  it("400s a non-form task", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(getResponseRequest(ASSIGNMENT_GENERAL));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid");
  });
});

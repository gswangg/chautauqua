// DEC-214 regression: PATCH /api/v1/task-assignments/:id must gate the
// owning speaker's transition to 'complete' by task kind — 'form' requires a
// saved response_json, 'file_request' requires a stored file_id — while the
// organizer path stays a deliberately ungated manual J6 grid override.
// Route-level test with the repo layer mocked, same pattern as
// test/tasks-assign-org-scope.test.ts (Hono app mounted directly with a
// stamped auth var, no D1/wrangler dependency in stage 1).

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";
const CONTACT_SPEAKER = "contact-speaker-1";
const EVENT_ID = "event-1";

const ASSIGNMENT_FORM_NO_RESPONSE = "assignment-form-empty";
const ASSIGNMENT_FORM_WITH_RESPONSE = "assignment-form-filled";
const ASSIGNMENT_FILE_NO_FILE = "assignment-file-empty";
const ASSIGNMENT_FILE_WITH_FILE = "assignment-file-filled";
const ASSIGNMENT_GENERAL = "assignment-general";
const ASSIGNMENT_COMPLETE_TO_PENDING = "assignment-complete-to-pending";

interface AssignmentOwnershipRow {
  eventId: string;
  orgId: string;
  contactId: string;
  kind: string;
  responseJson: string | null;
  fileId: string | null;
}

const OWNERSHIP_ROWS: Record<string, AssignmentOwnershipRow> = {
  [ASSIGNMENT_FORM_NO_RESPONSE]: {
    eventId: EVENT_ID,
    orgId: ORG_A,
    contactId: CONTACT_SPEAKER,
    kind: "form",
    responseJson: null,
    fileId: null,
  },
  [ASSIGNMENT_FORM_WITH_RESPONSE]: {
    eventId: EVENT_ID,
    orgId: ORG_A,
    contactId: CONTACT_SPEAKER,
    kind: "form",
    responseJson: '{"answer":"yes"}',
    fileId: null,
  },
  [ASSIGNMENT_FILE_NO_FILE]: {
    eventId: EVENT_ID,
    orgId: ORG_A,
    contactId: CONTACT_SPEAKER,
    kind: "file_request",
    responseJson: null,
    fileId: null,
  },
  [ASSIGNMENT_FILE_WITH_FILE]: {
    eventId: EVENT_ID,
    orgId: ORG_A,
    contactId: CONTACT_SPEAKER,
    kind: "file_request",
    responseJson: null,
    fileId: "file-1",
  },
  [ASSIGNMENT_GENERAL]: {
    eventId: EVENT_ID,
    orgId: ORG_A,
    contactId: CONTACT_SPEAKER,
    kind: "general",
    responseJson: null,
    fileId: null,
  },
  [ASSIGNMENT_COMPLETE_TO_PENDING]: {
    eventId: EVENT_ID,
    orgId: ORG_A,
    contactId: CONTACT_SPEAKER,
    kind: "form",
    responseJson: null,
    fileId: null,
  },
};

const updateAssignmentStatusCalls: { assignmentId: string; status: string }[] = [];

vi.mock("../src/server/repo/tasks", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/tasks")>("../src/server/repo/tasks");
  return {
    ...actual,
    getAssignmentOwnership: vi.fn(async (_db: unknown, assignmentId: string) => OWNERSHIP_ROWS[assignmentId] ?? null),
    updateAssignmentStatus: vi.fn(async (_db: unknown, assignmentId: string, status: string) => {
      updateAssignmentStatusCalls.push({ assignmentId, status });
      return {
        id: assignmentId,
        taskId: "task-1",
        contactId: CONTACT_SPEAKER,
        status,
        completedAt: status === "complete" ? Date.now() : null,
        completedBy: status === "complete" ? "u1" : null,
        fileId: OWNERSHIP_ROWS[assignmentId]?.fileId ?? null,
        responseJson: OWNERSHIP_ROWS[assignmentId]?.responseJson ?? null,
        lastRemindedAt: null,
        createdAt: 0,
        updatedAt: Date.now(),
      };
    }),
  };
});

afterEach(() => {
  vi.clearAllMocks();
  updateAssignmentStatusCalls.length = 0;
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

const SPEAKER: AuthInfo = { userId: "u-speaker", role: "speaker", orgId: ORG_A, contactId: CONTACT_SPEAKER };
const ORGANIZER: AuthInfo = { userId: "u-organizer", role: "organizer", orgId: ORG_A };

function patchRequest(assignmentId: string, status: string) {
  return new Request(`http://test/api/v1/task-assignments/${assignmentId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify({ status }),
  });
}

describe("DEC-214: PATCH /task-assignments/:id speaker-side kind gates", () => {
  it("400s a speaker completing a 'form' task with no saved response, status stays pending (no update call)", async () => {
    const app = await buildApp(SPEAKER);
    const res = await app.request(patchRequest(ASSIGNMENT_FORM_NO_RESPONSE, "complete"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid");
    expect(updateAssignmentStatusCalls).toHaveLength(0);
  });

  it("200s a speaker completing a 'form' task once response_json is saved", async () => {
    const app = await buildApp(SPEAKER);
    const res = await app.request(patchRequest(ASSIGNMENT_FORM_WITH_RESPONSE, "complete"));
    expect(res.status).toBe(200);
    expect(updateAssignmentStatusCalls).toEqual([{ assignmentId: ASSIGNMENT_FORM_WITH_RESPONSE, status: "complete" }]);
  });

  it("400s a speaker completing a 'file_request' task with no file_id", async () => {
    const app = await buildApp(SPEAKER);
    const res = await app.request(patchRequest(ASSIGNMENT_FILE_NO_FILE, "complete"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid");
    expect(updateAssignmentStatusCalls).toHaveLength(0);
  });

  it("200s a speaker completing a 'file_request' task once file_id is set", async () => {
    const app = await buildApp(SPEAKER);
    const res = await app.request(patchRequest(ASSIGNMENT_FILE_WITH_FILE, "complete"));
    expect(res.status).toBe(200);
    expect(updateAssignmentStatusCalls).toEqual([{ assignmentId: ASSIGNMENT_FILE_WITH_FILE, status: "complete" }]);
  });

  it("200s a speaker completing a 'general' task freely", async () => {
    const app = await buildApp(SPEAKER);
    const res = await app.request(patchRequest(ASSIGNMENT_GENERAL, "complete"));
    expect(res.status).toBe(200);
    expect(updateAssignmentStatusCalls).toEqual([{ assignmentId: ASSIGNMENT_GENERAL, status: "complete" }]);
  });

  it("200s an organizer completing a 'form' task with no saved response (manual grid override, ungated)", async () => {
    const app = await buildApp(ORGANIZER);
    const res = await app.request(patchRequest(ASSIGNMENT_FORM_NO_RESPONSE, "complete"));
    expect(res.status).toBe(200);
    expect(updateAssignmentStatusCalls).toEqual([{ assignmentId: ASSIGNMENT_FORM_NO_RESPONSE, status: "complete" }]);
  });

  it("200s a speaker setting a 'form' task back to 'pending' even with no saved response", async () => {
    const app = await buildApp(SPEAKER);
    const res = await app.request(patchRequest(ASSIGNMENT_COMPLETE_TO_PENDING, "pending"));
    expect(res.status).toBe(200);
    expect(updateAssignmentStatusCalls).toEqual([{ assignmentId: ASSIGNMENT_COMPLETE_TO_PENDING, status: "pending" }]);
  });
});

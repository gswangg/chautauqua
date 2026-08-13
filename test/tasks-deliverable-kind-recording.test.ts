// DEC-879: a session recording is a deliverable like any other file kind.
// POST /events/:eventId/tasks must accept deliverableKind='recording' on a
// file_request task, and DELIVERABLE_KINDS must be derived from FILE_KINDS
// (src/domain/files.ts) rather than a hand-listed second copy of the same
// vocabulary — same mock pattern as test/task-form-binding.test.ts.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { FILE_KINDS } from "../src/domain/files";

const EVENT_ID = "event-1";
const ORG_A = "org-a";

const createTaskCalls: unknown[] = [];

vi.mock("../src/server/repo/tasks", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/tasks")>("../src/server/repo/tasks");
  return {
    ...actual,
    getEventOrgId: vi.fn(async (_db: unknown, eventId: string) => (eventId === EVENT_ID ? ORG_A : null)),
    createTask: vi.fn(async (_db: unknown, eventId: string, input: unknown) => {
      createTaskCalls.push({ eventId, input });
      return { id: "new-task", eventId, ...(input as object) };
    }),
  };
});

afterEach(() => {
  vi.clearAllMocks();
  createTaskCalls.length = 0;
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

function postTask(body: Record<string, unknown>) {
  return new Request(`http://test/api/v1/events/${EVENT_ID}/tasks`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

describe("DEC-879: deliverableKind='recording' on a file_request task", () => {
  it("201s a file_request task with deliverableKind='recording'", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(
      postTask({ kind: "file_request", title: "Upload your recording", required: true, deliverableKind: "recording" }),
    );
    expect(res.status).toBe(201);
    expect(createTaskCalls).toHaveLength(1);
    expect((createTaskCalls[0] as { input: { deliverableKind: string } }).input.deliverableKind).toBe("recording");
  });

  it("400s an unknown deliverableKind, listing every FILE_KINDS member (derived, not hand-typed)", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(
      postTask({ kind: "file_request", title: "Upload", required: true, deliverableKind: "video" }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    for (const k of FILE_KINDS) {
      expect(body.error.fields?.deliverableKind).toContain(`'${k}'`);
    }
  });
});

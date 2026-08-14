// CNT-01: a task carries INSTRUCTIONS end to end -- POST/PATCH accept it,
// trim it, treat an empty string as null, and cap it server-side at 2,000
// characters with the DEC-124 field-level error grammar. Same mock pattern
// as test/tasks-deliverable-kind-recording.test.ts.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const EVENT_ID = "event-1";
const ORG_A = "org-a";
const TASK_ID = "task-1";

const createTaskCalls: unknown[] = [];
const updateTaskCalls: unknown[] = [];

vi.mock("../src/server/repo/tasks", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/tasks")>("../src/server/repo/tasks");
  return {
    ...actual,
    getEventOrgId: vi.fn(async (_db: unknown, eventId: string) => (eventId === EVENT_ID ? ORG_A : null)),
    getTaskOwnership: vi.fn(async (_db: unknown, taskId: string) =>
      taskId === TASK_ID
        ? { orgId: ORG_A, eventId: EVENT_ID, kind: "general", title: "Existing task" }
        : null,
    ),
    createTask: vi.fn(async (_db: unknown, eventId: string, input: unknown) => {
      createTaskCalls.push({ eventId, input });
      return { id: "new-task", eventId, ...(input as object) };
    }),
    updateTask: vi.fn(async (_db: unknown, taskId: string, input: unknown) => {
      updateTaskCalls.push({ taskId, input });
      return { id: taskId, ...(input as object) };
    }),
  };
});

afterEach(() => {
  vi.clearAllMocks();
  createTaskCalls.length = 0;
  updateTaskCalls.length = 0;
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

function patchTask(body: Record<string, unknown>) {
  return new Request(`http://test/api/v1/tasks/${TASK_ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

describe("CNT-01: task instructions", () => {
  it("creates a task with instructions and reads them back", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(
      postTask({
        kind: "general",
        title: "Sign the agreement",
        required: true,
        instructions: "  Sign in blue ink and scan back.  ",
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { instructions: string };
    // trimmed server-side
    expect(body.instructions).toBe("Sign in blue ink and scan back.");
    expect(createTaskCalls).toHaveLength(1);
    expect((createTaskCalls[0] as { input: { instructions: string } }).input.instructions).toBe(
      "Sign in blue ink and scan back.",
    );
  });

  it("treats an empty/whitespace instructions string as null on create", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(
      postTask({ kind: "general", title: "No brief", required: true, instructions: "   " }),
    );
    expect(res.status).toBe(201);
    expect((createTaskCalls[0] as { input: { instructions: string | null } }).input.instructions).toBeNull();
  });

  it("400s an over-cap instructions with the DEC-124 field-level error grammar", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(
      postTask({
        kind: "general",
        title: "Too long",
        required: true,
        instructions: "x".repeat(2001),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.instructions).toBe("Too long (max 2,000 characters)");
    expect(createTaskCalls).toHaveLength(0);
  });

  it("accepts exactly the cap length (2,000 chars)", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(
      postTask({
        kind: "general",
        title: "Exactly at cap",
        required: true,
        instructions: "x".repeat(2000),
      }),
    );
    expect(res.status).toBe(201);
  });

  it("PATCHes instructions and trims/caps it the same way", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(patchTask({ instructions: "  Updated brief  " }));
    expect(res.status).toBe(200);
    expect((updateTaskCalls[0] as { input: { instructions: string } }).input.instructions).toBe("Updated brief");
  });

  it("400s an over-cap instructions on PATCH", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(patchTask({ instructions: "y".repeat(2001) }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.instructions).toBe("Too long (max 2,000 characters)");
    expect(updateTaskCalls).toHaveLength(0);
  });

  it("PATCH omitting instructions leaves it untouched", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(patchTask({ title: "Renamed" }));
    expect(res.status).toBe(200);
    const input = (updateTaskCalls[0] as { input: Record<string, unknown> }).input;
    expect("instructions" in input).toBe(false);
  });
});

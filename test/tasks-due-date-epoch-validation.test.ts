// DEC-527: POST/PATCH /tasks dueDate must route through DEC-517's isEpochMs
// so NaN and non-integers 400 instead of silently discarding the value (was
// `typeof body.dueDate === "number"`, which let NaN and 1.5 through as
// "valid" numbers), and epoch 0 must round-trip rather than being nulled by
// the old `input.dueDate ? ... : null` truthiness check in
// src/server/repo/tasks/crud.ts. Route-level: repo layer mocked, same
// pattern as test/tasks-assign-org-scope.test.ts.

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { TaskRecord } from "../src/server/repo/tasks";

const ORG_A = "org-a";
const EVENT_ID = "event-1";
const TASK_ID = "task-1";

function taskRecord(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: TASK_ID,
    eventId: EVENT_ID,
    kind: "general",
    title: "T",
    description: null,
    instructions: null,
    dueDate: null,
    required: false,
    formId: null,
    deliverableKind: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

const createTaskCalls: unknown[] = [];
const updateTaskCalls: { taskId: string; input: unknown }[] = [];
let lastCreatedDueDate: number | null = null;
let lastUpdatedDueDate: number | null | undefined = undefined;

vi.mock("../src/server/repo/tasks", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/tasks")>("../src/server/repo/tasks");
  return {
    ...actual,
    getEventOrgId: vi.fn(async (_db: unknown, eventId: string) => (eventId === EVENT_ID ? ORG_A : null)),
    getTaskOwnership: vi.fn(async (_db: unknown, taskId: string) =>
      taskId === TASK_ID ? { orgId: ORG_A, eventId: EVENT_ID } : null,
    ),
    createTask: vi.fn(async (_db: unknown, _eventId: string, input: { dueDate?: number | null }) => {
      createTaskCalls.push(input);
      lastCreatedDueDate = input.dueDate ?? null;
      return taskRecord({ dueDate: input.dueDate ?? null });
    }),
    updateTask: vi.fn(async (_db: unknown, taskId: string, input: { dueDate?: number | null }) => {
      updateTaskCalls.push({ taskId, input });
      lastUpdatedDueDate = input.dueDate;
      return taskRecord({ dueDate: input.dueDate ?? null });
    }),
  };
});

beforeAll(async () => {
  await import("../src/routes/tasks");
}, 60_000);

afterEach(() => {
  vi.clearAllMocks();
  createTaskCalls.length = 0;
  updateTaskCalls.length = 0;
  lastCreatedDueDate = null;
  lastUpdatedDueDate = undefined;
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

function createRequest(body: Record<string, unknown>) {
  return new Request(`http://test/api/v1/events/${EVENT_ID}/tasks`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

function patchRequest(body: Record<string, unknown>) {
  return new Request(`http://test/api/v1/tasks/${TASK_ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

// NaN has no literal JSON representation (JSON.stringify(NaN) === "null" and
// JSON.parse rejects a bare `NaN` token), so a real HTTP client can never put
// a NaN body.dueDate on the wire as valid JSON. But HonoRequest#json() is
// just `JSON.parse(text)` under the hood -- so a client using a looser
// JSON5-style parser, or a value that lost precision to NaN upstream of
// serialization, can still hand the route handler a parsed object whose
// dueDate is NaN. Spy on the global JSON.parse for exactly one call to
// simulate that parsed-body shape while exercising the real route handler
// end to end (real Hono app, real request/response cycle) -- this is a
// route-level test of the NaN branch, not a unit test of isEpochMs.
function mockNextJsonParseOnce(parsed: unknown) {
  return vi.spyOn(JSON, "parse").mockImplementationOnce(() => parsed);
}

describe("DEC-527: POST /events/:eventId/tasks dueDate via isEpochMs", () => {
  it("400s with 'Must be a ms-epoch integer' for dueDate: NaN", async () => {
    const app = await buildApp(ORGANIZER_A);
    const parseSpy = mockNextJsonParseOnce({ kind: "general", title: "Do the thing", required: false, dueDate: NaN });
    const res = await app.request(createRequest({}));
    parseSpy.mockRestore();
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.dueDate).toBe("Must be a ms-epoch integer");
    expect(createTaskCalls).toHaveLength(0);
  });

  it("400s for dueDate: 1.5 (non-integer float)", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(
      createRequest({ kind: "general", title: "Do the thing", required: false, dueDate: 1.5 }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.dueDate).toBe("Must be a ms-epoch integer");
    expect(createTaskCalls).toHaveLength(0);
  });

  it("200s and round-trips dueDate: 0 (epoch 0 is not falsy-nulled)", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(
      createRequest({ kind: "general", title: "Do the thing", required: false, dueDate: 0 }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as TaskRecord;
    expect(body.dueDate).toBe(0);
    expect(lastCreatedDueDate).toBe(0);
  });
});

describe("DEC-527: PATCH /tasks/:id dueDate via isEpochMs", () => {
  it("400s with 'Must be a ms-epoch integer' for dueDate: NaN", async () => {
    const app = await buildApp(ORGANIZER_A);
    const parseSpy = mockNextJsonParseOnce({ dueDate: NaN });
    const res = await app.request(patchRequest({}));
    parseSpy.mockRestore();
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.dueDate).toBe("Must be a ms-epoch integer");
    expect(updateTaskCalls).toHaveLength(0);
  });

  it("400s for dueDate: 1.5 (non-integer float)", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(patchRequest({ dueDate: 1.5 }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.dueDate).toBe("Must be a ms-epoch integer");
    expect(updateTaskCalls).toHaveLength(0);
  });

  it("200s and round-trips dueDate: 0 (epoch 0 is not falsy-nulled)", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(patchRequest({ dueDate: 0 }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as TaskRecord;
    expect(body.dueDate).toBe(0);
    expect(lastUpdatedDueDate).toBe(0);
  });

  it("still clears a due date with explicit null", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(patchRequest({ dueDate: null }));
    expect(res.status).toBe(200);
    expect(lastUpdatedDueDate).toBeNull();
  });
});

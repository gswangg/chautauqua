// DEC-398 regression: POST /events/:eventId/tasks and PATCH /tasks/:id
// pair kind='form' with a formId that resolves to a form on the task's own
// event -- no free-text id, no cross-event leak, same message whether the
// id is unknown or belongs to another event. Repo layer is mocked so this
// is a pure route-level access-decision test, same pattern as
// test/tasks-assign-org-scope.test.ts (Hono app mounted directly with a
// stamped auth var, no D1/wrangler dependency in stage 1).

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import type { FormRow } from "../src/server/repo/forms";

const EVENT_ID = "event-1";
const OTHER_EVENT_ID = "event-2";
const ORG_A = "org-a";
const TASK_ID = "task-1";
const NON_FORM_TASK_ID = "task-2";

const OWN_FORM_ID = "form-own";
const OTHER_EVENT_FORM_ID = "form-other-event";

function formRow(id: string, eventId: string): FormRow {
  return {
    id,
    eventId,
    title: "Some form",
    intro: null,
    isDefault: false,
    openDate: null,
    closeDate: null,
    tracks: null,
  };
}

const FORMS: Record<string, FormRow> = {
  [OWN_FORM_ID]: formRow(OWN_FORM_ID, EVENT_ID),
  [OTHER_EVENT_FORM_ID]: formRow(OTHER_EVENT_FORM_ID, OTHER_EVENT_ID),
};

const createTaskCalls: unknown[] = [];
const updateTaskCalls: unknown[] = [];

vi.mock("../src/server/repo/tasks", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/tasks")>("../src/server/repo/tasks");
  return {
    ...actual,
    getEventOrgId: vi.fn(async (_db: unknown, eventId: string) =>
      eventId === EVENT_ID || eventId === OTHER_EVENT_ID ? ORG_A : null,
    ),
    getTaskOwnership: vi.fn(async (_db: unknown, taskId: string) => {
      if (taskId === TASK_ID) return { eventId: EVENT_ID, orgId: ORG_A, kind: "form" };
      if (taskId === NON_FORM_TASK_ID) return { eventId: EVENT_ID, orgId: ORG_A, kind: "general" };
      return null;
    }),
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

vi.mock("../src/server/repo/forms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/forms")>("../src/server/repo/forms");
  return {
    ...actual,
    findFormById: vi.fn(async (_db: unknown, formId: string) => FORMS[formId] ?? null),
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
  app.route("/", taskRoutes);
  return app;
}

const ORGANIZER_A: AuthInfo = { userId: "u1", role: "organizer", orgId: ORG_A };

function postTask(body: Record<string, unknown>) {
  return new Request(`http://test/events/${EVENT_ID}/tasks`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

function patchTask(taskId: string, body: Record<string, unknown>) {
  return new Request(`http://test/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

describe("DEC-398: POST /events/:eventId/tasks form-task binding", () => {
  it("201s a form-kind task whose formId resolves to a form on this event", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(
      postTask({ kind: "form", title: "Fill out", required: true, formId: OWN_FORM_ID }),
    );
    expect(res.status).toBe(201);
    expect(createTaskCalls).toHaveLength(1);
  });

  it("400s with fields.formId=Required when kind='form' and formId is absent", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(postTask({ kind: "form", title: "Fill out", required: true }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.formId).toBe("Required");
    expect(createTaskCalls).toHaveLength(0);
  });

  it("400s with the same fields.formId message for an unknown id and a foreign-event id", async () => {
    const app = await buildApp(ORGANIZER_A);
    const resUnknown = await app.request(
      postTask({ kind: "form", title: "Fill out", required: true, formId: "does-not-exist" }),
    );
    const resForeign = await app.request(
      postTask({ kind: "form", title: "Fill out", required: true, formId: OTHER_EVENT_FORM_ID }),
    );
    expect(resUnknown.status).toBe(400);
    expect(resForeign.status).toBe(400);
    const bodyUnknown = (await resUnknown.json()) as { error: { fields?: Record<string, string> } };
    const bodyForeign = (await resForeign.json()) as { error: { fields?: Record<string, string> } };
    expect(bodyUnknown.error.fields?.formId).toBe(bodyForeign.error.fields?.formId);
    expect(createTaskCalls).toHaveLength(0);
  });

  it("400s with fields.formId when kind is not 'form' but a formId is given", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(
      postTask({ kind: "general", title: "Just a task", required: true, formId: OWN_FORM_ID }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.formId).toBeDefined();
    expect(createTaskCalls).toHaveLength(0);
  });
});

describe("DEC-398: PATCH /tasks/:id form-task binding", () => {
  it("200s setting a form-kind task's formId to a form on its own event", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(patchTask(TASK_ID, { formId: OWN_FORM_ID }));
    expect(res.status).toBe(200);
    expect(updateTaskCalls).toHaveLength(1);
  });

  it("400s setting a form-kind task's formId to a form on a different event", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(patchTask(TASK_ID, { formId: OTHER_EVENT_FORM_ID }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.formId).toBeDefined();
    expect(updateTaskCalls).toHaveLength(0);
  });

  it("400s nulling out a form-kind task's formId", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(patchTask(TASK_ID, { formId: null }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.formId).toBeDefined();
    expect(updateTaskCalls).toHaveLength(0);
  });

  it("400s giving a non-form task a formId", async () => {
    const app = await buildApp(ORGANIZER_A);
    const res = await app.request(patchTask(NON_FORM_TASK_ID, { formId: OWN_FORM_ID }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.formId).toBeDefined();
    expect(updateTaskCalls).toHaveLength(0);
  });
});

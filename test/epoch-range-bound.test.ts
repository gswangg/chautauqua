// DEC-517 amendment (wave 42): isEpochMs used to be Number.isInteger with no
// range bound. An out-of-range integer (e.g. 1e18) passed the predicate,
// persisted, and then 500'd every downstream reader that turns a ms-epoch
// day-label into a calendar day (src/lib/timezone.ts dayLabelToYmd ->
// "NaN-NaN-NaN" -> zonedMinutesToUtc throws). This file locks:
//   (i)   the predicate's own unit boundary,
//   (ii)  the AGREEMENT invariant -- every value isEpochMs accepts must also
//         produce a day label isIsoDate() accepts, so the two boundary
//         predicates (DEC-510 dates, DEC-517 epochs) never disagree, and
//   (iii) the route-level refusal: PATCH forms/:formId, PATCH plans/:id, and
//         POST/PATCH tasks all 400 (never 500, never persist) on 1e18.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { isEpochMs, MIN_EPOCH_MS, MAX_EPOCH_MS } from "../src/routes/api/validators";
import { isIsoDate } from "../src/domain/iso-date";

// ---------------------------------------------------------------------
// (i) predicate units
// ---------------------------------------------------------------------

describe("DEC-517 amendment: isEpochMs range bound", () => {
  it("accepts 0, Date.now(), and both bounds", () => {
    expect(isEpochMs(0)).toBe(true);
    expect(isEpochMs(Date.now())).toBe(true);
    expect(isEpochMs(MIN_EPOCH_MS)).toBe(true);
    expect(isEpochMs(MAX_EPOCH_MS)).toBe(true);
  });

  it("rejects out-of-range and non-integer values", () => {
    expect(isEpochMs(1e18)).toBe(false);
    expect(isEpochMs(-1e18)).toBe(false);
    expect(isEpochMs(MAX_EPOCH_MS + 1)).toBe(false);
    expect(isEpochMs(MIN_EPOCH_MS - 1)).toBe(false);
    expect(isEpochMs(NaN)).toBe(false);
    expect(isEpochMs(1.5)).toBe(false);
    expect(isEpochMs("123")).toBe(false);
  });
});

// ---------------------------------------------------------------------
// (ii) agreement contract: isEpochMs(accepted) => derived day is isIsoDate
// ---------------------------------------------------------------------

describe("DEC-517 amendment: isEpochMs/isIsoDate agreement", () => {
  const accepted = [0, 1_700_000_000_000, MIN_EPOCH_MS, MAX_EPOCH_MS, Date.now()];

  it("every value isEpochMs accepts derives a UTC day label isIsoDate() accepts", () => {
    for (const value of accepted) {
      expect(isEpochMs(value)).toBe(true);
      const d = new Date(value);
      const year = String(d.getUTCFullYear()).padStart(4, "0");
      const month = String(d.getUTCMonth() + 1).padStart(2, "0");
      const date = String(d.getUTCDate()).padStart(2, "0");
      const label = `${year}-${month}-${date}`;
      expect(isIsoDate(label), `derived label '${label}' from ${value} failed isIsoDate`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------
// (iii) route-level refusal
// ---------------------------------------------------------------------

const ORG_A = "org-1";
const ORGANIZER: AuthInfo = { userId: "u1", role: "organizer", orgId: ORG_A };

function makeForm(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "form-1",
    eventId: "event-1",
    title: "CFP",
    intro: null,
    isDefault: true,
    openDate: null as number | null,
    closeDate: null as number | null,
    tracks: null,
    ...overrides,
  };
}

let form = makeForm();

vi.mock("../src/server/repo/forms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/forms")>("../src/server/repo/forms");
  return {
    ...actual,
    findFormForOrg: vi.fn(async (_db: unknown, formId: string, orgId: string) =>
      formId === form.id && orgId === ORG_A ? form : null,
    ),
    getOrCreateForm: vi.fn(async () => ({ form, fields: [] })),
    listFields: vi.fn(async () => []),
    listFormsForEvent: vi.fn(async () => [{ id: form.id, title: form.title, isDefault: form.isDefault }]),
    patchForm: vi.fn(async (_db: unknown, _formId: string, patch: Record<string, unknown>) => {
      const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
      form = { ...form, ...defined } as typeof form;
      return form;
    }),
  };
});

function makePlan(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "plan-1",
    eventId: "event-1",
    name: "Plan One",
    instructions: null,
    openDate: null as number | null,
    closeDate: null as number | null,
    filters: null,
    anonymized: false,
    scale: { min: 1, max: 5 },
    criteria: [{ id: "c1", label: "Quality", kind: "rating", weight: 1 }],
    rounds: 1,
    currentRound: 1,
    maxEvaluations: null,
    ...overrides,
  };
}

let plan = makePlan();

vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>("../src/server/repo/review");
  return {
    ...actual,
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
      planId === plan.id && orgId === ORG_A ? plan : null,
    ),
    getPlanById: vi.fn(async (_db: unknown, planId: string) => (planId === plan.id ? plan : null)),
    updatePlan: vi.fn(async (_db: unknown, planId: string, patch: Record<string, unknown>) => {
      const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
      plan = { ...plan, ...defined } as typeof plan;
      return plan;
    }),
    planHasEvaluations: vi.fn(async () => false),
    listRoundsWithEvaluations: vi.fn(async () => []),
  };
});

vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
  return {
    ...actual,
    listTracksForEvent: vi.fn(async () => []),
    getEventForOrg: vi.fn(async (_db: unknown, eventId: string, orgId: string) =>
      eventId === plan.eventId && orgId === ORG_A ? { id: eventId, orgId } : null,
    ),
  };
});

vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  return {
    ...actual,
    makeMailer: vi.fn(() => ({ send: vi.fn(async () => {}) })),
  };
});

const TASK_EVENT_ID = "event-2";
const TASK_ID = "task-1";

vi.mock("../src/server/repo/tasks", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/tasks")>("../src/server/repo/tasks");
  return {
    ...actual,
    getEventOrgId: vi.fn(async (_db: unknown, eventId: string) => (eventId === TASK_EVENT_ID ? ORG_A : null)),
    getTaskOwnership: vi.fn(async (_db: unknown, taskId: string) =>
      taskId === TASK_ID ? { orgId: ORG_A, eventId: TASK_EVENT_ID } : null,
    ),
    createTask: vi.fn(async () => {
      throw new Error("createTask must not be called on a 400");
    }),
    updateTask: vi.fn(async () => {
      throw new Error("updateTask must not be called on a 400");
    }),
  };
});

async function buildFormsApp(auth: AuthInfo) {
  const { formsRoutes } = await import("../src/routes/api/forms");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/", formsRoutes);
  return app;
}

async function buildPlansApp(auth: AuthInfo) {
  const { reviewPlansRoutes } = await import("../src/routes/review/plans");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/", reviewPlansRoutes);
  return app;
}

async function buildTasksApp(auth: AuthInfo) {
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

afterEach(() => {
  vi.clearAllMocks();
  form = makeForm();
  plan = makePlan();
});

describe("DEC-517 amendment: route-level refusal of an out-of-range ms-epoch", () => {
  it("PATCH /api/v1/forms/:formId closeDate: 1e18 -> 400 with fields.closeDate, nothing persisted", async () => {
    const app = await buildFormsApp(ORGANIZER);
    const res = await app.request("/api/v1/forms/form-1", {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ closeDate: 1e18 }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.closeDate).toBeTruthy();
    expect(form.closeDate).toBeNull();
  });

  it("PATCH /api/v1/plans/:id closeDate: 1e18 -> 400 with fields.closeDate, nothing persisted", async () => {
    const app = await buildPlansApp(ORGANIZER);
    const res = await app.request("/api/v1/plans/plan-1", {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ closeDate: 1e18 }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.closeDate).toBeTruthy();
    expect(plan.closeDate).toBeNull();
  });

  it("POST /api/v1/events/:eventId/tasks dueDate: 1e18 -> 400 with fields.dueDate, createTask never called", async () => {
    const app = await buildTasksApp(ORGANIZER);
    const res = await app.request(`/api/v1/events/${TASK_EVENT_ID}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ kind: "general", title: "Do the thing", required: false, dueDate: 1e18 }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.dueDate).toBeTruthy();
  });

  it("PATCH /api/v1/tasks/:id dueDate: 1e18 -> 400 with fields.dueDate, updateTask never called", async () => {
    const app = await buildTasksApp(ORGANIZER);
    const res = await app.request(`/api/v1/tasks/${TASK_ID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ dueDate: 1e18 }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.dueDate).toBeTruthy();
  });
});

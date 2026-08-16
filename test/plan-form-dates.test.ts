// DEC-517 regression coverage for task w29-c: PATCH /api/v1/forms/:formId
// and POST/PATCH .../plans must (a) 400 a non-integer openDate/closeDate
// instead of a silent `typeof !== 'number'` cast, and (b) refuse a
// close-before-open date pair evaluated against the MERGED post-patch
// state -- a PATCH that only sends one side is still checked against the
// other side's already-stored value.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-1";
const ORGANIZER: AuthInfo = { userId: "u1", role: "organizer", orgId: ORG_A };

// DEC-522: forms.ts/shared.ts's date doors now require a UTC-midnight day
// label, not any ms-epoch integer -- these fixtures mint day labels the
// same way the doors expect, preserving the original numeric ordering
// (DAY_1 < DAY_2 < DAY_5).
const DAY_1 = Date.UTC(2027, 0, 1);
const DAY_2 = Date.UTC(2027, 0, 2);
const DAY_5 = Date.UTC(2027, 0, 5);

// ---------------------------------------------------------------------
// Forms surface
// ---------------------------------------------------------------------

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

vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
  return {
    ...actual,
    listTracksForEvent: vi.fn(async () => []),
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

async function patchForm(body: Record<string, unknown>) {
  const app = await buildFormsApp(ORGANIZER);
  return app.request("/api/v1/forms/form-1", {
    method: "PATCH",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------
// Plans surface
// ---------------------------------------------------------------------

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
    createPlan: vi.fn(async (_db: unknown, eventId: string, input: Record<string, unknown>) => ({
      ...makePlan(),
      eventId,
      ...input,
    })),
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

function basePlanBody(overrides: Record<string, unknown> = {}) {
  return {
    name: "New Plan",
    scale: { min: 1, max: 5 },
    criteria: [{ id: "c1", label: "Quality", kind: "rating", weight: 1 }],
    ...overrides,
  };
}

async function postPlan(body: Record<string, unknown>) {
  const app = await buildPlansApp(ORGANIZER);
  return app.request(`/api/v1/events/${plan.eventId}/plans`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(basePlanBody(body)),
  });
}

async function patchPlan(body: Record<string, unknown>) {
  const app = await buildPlansApp(ORGANIZER);
  return app.request(`/api/v1/plans/${plan.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", "x-chq-csrf": "1" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.clearAllMocks();
  form = makeForm();
  plan = makePlan();
});

describe("DEC-517: PATCH /api/v1/forms/:formId date validation", () => {
  it("string openDate -> 400, not a silent null", async () => {
    const res = await patchForm({ openDate: "2027-01-05" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.openDate).toBeTruthy();
    expect(form.openDate).toBeNull(); // repo.patchForm never called
  });

  it("closeDate < openDate (both in body) -> 400 on both fields", async () => {
    const res = await patchForm({ openDate: DAY_2, closeDate: DAY_1 });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.openDate).toBeTruthy();
    expect(body.error.fields?.closeDate).toBeTruthy();
  });

  it("only closeDate sent, lands before the STORED openDate -> 400 (merged-state case)", async () => {
    form = makeForm({ openDate: DAY_5 });
    const res = await patchForm({ closeDate: DAY_1 });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.openDate).toBeTruthy();
    expect(body.error.fields?.closeDate).toBeTruthy();
  });

  it("equal dates -> 200 OK", async () => {
    const res = await patchForm({ openDate: DAY_1, closeDate: DAY_1 });
    expect(res.status).toBe(200);
  });

  it("openDate explicitly null, closeDate set -> 200 OK", async () => {
    form = makeForm({ openDate: DAY_5 });
    const res = await patchForm({ openDate: null, closeDate: DAY_1 });
    expect(res.status).toBe(200);
  });

  it("closeDate explicitly null, openDate set -> 200 OK", async () => {
    const res = await patchForm({ openDate: DAY_1, closeDate: null });
    expect(res.status).toBe(200);
  });

  it("DEC-522: a sub-day instant (not UTC-midnight) -> 400 on openDate", async () => {
    const res = await patchForm({ openDate: DAY_1 + 60_000 });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.openDate).toBeTruthy();
    expect(form.openDate).toBeNull(); // repo.patchForm never called
  });
});

describe("DEC-517: POST /api/v1/events/:eventId/plans date validation", () => {
  it("string openDate -> 400", async () => {
    const res = await postPlan({ openDate: "2027-01-05" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.openDate).toBeTruthy();
  });

  it("closeDate < openDate -> 400 on both fields", async () => {
    const res = await postPlan({ openDate: DAY_2, closeDate: DAY_1 });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.openDate).toBeTruthy();
    expect(body.error.fields?.closeDate).toBeTruthy();
  });

  it("equal dates -> 201 OK", async () => {
    const res = await postPlan({ openDate: DAY_1, closeDate: DAY_1 });
    expect(res.status).toBe(201);
  });

  it("either side null -> 201 OK", async () => {
    const res = await postPlan({ openDate: null, closeDate: DAY_1 });
    expect(res.status).toBe(201);
  });
});

describe("DEC-517: PATCH /api/v1/plans/:id date validation", () => {
  it("string closeDate -> 400", async () => {
    const res = await patchPlan({ closeDate: "2027-01-05" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.closeDate).toBeTruthy();
  });

  it("closeDate < openDate (both in body) -> 400 on both fields", async () => {
    const res = await patchPlan({ openDate: DAY_2, closeDate: DAY_1 });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.openDate).toBeTruthy();
    expect(body.error.fields?.closeDate).toBeTruthy();
  });

  it("only closeDate sent, lands before the STORED openDate -> 400 (merged-state case)", async () => {
    plan = makePlan({ openDate: DAY_5 });
    const res = await patchPlan({ closeDate: DAY_1 });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.openDate).toBeTruthy();
    expect(body.error.fields?.closeDate).toBeTruthy();
  });

  it("equal dates -> 200 OK", async () => {
    const res = await patchPlan({ openDate: DAY_1, closeDate: DAY_1 });
    expect(res.status).toBe(200);
  });

  it("either side explicitly null -> 200 OK", async () => {
    plan = makePlan({ openDate: DAY_5 });
    const res = await patchPlan({ openDate: null, closeDate: DAY_1 });
    expect(res.status).toBe(200);
  });

  it("DEC-522: a sub-day instant (not UTC-midnight) -> 400 on closeDate", async () => {
    const res = await patchPlan({ closeDate: DAY_1 + 60_000 });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.closeDate).toBeTruthy();
  });
});

// DEC-623/DEC-624 coverage for task w6-b: POST /api/v1/plans/:id/reviewers
// accepts either the internal submission id OR its printed ref (e.g.
// SES-014), resolved server-side; PATCH /api/v1/plans/:id refuses to turn
// anonymized off once at least one evaluation was SUBMITTED under it (the
// ratchet), while turning it on is always allowed. Mocking pattern mirrors
// test/review-plan-numeric-validation.test.ts (no D1/wrangler dependency).

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";

function makePlan(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "plan-1",
    eventId: "event-1",
    name: "Plan One",
    instructions: null,
    openDate: null,
    closeDate: null,
    filters: null,
    anonymized: false,
    scale: { min: 1, max: 5 },
    criteria: [{ id: "c1", label: "Quality", kind: "rating", weight: 1 }],
    rounds: 1,
    currentRound: 1,
    maxEvaluations: null,
    anonymizedAt: null,
    timezone: "UTC",
    ...overrides,
  };
}

let plan = makePlan();
let submittedEvaluationCount = 0;
// DEC-799: fixture of submitted-evaluation timestamps, so
// countSubmittedEvaluationsForPlan's mock can genuinely apply a sinceMs
// filter rather than just returning a canned count.
let submittedEvaluationTimestamps: number[] = [];

const submission = { id: "sub-1", ref: "SES-014", title: "Talk", description: null, trackIds: [] };

vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>(
    "../src/server/repo/review",
  );
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
    countSubmittedEvaluationsForPlan: vi.fn(async (_db: unknown, planId: string, sinceMs?: number) => {
      if (planId !== plan.id) return 0;
      if (submittedEvaluationTimestamps.length > 0) {
        return submittedEvaluationTimestamps.filter((t) => sinceMs === undefined || t >= sinceMs).length;
      }
      return submittedEvaluationCount;
    }),
    requireOrgUser: vi.fn(async () => ({ role: "reviewer", email: "rev@org.test" })),
    trackExistsInEvent: vi.fn(async () => true),
    // DEC-354 (amendment, wave 61): the scopeAdvisory pre-read -- no
    // existing plan_reviewer rows in this fixture, so always empty.
    listReviewerRowsForPlan: vi.fn(async () => []),
    getTrackIdsBySubmissionIds: vi.fn(async () => new Map()),
    findSubmissionIdByRefOrId: vi.fn(async (_db: unknown, eventId: string, input: string) => {
      if (eventId !== plan.eventId) return null;
      if (input === submission.id || input === submission.ref) return submission.id;
      return null;
    }),
    // DEC-924 (amendment, wave 47): the singular addReviewer is retired, so
    // the single-pair POST /plans/:id/reviewers path now goes through the
    // set-based addReviewers with a one-element array.
    addReviewers: vi.fn(
      async (
        _db: unknown,
        planId: string,
        inputs: { userId: string; trackId?: string | null; submissionId?: string | null }[],
      ) =>
        inputs.map((input, i) => ({
          id: `pr-${i + 1}`,
          planId,
          userId: input.userId,
          trackId: input.trackId ?? null,
          submissionId: input.submissionId ?? null,
        })),
    ),
    // DEC-659 (amendment, wave 55): POST /plans/:id/reviewers now decorates
    // the row it just wrote with the same batched label lookups the GET list
    // uses. This file drives the route with an empty `{}` db, so the three
    // lookups are stubbed here rather than hitting drizzle.
    getUsersByIds: vi.fn(async (_db: unknown, userIds: string[]) =>
      userIds.map((userId) => ({ userId, email: "rev@org.test" })),
    ),
    getTrackNamesByIds: vi.fn(async (_db: unknown, trackIds: string[]) =>
      new Map(trackIds.map((id) => [id, "Track One"])),
    ),
    getSubmissionLabelsByIds: vi.fn(async (_db: unknown, submissionIds: string[]) =>
      new Map(submissionIds.map((id) => [id, { ref: submission.ref, title: submission.title }])),
    ),
  };
});

vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>(
    "../src/server/repo/events",
  );
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

afterEach(() => {
  vi.clearAllMocks();
  plan = makePlan();
  submittedEvaluationCount = 0;
  submittedEvaluationTimestamps = [];
});

async function buildApp(auth: AuthInfo) {
  const { reviewRoutes } = await import("../src/routes/review");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/", reviewRoutes);
  return app;
}

const organizer: AuthInfo = { userId: "org-user", role: "organizer", orgId: ORG_A };

describe("DEC-623: POST /api/v1/plans/:id/reviewers accepts a ref or an internal id", () => {
  it("resolves a printed ref (SES-014) to the internal submission id", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}/reviewers`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ userId: "rev-1", submissionId: "SES-014" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { submissionId: string };
    expect(body.submissionId).toBe(submission.id);
  });

  it("still accepts the internal id directly", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}/reviewers`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ userId: "rev-1", submissionId: submission.id }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { submissionId: string };
    expect(body.submissionId).toBe(submission.id);
  });

  it("400s on an unknown ref with the field-specific hint message", async () => {
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}/reviewers`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ userId: "rev-1", submissionId: "SES-999" }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields?: Record<string, string> } };
    expect(body.error.fields?.submissionId).toBe(
      "unknown submission for this event — use the ref (e.g. SES-014) or the internal id",
    );
  });
});

describe("DEC-624: PATCH /api/v1/plans/:id anonymity ratchet", () => {
  it("turning anonymized OFF is rejected (409) once evaluations were submitted under it", async () => {
    plan = makePlan({ anonymized: true });
    submittedEvaluationCount = 3;
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ anonymized: false }),
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain("3 evaluations were submitted under anonymity");
    expect(body.error.message).toContain("anonymity cannot be switched off for this plan");
  });

  it("turning anonymized OFF succeeds when no evaluations were submitted under it", async () => {
    plan = makePlan({ anonymized: true });
    submittedEvaluationCount = 0;
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ anonymized: false }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { anonymized: boolean };
    expect(body.anonymized).toBe(false);
  });

  it("DEC-799: evaluations submitted BEFORE anonymity was enabled do not block switching it off", async () => {
    const anonymizedAt = 2_000;
    plan = makePlan({ anonymized: true, anonymizedAt });
    // Submitted before the plan was anonymized -- never made under an
    // anonymity promise, so must not count toward the ratchet.
    submittedEvaluationTimestamps = [1_000, 1_500];
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ anonymized: false }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { anonymized: boolean };
    expect(body.anonymized).toBe(false);
  });

  it("DEC-799: an evaluation submitted AFTER anonymity was enabled blocks switching it off", async () => {
    const anonymizedAt = 2_000;
    plan = makePlan({ anonymized: true, anonymizedAt });
    submittedEvaluationTimestamps = [1_000, 2_500];
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ anonymized: false }),
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain("1 evaluation were submitted under anonymity");
  });

  it("turning anonymized ON is always allowed, even with submitted evaluations", async () => {
    plan = makePlan({ anonymized: false });
    submittedEvaluationCount = 5;
    const app = await buildApp(organizer);
    const res = await app.request(`/api/v1/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ anonymized: true }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { anonymized: boolean };
    expect(body.anonymized).toBe(true);
  });
});

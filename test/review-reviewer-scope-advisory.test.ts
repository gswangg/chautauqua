// DEC-354 (amendment, wave 61): a narrower reviewer scope laid over a
// broader one is an ADVISORY, never a silent supersede and never a
// refusal. POST /api/v1/plans/:id/reviewers still writes the row and
// answers 201, but the envelope grows `scopeAdvisory: string | null` --
// non-null when the row(s) just written are strictly narrower than a row
// the same userId already holds on this plan (a submissionId row under an
// existing all-scope or covering-track row; a trackId row under an
// existing all-scope row). Mocking pattern mirrors
// test/review-reviewers-bulk-assign.test.ts (no D1/wrangler dependency).

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
    timezone: "UTC",
    ...overrides,
  };
}

const plan = makePlan();

// sub-1 is tagged track-a; sub-2 is tagged track-b.
const SUBMISSIONS: Record<string, { id: string; ref: string; trackId: string }> = {
  "sub-1": { id: "sub-1", ref: "SES-1", trackId: "track-a" },
  "sub-2": { id: "sub-2", ref: "SES-2", trackId: "track-b" },
};

// Mutable fixture of the userId's EXISTING plan_reviewer rows, read by
// listReviewerRowsForPlan before the route writes anything new.
let existingRows: { id: string; planId: string; userId: string; trackId: string | null; submissionId: string | null }[] = [];

vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>("../src/server/repo/review");
  return {
    ...actual,
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
      planId === plan.id && orgId === ORG_A ? plan : null,
    ),
    requireOrgUser: vi.fn(async (_db: unknown, userId: string) => {
      if (userId !== "rev-1") throw new Error("unknown user in fixture");
      return { role: "reviewer", email: "rev1@org.test" };
    }),
    trackExistsInEvent: vi.fn(
      async (_db: unknown, trackId: string, eventId: string) =>
        eventId === plan.eventId && (trackId === "track-a" || trackId === "track-b"),
    ),
    findSubmissionIdByRefOrId: vi.fn(async (_db: unknown, eventId: string, input: string) => {
      if (eventId !== plan.eventId) return null;
      const bySub = Object.values(SUBMISSIONS).find((s) => s.id === input || s.ref === input);
      return bySub?.id ?? null;
    }),
    findSubmissionIdsByRefsOrIds: vi.fn(async (_db: unknown, eventId: string, inputs: string[]) => {
      const map = new Map<string, string>();
      if (eventId !== plan.eventId) return map;
      for (const input of inputs) {
        const bySub = Object.values(SUBMISSIONS).find((s) => s.id === input || s.ref === input);
        if (bySub) map.set(input, bySub.id);
      }
      return map;
    }),
    listReviewerRowsForPlan: vi.fn(async (_db: unknown, planId: string) =>
      existingRows.filter((r) => r.planId === planId),
    ),
    getTrackIdsBySubmissionIds: vi.fn(async (_db: unknown, submissionIds: string[]) => {
      const map = new Map<string, string[]>();
      for (const id of submissionIds) {
        const sub = Object.values(SUBMISSIONS).find((s) => s.id === id);
        if (sub) map.set(id, [sub.trackId]);
      }
      return map;
    }),
    addReviewers: vi.fn(
      async (_db: unknown, planId: string, inputs: { userId: string; trackId?: string | null; submissionId?: string | null }[]) =>
        inputs.map((input, i) => ({
          id: `pr-new-${i + 1}`,
          planId,
          userId: input.userId,
          trackId: input.trackId ?? null,
          submissionId: input.submissionId ?? null,
        })),
    ),
    getUsersByIds: vi.fn(async (_db: unknown, userIds: string[]) =>
      userIds.filter((id) => id === "rev-1").map((id) => ({ userId: id, email: "rev1@org.test" })),
    ),
    getTrackNamesByIds: vi.fn(async (_db: unknown, trackIds: string[]) => {
      const map = new Map<string, string>();
      for (const id of trackIds) {
        if (id === "track-a") map.set(id, "Track A");
        if (id === "track-b") map.set(id, "Track B");
      }
      return map;
    }),
    getSubmissionLabelsByIds: vi.fn(async (_db: unknown, submissionIds: string[]) => {
      const map = new Map<string, { ref: string; title: string }>();
      for (const id of submissionIds) {
        const sub = Object.values(SUBMISSIONS).find((s) => s.id === id);
        if (sub) map.set(id, { ref: sub.ref, title: `Title for ${sub.ref}` });
      }
      return map;
    }),
  };
});

afterEach(() => {
  vi.clearAllMocks();
  existingRows = [];
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

function postReviewer(body: Record<string, unknown>) {
  return buildApp(organizer).then((app) =>
    app.request(`/api/v1/plans/${plan.id}/reviewers`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify(body),
    }),
  );
}

describe("DEC-354 (wave 61): POST /plans/:id/reviewers scopeAdvisory", () => {
  it("submissionId row under an existing all-scope row: advisory names the plan-wide row", async () => {
    existingRows = [{ id: "pr-existing", planId: plan.id, userId: "rev-1", trackId: null, submissionId: null }];
    const res = await postReviewer({ userId: "rev-1", submissionId: "SES-1" });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { scopeAdvisory: string | null };
    expect(body.scopeAdvisory).not.toBeNull();
    expect(body.scopeAdvisory).toMatch(/all-submissions/i);
    expect(body.scopeAdvisory).toMatch(/union/i);
  });

  it("submissionId row under an existing covering-track row: advisory names the track", async () => {
    existingRows = [{ id: "pr-existing", planId: plan.id, userId: "rev-1", trackId: "track-a", submissionId: null }];
    const res = await postReviewer({ userId: "rev-1", submissionId: "SES-1" });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { scopeAdvisory: string | null };
    expect(body.scopeAdvisory).not.toBeNull();
    expect(body.scopeAdvisory).toContain("Track A");
    expect(body.scopeAdvisory).toMatch(/union/i);
  });

  it("trackId row under an existing all-scope row: advisory names the plan-wide row", async () => {
    existingRows = [{ id: "pr-existing", planId: plan.id, userId: "rev-1", trackId: null, submissionId: null }];
    const res = await postReviewer({ userId: "rev-1", trackId: "track-a" });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { scopeAdvisory: string | null };
    expect(body.scopeAdvisory).not.toBeNull();
    expect(body.scopeAdvisory).toMatch(/all-submissions/i);
  });

  it("array form: a submissionId under an existing covering-track row also carries the advisory", async () => {
    existingRows = [{ id: "pr-existing", planId: plan.id, userId: "rev-1", trackId: "track-b", submissionId: null }];
    const res = await postReviewer({ userId: "rev-1", submissionIds: ["SES-1", "SES-2"] });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { items: unknown[]; total: number; scopeAdvisory: string | null };
    expect(body.total).toBe(2);
    expect(body.scopeAdvisory).not.toBeNull();
    expect(body.scopeAdvisory).toContain("Track B");
  });

  it("no overlap (trackId row under a DIFFERENT existing track row): scopeAdvisory is null", async () => {
    existingRows = [{ id: "pr-existing", planId: plan.id, userId: "rev-1", trackId: "track-b", submissionId: null }];
    const res = await postReviewer({ userId: "rev-1", trackId: "track-a" });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { scopeAdvisory: string | null };
    expect(body.scopeAdvisory).toBeNull();
  });

  it("no existing rows at all: scopeAdvisory is null", async () => {
    existingRows = [];
    const res = await postReviewer({ userId: "rev-1", submissionId: "SES-1" });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { scopeAdvisory: string | null };
    expect(body.scopeAdvisory).toBeNull();
  });

  it("a DIFFERENT user's all-scope row on the same plan does not trigger the advisory", async () => {
    existingRows = [{ id: "pr-existing", planId: plan.id, userId: "someone-else", trackId: null, submissionId: null }];
    const res = await postReviewer({ userId: "rev-1", submissionId: "SES-1" });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { scopeAdvisory: string | null };
    expect(body.scopeAdvisory).toBeNull();
  });
});

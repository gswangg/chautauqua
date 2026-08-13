// DEC-526: POST /api/v1/plans/:id/remind must count "outstanding" the same
// way GET /api/v1/plans/:id/progress does -- both route the reviewer's
// assigned total through assignedExcludingRecused (DEC-271), so a fully
// recused reviewer never gets nagged and a partially recused reviewer's
// reminder body matches what the producer's own progress panel shows for
// that reviewer. Mocked repo/mailer, mirrors test/review-remind-mailer-
// failure.test.ts's harness pattern (no D1/wrangler dependency in stage 1).

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";

const planRecord = {
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
};

// rev-full: assigned 2 submissions, has recused from BOTH (and completed
// neither) -- zero outstanding once recusals are excluded, so no reminder.
// rev-partial: assigned 2 submissions, recused from ONE, completed NEITHER
// of the remaining -- 1 outstanding once recusals are excluded, both
// endpoints must report that same 1.
const SUBMISSIONS = [
  { id: "sub-1", ref: "S-001", title: "Talk One", description: null, trackIds: [] },
  { id: "sub-2", ref: "S-002", title: "Talk Two", description: null, trackIds: [] },
];

const RECUSALS = [
  { id: "rec-1", planId: planRecord.id, submissionId: "sub-1", userId: "rev-full", reason: null },
  { id: "rec-2", planId: planRecord.id, submissionId: "sub-2", userId: "rev-full", reason: null },
  { id: "rec-3", planId: planRecord.id, submissionId: "sub-1", userId: "rev-partial", reason: null },
];

vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>(
    "../src/server/repo/review",
  );
  return {
    ...actual,
    listRecusalsForPlan: vi.fn(async () => RECUSALS),
    listRecusalsForReviewer: vi.fn(async () => []),
    hasRecusal: vi.fn(async () => null),
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
      planId === planRecord.id && orgId === ORG_A ? planRecord : null,
    ),
    listReviewerRowsForPlan: vi.fn(async () => [
      { id: "pr-1", planId: planRecord.id, userId: "rev-full", trackId: null, submissionId: null },
      { id: "pr-2", planId: planRecord.id, userId: "rev-partial", trackId: null, submissionId: null },
    ]),
    getUsersByIds: vi.fn(async () => [
      { userId: "rev-full", email: "full@example.test" },
      { userId: "rev-partial", email: "partial@example.test" },
    ]),
    batchUserDisplayNames: vi.fn(async () => new Map()),
    listEvaluationsForPlan: vi.fn(async () => []),
    listCompletedPairsForPlan: vi.fn(async () => []),
    listPlanFilteredSubmissions: vi.fn(async () => SUBMISSIONS),
  };
});

const sentTo: string[] = [];
let capturedText = "";
const sendMock = vi.fn(async (input: { to: { email: string }; text: string }) => {
  sentTo.push(input.to.email);
  if (input.to.email === "partial@example.test") capturedText = input.text;
});

vi.mock("../src/server/context", async () => {
  const actual = await vi.importActual<typeof import("../src/server/context")>("../src/server/context");
  return {
    ...actual,
    makeMailer: vi.fn(() => ({ send: sendMock })),
  };
});

afterEach(() => {
  vi.clearAllMocks();
  sentTo.length = 0;
  capturedText = "";
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

describe("DEC-526: remind and progress agree on outstanding counts (DEC-271 recusal exclusion)", () => {
  it("skips a reviewer who has recused from every assigned submission", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/plans/${planRecord.id}/remind`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: "{}",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { reminded: string[]; sent: number };
    expect(body.reminded).not.toContain("rev-full");
    expect(sentTo).not.toContain("full@example.test");
  });

  it("reports the same outstanding count for a partially recused reviewer as the progress panel", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });

    const progressRes = await app.request(`/api/v1/plans/${planRecord.id}/progress`, {
      headers: { "content-type": "application/json" },
    });
    expect(progressRes.status).toBe(200);
    const progressBody = (await progressRes.json()) as {
      items: { userId: string; assigned: number; completed: number }[];
    };
    const partialRow = progressBody.items.find((r) => r.userId === "rev-partial");
    expect(partialRow).toBeDefined();
    const progressOutstanding = (partialRow!.assigned) - (partialRow!.completed);

    const remindRes = await app.request(`/api/v1/plans/${planRecord.id}/remind`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: "{}",
    });
    expect(remindRes.status).toBe(200);
    const remindBody = (await remindRes.json()) as { reminded: string[] };
    expect(remindBody.reminded).toContain("rev-partial");

    // Assert the two endpoints agree with each other, not a hardcoded literal.
    expect(progressOutstanding).toBeGreaterThan(0);
    expect(capturedText).toContain(`You have ${progressOutstanding} submission(s) left to review`);
  });
});

// wave 11 (task w11-e): closure-by-executed-test for two SBEK-RUN-3 mandate
// clauses carried only on a code comment (docs/eval-findings.md:467-469):
//   (i) "'Remind laggards (N)' 500 — same mailer cause; verify it heals with
//       the boundary fix."
//   (ii) "'Submission (removed)' label renders for a live assignment on the
//        who-reviews-what list" -- src/routes/review/plans-reviewers.ts:40
//        CLAIMS the fix, but no test exercised it.
//
// This file closes (i): a per-recipient mailer failure inside
// POST /plans/:id/remind never 500s (DEC-238 class 2), and the laggard
// denominator the reminder run counts (assignedCount - completed) agrees
// with the SAME fold GET /plans/:id/progress reports for the identical
// fixture (DEC-707 wave-3 amendment: one fold, not two).
//
// (ii) is closed in app/src/pages/review/PlanEditor.render.test.tsx (the
// who-reviews-what list lives client-side) -- see that file for the
// dangling-submission assertion added alongside this one.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";

const planRecord = {
  id: "plan-1",
  eventId: "event-1",
  name: "Laggard Plan",
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

// Two submissions in scope; both reviewers are unrestricted (trackId and
// submissionId both null on their plan_reviewer row) so resolveAssignments
// gives each of them BOTH submissions -- assignedCount === 2 for both.
const SUBMISSIONS = [
  { id: "sub-1", ref: "S-001", title: "Talk One", description: null, trackIds: [] },
  { id: "sub-2", ref: "S-002", title: "Talk Two", description: null, trackIds: [] },
];

// rev-ok has evaluated ONE of their two assigned submissions (completed=1,
// assigned=2 -> 1 laggard item left). rev-bad has evaluated NONE
// (completed=0, assigned=2 -> 2 left). Neither is "done", so scope
// 'incomplete' (the route's default) targets both.
const EVALUATED_PAIRS = [{ reviewerId: "rev-ok", submissionId: "sub-1" }];

vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>(
    "../src/server/repo/review",
  );
  return {
    ...actual,
    listRecusalsForPlan: vi.fn(async () => []),
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
      planId === planRecord.id && orgId === ORG_A ? planRecord : null,
    ),
    listReviewerRowsForPlan: vi.fn(async () => [
      { id: "pr-1", planId: planRecord.id, userId: "rev-ok", trackId: null, submissionId: null },
      { id: "pr-2", planId: planRecord.id, userId: "rev-bad", trackId: null, submissionId: null },
    ]),
    getUsersByIds: vi.fn(async () => [
      { userId: "rev-ok", email: "ok@example.test" },
      { userId: "rev-bad", email: "bad@example.test" },
    ]),
    listEvaluatedPairsForPlan: vi.fn(async () => EVALUATED_PAIRS),
    batchUserDisplayNames: vi.fn(async () => new Map()),
    listPlanFilteredSubmissions: vi.fn(async () => SUBMISSIONS),
    getTrackNamesByIds: vi.fn(async () => new Map()),
  };
});

const sendMock = vi.fn(async (input: { to: { email: string }; text: string }) => {
  if (input.to.email === "bad@example.test") throw new Error("mailer exploded");
});

// B9 (DEC-037 amendment, wave 27): POST /remind names the event in the email
// shell's wordmark/footer, so the route makes one owned event lookup. This
// harness sets db to {} and mocks every repo module the route touches, so the
// events module has to be mocked here too or the real query hits the stub db.
vi.mock("../src/server/repo/events", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
  return {
    ...actual,
    getEventForOrg: vi.fn(async (_db: unknown, eventId: string) => ({ id: eventId, name: "Event One" })),
  };
});

// DEC-238 (wave-66 amendment): POST /plans/:id/remind now consults
// loadRecentlySent before sending -- this file's db stub is `{}`, so the
// real reader would throw; return an always-empty map (nothing is ever
// "recently sent" in this fixture) so the dedupe check is a no-op here.
vi.mock("../src/server/repo/comms", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/comms")>("../src/server/repo/comms");
  return {
    ...actual,
    loadRecentlySent: vi.fn(async () => new Map()),
  };
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
});

async function buildApp(auth: AuthInfo) {
  const { reviewRoutes } = await import("../src/routes/review");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    c.env = { DEV_MODE: "1" } as never;
    await next();
  });
  app.route("/", reviewRoutes);
  return app;
}

describe("SBEK-RUN-3: 'Remind laggards (N)' heals under a per-recipient mailer failure", () => {
  it("200s with a structured partial-failure body, never a 500, when one recipient's send throws", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/plans/${planRecord.id}/remind`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: "{}",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      reminded: string[];
      sent: number;
      failed: { email: string; message: string }[];
    };
    expect(body.reminded).toEqual(["rev-ok"]);
    expect(body.sent).toBe(1);
    expect(body.failed).toHaveLength(1);
    expect(body.failed[0]?.email).toBe("bad@example.test");
    expect(body.failed[0]?.message).toContain("mailer exploded");
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it("targets the same laggard set + denominator (assignedCount - completed) that GET /progress reports for the identical fixture", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });

    const progressRes = await app.request(`/api/v1/plans/${planRecord.id}/progress`);
    expect(progressRes.status).toBe(200);
    const progressBody = (await progressRes.json()) as {
      items: { userId: string; assigned: number; completed: number }[];
    };
    const progressByUser = new Map(progressBody.items.map((i) => [i.userId, i]));
    expect(progressByUser.get("rev-ok")).toMatchObject({ assigned: 2, completed: 1 });
    expect(progressByUser.get("rev-bad")).toMatchObject({ assigned: 2, completed: 0 });

    // POST /remind's per-recipient reminder text embeds
    // (laggard.assignedCount - laggard.completed) as the "N left to review"
    // count -- assert it against the SAME numbers GET /progress just
    // reported, so the two surfaces can never contradict each other for the
    // exact same reviewer.
    const remindRes = await app.request(`/api/v1/plans/${planRecord.id}/remind`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: "{}",
    });
    expect(remindRes.status).toBe(200);

    const okProgress = progressByUser.get("rev-ok");
    const badProgress = progressByUser.get("rev-bad");
    if (!okProgress || !badProgress) throw new Error("fixture missing an expected progress row");
    const okRemaining = okProgress.assigned - okProgress.completed;
    const badRemaining = badProgress.assigned - badProgress.completed;
    expect(okRemaining).toBe(1);
    expect(badRemaining).toBe(2);

    const okCall = sendMock.mock.calls.find((call) => call[0]?.to?.email === "ok@example.test");
    const badCall = sendMock.mock.calls.find((call) => call[0]?.to?.email === "bad@example.test");
    expect(okCall?.[0]?.text).toContain(`${okRemaining} submission`);
    expect(badCall?.[0]?.text).toContain(`${badRemaining} submissions`);

    // Both reviewers are non-done (rev-ok: 1/2, rev-bad: 0/2) so the
    // default 'incomplete' scope reaches both -- the laggard fan-out is not
    // silently narrower than the progress panel it mirrors.
    expect(sendMock).toHaveBeenCalledTimes(2);
  });
});

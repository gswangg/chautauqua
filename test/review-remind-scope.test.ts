// DEC-707: POST /api/v1/plans/:id/remind accepts an optional JSON body
// {scope: 'not_started' | 'incomplete'} (default 'incomplete') and selects
// recipients through src/domain/evaluation.ts's selectRemindTargets -- the
// SAME function the Review landing SPA imports to count its "Remind the N
// not started" link label. scope=not_started must mail ONLY reviewers with
// completed===0 (never a reviewer who has started but not finished).
// Mocked repo/mailer, mirrors test/review-remind-bound.test.ts's harness.

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

const SUBMISSIONS = [
  { id: "sub-1", ref: "S-001", title: "Talk One", description: null, trackIds: [] },
  { id: "sub-2", ref: "S-002", title: "Talk Two", description: null, trackIds: [] },
];

// rev-not-started: assigned 2, completed 0.
// rev-in-progress: assigned 2, completed 1 (started, not finished).
// rev-done: assigned 2, completed 2 (fully caught up).
const REVIEWER_ROWS = [
  { id: "pr-1", planId: planRecord.id, userId: "rev-not-started", trackId: null, submissionId: null },
  { id: "pr-2", planId: planRecord.id, userId: "rev-in-progress", trackId: null, submissionId: null },
  { id: "pr-3", planId: planRecord.id, userId: "rev-done", trackId: null, submissionId: null },
];
const USERS = [
  { userId: "rev-not-started", email: "not-started@example.test" },
  { userId: "rev-in-progress", email: "in-progress@example.test" },
  { userId: "rev-done", email: "done@example.test" },
];
const EVALUATED_PAIRS = [
  { reviewerId: "rev-in-progress", submissionId: "sub-1" },
  { reviewerId: "rev-done", submissionId: "sub-1" },
  { reviewerId: "rev-done", submissionId: "sub-2" },
];

vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>("../src/server/repo/review");
  return {
    ...actual,
    listRecusalsForPlan: vi.fn(async () => []),
    listRecusalsForReviewer: vi.fn(async () => []),
    hasRecusal: vi.fn(async () => null),
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
      planId === planRecord.id && orgId === ORG_A ? planRecord : null,
    ),
    listReviewerRowsForPlan: vi.fn(async () => REVIEWER_ROWS),
    getUsersByIds: vi.fn(async () => USERS),
    batchUserDisplayNames: vi.fn(async () => new Map()),
    listEvaluatedPairsForPlan: vi.fn(async () => EVALUATED_PAIRS),
    listPlanFilteredSubmissions: vi.fn(async () => SUBMISSIONS),
  };
});

const sentTo: string[] = [];
const sendMock = vi.fn(async (input: { to: { email: string }; text: string }) => {
  sentTo.push(input.to.email);
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
  sentTo.length = 0;
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

describe("DEC-707: POST /api/v1/plans/:id/remind scope", () => {
  it("scope=not_started mails only the reviewer with completed===0", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/plans/${planRecord.id}/remind`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ scope: "not_started" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { reminded: string[]; sent: number };
    expect(body.reminded).toEqual(["rev-not-started"]);
    expect(body.sent).toBe(1);
    expect(sentTo).toEqual(["not-started@example.test"]);
  });

  it("default scope (no body) mails every non-done reviewer, including one in progress", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/plans/${planRecord.id}/remind`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: "{}",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { reminded: string[] };
    expect([...body.reminded].sort()).toEqual(["rev-in-progress", "rev-not-started"]);
    expect(body.reminded).not.toContain("rev-done");
  });

  it("explicit scope=incomplete behaves the same as the default", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/plans/${planRecord.id}/remind`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ scope: "incomplete" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { reminded: string[] };
    expect([...body.reminded].sort()).toEqual(["rev-in-progress", "rev-not-started"]);
  });

  it("rejects an unknown scope value with 400", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/plans/${planRecord.id}/remind`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ scope: "everyone" }),
    });
    expect(res.status).toBe(400);
  });
});

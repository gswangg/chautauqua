// DEC-535: bounds the J4 bulk reviewer nudge (POST /api/v1/plans/:id/remind)
// the same way DEC-319 bounds its J6 sibling -- a large laggard list is
// capped at MAX_REVIEWER_REMINDER_BATCH, sorted ascending by userId so a
// second call advances to the next slice, and the response reports
// `remaining`. Mocked repo/mailer, mirrors test/review-remind-recusal.test.ts's
// harness pattern (no D1/wrangler dependency in stage 1).

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { capById, capReminderGroups, MAX_REVIEWER_REMINDER_BATCH } from "../src/domain/reminders";

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

const SUBMISSIONS = [{ id: "sub-1", ref: "S-001", title: "Talk One", description: null, trackIds: [] }];

function makeUserId(n: number): string {
  return `rev-${String(n).padStart(4, "0")}`;
}

let reviewerRows: { id: string; planId: string; userId: string; trackId: null; submissionId: null }[] = [];
let users: { userId: string; email: string }[] = [];
let recusals: { id: string; planId: string; submissionId: string; userId: string; reason: null }[] = [];
let completedPairs: { reviewerId: string; submissionId: string }[] = [];

vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>("../src/server/repo/review");
  return {
    ...actual,
    listRecusalsForPlan: vi.fn(async () => recusals),
    listRecusalsForReviewer: vi.fn(async () => []),
    hasRecusal: vi.fn(async () => null),
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
      planId === planRecord.id && orgId === ORG_A ? planRecord : null,
    ),
    listReviewerRowsForPlan: vi.fn(async () => reviewerRows),
    getUsersByIds: vi.fn(async () => users),
    listEvaluationsForPlan: vi.fn(async () => []),
    listEvaluatedPairsForPlan: vi.fn(async () => completedPairs),
    batchUserDisplayNames: vi.fn(async () => new Map()),
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
  reviewerRows = [];
  users = [];
  recusals = [];
  completedPairs = [];
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

function setLaggards(n: number) {
  reviewerRows = [];
  users = [];
  for (let i = 0; i < n; i++) {
    const uid = makeUserId(i);
    reviewerRows.push({ id: `pr-${i}`, planId: planRecord.id, userId: uid, trackId: null, submissionId: null });
    users.push({ userId: uid, email: `${uid}@example.test` });
  }
}

describe("DEC-535: POST /api/v1/plans/:id/remind is bounded like its J6 sibling", () => {
  it("caps 150 laggards at MAX_REVIEWER_REMINDER_BATCH, sends only the lowest 100 userIds ascending, reports remaining", async () => {
    setLaggards(150);
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/plans/${planRecord.id}/remind`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: "{}",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { reminded: string[]; sent: number; remaining: number };
    expect(body.sent).toBe(MAX_REVIEWER_REMINDER_BATCH);
    expect(sentTo.length).toBe(MAX_REVIEWER_REMINDER_BATCH);
    expect(body.remaining).toBe(50);

    const expectedIds = Array.from({ length: 100 }, (_, i) => makeUserId(i)).sort();
    expect([...body.reminded].sort()).toEqual(expectedIds);
  });

  it("sends all and reports remaining: 0 when only 3 laggards", async () => {
    setLaggards(3);
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/plans/${planRecord.id}/remind`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: "{}",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { reminded: string[]; sent: number; remaining: number };
    expect(body.sent).toBe(3);
    expect(body.remaining).toBe(0);
  });

  it("skips a fully-caught-up reviewer", async () => {
    setLaggards(2);
    completedPairs = [{ reviewerId: makeUserId(0), submissionId: "sub-1" }];
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/plans/${planRecord.id}/remind`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: "{}",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { reminded: string[] };
    expect(body.reminded).not.toContain(makeUserId(0));
    expect(body.reminded).toContain(makeUserId(1));
  });

  it("skips a reviewer recused from everything assigned (DEC-526 regression)", async () => {
    setLaggards(2);
    recusals = [{ id: "rec-1", planId: planRecord.id, submissionId: "sub-1", userId: makeUserId(0), reason: null }];
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/plans/${planRecord.id}/remind`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: "{}",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { reminded: string[] };
    expect(body.reminded).not.toContain(makeUserId(0));
    expect(body.reminded).toContain(makeUserId(1));
  });
});

describe("DEC-535: capById / capReminderGroups equivalence", () => {
  it("capReminderGroups is a thin delegate over capById keyed by contactId", () => {
    const groups = Array.from({ length: 10 }, (_, i) => ({ contactId: `c-${9 - i}`, x: i }));
    const viaGroups = capReminderGroups(groups, 4);
    const viaGeneric = capById(groups, (g) => g.contactId, 4);
    expect(viaGroups.groups).toEqual(viaGeneric.items);
    expect(viaGroups.remaining).toBe(viaGeneric.remaining);
    expect(viaGroups.groups.map((g) => g.contactId)).toEqual(["c-0", "c-1", "c-2", "c-3"]);
  });
});

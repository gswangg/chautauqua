// DEC-707 (wave-61 amendment): POST /api/v1/plans/:id/remind's nudge now
// carries a way back (queue URL) and a resolved display name, and resolves
// its round through the SAME parseRoundQuery GET /progress uses -- never
// unconditionally against plan.currentRound. Mocked repo/mailer, mirrors
// test/review-remind-scope.test.ts's harness.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";

const planNoClose = {
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
  rounds: 2,
  currentRound: 2,
  maxEvaluations: null,
};

const planWithClose = {
  ...planNoClose,
  id: "plan-2",
  closeDate: Date.UTC(2027, 2, 1), // Mar 01 2027, UTC-midnight day label
};

const SUBMISSIONS = [{ id: "sub-1", ref: "S-001", title: "Talk One", description: null, trackIds: [] }];

const REVIEWER_ROWS = [
  { id: "pr-1", planId: planNoClose.id, userId: "rev-named", trackId: null, submissionId: null },
  { id: "pr-2", planId: planNoClose.id, userId: "rev-unnamed", trackId: null, submissionId: null },
];
const USERS = [
  { userId: "rev-named", email: "named@example.test" },
  { userId: "rev-unnamed", email: "unnamed@example.test" },
];

// rev-named finished round 1 but not round 2; rev-unnamed finished neither.
const EVALUATED_ROUND_1 = [{ reviewerId: "rev-named", submissionId: "sub-1" }];
const EVALUATED_ROUND_2: { reviewerId: string; submissionId: string }[] = [];

const batchUserDisplayNamesMock = vi.fn(async (_db: unknown, userIds: string[]) => {
  const m = new Map<string, string | null>();
  for (const id of userIds) m.set(id, id === "rev-named" ? "Rivka Named" : null);
  return m;
});

vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>("../src/server/repo/review");
  return {
    ...actual,
    listRecusalsForPlan: vi.fn(async () => []),
    listRecusalsForReviewer: vi.fn(async () => []),
    hasRecusal: vi.fn(async () => null),
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) => {
      if (orgId !== ORG_A) return null;
      if (planId === planNoClose.id) return planNoClose;
      if (planId === planWithClose.id) return planWithClose;
      return null;
    }),
    listReviewerRowsForPlan: vi.fn(async () => REVIEWER_ROWS),
    getUsersByIds: vi.fn(async () => USERS),
    batchUserDisplayNames: batchUserDisplayNamesMock,
    listEvaluatedPairsForPlan: vi.fn(async (_db: unknown, _planId: string, round: number) =>
      round === 1 ? EVALUATED_ROUND_1 : EVALUATED_ROUND_2,
    ),
    listPlanFilteredSubmissions: vi.fn(async () => SUBMISSIONS),
  };
});

const sent: { to: { email: string; name: string }; text: string; html: string }[] = [];
const sendMock = vi.fn(async (input: { to: { email: string; name: string }; text: string; html: string }) => {
  sent.push(input);
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
  sent.length = 0;
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

describe("DEC-707 (wave-61 amendment): remind nudge link + identity + round", () => {
  it("addresses the resolved display name and falls back to email when unresolved, includes the queue URL, batches names once", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/plans/${planNoClose.id}/remind`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1", Origin: "http://localhost:3000" },
      body: "{}",
    });
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(2);

    const named = sent.find((s) => s.to.email === "named@example.test");
    expect(named?.to.name).toBe("Rivka Named");
    const unnamed = sent.find((s) => s.to.email === "unnamed@example.test");
    expect(unnamed?.to.name).toBe("unnamed@example.test");

    for (const s of sent) {
      expect(s.text).toContain(`/admin/review/plans/${planNoClose.id}`);
      expect(s.html).toContain(`/admin/review/plans/${planNoClose.id}`);
    }

    // One batched call for the whole capped set, never per-recipient.
    expect(batchUserDisplayNamesMock).toHaveBeenCalledTimes(1);
  });

  it("states the plan's close date when present and omits the clause when absent", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });

    const resNoClose = await app.request(`/api/v1/plans/${planNoClose.id}/remind`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1", Origin: "http://localhost:3000" },
      body: "{}",
    });
    expect(resNoClose.status).toBe(200);
    for (const s of sent) expect(s.text).not.toContain("closes");
    sent.length = 0;

    const resWithClose = await app.request(`/api/v1/plans/${planWithClose.id}/remind`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1", Origin: "http://localhost:3000" },
      body: "{}",
    });
    expect(resWithClose.status).toBe(200);
    expect(sent.length).toBeGreaterThan(0);
    for (const s of sent) expect(s.text).toContain("closes Mon 1 Mar 2027");
  });

  it("resolves laggards against a round named in the request, not always plan.currentRound", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });

    // plan.currentRound is 2; naming round=1 must select against round 1's
    // completion (rev-named finished round 1, so only rev-unnamed remains).
    const res = await app.request(`/api/v1/plans/${planNoClose.id}/remind?round=1`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1", Origin: "http://localhost:3000" },
      body: "{}",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { reminded: string[] };
    expect(body.reminded).toEqual(["rev-unnamed"]);
  });

  it("keeps the response envelope shape byte-identical", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/plans/${planNoClose.id}/remind`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1", Origin: "http://localhost:3000" },
      body: "{}",
    });
    const body = await res.json();
    // DEC-238 (wave-66 amendment): `skipped` joins the CLOSED envelope.
    expect(Object.keys(body as object).sort()).toEqual(["failed", "remaining", "reminded", "sent", "skipped"]);
  });
});

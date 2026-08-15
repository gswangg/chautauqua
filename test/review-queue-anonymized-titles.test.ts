// DEC-018 (wave-57 amendment): the reviewer QUEUE leaked speaker identity
// through submission titles for an anonymized plan (the detail route
// redacted title/description/sessionAnswers via anonymizeForReviewer, but
// the queue handler emitted `summary.title`/`s.title` verbatim). This closes
// that gap: an anonymized plan's queue items[].title and recused[].title
// must both be masked via redactIdentity, using an identity set built from
// listSpeakerIdentitiesForSubmissions (NOT scoped to display-status
// participants). A non-anonymized plan's response must be byte-for-byte
// unchanged. Mirrors test/review-queue-shape.test.ts's mocking pattern.

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
  timezone: "UTC",
};

const SUBMISSIONS = [
  { id: "sub-1", ref: "S-001", title: "A Talk by Jane Speaker from Acme Corp", description: null, trackIds: [] },
  { id: "sub-2", ref: "S-002", title: "Another Talk by Jane Speaker", description: null, trackIds: [] },
  { id: "sub-3", ref: "S-003", title: "No Participants Here", description: null, trackIds: [] },
];

const IDENTITIES = new Map([
  ["sub-1", [{ name: "Jane Speaker", email: "jane@example.com", company: "Acme Corp" }]],
  ["sub-2", [{ name: "Jane Speaker", email: "jane@example.com", company: "Acme Corp" }]],
  // sub-3 intentionally absent -- a submission with no participants.
]);

vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>(
    "../src/server/repo/review",
  );
  return {
    ...actual,
    listRecusalsForPlan: vi.fn(async () => []),
    listRecusalsForReviewer: vi.fn(async () => [
      { id: "recusal-1", planId: planRecord.id, submissionId: "sub-2", userId: "r1", reason: "Co-author", createdAt: 0 },
    ]),
    hasRecusal: vi.fn(async () => null),
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
      planId === planRecord.id && orgId === ORG_A ? planRecord : null,
    ),
    getPlanById: vi.fn(async (_db: unknown, planId: string) => (planId === planRecord.id ? planRecord : null)),
    listPlanIdsForReviewer: vi.fn(async () => [planRecord.id]),
    resolveReviewerSubmissions: vi.fn(async () => SUBMISSIONS),
    countEvaluationsBySubmission: vi.fn(async () => new Map()),
    listSubmissionIdsRatedBy: vi.fn(async () => new Set<string>()),
    listEvaluationScoresForReviewer: vi.fn(async () => new Map()),
    getReviewerScopeTrackId: vi.fn(async () => null),
    getTrackNamesByIds: vi.fn(async () => new Map()),
    listFormatLabelsBySubmission: vi.fn(async () => new Map()),
    listAudienceLevelLabelsBySubmission: vi.fn(async () => new Map()),
    listSpeakerIdentitiesForSubmissions: vi.fn(async (_db: unknown, ids: string[]) => {
      const out = new Map<string, { name: string; email: string; company: string | null }[]>();
      for (const id of ids) {
        const v = IDENTITIES.get(id);
        if (v) out.set(id, v);
      }
      return out;
    }),
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
    await next();
  });
  app.route("/", reviewRoutes);
  return app;
}

describe("DEC-018: anonymized reviewer queue titles are redacted", () => {
  it("masks a queue item's title containing the speaker's full name and company", async () => {
    const { getPlanById } = await import("../src/server/repo/review");
    vi.mocked(getPlanById).mockResolvedValue({ ...planRecord, anonymized: true } as never);
    const app = await buildApp({ userId: "r1", role: "reviewer", orgId: ORG_A });
    const res = await app.request(`/api/v1/review/plans/${planRecord.id}/queue`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { submissionId: string; title: string }[] };
    const sub1 = body.items.find((i) => i.submissionId === "sub-1");
    expect(sub1).toBeDefined();
    expect(sub1?.title).toContain("[hidden]");
    expect(sub1?.title).not.toContain("Jane Speaker");
    expect(sub1?.title).not.toContain("Acme Corp");
  });

  it("masks a recused submission's title the same way", async () => {
    const { getPlanById } = await import("../src/server/repo/review");
    vi.mocked(getPlanById).mockResolvedValue({ ...planRecord, anonymized: true } as never);
    const app = await buildApp({ userId: "r1", role: "reviewer", orgId: ORG_A });
    const res = await app.request(`/api/v1/review/plans/${planRecord.id}/queue`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { recused: { submissionId: string; title: string }[] };
    const recusedSub2 = body.recused.find((r) => r.submissionId === "sub-2");
    expect(recusedSub2).toBeDefined();
    expect(recusedSub2?.title).toContain("[hidden]");
    expect(recusedSub2?.title).not.toContain("Jane Speaker");
  });

  it("returns titles verbatim on a non-anonymized plan", async () => {
    const { getPlanById } = await import("../src/server/repo/review");
    vi.mocked(getPlanById).mockResolvedValue({ ...planRecord, anonymized: false } as never);
    const app = await buildApp({ userId: "r1", role: "reviewer", orgId: ORG_A });
    const res = await app.request(`/api/v1/review/plans/${planRecord.id}/queue`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: { submissionId: string; title: string }[];
      recused: { submissionId: string; title: string }[];
    };
    const sub1 = body.items.find((i) => i.submissionId === "sub-1");
    expect(sub1?.title).toBe("A Talk by Jane Speaker from Acme Corp");
    const recusedSub2 = body.recused.find((r) => r.submissionId === "sub-2");
    expect(recusedSub2?.title).toBe("Another Talk by Jane Speaker");
  });

  it("does not throw for a submission with no participants on an anonymized plan", async () => {
    const { getPlanById } = await import("../src/server/repo/review");
    vi.mocked(getPlanById).mockResolvedValue({ ...planRecord, anonymized: true } as never);
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/review/plans/${planRecord.id}/queue`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { submissionId: string; title: string }[] };
    const sub3 = body.items.find((i) => i.submissionId === "sub-3");
    expect(sub3).toBeDefined();
    expect(sub3?.title).toBe("No Participants Here");
  });
});

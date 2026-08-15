// DEC-857 (task w7-b): audience level, wired the same way SESSION_FORMAT_FIELD_ID
// already was -- listAudienceLevelLabelsBySubmission is the exact twin of
// listFormatLabelsBySubmission (same chunkIds batching, ONE query per chunk),
// and both the reviewer queue and the submission-detail route carry the
// stored answer LABEL verbatim, null when a submission has no answer, and
// NOT stripped for an anonymized plan (a session-shape fact is not identity,
// mirroring `format`).

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { AUDIENCE_LEVEL_FIELD_ID } from "../src/forms/types";
import { listAudienceLevelLabelsBySubmission } from "../src/server/repo/review/submissions";
import type { Db } from "../src/server/context";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

// ---------------------------------------------------------------------------
// (1) Repo-level: batched lookup, chunked, verbatim label, null for absent
// ---------------------------------------------------------------------------

describe("listAudienceLevelLabelsBySubmission (DEC-857)", () => {
  it("returns [] map for an empty id list without touching the db", async () => {
    const db = {
      select: () => {
        throw new Error("must not query for an empty id list");
      },
    } as unknown as Db;
    const map = await listAudienceLevelLabelsBySubmission(db, []);
    expect(map.size).toBe(0);
  });

  it("issues ONE query per chunkIds batch, filters to AUDIENCE_LEVEL_FIELD_ID, and returns the label verbatim; absent submissions map to null", async () => {
    // 91 ids forces exactly two chunkIds batches (90 + 1) -- the batching
    // must be observed, not just the per-row parsing.
    const ids = Array.from({ length: 91 }, (_, i) => `sub-${i}`);
    let queryCount = 0;
    let capturedWhereArgs: unknown[] = [];
    const rowsByCall: Record<string, { submissionId: string; valueJson: string }[]> = {
      0: [{ submissionId: "sub-0", valueJson: JSON.stringify("Intermediate") }],
      1: [{ submissionId: "sub-90", valueJson: JSON.stringify("Beginner") }],
    };
    const db = {
      select: () => ({
        from: () => ({
          where: (...args: unknown[]) => {
            capturedWhereArgs = args;
            const callIndex = queryCount;
            queryCount += 1;
            return Promise.resolve(rowsByCall[callIndex] ?? []);
          },
        }),
      }),
    } as unknown as Db;

    const map = await listAudienceLevelLabelsBySubmission(db, ids);

    expect(queryCount).toBe(2);
    expect(capturedWhereArgs).toHaveLength(1);
    // sub-0 (first chunk) and sub-90 (second chunk) both carry their verbatim
    // stored label.
    expect(map.get("sub-0")).toBe("Intermediate");
    expect(map.get("sub-90")).toBe("Beginner");
    // Every other submission has no answer row -- absent from the map, and a
    // route-level `.get(id) ?? null` turns that into null (asserted below).
    expect(map.has("sub-1")).toBe(false);
  });

  it("filters on AUDIENCE_LEVEL_FIELD_ID (field_audience_level), not the session-format field", async () => {
    let capturedFieldId: unknown;
    const db = {
      select: () => ({
        from: () => ({
          where: (condition: unknown) => {
            // drizzle's `and(...)` composes a tree of SQL objects; walk it
            // (bounded depth, guarded against the circular column<->table
            // refs) collecting every string literal it binds, and assert the
            // field-id literal is among them.
            const seen = new Set<unknown>();
            const strings: string[] = [];
            const walk = (node: unknown, depth: number): void => {
              if (depth > 6 || node === null || typeof node !== "object") return;
              if (seen.has(node)) return;
              seen.add(node);
              for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
                if (key === "table") continue; // circular column<->table back-ref
                if (typeof value === "string") strings.push(value);
                else if (Array.isArray(value)) value.forEach((v) => walk(v, depth + 1));
                else if (typeof value === "object") walk(value, depth + 1);
              }
            };
            walk(condition, 0);
            capturedFieldId = strings;
            return Promise.resolve([]);
          },
        }),
      }),
    } as unknown as Db;
    await listAudienceLevelLabelsBySubmission(db, ["sub-1"]);
    expect(capturedFieldId).toContain(AUDIENCE_LEVEL_FIELD_ID);
  });
});

// ---------------------------------------------------------------------------
// (2) Route-level: queue + submission-detail carry audienceLevel
// ---------------------------------------------------------------------------

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

const anonymizedPlanRecord = { ...planRecord, id: "plan-2", anonymized: true };

const SUBMISSIONS = [
  { id: "sub-1", ref: "S-001", title: "Talk One", description: null, trackIds: [] },
  { id: "sub-2", ref: "S-002", title: "Talk Two", description: null, trackIds: [] },
];

const SUMMARY = { id: "sub-1", ref: "S-001", title: "Talk One", description: "desc", trackIds: [], status: "accepted" };

vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>("../src/server/repo/review");
  return {
    ...actual,
    listRecusalsForPlan: vi.fn(async () => []),
    listRecusalsForReviewer: vi.fn(async () => []),
    hasRecusal: vi.fn(async () => null),
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) => {
      if (orgId !== ORG_A) return null;
      if (planId === planRecord.id) return planRecord;
      if (planId === anonymizedPlanRecord.id) return anonymizedPlanRecord;
      return null;
    }),
    getPlanById: vi.fn(async (_db: unknown, planId: string) =>
      planId === planRecord.id ? planRecord : planId === anonymizedPlanRecord.id ? anonymizedPlanRecord : null,
    ),
    listPlanIdsForReviewer: vi.fn(async () => [planRecord.id]),
    resolveReviewerSubmissions: vi.fn(async () => SUBMISSIONS),
    listEvaluationsForPlan: vi.fn(async () => []),
    listEvaluatedPairsForPlan: vi.fn(async () => []),
    countEvaluationsBySubmission: vi.fn(async () => new Map()),
    listSubmissionIdsRatedBy: vi.fn(async () => new Set<string>()),
    listEvaluationScoresForReviewer: vi.fn(async () => new Map()),
    getReviewerScopeTrackIds: vi.fn(async () => []),
    getTrackNamesByIds: vi.fn(async () => new Map()),
    listFormatLabelsBySubmission: vi.fn(async () => new Map()),
    // The lookup under test: sub-1 has an audience-level answer, sub-2 does not.
    listAudienceLevelLabelsBySubmission: vi.fn(async (_db: unknown, ids: string[]) =>
      new Map(ids.filter((id) => id === "sub-1").map((id) => [id, "Intermediate"])),
    ),
    isSubmissionInReviewerScope: vi.fn(async () => true),
    getSubmissionSummaryInEvent: vi.fn(async () => SUMMARY),
    listAnswersForSubmission: vi.fn(async () => []),
    listSpeakersForSubmission: vi.fn(async () => []),
    listSpeakerIdentitiesForSubmissions: vi.fn(async () => new Map()),
    getEvaluation: vi.fn(async () => null),
  };
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

describe("GET /api/v1/review/plans/:id/queue carries audienceLevel (DEC-857)", () => {
  it("carries the verbatim label for a submission with an answer, null for one without", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/review/plans/${planRecord.id}/queue`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { submissionId: string; audienceLevel: string | null }[] };
    const bySubmission = new Map(body.items.map((i) => [i.submissionId, i]));
    expect(bySubmission.get("sub-1")?.audienceLevel).toBe("Intermediate");
    expect(bySubmission.get("sub-2")?.audienceLevel).toBeNull();
  });
});

describe("GET /api/v1/review/submissions/:id carries audienceLevel (DEC-857)", () => {
  it("carries the verbatim label beside format on the detail payload", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/review/submissions/sub-1?planId=${planRecord.id}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { format: string | null; audienceLevel: string | null };
    expect(body.audienceLevel).toBe("Intermediate");
    expect(body.format).toBeNull();
  });

  it("is null when the submission has no audience-level answer", async () => {
    const { getSubmissionSummaryInEvent } = await import("../src/server/repo/review");
    vi.mocked(getSubmissionSummaryInEvent).mockResolvedValueOnce({ ...SUMMARY, id: "sub-2" });
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/review/submissions/sub-2?planId=${planRecord.id}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { audienceLevel: string | null };
    expect(body.audienceLevel).toBeNull();
  });

  // DEC-018/DEC-857: server-side anonymization strips identity, never a
  // session-shape fact -- audienceLevel must survive anonymizeForReviewer
  // the same way `format` already does.
  it("still carries audienceLevel on an anonymized plan's submission detail", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/review/submissions/sub-1?planId=${anonymizedPlanRecord.id}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { audienceLevel: string | null; speakers?: unknown };
    expect(body.audienceLevel).toBe("Intermediate");
    // sanity: anonymization is actually active on this plan (speakers key stripped).
    expect(body.speakers).toBeUndefined();
  });
});

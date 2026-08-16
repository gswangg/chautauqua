// DEC-736: the evaluations export and GET /api/v1/submissions/:id/evaluations
// must agree that the organiser is ALWAYS told who reviewed -- anonymization
// hides the SPEAKER from the REVIEWER, never the reviewer's identity from
// the organiser. Both surfaces resolve identity through the same
// resolveReviewerIdentity helper (DEC-622's "one resolver" shape), so they
// can never disagree.

import { describe, expect, it, vi, afterEach } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { exportsRoutes } from "../src/routes/api/exports";
import { reviewRoutes } from "../src/routes/review";
import * as evaluationsRepo from "../src/server/repo/review/evaluations";
import * as reviewersRepo from "../src/server/repo/review/reviewers";

const EVENT_ID = "event-1";
const ORG_A = "org-a";
const SUBMISSION_ID = "sub-1";
const REVIEWER_EMAIL = "reviewer1@example.com";

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (v: unknown[]) => void) => resolve(rows),
  };
  return chain;
}

function fakeDb(selectQueue: unknown[][]) {
  let call = 0;
  const db = {
    select: () => {
      const rows = selectQueue[call] ?? [];
      call += 1;
      return makeChain(rows);
    },
  };
  return db as unknown as AppEnv["Variables"]["db"];
}

function evaluationExportRow() {
  return {
    planId: "plan-1",
    planName: "Program Committee",
    criteriaJson: JSON.stringify([{ id: "c1", label: "Clarity", kind: "rating", weight: 1 }]),
    roundCriteriaJson: null,
    scaleJson: JSON.stringify({ min: 1, max: 5 }),
    seq: 1,
    title: "Talk One",
    reviewerEmail: REVIEWER_EMAIL,
    round: 1,
    scoresJson: JSON.stringify({ c1: 4 }),
    comment: "Great talk",
    submittedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

// buildExport('evaluations') call order: getRecordPrefix, then evaluation rows.
// requireOwnedEvent (route middleware) selects the event first.
function exportQueue() {
  return [
    [{ id: EVENT_ID, orgId: ORG_A }], // requireOwnedEvent
    [{ recordPrefix: "SES" }], // getRecordPrefix
    [evaluationExportRow()], // evaluation rows
  ];
}

async function buildExportApp(auth: AuthInfo) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", fakeDb(exportQueue()));
    await next();
  });
  app.route("/", exportsRoutes);
  return app;
}

async function buildSubmissionEvaluationsApp(auth: AuthInfo) {
  vi.spyOn(evaluationsRepo, "listEvaluationsForSubmission").mockResolvedValue([
    {
      planId: "plan-1",
      planName: "Program Committee",
      round: 1,
      reviewerName: REVIEWER_EMAIL,
      scores: { c1: 4 },
      comment: "Great talk",
      submittedAt: 1_700_000_000_000,
    },
  ]);
  vi.spyOn(reviewersRepo, "countAssignedReviewersForSubmission").mockResolvedValue(1);
  vi.spyOn(evaluationsRepo, "listPlanCriteriaByIds").mockResolvedValue(
    new Map([
      [
        "plan-1",
        {
          criteria: [{ id: "c1", label: "Clarity", kind: "rating" as const, weight: 1 }],
          roundCriteriaJson: null,
          scale: { min: 1, max: 5 },
        },
      ],
    ]),
  );

  const submissionsRepo = await import("../src/server/repo/submissions");
  vi.spyOn(submissionsRepo, "getSubmissionOwnership").mockImplementation(async (_db: unknown, submissionId: string) =>
    submissionId === SUBMISSION_ID ? { eventId: EVENT_ID, orgId: ORG_A } : null,
  );

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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DEC-736: evaluations export and evaluations screen agree by naming the reviewer", () => {
  it("the export contains the reviewer's identity, never a withheld sentinel", async () => {
    const app = await buildExportApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/events/${EVENT_ID}/export/evaluations?format=json`);
    expect(res.status).toBe(200);
    const records = (await res.json()) as Array<Record<string, string>>;
    expect(records).toHaveLength(1);
    expect(records[0]!["reviewer"]).toBe(REVIEWER_EMAIL);
    const serialized = JSON.stringify(records);
    expect(serialized).not.toContain("(anonymized)");
  });

  it("the screen contains the reviewer's identity, never null", async () => {
    const app = await buildSubmissionEvaluationsApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/submissions/${SUBMISSION_ID}/evaluations`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ reviewerName: string }> };
    expect(body.items[0]!.reviewerName).toBe(REVIEWER_EMAIL);
    expect(body.items[0]!.reviewerName).not.toBeNull();
  });

  it("the export and the screen agree: both name the same reviewer for the same underlying identity", async () => {
    const exportApp = await buildExportApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const exportRes = await exportApp.request(`/api/v1/events/${EVENT_ID}/export/evaluations?format=json`);
    const exportRecords = (await exportRes.json()) as Array<Record<string, string>>;

    const screenApp = await buildSubmissionEvaluationsApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const screenRes = await screenApp.request(`/api/v1/submissions/${SUBMISSION_ID}/evaluations`);
    const screenBody = (await screenRes.json()) as { items: Array<{ reviewerName: string }> };

    expect(exportRecords[0]!["reviewer"]).toBe(screenBody.items[0]!.reviewerName);
  });
});

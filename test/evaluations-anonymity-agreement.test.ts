// DEC-622: the evaluations export and GET /api/v1/submissions/:id/evaluations
// must agree about anonymity -- an anonymized plan's reviewer email is never
// leaked through either surface, and a non-anonymized plan's email still
// appears in the export (reviewerEmail column keeps meaning an email in that
// case, per the task's constraint of passing no names to the export's
// resolveReviewerIdentity call).

import { describe, expect, it, vi, afterEach } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";
import { exportsRoutes } from "../src/routes/api/exports";
import { reviewRoutes } from "../src/routes/review";
import * as evaluationsRepo from "../src/server/repo/review/evaluations";

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

function evaluationExportRow(anonymized: boolean) {
  return {
    planId: "plan-1",
    planName: "Program Committee",
    criteriaJson: JSON.stringify([{ id: "c1", label: "Clarity", kind: "rating", weight: 1 }]),
    roundCriteriaJson: null,
    seq: 1,
    title: "Talk One",
    anonymized,
    reviewerEmail: REVIEWER_EMAIL,
    round: 1,
    scoresJson: JSON.stringify({ c1: 4 }),
    comment: "Great talk",
    submittedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

// buildExport('evaluations') call order: getRecordPrefix, then evaluation rows.
// requireOwnedEvent (route middleware) selects the event first.
function exportQueue(anonymized: boolean) {
  return [
    [{ id: EVENT_ID, orgId: ORG_A }], // requireOwnedEvent
    [{ recordPrefix: "SES" }], // getRecordPrefix
    [evaluationExportRow(anonymized)], // evaluation rows
  ];
}

async function buildExportApp(auth: AuthInfo, anonymized: boolean) {
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", fakeDb(exportQueue(anonymized)));
    await next();
  });
  app.route("/", exportsRoutes);
  return app;
}

async function buildSubmissionEvaluationsApp(auth: AuthInfo, anonymized: boolean) {
  vi.spyOn(evaluationsRepo, "listEvaluationsForSubmission").mockResolvedValue([
    {
      planId: "plan-1",
      planName: "Program Committee",
      round: 1,
      reviewerName: anonymized ? null : REVIEWER_EMAIL,
      scores: { c1: 4 },
      comment: "Great talk",
      submittedAt: 1_700_000_000_000,
    },
  ]);

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

describe("DEC-622: evaluations export obeys the same reviewer-identity resolution as the screen", () => {
  it("an anonymized plan's export contains '(anonymized)' and never the reviewer's email", async () => {
    const app = await buildExportApp({ userId: "u1", role: "organizer", orgId: ORG_A }, true);
    const res = await app.request(`/api/v1/events/${EVENT_ID}/export/evaluations?format=json`);
    expect(res.status).toBe(200);
    const records = (await res.json()) as Array<Record<string, string>>;
    expect(records).toHaveLength(1);
    expect(records[0]!["reviewerEmail"]).toBe("(anonymized)");
    const serialized = JSON.stringify(records);
    expect(serialized).not.toContain(REVIEWER_EMAIL);
  });

  it("a non-anonymized plan's export still contains the reviewer's email", async () => {
    const app = await buildExportApp({ userId: "u1", role: "organizer", orgId: ORG_A }, false);
    const res = await app.request(`/api/v1/events/${EVENT_ID}/export/evaluations?format=json`);
    expect(res.status).toBe(200);
    const records = (await res.json()) as Array<Record<string, string>>;
    expect(records[0]!["reviewerEmail"]).toBe(REVIEWER_EMAIL);
  });

  it("the export and GET /api/v1/submissions/:id/evaluations agree: both withhold identity for an anonymized plan", async () => {
    const exportApp = await buildExportApp({ userId: "u1", role: "organizer", orgId: ORG_A }, true);
    const exportRes = await exportApp.request(`/api/v1/events/${EVENT_ID}/export/evaluations?format=json`);
    const exportRecords = (await exportRes.json()) as Array<Record<string, string>>;

    const screenApp = await buildSubmissionEvaluationsApp({ userId: "u1", role: "organizer", orgId: ORG_A }, true);
    const screenRes = await screenApp.request(`/api/v1/submissions/${SUBMISSION_ID}/evaluations`);
    const screenBody = (await screenRes.json()) as { items: Array<{ reviewerName: string | null }> };

    expect(exportRecords[0]!["reviewerEmail"]).toBe("(anonymized)");
    expect(screenBody.items[0]!.reviewerName).toBeNull();
  });

  it("the export and GET /api/v1/submissions/:id/evaluations agree: both reveal identity for a non-anonymized plan", async () => {
    const exportApp = await buildExportApp({ userId: "u1", role: "organizer", orgId: ORG_A }, false);
    const exportRes = await exportApp.request(`/api/v1/events/${EVENT_ID}/export/evaluations?format=json`);
    const exportRecords = (await exportRes.json()) as Array<Record<string, string>>;

    const screenApp = await buildSubmissionEvaluationsApp({ userId: "u1", role: "organizer", orgId: ORG_A }, false);
    const screenRes = await screenApp.request(`/api/v1/submissions/${SUBMISSION_ID}/evaluations`);
    const screenBody = (await screenRes.json()) as { items: Array<{ reviewerName: string | null }> };

    expect(exportRecords[0]!["reviewerEmail"]).toBe(REVIEWER_EMAIL);
    expect(screenBody.items[0]!.reviewerName).toBe(REVIEWER_EMAIL);
  });
});

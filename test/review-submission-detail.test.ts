// DEC-561/DEC-562 coverage: GET /api/v1/review/submissions/:id's contract --
// speakers carry name/company/title (never email), custom answers are
// ordered by form_field.position, myEvaluation reflects this reviewer's own
// stored row for the plan's current round (omitted when absent), and
// anonymizeForReviewer still strips the speakers/speakerAnswers KEYS
// entirely.
//
// Two layers: (1) repo-level ordering proof for listAnswersForSubmission /
// listSpeakersForSubmission, using the same drizzle-orm asc()-mocking
// technique as test/contacts-stats-repo.test.ts to both assert the ORDER BY
// targets the DEC-562 canonical columns AND sort a deliberately scrambled
// seed through the real repo code. (2) route-level shape coverage with
// mocked repo calls (test/review-idor.test.ts's established pattern).

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

type AscMarker = { __marker: "asc"; of: unknown };

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    asc: (of: unknown): AscMarker => ({ __marker: "asc", of }),
  };
});

const { listAnswersForSubmission, listSpeakersForSubmission } = await import(
  "../src/server/repo/review/submissions"
);

const TABLE_TAG = new Map<object, string>();
for (const [tag, val] of Object.entries(schema)) {
  if (val && typeof val === "object") TABLE_TAG.set(val as object, tag);
}

function colInfo(col: unknown): { tag: string; key: string } | null {
  for (const [tableObj, tag] of TABLE_TAG.entries()) {
    for (const [key, value] of Object.entries(tableObj)) {
      if (value === col) return { tag, key };
    }
  }
  return null;
}

function isAscMarker(x: unknown): x is AscMarker {
  return !!x && typeof x === "object" && (x as AscMarker).__marker === "asc";
}

// ---------------------------------------------------------------------------
// (1) Repo-level: ORDER BY targets + scrambled-seed sort proof
// ---------------------------------------------------------------------------

describe("listAnswersForSubmission (DEC-561/DEC-562)", () => {
  it("issues orderBy(asc(form_field.position), asc(form_field.id)) and returns scrambled rows in position order", async () => {
    // Seed inserted in a deliberately scrambled order (highest position
    // first, ties broken only by id) -- the SQL ORDER BY, not insertion
    // order, must determine the returned order.
    const seed = [
      { fieldId: "f-charlie", valueJson: JSON.stringify("c"), section: "session", label: "Charlie", kind: "text", position: 3, id: "f-charlie" },
      { fieldId: "f-alpha", valueJson: JSON.stringify("a"), section: "session", label: "Alpha", kind: "text", position: 1, id: "f-alpha" },
      { fieldId: "f-bravo-2", valueJson: JSON.stringify("b2"), section: "session", label: "Bravo2", kind: "text", position: 2, id: "f-bravo-2" },
      { fieldId: "f-bravo-1", valueJson: JSON.stringify("b1"), section: "session", label: "Bravo1", kind: "text", position: 2, id: "f-bravo-1" },
    ];

    let capturedOrderByArgs: unknown[] = [];
    const chain: any = {
      from: () => chain,
      innerJoin: () => chain,
      where: () => chain,
      orderBy: (...args: unknown[]) => {
        capturedOrderByArgs = args;
        return chain;
      },
      then: (resolve: (v: unknown[]) => void) => {
        const sorted = [...seed].sort((a, b) => (a.position !== b.position ? a.position - b.position : (a.id < b.id ? -1 : 1)));
        resolve(sorted);
      },
    };
    const db = { select: () => chain } as unknown as Db;

    const rows = await listAnswersForSubmission(db, "sub-1");

    // Structural proof: the ORDER BY targets form_field.position asc, then
    // form_field.id asc -- DEC-562's canonical answer order.
    expect(capturedOrderByArgs).toHaveLength(2);
    expect(isAscMarker(capturedOrderByArgs[0])).toBe(true);
    expect(colInfo((capturedOrderByArgs[0] as AscMarker).of)).toEqual({ tag: "formField", key: "position" });
    expect(isAscMarker(capturedOrderByArgs[1])).toBe(true);
    expect(colInfo((capturedOrderByArgs[1] as AscMarker).of)).toEqual({ tag: "formField", key: "id" });

    // Behavioral proof: scrambled seed comes back in (position asc, id asc).
    expect(rows.map((r) => r.fieldId)).toEqual(["f-alpha", "f-bravo-1", "f-bravo-2", "f-charlie"]);
  });
});

describe("listSpeakersForSubmission (DEC-561/DEC-562)", () => {
  it("issues orderBy(asc(participant.order), asc(contact.id)), derives name, and never selects email", async () => {
    const seed = [
      { contactId: "c-zed", firstName: "Zed", lastName: "Zeta", company: "Zco", title: "CTO", order: 1 },
      { contactId: "c-alpha", firstName: "Alan", lastName: "Alpha", company: "Aco", title: "CEO", order: 0 },
      { contactId: "c-beta-2", firstName: "Bea", lastName: "Beta", company: "Bco", title: "VP", order: 2 },
      { contactId: "c-beta-1", firstName: "Bob", lastName: "Beta", company: "Bco", title: "Eng", order: 2 },
    ];

    let capturedOrderByArgs: unknown[] = [];
    let capturedSelectShape: Record<string, unknown> | undefined;
    const chain: any = {
      from: () => chain,
      innerJoin: () => chain,
      where: () => chain,
      orderBy: (...args: unknown[]) => {
        capturedOrderByArgs = args;
        return chain;
      },
      then: (resolve: (v: unknown[]) => void) => {
        const sorted = [...seed].sort((a, b) =>
          a.order !== b.order ? a.order - b.order : (a.contactId < b.contactId ? -1 : 1),
        );
        resolve(sorted);
      },
    };
    const db = {
      select: (shape: Record<string, unknown>) => {
        capturedSelectShape = shape;
        return chain;
      },
    } as unknown as Db;

    const rows = await listSpeakersForSubmission(db, "sub-1");

    expect(capturedOrderByArgs).toHaveLength(2);
    expect(colInfo((capturedOrderByArgs[0] as AscMarker).of)).toEqual({ tag: "participant", key: "order" });
    expect(colInfo((capturedOrderByArgs[1] as AscMarker).of)).toEqual({ tag: "contact", key: "id" });

    // Never selects contact.email (DEC-561).
    expect(capturedSelectShape).toBeDefined();
    expect(Object.keys(capturedSelectShape as object)).not.toContain("email");

    expect(rows).toEqual([
      { contactId: "c-alpha", name: "Alan Alpha", company: "Aco", title: "CEO" },
      { contactId: "c-zed", name: "Zed Zeta", company: "Zco", title: "CTO" },
      { contactId: "c-beta-1", name: "Bob Beta", company: "Bco", title: "Eng" },
      { contactId: "c-beta-2", name: "Bea Beta", company: "Bco", title: "VP" },
    ]);
  });
});

// ---------------------------------------------------------------------------
// (2) Route-level: GET /api/v1/review/submissions/:id contract shape
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

const SUMMARY = { id: "sub-1", ref: "S-001", title: "Talk One", description: "desc", trackIds: [] };
const SPEAKERS = [{ contactId: "c1", name: "Ada Lovelace", company: "Acme", title: "CTO" }];
const ANSWERS = [
  { fieldId: "f1", section: "session" as const, label: "Q1", kind: "text", value: "a1" },
  { fieldId: "f2", section: "speaker" as const, label: "Q2", kind: "text", value: "a2" },
];

let evaluationStore: Map<string, { scores: Record<string, number | string>; comment: string | null }>;

vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>(
    "../src/server/repo/review",
  );
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
    listPlanIdsForReviewer: vi.fn(async () => []),
    isSubmissionInReviewerScope: vi.fn(async () => true),
    getSubmissionSummaryInEvent: vi.fn(async () => SUMMARY),
    listAnswersForSubmission: vi.fn(async () => ANSWERS),
    listSpeakersForSubmission: vi.fn(async () => SPEAKERS),
    getEvaluation: vi.fn(async (_db: unknown, planId: string, submissionId: string, reviewerId: string, round: number) => {
      const key = `${planId}:${submissionId}:${reviewerId}:${round}`;
      const row = evaluationStore.get(key);
      return row ? { id: "ev-1", planId, submissionId, reviewerId, round, ...row } : null;
    }),
    upsertEvaluation: vi.fn(async (_db: unknown, input: { planId: string; submissionId: string; reviewerId: string; round: number; scores: Record<string, number | string>; comment: string | null }) => {
      const key = `${input.planId}:${input.submissionId}:${input.reviewerId}:${input.round}`;
      evaluationStore.set(key, { scores: input.scores, comment: input.comment });
      return { id: "ev-1", ...input };
    }),
    countEvaluationsForSubmission: vi.fn(async () => 0),
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

describe("GET /api/v1/review/submissions/:id (DEC-561 contract)", () => {
  it("speakers carry name/company/title and never an email key anywhere in the body", async () => {
    evaluationStore = new Map();
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/review/submissions/sub-1?planId=${planRecord.id}`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain('"email"');
    const body = JSON.parse(text) as { speakers?: { contactId: string; name: string; company: string | null; title: string | null }[] };
    expect(body.speakers).toEqual(SPEAKERS);
  });

  it("returns sessionAnswers filtered to the session section", async () => {
    evaluationStore = new Map();
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/review/submissions/sub-1?planId=${planRecord.id}`);
    const body = (await res.json()) as { sessionAnswers: { fieldId: string }[] };
    expect(body.sessionAnswers.map((a) => a.fieldId)).toEqual(["f1"]);
  });

  it("omits myEvaluation when this reviewer has no stored row", async () => {
    evaluationStore = new Map();
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/review/submissions/sub-1?planId=${planRecord.id}`);
    const body = (await res.json()) as Record<string, unknown>;
    expect("myEvaluation" in body).toBe(false);
  });

  it("after a PUT of scores+comment, a re-GET returns the identical myEvaluation", async () => {
    evaluationStore = new Map();
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const putRes = await app.request(`/api/v1/review/plans/${planRecord.id}/evaluations/sub-1`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ scores: { c1: 4 }, comment: "Solid talk" }),
    });
    expect(putRes.status).toBe(200);

    const getRes = await app.request(`/api/v1/review/submissions/sub-1?planId=${planRecord.id}`);
    const body = (await getRes.json()) as { myEvaluation?: { scores: Record<string, unknown>; comment: string | null } };
    expect(body.myEvaluation).toEqual({ scores: { c1: 4 }, comment: "Solid talk" });
  });

  it("anonymized plan: neither speakers nor speakerAnswers key present, but sessionAnswers and myEvaluation still are", async () => {
    evaluationStore = new Map();
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    await app.request(`/api/v1/review/plans/${anonymizedPlanRecord.id}/evaluations/sub-1`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify({ scores: { c1: 5 }, comment: null }),
    });

    const res = await app.request(`/api/v1/review/submissions/sub-1?planId=${anonymizedPlanRecord.id}`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain("undefined");
    const body = JSON.parse(text) as Record<string, unknown>;
    expect("speakers" in body).toBe(false);
    expect("speakerAnswers" in body).toBe(false);
    expect((body.sessionAnswers as unknown[]).length).toBeGreaterThan(0);
    expect(body.myEvaluation).toEqual({ scores: { c1: 5 }, comment: null });
  });
});

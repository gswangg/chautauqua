// DEC-561/DEC-562 coverage: GET /api/v1/review/submissions/:id's contract --
// speakers carry name/company/title in the response body (never email, even
// though the repo layer now also selects email for DEC-018's wave-54
// identity-redaction list -- the route strips it before responding), custom
// answers are ordered by form_field.position, myEvaluation reflects this
// reviewer's own stored row for the plan's current round (omitted when
// absent), and anonymizeForReviewer still strips the speakers/speakerAnswers
// KEYS entirely plus (wave-54) redacts speaker identity strings out of
// title/description/sessionAnswers.
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
  it("issues orderBy(asc(participant.order), asc(contact.id)), derives name, and selects email (DEC-018 wave-54: identity redaction, never serialized to the client -- caller must strip it)", async () => {
    const seed = [
      { contactId: "c-zed", firstName: "Zed", lastName: "Zeta", company: "Zco", title: "CTO", email: "zed@z.co", order: 1 },
      { contactId: "c-alpha", firstName: "Alan", lastName: "Alpha", company: "Aco", title: "CEO", email: "alan@a.co", order: 0 },
      { contactId: "c-beta-2", firstName: "Bea", lastName: "Beta", company: "Bco", title: "VP", email: "bea@b.co", order: 2 },
      { contactId: "c-beta-1", firstName: "Bob", lastName: "Beta", company: "Bco", title: "Eng", email: "bob@b.co", order: 2 },
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

    // DEC-018 (wave-54 amendment): now selects contact.email too -- purely
    // for the caller's identity-redaction list, never for the client-facing
    // `detail.speakers` field (the route strips it before responding).
    expect(capturedSelectShape).toBeDefined();
    expect(Object.keys(capturedSelectShape as object)).toContain("email");

    expect(rows).toEqual([
      { contactId: "c-alpha", name: "Alan Alpha", company: "Aco", title: "CEO", email: "alan@a.co" },
      { contactId: "c-zed", name: "Zed Zeta", company: "Zco", title: "CTO", email: "zed@z.co" },
      { contactId: "c-beta-1", name: "Bob Beta", company: "Bco", title: "Eng", email: "bob@b.co" },
      { contactId: "c-beta-2", name: "Bea Beta", company: "Bco", title: "VP", email: "bea@b.co" },
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
// DEC-018 (wave-54 amendment): the stubbed repo call still returns `email`
// (listSpeakersForSubmission's real shape) even though SPEAKERS above (used
// by the non-anonymized-plan speakers assertion) does not carry it -- the
// route must strip it from `detail.speakers` regardless of plan.anonymized.
const SPEAKERS_WITH_EMAIL = [{ contactId: "c1", name: "Ada Lovelace", company: "Acme", title: "CTO", email: "ada@example.com" }];
const ANSWERS = [
  { fieldId: "f1", section: "session" as const, label: "Q1", kind: "text", value: "a1" },
  { fieldId: "f2", section: "speaker" as const, label: "Q2", kind: "text", value: "a2" },
];
const IDENTITY_SUMMARY = {
  id: "sub-1",
  ref: "S-001",
  title: "A talk by Ada Lovelace",
  description: "Presented by Ada Lovelace of Acme.",
  trackIds: [],
  status: "submitted",
};
const IDENTITY_ANSWERS = [
  { fieldId: "f1", section: "session" as const, label: "Q1", kind: "text", value: "Written by Ada Lovelace" },
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
    listSpeakersForSubmission: vi.fn(async () => SPEAKERS_WITH_EMAIL),
    // DEC-939 (wave-6 amendment): the detail route now reads the scorecard
    // meta line's format label through the same DEC-857 batched lookup the
    // queue uses. These fixtures carry no format answer, so the map is
    // empty and `format` serialises as null -- stubbed here because the
    // real implementation issues a drizzle db.select() and this suite's db
    // is `{}` (same stub the queue suites already carry).
    listFormatLabelsBySubmission: vi.fn(async () => new Map<string, string | null>()),
    // DEC-857 (task w7-b): the scorecard route now batches the audience-level
    // answer through this same repo module -- same stub reason as format
    // above, or the route 500s against this suite's `{}` db.
    listAudienceLevelLabelsBySubmission: vi.fn(async () => new Map<string, string | null>()),
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

const {
  hasRecusal,
  getSubmissionSummaryInEvent,
  listAnswersForSubmission: listAnswersForSubmissionRoute,
} = await import("../src/server/repo/review");

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

  // DEC-984: a recusal must survive a reload -- the detail carries the
  // caller's own recusal (never another reviewer's) so the SPA can render
  // the recused branch on first paint, not only after a client-side POST.
  it("carries myRecusal when this reviewer has recused themselves", async () => {
    evaluationStore = new Map();
    vi.mocked(hasRecusal).mockResolvedValueOnce({
      id: "rec-1",
      planId: planRecord.id,
      submissionId: "sub-1",
      userId: "u1",
      reason: "Co-author on this submission",
      createdAt: 1700000000000,
    });
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/review/submissions/sub-1?planId=${planRecord.id}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { myRecusal?: { reason: string | null; createdAt: number } };
    expect(body.myRecusal).toEqual({ reason: "Co-author on this submission", createdAt: 1700000000000 });
    // userId is never echoed on this endpoint -- only reason/createdAt.
    expect(JSON.stringify(body.myRecusal)).not.toContain("u1");
  });

  it("omits myRecusal when this reviewer has not recused", async () => {
    evaluationStore = new Map();
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/review/submissions/sub-1?planId=${planRecord.id}`);
    const body = (await res.json()) as Record<string, unknown>;
    expect("myRecusal" in body).toBe(false);
  });

  // DEC-018 (wave-54 amendment): an anonymized plan's detail carries no
  // speaker identity STRING anywhere in the body -- not just the dedicated
  // speaker fields, but title/description/sessionAnswers too. A
  // non-anonymized plan's detail is byte-identical to before this change.
  describe("DEC-018 (wave-54 amendment): identity redaction", () => {
    it("anonymized plan: the speaker's name is nowhere in title/description/sessionAnswers", async () => {
      evaluationStore = new Map();
      vi.mocked(getSubmissionSummaryInEvent).mockResolvedValueOnce(IDENTITY_SUMMARY);
      vi.mocked(listAnswersForSubmissionRoute).mockResolvedValueOnce(IDENTITY_ANSWERS);

      const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
      const res = await app.request(`/api/v1/review/submissions/sub-1?planId=${anonymizedPlanRecord.id}`);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).not.toContain("Ada Lovelace");
      expect(text).not.toContain("ada@example.com");

      const body = JSON.parse(text) as {
        title: string;
        description: string;
        sessionAnswers: { value: unknown }[];
        anonymized: boolean;
      };
      expect(body.title).toBe("A talk by [hidden]");
      expect(body.description).toBe("Presented by [hidden] of [hidden].");
      expect(body.sessionAnswers[0]?.value).toBe("Written by [hidden]");
      expect(body.anonymized).toBe(true);
    });

    it("non-anonymized plan: response is byte-identical to before the wave-54 amendment (no anonymized key, speaker name intact)", async () => {
      evaluationStore = new Map();
      vi.mocked(getSubmissionSummaryInEvent).mockResolvedValueOnce(IDENTITY_SUMMARY);
      vi.mocked(listAnswersForSubmissionRoute).mockResolvedValueOnce(IDENTITY_ANSWERS);

      const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
      const res = await app.request(`/api/v1/review/submissions/sub-1?planId=${planRecord.id}`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        title: string;
        description: string;
        sessionAnswers: { value: unknown }[];
        anonymized?: boolean;
      };
      expect(body.title).toBe("A talk by Ada Lovelace");
      expect(body.description).toBe("Presented by Ada Lovelace of Acme.");
      expect(body.sessionAnswers[0]?.value).toBe("Written by Ada Lovelace");
      expect("anonymized" in body).toBe(false);
    });
  });
});

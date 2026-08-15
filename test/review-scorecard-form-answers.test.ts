// DEC-908 amendment (wave 20): locked built-in answers (title, description,
// first_name/last_name/email, ...) already surface through their own
// SubmissionDetail columns (summary fields / speakers) -- they must never
// ALSO ride along in speakerAnswers/sessionAnswers, or the reviewer
// scorecard double-renders the title/abstract and, on a non-anonymized
// plan, leaks raw speaker PII through a reading column that isn't supposed
// to carry it. This drives the real GET /api/v1/review/submissions/:id
// route (test/review-idor.test.ts's established mocked-repo pattern) with a
// submission carrying both spellings of a locked key (bare seeded id AND
// the DEC-050 per-form PK) alongside genuine custom answers, and asserts
// the locked keys never reach the wire while the custom answers and the
// format/audienceLevel facts (DEC-857/DEC-939, resolved through a separate
// non-locked field id) still do.

import { describe, expect, it, vi } from "vitest";
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

const SUMMARY = { id: "sub-1", ref: "S-001", title: "Talk One", description: "desc", trackIds: [] };
const SPEAKERS = [{ contactId: "c1", name: "Ada Lovelace", company: "Acme", title: "CTO" }];

// Deliberately mixes: bare seeded locked ids ("title", "email"), a
// DEC-050 per-form PK locked id ("form-1:first_name"), and one genuine
// custom field in each section.
const ANSWERS = [
  { fieldId: "title", section: "session" as const, label: "Title", kind: "text", value: "Talk One" },
  { fieldId: "form-1:description", section: "session" as const, label: "Description", kind: "text", value: "desc" },
  { fieldId: "custom-session-1", section: "session" as const, label: "Prior experience", kind: "text", value: "5 years" },
  { fieldId: "form-1:first_name", section: "speaker" as const, label: "First name", kind: "text", value: "Ada" },
  { fieldId: "email", section: "speaker" as const, label: "Email", kind: "text", value: "ada@example.com" },
  { fieldId: "custom-speaker-1", section: "speaker" as const, label: "Twitter handle", kind: "text", value: "@ada" },
];

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
      return planId === planRecord.id ? planRecord : null;
    }),
    getPlanById: vi.fn(async (_db: unknown, planId: string) => (planId === planRecord.id ? planRecord : null)),
    listPlanIdsForReviewer: vi.fn(async () => []),
    isSubmissionInReviewerScope: vi.fn(async () => true),
    getSubmissionSummaryInEvent: vi.fn(async () => SUMMARY),
    listAnswersForSubmission: vi.fn(async () => ANSWERS),
    listSpeakersForSubmission: vi.fn(async () => SPEAKERS),
    listFormatLabelsBySubmission: vi.fn(async () => new Map([["sub-1", "Workshop"]])),
    listAudienceLevelLabelsBySubmission: vi.fn(async () => new Map([["sub-1", "Intermediate"]])),
    getEvaluation: vi.fn(async () => null),
    upsertEvaluation: vi.fn(async () => {
      throw new Error("not exercised in this suite");
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

describe("GET /api/v1/review/submissions/:id form answers (DEC-908 amendment, wave 20)", () => {
  it("strips locked built-in keys (both spellings) from speakerAnswers/sessionAnswers, keeps genuine custom answers and format/audienceLevel", async () => {
    const app = await buildApp({ userId: "u1", role: "organizer", orgId: ORG_A });
    const res = await app.request(`/api/v1/review/submissions/sub-1?planId=${planRecord.id}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      sessionAnswers: { fieldId: string; label: string }[];
      speakerAnswers: { fieldId: string; label: string }[];
      format: string | null;
      audienceLevel: string | null;
    };

    const lockedKeys = ["title", "form-1:description", "form-1:first_name", "email"];
    const allAnswerFieldIds = [...body.sessionAnswers, ...body.speakerAnswers].map((a) => a.fieldId);
    for (const locked of lockedKeys) {
      expect(allAnswerFieldIds).not.toContain(locked);
    }

    expect(body.sessionAnswers.map((a) => a.fieldId)).toEqual(["custom-session-1"]);
    expect(body.sessionAnswers[0]?.label).toBe("Prior experience");
    expect(body.speakerAnswers.map((a) => a.fieldId)).toEqual(["custom-speaker-1"]);
    expect(body.speakerAnswers[0]?.label).toBe("Twitter handle");

    // format/audienceLevel resolve through the role-tagged session_format /
    // audience_level fields (src/server/repo/form-roles.ts), which are not
    // locked names, and must keep working unaffected by this filter.
    expect(body.format).toBe("Workshop");
    expect(body.audienceLevel).toBe("Intermediate");
  });
});

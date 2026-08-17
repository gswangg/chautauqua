// DEC-239 contract sweep: route-level tests asserting EXACT key names for
// every SPA payload type NOT already covered by test/users-api.test.ts
// (PlanReviewer via GET /api/v1/plans/:id/reviewers), test/review-queue-
// shape.test.ts (reviewer queue item), or test/contacts-duplicates-merge-
// route.test.ts. Repo calls are mocked (no D1/wrangler dependency in stage
// 1), mirroring the existing test/review-idor.test.ts pattern -- these are
// still real requests through each route file's Hono sub-app (the same
// sub-apps src/index.ts mounts), just with the DB layer swapped for
// deterministic fixtures. Any key-name mismatch found here gets fixed at
// the ROUTE per DEC-246 (SPA types.ts is the contract of record), same
// commit, called out in the commit message.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { registerErrorHandler } from "../src/server/http";
import type { AppEnv, AuthInfo } from "../src/server/env";

const ORG_A = "org-a";
const organizerAuth: AuthInfo = { userId: "u-organizer", role: "organizer", orgId: ORG_A };

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

function keysOf(obj: Record<string, unknown>): string[] {
  return Object.keys(obj).sort();
}

function first<T>(arr: T[]): T {
  const item = arr[0];
  if (item === undefined) throw new Error("expected a non-empty array");
  return item;
}

// ---------------------------------------------------------------------------
// GET /api/v1/plans/:id/progress vs ProgressRow {userId,email,assigned,completed}
// GET /api/v1/plans/:id/results vs ResultsRow {submissionId,ref,title,count,
//   average,perCriterion,perDropdown}
// ---------------------------------------------------------------------------

const PLAN = {
  id: "plan-1",
  eventId: "event-1",
  name: "Plan One",
  instructions: null,
  openDate: null,
  closeDate: null,
  filters: null,
  anonymized: false,
  scale: { min: 1, max: 5 },
  criteria: [
    { id: "c1", label: "Quality", kind: "rating", weight: 1 },
    { id: "c2", label: "Track fit", kind: "dropdown", options: ["Yes", "No"] },
  ],
  rounds: 1,
  currentRound: 1,
  roundCriteria: null,
  maxEvaluations: null,
};

const REVIEWER_ROWS = [{ id: "pr-1", planId: PLAN.id, userId: "u-rev-1", trackId: null, submissionId: null }];
const USERS = [{ userId: "u-rev-1", email: "reviewer@org.test" }];
const SUBMISSIONS = [{ id: "sub-1", ref: "S-001", title: "Talk One", description: null, trackIds: [] }];
const EVALUATIONS = [
  {
    id: "ev-1",
    planId: PLAN.id,
    submissionId: "sub-1",
    reviewerId: "u-rev-1",
    round: 1,
    scores: { c1: 4, c2: "Yes" },
    comment: null,
  },
];

async function buildReviewApp() {
  vi.doMock("../src/server/repo/review", async () => {
    const actual = await vi.importActual<typeof import("../src/server/repo/review")>("../src/server/repo/review");
    return {
      ...actual,
      getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
        planId === PLAN.id && orgId === ORG_A ? PLAN : null,
      ),
      listReviewerRowsForPlan: vi.fn(async () => REVIEWER_ROWS),
      getUsersByIds: vi.fn(async () => USERS),
      // DEC-708: batched account->contact display-name resolver -- no
      // contact fixtures here, so every userId resolves to null (email
      // rendered alone), still present as the `name` key.
      batchUserDisplayNames: vi.fn(async () => new Map()),
      listEvaluationsForPlan: vi.fn(async () => EVALUATIONS),
      listEvaluationScoresForPlan: vi.fn(async (_db: unknown, planId: string, round: number) =>
        EVALUATIONS.filter((e) => e.planId === planId && e.round === round).map((e) => ({
          submissionId: e.submissionId,
          scores: e.scores,
        })),
      ),
      listEvaluatedPairsForPlan: vi.fn(async (_db: unknown, planId: string, round: number) =>
        EVALUATIONS
          .filter((e) => e.planId === planId && e.round === round)
          .map((e) => ({ reviewerId: e.reviewerId, submissionId: e.submissionId })),
      ),
      listPlanFilteredSubmissions: vi.fn(async () => SUBMISSIONS),
      // DEC-703: batched speaker/track lookups -- no participant/track
      // fixtures here, so both resolve to empty (still present as [] keys).
      listSpeakerNamesForSubmissions: vi.fn(async () => new Map()),
      listTrackNamesForSubmissions: vi.fn(async () => new Map()),
      // DEC-271 (task w5-c): no recusals in this fixture.
      listRecusalsForPlan: vi.fn(async () => []),
      listRecusalsForReviewer: vi.fn(async () => []),
      hasRecusal: vi.fn(async () => null),
    };
  });
  const { reviewRoutes } = await import("../src/routes/review");
  const app = new Hono<AppEnv>();
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", organizerAuth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/", reviewRoutes);
  return app;
}

describe("DEC-239: plan progress/results wire shapes", () => {
  it("GET /api/v1/plans/:id/progress items match ProgressRow {userId,email,name,assigned,completed,recused,trackName}", async () => {
    const app = await buildReviewApp();
    const res = await app.request(`/api/v1/plans/${PLAN.id}/progress`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Record<string, unknown>[] };
    expect(body.items.length).toBeGreaterThan(0);
    // w5-f: trackName -- this reviewer's own track scope, resolved from
    // their plan_reviewer rows (DEC-845 reuse) -- rides the envelope so the
    // reviewer-progress row can carry the plan's track subtitle without a
    // second fetch.
    expect(keysOf(first(body.items))).toEqual(["assigned", "completed", "email", "name", "recused", "trackName", "userId"]);
  });

  it("GET /api/v1/plans/:id/results items match ResultsRow incl perCriterion/perDropdown", async () => {
    const app = await buildReviewApp();
    const res = await app.request(`/api/v1/plans/${PLAN.id}/results`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Record<string, unknown>[] };
    expect(body.items.length).toBeGreaterThan(0);
    const row = first(body.items);
    expect(keysOf(row)).toEqual([
      "average",
      "count",
      "perCriterion",
      "perDropdown",
      // Post-eval amendment: the SCORE rank is server truth -- the table
      // renders it verbatim instead of numbering rows by display position.
      "rank",
      // w42-h/DEC-366 amendment: the Reviews cell's disclosure trigger names
      // a real recusal count, never a fabricated figure -- plan-scoped.
      "recusals",
      "ref",
      "speakers",
      "submissionId",
      "title",
      "trackNames",
    ]);
    expect(typeof row.perCriterion).toBe("object");
    expect(typeof row.perDropdown).toBe("object");
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/events/:id/files vs EventFileChainItem
// ---------------------------------------------------------------------------

const FILE_CHAIN_ITEM = {
  rootFileId: "file-root-1",
  latestFileId: "file-latest-1",
  filename: "slides.pdf",
  kind: "presentation",
  submissionId: "sub-1",
  submissionRef: "S-001",
  submissionTitle: "Talk One",
  speakerName: "Ada Lovelace",
  uploadedAt: 1700000000000,
  versionCount: 2,
};

describe("DEC-239: GET /api/v1/events/:eventId/files vs EventFileChainItem", () => {
  it("items match {rootFileId,latestFileId,filename,kind,submissionId,submissionRef,submissionTitle,speakerName,uploadedAt,versionCount}", async () => {
    vi.doMock("../src/server/repo/files", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
      return {
        ...actual,
        getEventFilesScope: vi.fn(async (_db: unknown, eventId: string) =>
          eventId === "event-1" ? { orgId: ORG_A, slug: "arbitrary-con" } : null,
        ),
        listEventDeliverableFiles: vi.fn(async () => ({ items: [FILE_CHAIN_ITEM], total: 1, page: 1, perPage: 50 })),
      };
    });
    const { fileApiRoutes } = await import("../src/routes/files");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", organizerAuth);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/v1", fileApiRoutes);

    const res = await app.request("/api/v1/events/event-1/files");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Record<string, unknown>[] };
    expect(body.items.length).toBeGreaterThan(0);
    expect(keysOf(first(body.items))).toEqual(
      [
        "filename",
        "kind",
        "latestFileId",
        "rootFileId",
        "speakerName",
        "submissionId",
        "submissionRef",
        "submissionTitle",
        "uploadedAt",
        "versionCount",
      ].sort(),
    );
  });
});

// ---------------------------------------------------------------------------
// DEC-247: GET /api/v1/submissions/:id/files must be a flat
// { items: DeliverableFile[] } envelope, not the repo's internal
// kind-grouped shape. DEC-471: also now carries total/page/perPage.
// ---------------------------------------------------------------------------

describe("DEC-239/DEC-247: GET /api/v1/submissions/:id/files vs DeliverableFile", () => {
  it("items match flat {id,submissionId,kind,filename,sizeBytes,contentType,previousFileId,uploadedByContactId,createdAt}", async () => {
    vi.doMock("../src/server/repo/files", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/files")>("../src/server/repo/files");
      return {
        ...actual,
        getSubmissionScope: vi.fn(async (_db: unknown, submissionId: string) =>
          submissionId === "sub-1" ? { orgId: ORG_A, readParticipantContactIds: [], activeParticipantContactIds: [] } : null,
        ),
        listSubmissionFiles: vi.fn(async () => ({
          presentation: [
            {
              id: "file-1",
              filename: "slides.pdf",
              sizeBytes: 100,
              contentType: "application/pdf",
              previousFileId: null,
              uploadedByContactId: "ct-1",
              createdAt: 1700000000000,
              versionNo: 1,
            },
          ],
        })),
        // DEC-601: the route batches a contact-name lookup for the page's
        // uploader ids — stub it out here, this test only cares about shape.
        batchContactNames: vi.fn(async () => new Map<string, string>([["ct-1", "Priya Raman"]])),
      };
    });
    const { fileApiRoutes } = await import("../src/routes/files");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", organizerAuth);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/v1", fileApiRoutes);

    const res = await app.request("/api/v1/submissions/sub-1/files");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    // DEC-471: this endpoint now returns the DEC-013/DEC-461 list envelope
    // ({items,total,page,perPage}), not a bare {items}.
    expect(keysOf(body)).toEqual(["items", "page", "perPage", "total"].sort());
    expect(keysOf(first(body.items as Record<string, unknown>[]))).toEqual(
      [
        "contentType",
        "createdAt",
        "filename",
        "id",
        "kind",
        "previousFileId",
        "sizeBytes",
        "submissionId",
        "uploadedByContactId",
        "uploaderName",
        "versionNo",
      ].sort(),
    );
  });
});

// ---------------------------------------------------------------------------
// speakers-matrix rows: GET /api/v1/events/:eventId/onboarding vs
// OnboardingGridResponse {tasks, rows, total, page, perPage, counts} (DEC-340
// server-paginated/filtered/searchable roster, superseding DEC-023).
// ---------------------------------------------------------------------------

const ONBOARDING_GRID = {
  tasks: [{ id: "task-1", kind: "general", title: "Sign W9", dueDate: null, required: true }],
  rows: [
    {
      contact: { id: "ct-1", name: "Ada Lovelace", email: "ada@org.test", company: null, hasAccount: true },
      cells: [
        {
          taskId: "task-1",
          assignmentId: "asg-1",
          status: "pending",
          completedAt: null,
          fileId: null,
          fileName: null,
        },
      ],
    },
  ],
  total: 1,
  page: 1,
  perPage: 50,
  counts: { speakers: 1, outstandingRequired: 1, overdue: 0, outstandingContacts: 1 },
};

describe("DEC-239/DEC-340: GET /api/v1/events/:eventId/onboarding vs OnboardingGridResponse", () => {
  it("matches {tasks,rows,total,page,perPage,counts} with exact task/row/cell/contact key names", async () => {
    vi.doMock("../src/server/repo/tasks", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/tasks")>("../src/server/repo/tasks");
      return {
        ...actual,
        getOnboardingGrid: vi.fn(async () => ONBOARDING_GRID),
        getEventOrgId: vi.fn(async (_db: unknown, eventId: string) => (eventId === "event-1" ? ORG_A : null)),
      };
    });
    const { taskRoutes } = await import("../src/routes/tasks");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", organizerAuth);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/v1", taskRoutes);

    const res = await app.request("/api/v1/events/event-1/onboarding");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      tasks: Record<string, unknown>[];
      rows: Record<string, unknown>[];
      counts: Record<string, unknown>;
    };
    expect(keysOf(body)).toEqual(["counts", "page", "perPage", "rows", "tasks", "total"]);
    expect(keysOf(first(body.tasks))).toEqual(["dueDate", "id", "kind", "required", "title"]);
    expect(keysOf(body.counts)).toEqual(["outstandingContacts", "outstandingRequired", "overdue", "speakers"]);
    const row = first(body.rows);
    expect(keysOf(row)).toEqual(["cells", "contact"]);
    expect(keysOf(row.contact as Record<string, unknown>)).toEqual([
      "company",
      "email",
      "hasAccount",
      "id",
      "name",
    ]);
    expect(keysOf(first(row.cells as Record<string, unknown>[]))).toEqual([
      "assignmentId",
      "completedAt",
      "fileId",
      "fileName",
      "status",
      "taskId",
    ]);
  });
});

// ---------------------------------------------------------------------------
// agenda payloads: GET /api/v1/events/:eventId/agenda vs AgendaPayload
// ---------------------------------------------------------------------------

const AGENDA_PAYLOAD = {
  days: ["2026-09-01"],
  rooms: [{ id: "room-1", name: "Main Hall" }],
  tracks: [{ id: "trk-1", name: "Keynotes", color: "#ff0000" }],
  placed: [
    {
      submissionId: "sub-1",
      ref: "S-001",
      title: "Talk One",
      trackIds: ["trk-1"],
      speakers: [{ contactId: "ct-1", name: "Ada Lovelace" }],
      roomId: "room-1",
      day: "2026-09-01",
      startMin: 540,
      endMin: 600,
    },
  ],
  unscheduled: [
    {
      submissionId: "sub-2",
      ref: "S-002",
      title: "Talk Two",
      trackIds: [],
      speakers: [],
    },
  ],
  conflicts: [
    {
      kind: "room_overlap",
      submissionIds: ["sub-1", "sub-2"],
      day: "2026-09-01",
      roomId: "room-1",
      speakerContactIds: [],
      detail: "overlap",
    },
  ],
  unplacedReasons: [],
  summary: { unplaced: 1, conflicts: 1 },
};

describe("DEC-239: GET /api/v1/events/:eventId/agenda vs AgendaPayload", () => {
  it("matches {days,rooms,tracks,placed,unscheduled,conflicts,summary} incl. session/speaker keys", async () => {
    vi.doMock("../src/server/repo/agenda", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/agenda")>("../src/server/repo/agenda");
      return {
        ...actual,
        getEventInfo: vi.fn(async (_db: unknown, eventId: string) =>
          eventId === "event-1" ? { orgId: ORG_A, startDate: "2026-09-01", endDate: "2026-09-02", recordPrefix: "SES" } : null,
        ),
        getAgendaPayload: vi.fn(async () => AGENDA_PAYLOAD),
      };
    });
    const { agendaRoutes } = await import("../src/routes/agenda");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", organizerAuth);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/v1", agendaRoutes);

    const res = await app.request("/api/v1/events/event-1/agenda");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(keysOf(body)).toEqual([
      "conflicts",
      "days",
      "placed",
      "rooms",
      "summary",
      "tracks",
      "unplacedReasons",
      "unscheduled",
    ]);
    const placed = first(body.placed as Record<string, unknown>[]);
    expect(keysOf(placed)).toEqual(["day", "endMin", "ref", "roomId", "speakers", "startMin", "submissionId", "title", "trackIds"]);
    expect(keysOf(first(placed.speakers as Record<string, unknown>[]))).toEqual(["contactId", "name"]);
    const unscheduled = first(body.unscheduled as Record<string, unknown>[]);
    expect(keysOf(unscheduled)).toEqual(["ref", "speakers", "submissionId", "title", "trackIds"]);
    expect(keysOf(body.summary as Record<string, unknown>)).toEqual(["conflicts", "unplaced"]);
  });
});

// ---------------------------------------------------------------------------
// comms history: GET /api/v1/events/:eventId/email-log vs EmailLogRow
// ---------------------------------------------------------------------------

const EMAIL_LOG_ROW = {
  id: "log-1",
  eventId: "event-1",
  eventName: "Arbitrary Con",
  templateId: null,
  contactId: "ct-1",
  toEmail: "ada@org.test",
  subject: "Welcome",
  bodyText: "Hi",
  bodyHtml: null,
  icsText: null,
  icsFilename: null,
  provider: "dev",
  status: "sent",
  sentAt: 1700000000000,
};

describe("DEC-239: GET /api/v1/events/:eventId/email-log vs EmailLogRow", () => {
  it("matches every EmailLogRow key exactly", async () => {
    vi.doMock("../src/server/repo/email", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/email")>("../src/server/repo/email");
      return { ...actual, listEmailLog: vi.fn(async () => ({ items: [EMAIL_LOG_ROW], total: 1 })) };
    });
    const dbStub = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ id: "event-1", orgId: ORG_A }],
          }),
        }),
      }),
    };
    const { emailLogRoutes } = await import("../src/routes/api/email-log");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", organizerAuth);
      c.set("db", dbStub as never);
      await next();
    });
    app.route("/", emailLogRoutes);

    const res = await app.request("/api/v1/events/event-1/email-log");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Record<string, unknown>[] };
    expect(body.items.length).toBeGreaterThan(0);
    expect(keysOf(first(body.items))).toEqual(
      [
        "id",
        "eventId",
        "eventName",
        "templateId",
        "contactId",
        "toEmail",
        "subject",
        "bodyText",
        "bodyHtml",
        "icsText",
        "icsFilename",
        "provider",
        "status",
        "sentAt",
      ].sort(),
    );
  });
});

// ---------------------------------------------------------------------------
// overview cards: GET /api/v1/events/:eventId/overview (v1 wire shape).
// See DEC-370: the SPA-side consumer of this payload moved to
// app/src/pages/overview/{types,rows}.ts (v2 contract, shipped separately).
// ---------------------------------------------------------------------------

const OVERVIEW_PAYLOAD = {
  "triage-counts": { pending: 2, accept_queue: 1, decline_queue: 0 },
  review: { plans: 1, evaluationsSubmitted: 0, evaluationsExpected: 0 },
  speakers: { contactsOwing: 3, overdueAssignments: 1 },
  content: { awaitingApproval: 2 },
  agenda: { unplaced: 1, conflicts: 0 },
  comms: { sentLast7Days: 4, lastSentAt: 1700000000000 },
};

describe("DEC-239: GET /api/v1/events/:eventId/overview vs OverviewPayload", () => {
  it("matches every top-level + nested key the overview cards module dereferences", async () => {
    vi.doMock("../src/server/repo/overview", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/overview")>("../src/server/repo/overview");
      return { ...actual, getOverviewPayload: vi.fn(async () => OVERVIEW_PAYLOAD) };
    });
    vi.doMock("../src/server/repo/events", async () => {
      const actual = await vi.importActual<typeof import("../src/server/repo/events")>("../src/server/repo/events");
      return {
        ...actual,
        getEventForOrg: vi.fn(async (_db: unknown, eventId: string, orgId: string) =>
          eventId === "event-1" && orgId === ORG_A ? { id: "event-1", orgId: ORG_A, timezone: "America/New_York" } : null,
        ),
      };
    });
    const { overviewRoutes } = await import("../src/routes/api/overview");
    const app = new Hono<AppEnv>();
    registerErrorHandler(app);
    app.use("*", async (c, next) => {
      c.set("auth", organizerAuth);
      c.set("db", {} as never);
      await next();
    });
    app.route("/api/v1", overviewRoutes);

    const res = await app.request("/api/v1/events/event-1/overview");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(keysOf(body)).toEqual(["agenda", "comms", "content", "review", "speakers", "triage-counts"]);
    expect(keysOf(body["triage-counts"] as Record<string, unknown>)).toEqual(["accept_queue", "decline_queue", "pending"]);
    expect(keysOf(body.review as Record<string, unknown>)).toEqual(["evaluationsExpected", "evaluationsSubmitted", "plans"]);
    expect(keysOf(body.speakers as Record<string, unknown>)).toEqual(["contactsOwing", "overdueAssignments"]);
    expect(keysOf(body.content as Record<string, unknown>)).toEqual(["awaitingApproval"]);
    expect(keysOf(body.agenda as Record<string, unknown>)).toEqual(["conflicts", "unplaced"]);
    expect(keysOf(body.comms as Record<string, unknown>)).toEqual(["lastSentAt", "sentLast7Days"]);

    // DEC-370 (w1 redesign): the SPA's overview cards module (which used to
    // be exercised here against this v1 payload) was replaced by the
    // worklist page in app/src/pages/overview/{types,rows}.ts, built
    // against the v2 payload contract. The v2 server response is shipped
    // separately (task-w1-c); this test keeps asserting the v1 wire shape
    // the live route above still returns.
  });
});

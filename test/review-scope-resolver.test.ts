// DEC-655 regression coverage: the two readings of "is this submission in
// this reviewer's scope" must end in ONE rule.
//
// (a) isSubmissionInReviewerScope (the per-submission GET/PUT reader) and
// resolveReviewerSubmissions (the set-based reviewer-queue reader) must
// never disagree, across a matrix of plan.filters.trackIds x assignment
// scope x submission track membership -- exercising the real (unmocked)
// src/server/repo/review/submissions.ts against a fake drizzle db (no local
// sqlite/D1 test driver in stage 1 -- see test/review-repo-aggregates.test.ts
// and test/review-queue-scoping.test.ts, whose tag-evaluator fake-db pattern
// this file reuses and extends with innerJoin support for the track-branch
// query isSubmissionInReviewerScope issues).
//
// (b) POST /api/v1/plans/:id/reviewers refuses (400, submissionId field) an
// explicit submissionId the plan's own filters exclude, and still assigns
// (201) one they include -- mirroring the DEC-354 in-event rejection at the
// same call site.

import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { AppEnv, AuthInfo } from "../src/server/env";
import * as schema from "../src/db/schema";

const TAG = Symbol("cond-tag");

interface CondTag {
  kind: "eq" | "inArray" | "and" | "or" | "exists";
  col?: string;
  val?: unknown;
  vals?: unknown[];
  children?: (CondTag | undefined)[];
  inner?: CondTag;
}

type Tagged<T> = T & { [TAG]?: CondTag };

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  function eq(col: { name: string }, val: unknown): Tagged<object> {
    return { [TAG]: { kind: "eq", col: col.name, val } };
  }
  function inArray(col: { name: string }, vals: unknown[]): Tagged<object> {
    return { [TAG]: { kind: "inArray", col: col.name, vals } };
  }
  function and(...conds: (Tagged<object> | undefined)[]): Tagged<object> | undefined {
    const present = conds.filter((c): c is Tagged<object> => Boolean(c));
    if (present.length === 0) return undefined;
    return { [TAG]: { kind: "and", children: present.map((c) => c[TAG]) } };
  }
  function or(...conds: (Tagged<object> | undefined)[]): Tagged<object> | undefined {
    const present = conds.filter((c): c is Tagged<object> => Boolean(c));
    if (present.length === 0) return undefined;
    return { [TAG]: { kind: "or", children: present.map((c) => c[TAG]) } };
  }
  function exists(subquery: { __whereTag?: CondTag }): Tagged<object> {
    return { [TAG]: { kind: "exists", inner: subquery.__whereTag } };
  }
  return { ...actual, eq, and, or, inArray, exists };
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Fixture data. One submission ("sub-S") whose track membership varies per
// case; event-1 throughout.
// ---------------------------------------------------------------------------

const EVENT_ROW = { id: "event-1", record_prefix: "TALK" };
const SUBMISSION_ROW = { id: "sub-S", event_id: "event-1", seq: 1, title: "Talk S" };

type TrackMembership = "T1" | "T2" | "none";

function trackRowsFor(membership: TrackMembership): { submission_id: string; track_id: string }[] {
  return membership === "none" ? [] : [{ submission_id: "sub-S", track_id: membership }];
}

type PlanReviewerRow = { plan_id: string; user_id: string; track_id: string | null; submission_id: string | null };
const PLAN_ID = "plan-1";
const REVIEWER = "rev-1";

type AssignmentKind = "unrestricted" | "trackT1" | "trackT2" | "submissionS";

function reviewerRowFor(kind: AssignmentKind): PlanReviewerRow {
  const base = { plan_id: PLAN_ID, user_id: REVIEWER };
  switch (kind) {
    case "unrestricted":
      return { ...base, track_id: null, submission_id: null };
    case "trackT1":
      return { ...base, track_id: "T1", submission_id: null };
    case "trackT2":
      return { ...base, track_id: "T2", submission_id: null };
    case "submissionS":
      return { ...base, track_id: null, submission_id: "sub-S" };
  }
}

function evalCond(tag: CondTag | undefined, row: Record<string, unknown>): boolean {
  if (!tag) return true;
  switch (tag.kind) {
    case "eq":
      if (typeof tag.val === "object" && tag.val !== null && "name" in (tag.val as object)) return true;
      return row[tag.col as string] === tag.val;
    case "inArray":
      return (tag.vals as unknown[]).includes(row[tag.col as string]);
    case "and":
      return (tag.children ?? []).every((c) => evalCond(c, row));
    case "or":
      return (tag.children ?? []).some((c) => evalCond(c, row));
    case "exists": {
      const trackRowsForCandidate = CURRENT_TRACK_ROWS.filter((t) => t.submission_id === row.id);
      return trackRowsForCandidate.some((t) => evalCond(tag.inner, t as unknown as Record<string, unknown>));
    }
    default:
      throw new Error(`unhandled tag kind: ${(tag as CondTag).kind}`);
  }
}

function shapeRow(row: Record<string, unknown>, cols: Record<string, { name: string }>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [alias, col] of Object.entries(cols)) out[alias] = row[col.name];
  return out;
}

function chainable(rows: Record<string, unknown>[], tag: CondTag | undefined) {
  const resolved = Promise.resolve(rows);
  (resolved as unknown as { __whereTag?: CondTag }).__whereTag = tag;
  return {
    then: (resolve: (v: Record<string, unknown>[]) => void, reject?: (e: unknown) => void) =>
      resolved.then(resolve, reject),
    limit: (n: number) => Promise.resolve(rows.slice(0, n)),
    orderBy: () => ({ limit: (n: number) => Promise.resolve(rows.slice(0, n)) }),
    __whereTag: tag,
  };
}

let CURRENT_PLAN_REVIEWER_ROWS: PlanReviewerRow[] = [];
let CURRENT_TRACK_ROWS: { submission_id: string; track_id: string }[] = [];

function makeFakeDb() {
  return {
    select: (cols?: Record<string, { name: string }>) => ({
      from: (table: unknown) => {
        if (table === schema.planReviewer) {
          return {
            where: (cond: Tagged<object> | undefined) => {
              const tag = cond?.[TAG];
              const rows = CURRENT_PLAN_REVIEWER_ROWS.filter((r) =>
                evalCond(tag, r as unknown as Record<string, unknown>),
              );
              // resolveReviewerSubmissions and isSubmissionInReviewerScope
              // (DEC-346 amendment, wave 18) both now select the aliased
              // {trackId, submissionId} column map -- cover the bare
              // `db.select()` (no column map -- cols is undefined) shape too,
              // matching what real drizzle returns when no cols are given,
              // rather than shapeRow()'ing an undefined cols map.
              if (cols) {
                return chainable(rows.map((r) => shapeRow(r as unknown as Record<string, unknown>, cols)), tag);
              }
              return Promise.resolve(
                rows.map((r) => ({
                  id: "pr-fake",
                  planId: r.plan_id,
                  userId: r.user_id,
                  trackId: r.track_id,
                  submissionId: r.submission_id,
                  createdAt: 0,
                  updatedAt: 0,
                })),
              );
            },
          };
        }
        if (table === schema.submission) {
          return {
            where: (cond: Tagged<object> | undefined) => {
              const tag = cond?.[TAG];
              const rows = [SUBMISSION_ROW].filter((r) => evalCond(tag, r));
              return chainable(
                rows.map((r) => shapeRow(r, cols!)),
                tag,
              );
            },
          };
        }
        if (table === schema.event) {
          return {
            where: (cond: Tagged<object> | undefined) => {
              const tag = cond?.[TAG];
              const rows = [EVENT_ROW].filter((r) => evalCond(tag, r as unknown as Record<string, unknown>));
              return { limit: () => Promise.resolve(rows.map((r) => shapeRow(r as unknown as Record<string, unknown>, cols!))) };
            },
          };
        }
        if (table === schema.submissionTrack) {
          return {
            where: (cond: Tagged<object> | undefined) => {
              const tag = cond?.[TAG];
              if (cols && "one" in cols) {
                // Correlated EXISTS subquery body -- expose the tag via
                // __whereTag so the outer exists() tag builder can read it.
                const marker = { __whereTag: tag };
                return marker;
              }
              const rows = CURRENT_TRACK_ROWS.filter((r) => evalCond(tag, r));
              return chainable(
                rows.map((r) => shapeRow(r, cols!)),
                tag,
              );
            },
            innerJoin: (_joinTable: unknown, _joinCond: unknown) => ({
              where: (cond: Tagged<object> | undefined) => {
                const tag = cond?.[TAG];
                const joined = CURRENT_TRACK_ROWS.map((t) => ({
                  ...t,
                  id: SUBMISSION_ROW.id === t.submission_id ? SUBMISSION_ROW.id : undefined,
                  event_id: SUBMISSION_ROW.id === t.submission_id ? SUBMISSION_ROW.event_id : undefined,
                })).filter((r) => r.id !== undefined);
                const rows = joined.filter((r) => evalCond(tag, r as unknown as Record<string, unknown>));
                return chainable(
                  rows.map((r) => shapeRow(r as unknown as Record<string, unknown>, cols!)),
                  tag,
                );
              },
            }),
          };
        }
        throw new Error("unexpected table in fake db");
      },
    }),
  };
}

// ---------------------------------------------------------------------------
// Expected-value oracle, independent of both readers.
// ---------------------------------------------------------------------------

function expectedInScope(
  filterTracks: string[] | undefined,
  assignment: AssignmentKind,
  membership: TrackMembership,
): boolean {
  const filterMatch = !filterTracks || filterTracks.length === 0 || (membership !== "none" && filterTracks.includes(membership));
  let scopeMatch: boolean;
  switch (assignment) {
    case "unrestricted":
      scopeMatch = true;
      break;
    case "trackT1":
      scopeMatch = membership === "T1";
      break;
    case "trackT2":
      scopeMatch = membership === "T2";
      break;
    case "submissionS":
      scopeMatch = true; // it IS sub-S
      break;
  }
  return scopeMatch && filterMatch;
}

function planRecord(filterTracks: string[] | undefined) {
  return {
    id: PLAN_ID,
    eventId: "event-1",
    name: "Plan",
    instructions: null,
    openDate: null,
    closeDate: null,
    filters: filterTracks ? { trackIds: filterTracks } : null,
    anonymized: false,
    scale: { min: 1, max: 5 },
    criteria: [],
    rounds: 1,
    currentRound: 1,
    roundCriteria: null,
    maxEvaluations: null,
    createdAt: 0,
    updatedAt: 0,
    timezone: "UTC",
  };
}

describe("DEC-655: isSubmissionInReviewerScope and resolveReviewerSubmissions never disagree", () => {
  const filterCases: (string[] | undefined)[] = [undefined, ["T1"]];
  const assignmentCases: AssignmentKind[] = ["unrestricted", "trackT1", "trackT2", "submissionS"];
  const membershipCases: TrackMembership[] = ["T1", "T2", "none"];

  for (const filterTracks of filterCases) {
    for (const assignment of assignmentCases) {
      for (const membership of membershipCases) {
        const label = `filters=${filterTracks ? filterTracks.join(",") : "absent"} assignment=${assignment} membership=${membership}`;
        it(label, async () => {
          const { isSubmissionInReviewerScope, resolveReviewerSubmissions } = await vi.importActual<
            typeof import("../src/server/repo/review/submissions")
          >("../src/server/repo/review/submissions");

          CURRENT_PLAN_REVIEWER_ROWS = [reviewerRowFor(assignment)];
          CURRENT_TRACK_ROWS = trackRowsFor(membership);
          const plan = planRecord(filterTracks);
          const db = makeFakeDb();

          const viaPerSubmission = await isSubmissionInReviewerScope(db as never, plan as never, REVIEWER, "sub-S");

          const dbForSet = makeFakeDb();
          const setResult = await resolveReviewerSubmissions(dbForSet as never, plan as never, REVIEWER);
          const viaSet = setResult.some((r) => r.id === "sub-S");

          const expected = expectedInScope(filterTracks, assignment, membership);

          expect(viaPerSubmission).toBe(expected);
          expect(viaSet).toBe(expected);
          expect(viaPerSubmission).toBe(viaSet);
        });
      }
    }
  }
});

// ---------------------------------------------------------------------------
// DEC-346 amendment (wave 18): isSubmissionInReviewerScope's own plan_reviewer
// read now shares resolveReviewerSubmissions' bound -- capped at
// MAX_REVIEWER_SCOPE_ROWS + 1, refusing loudly (same literal message) once a
// single reviewer's plan_reviewer rows for this plan cross the cap.
// ---------------------------------------------------------------------------

describe("DEC-346 amendment (wave 18): isSubmissionInReviewerScope shares resolveReviewerSubmissions' cap", () => {
  it("refuses once this reviewer's plan_reviewer rows for the plan exceed MAX_REVIEWER_SCOPE_ROWS", async () => {
    const { isSubmissionInReviewerScope } = await vi.importActual<
      typeof import("../src/server/repo/review/submissions")
    >("../src/server/repo/review/submissions");
    const { MAX_REVIEWER_SCOPE_ROWS } = await vi.importActual<typeof import("../src/server/repo/review/reviewers")>(
      "../src/server/repo/review/reviewers",
    );

    // One extra trackT2 row per iteration beyond the cap -- none of them
    // grant scope over sub-S, so absent the cap this would resolve false
    // rather than refuse.
    CURRENT_PLAN_REVIEWER_ROWS = Array.from({ length: MAX_REVIEWER_SCOPE_ROWS + 1 }, () => ({
      plan_id: PLAN_ID,
      user_id: REVIEWER,
      track_id: "T2",
      submission_id: null,
    }));
    CURRENT_TRACK_ROWS = trackRowsFor("T1");
    const plan = planRecord(undefined);
    const db = makeFakeDb();

    await expect(isSubmissionInReviewerScope(db as never, plan as never, REVIEWER, "sub-S")).rejects.toThrow(
      `This reviewer's scope would scan more than ${MAX_REVIEWER_SCOPE_ROWS} plan_reviewer rows -- narrow the reviewer's assignment scope first`,
    );
  });

  it("a within-cap scope still resolves true/false correctly (no false refusal below the cap)", async () => {
    const { isSubmissionInReviewerScope } = await vi.importActual<
      typeof import("../src/server/repo/review/submissions")
    >("../src/server/repo/review/submissions");

    CURRENT_PLAN_REVIEWER_ROWS = [reviewerRowFor("submissionS")];
    CURRENT_TRACK_ROWS = trackRowsFor("T1");
    const plan = planRecord(undefined);

    const inScope = await isSubmissionInReviewerScope(makeFakeDb() as never, plan as never, REVIEWER, "sub-S");
    expect(inScope).toBe(true);

    const outOfScopeRows: PlanReviewerRow[] = [{ plan_id: PLAN_ID, user_id: REVIEWER, track_id: "T2", submission_id: null }];
    CURRENT_PLAN_REVIEWER_ROWS = outOfScopeRows;
    const notInScope = await isSubmissionInReviewerScope(makeFakeDb() as never, plan as never, REVIEWER, "sub-S");
    expect(notInScope).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Route-level: POST /api/v1/plans/:id/reviewers refuses an out-of-filter
// explicit submissionId (DEC-655) and still assigns an in-filter one.
// ---------------------------------------------------------------------------

const ORG_A = "org-a";
const ROUTE_PLAN = {
  id: "plan-route",
  eventId: "event-route",
  name: "Route Plan",
  instructions: null,
  openDate: null,
  closeDate: null,
  filters: { trackIds: ["T1"] },
  anonymized: false,
  scale: { min: 1, max: 5 },
  criteria: [{ id: "c1", label: "Quality", kind: "rating", weight: 1 }],
  rounds: 1,
  maxEvaluations: null,
};

vi.mock("../src/server/repo/review", async () => {
  const actual = await vi.importActual<typeof import("../src/server/repo/review")>("../src/server/repo/review");
  return {
    ...actual,
    getPlanForOrg: vi.fn(async (_db: unknown, planId: string, orgId: string) =>
      planId === ROUTE_PLAN.id && orgId === ORG_A ? ROUTE_PLAN : null,
    ),
    requireOrgUser: vi.fn(async () => ({ role: "reviewer", email: "rev@org.test" })),
    trackExistsInEvent: vi.fn(async () => true),
    // DEC-354 (amendment, wave 61): the scopeAdvisory pre-read -- no
    // existing plan_reviewer rows in this fixture, so always empty.
    listReviewerRowsForPlan: vi.fn(async () => []),
    getTrackIdsBySubmissionIds: vi.fn(async () => new Map()),
    // "sub-in-filter" is in track T1 (matches the plan's filter); "sub-out-
    // of-filter" is a real in-event submission whose only track is T2.
    findSubmissionIdByRefOrId: vi.fn(async (_db: unknown, eventId: string, input: string) =>
      eventId === ROUTE_PLAN.eventId && (input === "sub-in-filter" || input === "sub-out-of-filter") ? input : null,
    ),
    submissionMatchesPlanFilters: vi.fn(async (_db: unknown, _plan: unknown, submissionId: string) =>
      submissionId === "sub-in-filter",
    ),
    addReviewers: vi.fn(async (_db: unknown, planId: string, inputs: unknown[]) =>
      inputs.map((input) => ({
        id: "pr-new",
        planId,
        ...(input as Record<string, unknown>),
      })),
    ),
    // DEC-659 (amendment, wave 55): POST /plans/:id/reviewers now decorates
    // the row it just wrote with the same batched label lookups the GET list
    // uses. This file drives the route with an empty `{}` db, so the three
    // lookups are stubbed here rather than hitting drizzle.
    getUsersByIds: vi.fn(async (_db: unknown, userIds: string[]) =>
      userIds.map((userId) => ({ userId, email: "rev@org.test" })),
    ),
    getTrackNamesByIds: vi.fn(async (_db: unknown, trackIds: string[]) =>
      new Map(trackIds.map((id) => [id, "Track One"])),
    ),
    getSubmissionLabelsByIds: vi.fn(async (_db: unknown, submissionIds: string[]) =>
      new Map(submissionIds.map((id) => [id, { ref: "S-1", title: "Talk" }])),
    ),
  };
});

async function buildApp(auth: AuthInfo) {
  const { reviewRoutes } = await import("../src/routes/review");
  const app = new Hono<AppEnv>();
  const { registerErrorHandler } = await import("../src/server/http");
  registerErrorHandler(app);
  app.use("*", async (c, next) => {
    c.set("auth", auth);
    c.set("db", {} as never);
    await next();
  });
  app.route("/", reviewRoutes);
  return app;
}

function postReviewer(auth: AuthInfo, body: Record<string, unknown>) {
  return buildApp(auth).then((app) =>
    app.request(`/api/v1/plans/${ROUTE_PLAN.id}/reviewers`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-chq-csrf": "1" },
      body: JSON.stringify(body),
    }),
  );
}

describe("DEC-655: POST /api/v1/plans/:id/reviewers refuses an out-of-filter submissionId", () => {
  it("400s with a submissionId field message and writes no row", async () => {
    const reviewRepo = await import("../src/server/repo/review");
    const res = await postReviewer(
      { userId: "u1", role: "organizer", orgId: ORG_A },
      { userId: "rev-1", submissionId: "sub-out-of-filter" },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields?: Record<string, string> } };
    expect(body.error.code).toBe("invalid");
    expect(body.error.fields?.submissionId).toBeDefined();
    expect(vi.mocked(reviewRepo.addReviewers)).not.toHaveBeenCalled();
  });

  it("201s and assigns for an in-filter submissionId", async () => {
    const reviewRepo = await import("../src/server/repo/review");
    const res = await postReviewer(
      { userId: "u1", role: "organizer", orgId: ORG_A },
      { userId: "rev-1", submissionId: "sub-in-filter" },
    );
    expect(res.status).toBe(201);
    expect(vi.mocked(reviewRepo.addReviewers)).toHaveBeenCalledTimes(1);
  });
});

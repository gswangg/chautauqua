// DEC-346 amendment (wave 57) + DEC-829 amendment (wave 39) coverage:
// listPlanFilteredSubmissions (src/server/repo/review/submissions.ts) must
// (1) return byte-identical refs/titles/trackIds to the pre-fix shape for
// both the filterTracks and plain branches below MAX_PLAN_SUBMISSION_SCAN,
// (2) refuse loudly with an ApiError('invalid') naming the cap once the
// matched-submission count (or, wave 39, the raw joined submission_track row
// count) crosses it (never silently truncate), and (3) wave 39: hydrate
// trackIds with ONE LEFT JOIN query over the matched set -- never a
// chunkIds-batched `inArray` fan-out over submission_track. Exercised
// against an in-memory fake DB that evaluates the actual drizzle
// where/join/exists conditions the repo builds, pattern copied from
// test/contacts-segment-scan-bounds.test.ts (no D1 test harness exists in
// this repo).

import { describe, expect, it, vi } from "vitest";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { ApiError } from "../src/server/http";
import type { PlanRecord } from "../src/server/repo/review/plans";

type Marker =
  | { __marker: "eq"; col: unknown; val: unknown }
  | { __marker: "and"; conds: unknown[] }
  | { __marker: "inArray"; col: unknown; vals: unknown[] }
  | { __marker: "exists"; whereExpr: unknown };

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: unknown, val: unknown): Marker => ({ __marker: "eq", col, val }),
    and: (...conds: unknown[]): Marker => ({ __marker: "and", conds }),
    inArray: (col: unknown, vals: unknown[]): Marker => ({ __marker: "inArray", col, vals }),
    // DEC-829 (wave 39): exists() is called with the fake db's own chain
    // object (db.select(...).from(...).where(...)) -- captures that chain's
    // `__whereExpr` (set synchronously by .where(), read before the
    // subquery is ever `.then()`-resolved) so evalExpr can evaluate the
    // correlated EXISTS purely against the fixture, with no real SQL ever
    // built.
    exists: (subquery: { __whereExpr: unknown }): Marker => ({ __marker: "exists", whereExpr: subquery.__whereExpr }),
  };
});

const {
  listPlanFilteredSubmissions,
  resolveReviewerSubmissions,
  MAX_PLAN_SUBMISSION_SCAN,
  MAX_PLAN_SUBMISSION_TRACK_JOIN_SCAN,
} = await import("../src/server/repo/review/submissions");
const { getReviewerScopeTrackIds, listPlanIdsForReviewer, MAX_REVIEWER_SCOPE_ROWS } = await import(
  "../src/server/repo/review/reviewers"
);

const TABLE_SCHEMAS = {
  event: schema.event,
  submission: schema.submission,
  submissionTrack: schema.submissionTrack,
  planReviewer: schema.planReviewer,
};

function tableNameOf(table: unknown): "event" | "submission" | "submissionTrack" | "planReviewer" {
  for (const [name, tbl] of Object.entries(TABLE_SCHEMAS)) {
    if (tbl === table) return name as "event" | "submission" | "submissionTrack" | "planReviewer";
  }
  throw new Error("fake db: unexpected table reference");
}

function resolveColRef(col: unknown): { table: string; field: string } | null {
  for (const [tableName, tableObj] of Object.entries(TABLE_SCHEMAS)) {
    for (const [key, value] of Object.entries(tableObj)) {
      if (value === col) return { table: tableName, field: key };
    }
  }
  return null;
}

function resolveVal(x: unknown, ctx: Record<string, Record<string, unknown>>): unknown {
  const ref = resolveColRef(x);
  if (ref) return ctx[ref.table]?.[ref.field];
  return x;
}

// DEC-829 (wave 39): exists's whereExpr correlates the subquery's own table
// (submissionTrack) against the OUTER row (submission.id) -- so evaluating
// it means trying each of THAT submission's own track rows (via the
// submissionId -> tracks index, not a full fixture.tracks scan -- an O(n*m)
// scan is what made the >20k-row overcap tests here take minutes) as the
// inner context merged onto the outer ctx, asking whether any satisfies the
// subquery's where.
function evalExpr(
  marker: unknown,
  ctx: Record<string, Record<string, unknown>>,
  tracksBySubmission: Map<string, FixtureTrack[]>,
): boolean {
  const m = marker as Marker;
  switch (m.__marker) {
    case "eq":
      return resolveVal(m.col, ctx) === resolveVal(m.val, ctx);
    case "and":
      return m.conds.every((c) => evalExpr(c, ctx, tracksBySubmission));
    case "inArray":
      return m.vals.includes(resolveVal(m.col, ctx));
    case "exists": {
      const subId = (ctx.submission as { id?: string } | undefined)?.id;
      const candidates = subId !== undefined ? (tracksBySubmission.get(subId) ?? []) : [];
      return candidates.some((t) =>
        evalExpr(m.whereExpr, { ...ctx, submissionTrack: t as unknown as Record<string, unknown> }, tracksBySubmission),
      );
    }
    default:
      throw new Error(`fake db: unhandled marker ${(m as { __marker: string }).__marker}`);
  }
}

interface FixtureEvent {
  id: string;
  recordPrefix: string;
}
interface FixtureSubmission {
  id: string;
  eventId: string;
  seq: number;
  title: string;
  status: string;
}
interface FixtureTrack {
  submissionId: string;
  trackId: string;
}
interface FixtureReviewer {
  id: string;
  planId: string;
  userId: string;
  trackId: string | null;
  submissionId: string | null;
  createdAt: number;
}

interface FakeCall {
  table: "event" | "submission" | "submissionTrack" | "planReviewer";
  joined: boolean;
  joinKind: "inner" | "left" | null;
  distinct: boolean;
  limitN?: number;
  orderByCalled: boolean;
  matchedCount: number;
}

function makeFakeDb(fixture: {
  events: FixtureEvent[];
  submissions: FixtureSubmission[];
  tracks: FixtureTrack[];
  reviewers?: FixtureReviewer[];
}) {
  const reviewers = fixture.reviewers ?? [];
  const calls: FakeCall[] = [];
  // Perf: index tracks by submissionId so both the join-row builder and the
  // exists() correlation below are O(1)-per-submission, not an O(n*m) scan
  // -- large-fixture tests (e.g. the 20k+1-submission overcap cases) would
  // otherwise take minutes.
  const tracksBySubmission = new Map<string, FixtureTrack[]>();
  for (const t of fixture.tracks) {
    const list = tracksBySubmission.get(t.submissionId) ?? [];
    list.push(t);
    tracksBySubmission.set(t.submissionId, list);
  }

  function builder(proj: Record<string, unknown> | undefined, distinct: boolean) {
    return {
      from(table: unknown) {
        const tableName = tableNameOf(table);
        let joinTable: "submissionTrack" | null = null;
        let joinKind: "inner" | "left" | null = null;
        let whereExpr: unknown;
        let orderByCalled = false;
        let limitN: number | undefined;
        const chain = {
          innerJoin(table2: unknown, _expr: unknown) {
            joinTable = tableNameOf(table2) as "submissionTrack";
            joinKind = "inner";
            return chain;
          },
          leftJoin(table2: unknown, _expr: unknown) {
            joinTable = tableNameOf(table2) as "submissionTrack";
            joinKind = "left";
            return chain;
          },
          where(expr: unknown) {
            whereExpr = expr;
            return chain;
          },
          orderBy(..._args: unknown[]) {
            orderByCalled = true;
            return chain;
          },
          limit(n: number) {
            limitN = n;
            return chain;
          },
          // DEC-829 (wave 39): exists()'s mock reads this synchronously off
          // the subquery chain (db.select(...).from(...).where(...)) -- no
          // `.then()` is ever called on the subquery itself, so its own
          // projection/table never needs to resolve.
          get __whereExpr() {
            return whereExpr;
          },
          then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
            return resolveNow().then(resolve, reject);
          },
        };
        function resolveNow(): Promise<unknown[]> {
          let ctxRows: Record<string, Record<string, unknown>>[];
          if (tableName === "event") {
            ctxRows = fixture.events.map((e) => ({ event: e as unknown as Record<string, unknown> }));
          } else if (tableName === "submission" && !joinTable) {
            ctxRows = fixture.submissions.map((s) => ({ submission: s as unknown as Record<string, unknown> }));
          } else if (tableName === "submission" && joinTable === "submissionTrack") {
            ctxRows = [];
            for (const s of fixture.submissions) {
              const matches = tracksBySubmission.get(s.id) ?? [];
              if (matches.length > 0) {
                for (const t of matches) {
                  ctxRows.push({
                    submission: s as unknown as Record<string, unknown>,
                    submissionTrack: t as unknown as Record<string, unknown>,
                  });
                }
              } else if (joinKind === "left") {
                // No matching track row -- a LEFT JOIN still yields one row
                // for this submission, with a null trackId (never present in
                // an INNER JOIN).
                ctxRows.push({
                  submission: s as unknown as Record<string, unknown>,
                  submissionTrack: { submissionId: s.id, trackId: null } as unknown as Record<string, unknown>,
                });
              }
            }
          } else if (tableName === "submissionTrack" && !joinTable) {
            ctxRows = fixture.tracks.map((t) => ({ submissionTrack: t as unknown as Record<string, unknown> }));
          } else if (tableName === "planReviewer" && !joinTable) {
            ctxRows = reviewers.map((r) => ({ planReviewer: r as unknown as Record<string, unknown> }));
          } else {
            throw new Error(`fake db: unsupported table/join combo ${tableName}/${String(joinTable)}`);
          }

          let filtered = whereExpr ? ctxRows.filter((ctx) => evalExpr(whereExpr, ctx, tracksBySubmission)) : ctxRows;

          if (tableName === "submission") {
            filtered = [...filtered].sort((a, b) => {
              const sa = a.submission as unknown as FixtureSubmission;
              const sb = b.submission as unknown as FixtureSubmission;
              if (sa.seq !== sb.seq) return sa.seq - sb.seq;
              return sa.id < sb.id ? -1 : sa.id > sb.id ? 1 : 0;
            });
          }

          if (tableName === "planReviewer") {
            filtered = [...filtered].sort((a, b) => {
              const ra = a.planReviewer as unknown as FixtureReviewer;
              const rb = b.planReviewer as unknown as FixtureReviewer;
              if (ra.createdAt !== rb.createdAt) return ra.createdAt - rb.createdAt;
              return ra.id < rb.id ? -1 : ra.id > rb.id ? 1 : 0;
            });
          }

          calls.push({
            table: tableName,
            joined: joinTable !== null,
            joinKind,
            distinct,
            limitN,
            orderByCalled,
            matchedCount: filtered.length,
          });

          if (limitN !== undefined) filtered = filtered.slice(0, limitN);

          let rows = filtered.map((ctx) => {
            const out: Record<string, unknown> = {};
            for (const [key, col] of Object.entries(proj ?? {})) {
              const ref = resolveColRef(col);
              if (!ref) throw new Error("fake db: projection column not found on any known table");
              out[key] = ctx[ref.table]?.[ref.field];
            }
            return out;
          });

          if (distinct) {
            const seen = new Set<string>();
            rows = rows.filter((r) => {
              const key = JSON.stringify(r);
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          }

          return Promise.resolve(rows);
        }
        return chain;
      },
    };
  }

  const db = {
    select(proj?: Record<string, unknown>) {
      return builder(proj, false);
    },
    selectDistinct(proj?: Record<string, unknown>) {
      return builder(proj, true);
    },
  };

  return { db: db as unknown as Db, calls };
}

const EVENT_ID = "event-1";
const EVENT: FixtureEvent = { id: EVENT_ID, recordPrefix: "SES" };

function makePlan(overrides: Partial<PlanRecord> = {}): PlanRecord {
  return {
    id: "plan-1",
    eventId: EVENT_ID,
    name: "Plan One",
    instructions: null,
    openDate: null,
    closeDate: null,
    filters: null,
    anonymized: false,
    scale: { min: 1, max: 5 },
    criteria: [],
    rounds: 1,
    currentRound: 1,
    roundCriteria: null,
    maxEvaluations: null,
    ...overrides,
  } as PlanRecord;
}

function makeSubmissions(n: number): FixtureSubmission[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `sub-${String(i).padStart(5, "0")}`,
    eventId: EVENT_ID,
    seq: i + 1,
    title: `Talk ${i}`,
    status: "accepted",
  }));
}

describe("listPlanFilteredSubmissions (DEC-346 amendment, wave 57)", () => {
  it("no filterTracks: matches, ref/title/trackIds/status byte-identical to a naive reference, ordered seq asc", async () => {
    const submissions = makeSubmissions(4);
    const tracks: FixtureTrack[] = [
      { submissionId: submissions[0]!.id, trackId: "trk-a" },
      { submissionId: submissions[0]!.id, trackId: "trk-b" },
      { submissionId: submissions[2]!.id, trackId: "trk-a" },
    ];
    const { db } = makeFakeDb({ events: [EVENT], submissions, tracks });
    const plan = makePlan();

    const result = await listPlanFilteredSubmissions(db, plan);

    const expected = submissions
      .slice()
      .sort((a, b) => a.seq - b.seq)
      .map((s) => ({
        id: s.id,
        ref: `SES-${String(s.seq).padStart(3, "0")}`,
        title: s.title,
        trackIds: tracks.filter((t) => t.submissionId === s.id).map((t) => t.trackId),
        status: s.status,
      }));
    expect(result).toEqual(expected);
  });

  it("filterTracks set: only submissions with a matching track come back, deduped (no join fan-out), trackIds still the FULL set for each", async () => {
    const submissions = makeSubmissions(3);
    const tracks: FixtureTrack[] = [
      { submissionId: submissions[0]!.id, trackId: "trk-a" },
      { submissionId: submissions[0]!.id, trackId: "trk-b" }, // two matches on filter -- must not duplicate the submission
      { submissionId: submissions[1]!.id, trackId: "trk-c" },
    ];
    const { db } = makeFakeDb({ events: [EVENT], submissions, tracks });
    const plan = makePlan({ filters: { trackIds: ["trk-a", "trk-b"] } });

    const result = await listPlanFilteredSubmissions(db, plan);

    expect(result).toEqual([
      {
        id: submissions[0]!.id,
        ref: "SES-001",
        title: submissions[0]!.title,
        trackIds: ["trk-a", "trk-b"],
        status: "accepted",
      },
    ]);
  });

  it("withTrackIds: false skips the trackIds hydration entirely (no submissionTrack call at all)", async () => {
    const submissions = makeSubmissions(2);
    const tracks: FixtureTrack[] = [{ submissionId: submissions[0]!.id, trackId: "trk-a" }];
    const { db, calls } = makeFakeDb({ events: [EVENT], submissions, tracks });
    const plan = makePlan();

    const result = await listPlanFilteredSubmissions(db, plan, { withTrackIds: false });

    expect(result.every((r) => r.trackIds.length === 0)).toBe(true);
    expect(calls.some((c) => c.table === "submissionTrack")).toBe(false);
  });

  it("withTrackIds:false matched-submission query is ordered and capped at MAX_PLAN_SUBMISSION_SCAN + 1", async () => {
    const submissions = makeSubmissions(5);
    const { db, calls } = makeFakeDb({ events: [EVENT], submissions, tracks: [] });
    const plan = makePlan();

    await listPlanFilteredSubmissions(db, plan, { withTrackIds: false });

    const submissionCall = calls.find((c) => c.table === "submission" && !c.joined);
    expect(submissionCall).toBeDefined();
    expect(submissionCall!.orderByCalled).toBe(true);
    expect(submissionCall!.limitN).toBe(MAX_PLAN_SUBMISSION_SCAN + 1);
  });

  it("withTrackIds:true (default) joined query is ordered and capped at MAX_PLAN_SUBMISSION_TRACK_JOIN_SCAN + 1", async () => {
    const submissions = makeSubmissions(5);
    const { db, calls } = makeFakeDb({ events: [EVENT], submissions, tracks: [] });
    const plan = makePlan();

    await listPlanFilteredSubmissions(db, plan);

    const joinedCall = calls.find((c) => c.table === "submission" && c.joined);
    expect(joinedCall).toBeDefined();
    expect(joinedCall!.orderByCalled).toBe(true);
    expect(joinedCall!.limitN).toBe(MAX_PLAN_SUBMISSION_TRACK_JOIN_SCAN + 1);
  });

  it("exactly-cap matched rows passes; cap+1 refuses loudly naming the cap, for both branches", async () => {
    const atCap = makeSubmissions(MAX_PLAN_SUBMISSION_SCAN);
    const { db: dbAtCap } = makeFakeDb({ events: [EVENT], submissions: atCap, tracks: [] });
    await expect(listPlanFilteredSubmissions(dbAtCap, makePlan())).resolves.toBeDefined();

    const overCap = makeSubmissions(MAX_PLAN_SUBMISSION_SCAN + 1);
    const { db: dbOverCap } = makeFakeDb({ events: [EVENT], submissions: overCap, tracks: [] });
    await expect(listPlanFilteredSubmissions(dbOverCap, makePlan())).rejects.toMatchObject({
      code: "invalid",
      message: expect.stringContaining(String(MAX_PLAN_SUBMISSION_SCAN)),
    });

    // filterTracks branch too -- every submission tagged with the filtered track.
    const overCapFiltered = makeSubmissions(MAX_PLAN_SUBMISSION_SCAN + 1);
    const filteredTracks: FixtureTrack[] = overCapFiltered.map((s) => ({ submissionId: s.id, trackId: "trk-a" }));
    const { db: dbOverCapFiltered } = makeFakeDb({
      events: [EVENT],
      submissions: overCapFiltered,
      tracks: filteredTracks,
    });
    await expect(
      listPlanFilteredSubmissions(dbOverCapFiltered, makePlan({ filters: { trackIds: ["trk-a"] } })),
    ).rejects.toBeInstanceOf(ApiError);
    // Builds ~60k fixture rows (3x the 20k cap); ~2.6s solo but slower under
    // full-suite CPU contention, so it needs more than the 5s default timeout.
  }, 30_000);

  // DEC-829 (wave 39): trackIds hydration is now ONE LEFT JOIN query over the
  // matched set, never a chunkIds-batched inArray fan-out over
  // submission_track. This is the landing-evidence regression: it must fail
  // against the pre-fix (chunked) implementation.
  it("trackIds hydration issues exactly ONE joined submission_track query, never a chunked fan-out, for a 2,000-submission plan", async () => {
    const submissions = makeSubmissions(2000);
    const tracks: FixtureTrack[] = submissions.map((s) => ({ submissionId: s.id, trackId: "trk-a" }));
    const { db, calls } = makeFakeDb({ events: [EVENT], submissions, tracks });
    const plan = makePlan();

    const result = await listPlanFilteredSubmissions(db, plan);
    expect(result.length).toBe(2000);
    expect(result.every((r) => r.trackIds.length === 1)).toBe(true);

    // Old (chunked) implementation issued ~23 separate submissionTrack
    // queries (ID_CHUNK_SIZE=90, 2000/90); the fix issues submission_track
    // access only via the ONE joined submission query below.
    const bareTrackCalls = calls.filter((c) => c.table === "submissionTrack" && !c.joined);
    expect(bareTrackCalls.length).toBe(0);
    const joinedCalls = calls.filter((c) => c.table === "submission" && c.joined);
    expect(joinedCalls.length).toBe(1);
    expect(joinedCalls[0]!.joinKind).toBe("left");
  });

  it("the joined query's WHERE is the SAME predicate that determines the matched set (event_id + filters_json track EXISTS)", async () => {
    const submissions = makeSubmissions(4);
    const tracks: FixtureTrack[] = [
      { submissionId: submissions[0]!.id, trackId: "trk-a" },
      { submissionId: submissions[1]!.id, trackId: "trk-b" },
      { submissionId: submissions[2]!.id, trackId: "trk-a" },
    ];
    const { db } = makeFakeDb({ events: [EVENT], submissions, tracks });
    const plan = makePlan({ filters: { trackIds: ["trk-a"] } });

    const result = await listPlanFilteredSubmissions(db, plan);
    // Only submissions 0 and 2 carry trk-a; each result's trackIds is the
    // FULL per-submission set, not narrowed to the filter.
    expect(result.map((r) => r.id)).toEqual([submissions[0]!.id, submissions[2]!.id]);
    expect(result.map((r) => r.trackIds)).toEqual([["trk-a"], ["trk-a"]]);
  });

  it("submissions with no tracks at all still come back once, with an empty trackIds array (LEFT not INNER join)", async () => {
    const submissions = makeSubmissions(2);
    const { db } = makeFakeDb({ events: [EVENT], submissions, tracks: [] });
    const plan = makePlan();

    const result = await listPlanFilteredSubmissions(db, plan);
    expect(result.length).toBe(2);
    expect(result.every((r) => r.trackIds.length === 0)).toBe(true);
  });

  it("joined row count over MAX_PLAN_SUBMISSION_TRACK_JOIN_SCAN refuses loudly naming the cap", async () => {
    // One submission with more joined submission_track rows than the cap --
    // exercises the raw-joined-row ceiling independently of the
    // distinct-submission ceiling.
    const submissions = makeSubmissions(1);
    const tracks: FixtureTrack[] = Array.from({ length: MAX_PLAN_SUBMISSION_TRACK_JOIN_SCAN + 1 }, (_, i) => ({
      submissionId: submissions[0]!.id,
      trackId: `trk-${i}`,
    }));
    const { db } = makeFakeDb({ events: [EVENT], submissions, tracks });
    const plan = makePlan();

    await expect(listPlanFilteredSubmissions(db, plan)).rejects.toMatchObject({
      code: "invalid",
      message: expect.stringContaining(String(MAX_PLAN_SUBMISSION_TRACK_JOIN_SCAN)),
    });
  }, 30_000);
});

function makeUnrestrictedReviewers(planId: string, userId: string, n: number): FixtureReviewer[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `pr-${String(i).padStart(6, "0")}`,
    planId,
    userId,
    trackId: null,
    submissionId: null,
    createdAt: i,
  }));
}

describe("resolveReviewerSubmissions (DEC-439 amendment, wave 62)", () => {
  const PLAN_ID = "plan-1";
  const USER_ID = "user-1";

  it("plan_reviewer read is ordered and capped: under-cap read returns rows from a query carrying both limit and order-by", async () => {
    const submissions = makeSubmissions(3);
    const reviewers = makeUnrestrictedReviewers(PLAN_ID, USER_ID, 1);
    const { db, calls } = makeFakeDb({ events: [EVENT], submissions, tracks: [], reviewers });
    const plan = makePlan({ id: PLAN_ID });

    const result = await resolveReviewerSubmissions(db, plan, USER_ID);
    expect(result.length).toBe(3);

    const reviewerCall = calls.find((c) => c.table === "planReviewer");
    expect(reviewerCall).toBeDefined();
    expect(reviewerCall!.orderByCalled).toBe(true);
    expect(reviewerCall!.limitN).toBe(MAX_REVIEWER_SCOPE_ROWS + 1);

    const submissionCall = calls.find((c) => c.table === "submission" && !c.joined);
    expect(submissionCall).toBeDefined();
    expect(submissionCall!.orderByCalled).toBe(true);
    expect(submissionCall!.limitN).toBe(MAX_PLAN_SUBMISSION_SCAN + 1);
  });

  it("plan_reviewer rows over MAX_REVIEWER_SCOPE_ROWS refuse loudly naming the cap", async () => {
    const submissions = makeSubmissions(1);
    const reviewers = makeUnrestrictedReviewers(PLAN_ID, USER_ID, MAX_REVIEWER_SCOPE_ROWS + 1);
    const { db } = makeFakeDb({ events: [EVENT], submissions, tracks: [], reviewers });
    const plan = makePlan({ id: PLAN_ID });

    await expect(resolveReviewerSubmissions(db, plan, USER_ID)).rejects.toMatchObject({
      code: "invalid",
      message: expect.stringContaining(String(MAX_REVIEWER_SCOPE_ROWS)),
    });
  }, 30_000);

  it("matched submissions over MAX_PLAN_SUBMISSION_SCAN refuse loudly naming the cap", async () => {
    const submissions = makeSubmissions(MAX_PLAN_SUBMISSION_SCAN + 1);
    const reviewers = makeUnrestrictedReviewers(PLAN_ID, USER_ID, 1);
    const { db } = makeFakeDb({ events: [EVENT], submissions, tracks: [], reviewers });
    const plan = makePlan({ id: PLAN_ID });

    await expect(resolveReviewerSubmissions(db, plan, USER_ID)).rejects.toMatchObject({
      code: "invalid",
      message: expect.stringContaining(String(MAX_PLAN_SUBMISSION_SCAN)),
    });
  }, 30_000);
});

describe("getReviewerScopeTrackIds / listPlanIdsForReviewer (DEC-439 amendment, wave 62)", () => {
  const PLAN_ID = "plan-1";
  const USER_ID = "user-1";

  it("getReviewerScopeTrackIds: under-cap read carries both limit and order-by, returns the single scoped track", async () => {
    const reviewers: FixtureReviewer[] = [
      { id: "pr-1", planId: PLAN_ID, userId: USER_ID, trackId: "trk-a", submissionId: null, createdAt: 1 },
    ];
    const { db, calls } = makeFakeDb({ events: [EVENT], submissions: [], tracks: [], reviewers });

    const trackIds = await getReviewerScopeTrackIds(db, PLAN_ID, USER_ID);
    expect(trackIds).toEqual(["trk-a"]);

    const reviewerCall = calls.find((c) => c.table === "planReviewer");
    expect(reviewerCall).toBeDefined();
    expect(reviewerCall!.orderByCalled).toBe(true);
    expect(reviewerCall!.limitN).toBe(MAX_REVIEWER_SCOPE_ROWS + 1);
  });

  it("getReviewerScopeTrackIds: over-cap rows refuse loudly naming the cap", async () => {
    const reviewers = makeUnrestrictedReviewers(PLAN_ID, USER_ID, MAX_REVIEWER_SCOPE_ROWS + 1);
    const { db } = makeFakeDb({ events: [EVENT], submissions: [], tracks: [], reviewers });

    await expect(getReviewerScopeTrackIds(db, PLAN_ID, USER_ID)).rejects.toMatchObject({
      code: "invalid",
      message: expect.stringContaining(String(MAX_REVIEWER_SCOPE_ROWS)),
    });
  }, 30_000);

  it("listPlanIdsForReviewer: under-cap read carries both limit and order-by, returns distinct plan ids", async () => {
    const reviewers: FixtureReviewer[] = [
      { id: "pr-1", planId: "plan-1", userId: USER_ID, trackId: null, submissionId: null, createdAt: 1 },
      { id: "pr-2", planId: "plan-2", userId: USER_ID, trackId: null, submissionId: null, createdAt: 2 },
    ];
    const { db, calls } = makeFakeDb({ events: [EVENT], submissions: [], tracks: [], reviewers });

    const planIds = await listPlanIdsForReviewer(db, USER_ID);
    expect(planIds.sort()).toEqual(["plan-1", "plan-2"]);

    const reviewerCall = calls.find((c) => c.table === "planReviewer");
    expect(reviewerCall).toBeDefined();
    expect(reviewerCall!.orderByCalled).toBe(true);
    expect(reviewerCall!.limitN).toBe(MAX_REVIEWER_SCOPE_ROWS + 1);
  });

  it("listPlanIdsForReviewer: over-cap rows refuse loudly naming the cap", async () => {
    const reviewers = makeUnrestrictedReviewers(PLAN_ID, USER_ID, MAX_REVIEWER_SCOPE_ROWS + 1);
    const { db } = makeFakeDb({ events: [EVENT], submissions: [], tracks: [], reviewers });

    await expect(listPlanIdsForReviewer(db, USER_ID)).rejects.toMatchObject({
      code: "invalid",
      message: expect.stringContaining(String(MAX_REVIEWER_SCOPE_ROWS)),
    });
  }, 30_000);
});

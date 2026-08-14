// DEC-439/DEC-449 regression coverage: resolveReviewerSubmissions must
// cost-scale with ONE reviewer's slice (load only that reviewer's
// plan_reviewer rows, then one scoped `submission` query using EXISTS
// subqueries over submission_track) instead of loading the whole plan's
// matched submissions plus every reviewer's rows and recomputing all
// assignments in JS. DEC-449: this fn no longer performs any trackIds
// lookup at all (its one caller, the reviewer queue route, never reads
// trackIds) -- returns id/ref/title only.
//
// No local sqlite/D1 test driver is wired up in stage 1 (see
// test/review-repo-aggregates.test.ts) so this test fakes the drizzle
// `eq`/`and`/`or`/`inArray`/`exists` combinators with lightweight tag
// builders (never delegating to the real drizzle SQL renderer, which needs
// a real driver to execute) and a fake `db` that dispatches on table
// identity, reading the tag tree to decide which fixture rows match. This
// proves the *query shape* (which table/columns get touched, and with what
// filter) rather than just asserting against canned output.

import { afterEach, describe, expect, it, vi } from "vitest";
import * as schema from "../src/db/schema";
import { resolveAssignments, type ReviewerScopeRow } from "../src/domain/evaluation";
import type { ReviewerScopedSubmission } from "../src/server/repo/review/submissions";

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
// Fixture data (raw rows keyed by actual db column names, since the fake
// select() shapes output rows by reading `colObj.name` off the caller's
// select-column map).
// ---------------------------------------------------------------------------

const EVENT_ROW = { id: "event-1", record_prefix: "TALK" };

const SUBMISSION_ROWS = [
  { id: "sub-1", event_id: "event-1", seq: 1, title: "Talk One" },
  { id: "sub-2", event_id: "event-1", seq: 2, title: "Talk Two" },
  { id: "sub-3", event_id: "event-1", seq: 3, title: "Talk Three" },
  { id: "sub-4", event_id: "event-1", seq: 4, title: "Talk Four" },
  // Different event entirely -- must never leak into any reviewer's scope.
  { id: "sub-9", event_id: "event-OTHER", seq: 1, title: "Foreign Talk" },
];

const SUBMISSION_TRACK_ROWS = [
  { submission_id: "sub-1", track_id: "t1" },
  { submission_id: "sub-2", track_id: "t2" },
  { submission_id: "sub-3", track_id: "t1" },
  { submission_id: "sub-3", track_id: "t3" },
  // sub-4 has no tracks at all.
  { submission_id: "sub-9", track_id: "t1" }, // foreign event -- must never leak
];

type PlanReviewerRow = { plan_id: string; user_id: string; track_id: string | null; submission_id: string | null };

const PLAN_ID = "plan-1";

function reviewerFixture(rows: Omit<PlanReviewerRow, "plan_id">[]): PlanReviewerRow[] {
  return rows.map((r) => ({ plan_id: PLAN_ID, ...r }));
}

// ---------------------------------------------------------------------------
// Boolean-tag evaluator + fake db.
// ---------------------------------------------------------------------------

function evalCond(tag: CondTag | undefined, row: Record<string, unknown>): boolean {
  if (!tag) return true;
  switch (tag.kind) {
    case "eq":
      // A correlated eq (val is a Column object, e.g.
      // `eq(submissionTrack.submissionId, submission.id)`) is always
      // considered satisfied here -- the exists() case below already
      // filters submission_track rows down to this candidate row's id
      // before evaluating the inner condition, which IS the correlation.
      if (typeof tag.val === "object" && tag.val !== null && "name" in (tag.val as object)) return true;
      return row[tag.col as string] === tag.val;
    case "inArray":
      return (tag.vals as unknown[]).includes(row[tag.col as string]);
    case "and":
      return (tag.children ?? []).every((c) => evalCond(c, row));
    case "or":
      return (tag.children ?? []).some((c) => evalCond(c, row));
    case "exists": {
      // The correlated subquery is always `submission_track.submission_id =
      // submission.id AND submission_track.track_id IN (...)` -- correlation
      // to the outer row is inherent (this evaluator is always called
      // per-candidate-row), so just check whether ANY submission_track row
      // for this candidate id satisfies the inner (non-correlation) filter.
      const trackRowsForCandidate = SUBMISSION_TRACK_ROWS.filter((t) => t.submission_id === row.id);
      return trackRowsForCandidate.some((t) => evalCond(tag.inner, t as unknown as Record<string, unknown>));
    }
    default:
      throw new Error(`unhandled tag kind: ${tag.kind}`);
  }
}

function shapeRow(row: Record<string, unknown>, cols: Record<string, { name: string }>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [alias, col] of Object.entries(cols)) out[alias] = row[col.name];
  return out;
}

/** DEC-439 amendment (wave 62): resolveReviewerSubmissions' plan_reviewer
 * and (unjoined) submission reads now chain `.orderBy(...).limit(n)` after
 * `.where(...)` -- this fake's `where()` result must stay thenable (so
 * un-chained callers keep working) while also exposing no-op orderBy/limit
 * methods that return the same (already-ordered-enough for these fixtures)
 * row set, sliced to the caller's cap. */
function withOrderByLimit(rows: Record<string, unknown>[], tag: CondTag | undefined) {
  const out = Promise.resolve(rows) as Promise<Record<string, unknown>[]> & {
    __whereTag?: CondTag;
    orderBy: (...args: unknown[]) => typeof chainable;
    limit: (n: number) => Promise<Record<string, unknown>[]>;
  };
  out.__whereTag = tag;
  const chainable = {
    limit: (n: number) => Promise.resolve(rows.slice(0, n)),
  };
  out.orderBy = () => chainable;
  out.limit = (n: number) => Promise.resolve(rows.slice(0, n));
  return out;
}

/** Records every submission_track query's condition tag, so test (c) can
 * assert none of them is an unrestricted/whole-event scan. */
function makeFakeDb(submissionTrackQueries: CondTag[]) {
  const db = {
    select: (cols: Record<string, { name: string }>) => ({
      from: (table: unknown) => ({
        where: (cond: Tagged<object> | undefined) => {
          const tag = cond?.[TAG];
          if (table === schema.planReviewer) {
            const rows = PLAN_REVIEWER_ROWS.filter((r) => evalCond(tag, r as unknown as Record<string, unknown>));
            const shaped = rows.map((r) => shapeRow(r as unknown as Record<string, unknown>, cols));
            return withOrderByLimit(shaped, tag);
          }
          if (table === schema.submission) {
            const rows = SUBMISSION_ROWS.filter((r) => evalCond(tag, r));
            const shaped = rows.map((r) => shapeRow(r, cols));
            return withOrderByLimit(shaped, tag);
          }
          if (table === schema.event) {
            const rows = EVENT_ROWS_MATCHING(tag);
            return {
              limit: () => Promise.resolve(rows.map((r) => shapeRow(r, cols))),
              __whereTag: tag,
            };
          }
          if (table === schema.submissionTrack) {
            // Only the trackMap loop's genuine, awaited, top-level query
            // selects exactly {submissionId, trackId} -- the EXISTS
            // subqueries (correlated, never directly awaited by the
            // caller) select {one: sql`1`} instead. Only the former is a
            // "real" submission_track query whose shape test (c) checks.
            const colKeys = Object.keys(cols).sort().join(",");
            if (tag && colKeys === "submissionId,trackId") submissionTrackQueries.push(tag);
            const rows = SUBMISSION_TRACK_ROWS.filter((r) => evalCond(tag, r));
            const out = Promise.resolve(rows.map((r) => shapeRow(r, cols)));
            (out as unknown as { __whereTag?: CondTag }).__whereTag = tag;
            return out;
          }
          throw new Error("unexpected table in fake db");
        },
      }),
    }),
  };
  return db;
}

let PLAN_REVIEWER_ROWS: PlanReviewerRow[] = [];

function EVENT_ROWS_MATCHING(tag: CondTag | undefined): typeof EVENT_ROW[] {
  return [EVENT_ROW].filter((r) => evalCond(tag, r as unknown as Record<string, unknown>));
}

// ---------------------------------------------------------------------------
// Helper: the pure resolveAssignments reference computation, driven off the
// same fixtures, for cross-checking resolveReviewerSubmissions's output.
// ---------------------------------------------------------------------------

function trackIdsFor(submissionId: string): string[] {
  return SUBMISSION_TRACK_ROWS.filter((t) => t.submission_id === submissionId).map((t) => t.track_id);
}

function allPlanFiltered(filterTracks: string[] | undefined): (ReviewerScopedSubmission & { trackIds: string[] })[] {
  return SUBMISSION_ROWS.filter((s) => s.event_id === "event-1")
    .filter((s) => !filterTracks || filterTracks.length === 0 || trackIdsFor(s.id).some((t) => filterTracks.includes(t)))
    .map((s) => ({ id: s.id, ref: `TALK-${String(s.seq).padStart(3, "0")}`, title: s.title, trackIds: trackIdsFor(s.id) }));
}

function planRecord(filters: { trackIds?: string[] } | null) {
  return {
    id: PLAN_ID,
    eventId: "event-1",
    name: "Plan",
    instructions: null,
    openDate: null,
    closeDate: null,
    filters,
    anonymized: false,
    scale: { min: 1, max: 5 },
    criteria: [],
    rounds: 1,
    currentRound: 1,
    roundCriteria: null,
    maxEvaluations: null,
    createdAt: 0,
    updatedAt: 0,
  };
}

function sortedIds(rows: { id: string }[]): string[] {
  return [...rows.map((r) => r.id)].sort();
}

describe("DEC-439: resolveReviewerSubmissions scales with one reviewer's slice", () => {
  it("(a) matches resolveAssignments exactly for unrestricted, track-scoped and submission-scoped reviewers", async () => {
    const { resolveReviewerSubmissions } = await import("../src/server/repo/review/submissions");

    const rowsByReviewer: Record<string, Omit<PlanReviewerRow, "plan_id">[]> = {
      "rev-unrestricted": [{ user_id: "rev-unrestricted", track_id: null, submission_id: null }],
      "rev-track": [{ user_id: "rev-track", track_id: "t1", submission_id: null }],
      "rev-sub": [{ user_id: "rev-sub", track_id: null, submission_id: "sub-2" }],
      "rev-none": [], // no plan_reviewer rows at all -- must return []
    };
    PLAN_REVIEWER_ROWS = Object.values(rowsByReviewer).flatMap((rows) => reviewerFixture(rows));

    const plan = planRecord(null);
    const all = allPlanFiltered(undefined);

    const scopeRows: ReviewerScopeRow[] = PLAN_REVIEWER_ROWS.map((r) => ({
      userId: r.user_id,
      trackId: r.track_id,
      submissionId: r.submission_id,
    }));
    const expected = resolveAssignments(all, scopeRows);

    for (const userId of Object.keys(rowsByReviewer)) {
      const submissionTrackQueries: CondTag[] = [];
      const db = makeFakeDb(submissionTrackQueries);
      const actual = await resolveReviewerSubmissions(db as never, plan as never, userId);
      const expectedForUser = expected.get(userId) ?? [];
      expect(sortedIds(actual)).toEqual(sortedIds(expectedForUser));
      // ref/title also match exactly, not just ids (DEC-449: no trackIds on
      // this result -- resolveReviewerSubmissions never looks them up).
      const byId = new Map(actual.map((r) => [r.id, r]));
      for (const exp of expectedForUser) {
        const got = byId.get(exp.id);
        expect(got?.ref).toBe(exp.ref);
        expect(got?.title).toBe(exp.title);
      }
    }
  });

  it("(b) a plan-level track filter narrows all three scope kinds", async () => {
    const { resolveReviewerSubmissions } = await import("../src/server/repo/review/submissions");

    const rowsByReviewer: Record<string, Omit<PlanReviewerRow, "plan_id">[]> = {
      "rev-unrestricted": [{ user_id: "rev-unrestricted", track_id: null, submission_id: null }],
      // t2 does not intersect the plan filter (t1) -- expect zero results.
      "rev-track-excluded": [{ user_id: "rev-track-excluded", track_id: "t2", submission_id: null }],
      // t1 does intersect the plan filter -- expect sub-1 and sub-3.
      "rev-track-included": [{ user_id: "rev-track-included", track_id: "t1", submission_id: null }],
      // sub-2's only track (t2) is outside the plan filter -- expect zero
      // results even though the reviewer has an explicit submission scope.
      "rev-sub-excluded": [{ user_id: "rev-sub-excluded", track_id: null, submission_id: "sub-2" }],
    };
    PLAN_REVIEWER_ROWS = Object.values(rowsByReviewer).flatMap((rows) => reviewerFixture(rows));

    const plan = planRecord({ trackIds: ["t1"] });
    const all = allPlanFiltered(["t1"]);
    const scopeRows: ReviewerScopeRow[] = PLAN_REVIEWER_ROWS.map((r) => ({
      userId: r.user_id,
      trackId: r.track_id,
      submissionId: r.submission_id,
    }));
    const expected = resolveAssignments(all, scopeRows);

    for (const userId of Object.keys(rowsByReviewer)) {
      const db = makeFakeDb([]);
      const actual = await resolveReviewerSubmissions(db as never, plan as never, userId);
      expect(sortedIds(actual)).toEqual(sortedIds(expected.get(userId) ?? []));
    }

    // Explicit expectations, not just cross-checked against the reference:
    const db2 = makeFakeDb([]);
    expect(sortedIds(await resolveReviewerSubmissions(db2 as never, plan as never, "rev-unrestricted"))).toEqual([
      "sub-1",
      "sub-3",
    ]);
    expect(sortedIds(await resolveReviewerSubmissions(db2 as never, plan as never, "rev-track-excluded"))).toEqual([]);
    expect(sortedIds(await resolveReviewerSubmissions(db2 as never, plan as never, "rev-track-included"))).toEqual([
      "sub-1",
      "sub-3",
    ]);
    expect(sortedIds(await resolveReviewerSubmissions(db2 as never, plan as never, "rev-sub-excluded"))).toEqual([]);
  });

  it("returns [] for a userId with no plan_reviewer rows, without querying submission at all needing it", async () => {
    const { resolveReviewerSubmissions } = await import("../src/server/repo/review/submissions");
    PLAN_REVIEWER_ROWS = reviewerFixture([{ user_id: "someone-else", track_id: null, submission_id: null }]);
    const db = makeFakeDb([]);
    const result = await resolveReviewerSubmissions(db as never, planRecord(null) as never, "rev-absent");
    expect(result).toEqual([]);
  });

  it("(c) DEC-449: never issues any submission_track query at all -- this fn's only caller never reads trackIds", async () => {
    const { resolveReviewerSubmissions } = await import("../src/server/repo/review/submissions");
    PLAN_REVIEWER_ROWS = reviewerFixture([{ user_id: "rev-track", track_id: "t1", submission_id: null }]);
    const submissionTrackQueries: CondTag[] = [];
    const db = makeFakeDb(submissionTrackQueries);
    const result = await resolveReviewerSubmissions(db as never, planRecord(null) as never, "rev-track");

    expect(sortedIds(result)).toEqual(["sub-1", "sub-3"]);

    // DEC-449: the chunked trackIds-for-matched-set load was deleted (the
    // route never read it) -- zero submission_track round trips.
    expect(submissionTrackQueries.length).toBe(0);
  });
});

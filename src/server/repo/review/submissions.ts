// Submissions in review scope: resolves which submissions a plan/reviewer
// can see, plus the summary/speaker/answer data reviewers need to render a
// submission (DEC-078/DEC-081/DEC-016/DEC-017/DEC-346).

import { and, asc, eq, exists, inArray, or, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { formatRef, parseRef } from "../../../domain/ids";
import { chunkIds } from "../../../lib/chunk";
import { answerFieldRoleCondition, roleAnswerLabel } from "../form-roles";
import { SCHEDULING_PARTICIPANT_STATUSES } from "../../../domain/acceptance";
import { ApiError } from "../../http";
import type { PlanRecord } from "./plans";
import { MAX_REVIEWER_SCOPE_ROWS } from "./reviewers";

// DEC-346 amendment (wave 57): the ceiling listPlanFilteredSubmissions'
// matched-submissions scan refuses past -- mirrors MAX_FILE_LIBRARY_SCAN
// (src/server/repo/files-library.ts:39). A pathological-data guard set well
// above SPEC's 2,000-submission scale target, not a functional limit. The
// query `.limit(MAX_PLAN_SUBMISSION_SCAN + 1)`s and throws rather than
// silently truncating a plan's submission set once it crosses this.
export const MAX_PLAN_SUBMISSION_SCAN = 20000;

// DEC-829 (wave 39): the withTrackIds=true path of listPlanFilteredSubmissions
// LEFT JOINs submission_track onto the matched-submission set (one query,
// replacing the ~23-batch chunkIds fan-out) -- so the same query returns one
// row PER (submission, track) pair, not one row per submission. This caps the
// raw joined ROW count (a separate, larger ceiling than
// MAX_PLAN_SUBMISSION_SCAN, which still caps the distinct-submission count
// below) as a pathological-data guard against unbounded multi-track fan-out;
// 8x headroom over the submission cap comfortably covers any real event's
// tracks-per-submission count.
export const MAX_PLAN_SUBMISSION_TRACK_JOIN_SCAN = MAX_PLAN_SUBMISSION_SCAN * 8;

/** DEC-346: the narrow shape every plan-scoped whole-set load returns --
 * `description` is never selected for these (list/queue/results/progress),
 * only getSubmissionSummaryInEvent's single-row lookup needs the abstract. */
export interface PlanSubmissionRef {
  id: string;
  ref: string;
  title: string;
  trackIds: string[];
  status: string;
}

export interface SubmissionSummary extends PlanSubmissionRef {
  description: string | null;
}

/** Track ids for a single submission (DEC-078: this is always a one-id
 * lookup — getSubmissionSummaryInEvent's use case only — never an unbounded
 * id-list `inArray`). */
async function submissionTrackIdsForOne(db: Db, submissionId: string): Promise<string[]> {
  const rows = await db
    .select({ trackId: schema.submissionTrack.trackId })
    .from(schema.submissionTrack)
    .where(eq(schema.submissionTrack.submissionId, submissionId));
  return rows.map((r) => r.trackId);
}

/** All submissions in the plan's event, optionally narrowed by the plan's
 * filters_json (trackIds) and event record_prefix for ref formatting.
 * DEC-829 (wave 39): the hydration set (trackIds) IS the matched set, so
 * when withTrackIds is requested this issues ONE query -- submission LEFT
 * JOIN submission_track, filtered by the SAME WHERE that determines the
 * matched set (event_id, plus an EXISTS(submission_track) probe for the
 * plan's own filters_json trackIds when present) -- rather than a separate
 * matched-submissions query followed by ~23 chunkIds-batched `inArray`
 * lookups over submission_track. The event's record_prefix read runs
 * concurrently with that query (it depends on neither). Ordered (seq asc, id
 * asc) and capped: MAX_PLAN_SUBMISSION_SCAN + 1 on the distinct-submission
 * count (DEC-346 amendment, wave 57), MAX_PLAN_SUBMISSION_TRACK_JOIN_SCAN + 1
 * on the raw joined row count (multiple rows per multi-track submission) --
 * both refuse loudly rather than silently truncate. When withTrackIds is
 * false (DEC-439), no join is issued at all -- the plain matched-submissions
 * query behaves exactly as before. */
export async function listPlanFilteredSubmissions(
  db: Db,
  plan: PlanRecord,
  opts?: { withTrackIds?: boolean },
): Promise<PlanSubmissionRef[]> {
  const withTrackIds = opts?.withTrackIds ?? true;
  const filterTracks = plan.filters?.trackIds;

  const matchConditions = [eq(schema.submission.eventId, plan.eventId)];
  if (filterTracks && filterTracks.length > 0) {
    matchConditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(schema.submissionTrack)
          .where(
            and(
              eq(schema.submissionTrack.submissionId, schema.submission.id),
              inArray(schema.submissionTrack.trackId, filterTracks),
            ),
          ),
      ),
    );
  }

  if (!withTrackIds) {
    const [eventRows, matched] = await Promise.all([
      db
        .select({ recordPrefix: schema.event.recordPrefix })
        .from(schema.event)
        .where(eq(schema.event.id, plan.eventId))
        .limit(1),
      db
        .select({
          id: schema.submission.id,
          seq: schema.submission.seq,
          title: schema.submission.title,
          status: schema.submission.status,
        })
        .from(schema.submission)
        .where(and(...matchConditions))
        .orderBy(asc(schema.submission.seq), asc(schema.submission.id))
        .limit(MAX_PLAN_SUBMISSION_SCAN + 1),
    ]);
    if (matched.length > MAX_PLAN_SUBMISSION_SCAN) {
      throw new ApiError(
        "invalid",
        `This plan would scan more than ${MAX_PLAN_SUBMISSION_SCAN} submissions -- narrow the plan's track filter first`,
      );
    }
    const recordPrefix = eventRows[0]?.recordPrefix ?? "SES";
    return matched.map((row) => ({
      id: row.id,
      ref: formatRef(recordPrefix, row.seq),
      title: row.title,
      trackIds: [],
      status: row.status,
    }));
  }

  // withTrackIds: true -- one LEFT JOIN query over submission_track, filtered
  // by the same matchConditions, doubling as both the matched-submissions
  // read AND the trackIds hydration (DEC-829). Ordered by submission (seq,
  // id) so rows for the same submission stay adjacent for the fold below.
  const [eventRows, joined] = await Promise.all([
    db
      .select({ recordPrefix: schema.event.recordPrefix })
      .from(schema.event)
      .where(eq(schema.event.id, plan.eventId))
      .limit(1),
    db
      .select({
        id: schema.submission.id,
        seq: schema.submission.seq,
        title: schema.submission.title,
        status: schema.submission.status,
        trackId: schema.submissionTrack.trackId,
      })
      .from(schema.submission)
      .leftJoin(schema.submissionTrack, eq(schema.submissionTrack.submissionId, schema.submission.id))
      .where(and(...matchConditions))
      .orderBy(asc(schema.submission.seq), asc(schema.submission.id))
      .limit(MAX_PLAN_SUBMISSION_TRACK_JOIN_SCAN + 1),
  ]);
  if (joined.length > MAX_PLAN_SUBMISSION_TRACK_JOIN_SCAN) {
    throw new ApiError(
      "invalid",
      `This plan would scan more than ${MAX_PLAN_SUBMISSION_TRACK_JOIN_SCAN} submission-track rows -- narrow the plan's track filter first`,
    );
  }
  const recordPrefix = eventRows[0]?.recordPrefix ?? "SES";

  const order: string[] = [];
  const bySubmission = new Map<string, { seq: number; title: string; status: string; trackIds: string[] }>();
  for (const row of joined) {
    let entry = bySubmission.get(row.id);
    if (!entry) {
      entry = { seq: row.seq, title: row.title, status: row.status, trackIds: [] };
      bySubmission.set(row.id, entry);
      order.push(row.id);
    }
    if (row.trackId) entry.trackIds.push(row.trackId);
  }
  if (order.length > MAX_PLAN_SUBMISSION_SCAN) {
    throw new ApiError(
      "invalid",
      `This plan would scan more than ${MAX_PLAN_SUBMISSION_SCAN} submissions -- narrow the plan's track filter first`,
    );
  }

  return order.map((id) => {
    const entry = bySubmission.get(id);
    if (!entry) throw new ApiError("invalid", "listPlanFilteredSubmissions: missing hydrated entry");
    return {
      id,
      ref: formatRef(recordPrefix, entry.seq),
      title: entry.title,
      trackIds: entry.trackIds,
      status: entry.status,
    };
  });
}

/** DEC-346-style narrow shape for resolveReviewerSubmissions' single caller
 * (the reviewer queue route), which never reads trackIds -- no track-id
 * lookup is performed for this result at all (DEC-449). */
export interface ReviewerScopedSubmission {
  id: string;
  ref: string;
  title: string;
}

/** Narrows to either an explicit set of submissionIds, an explicit set of
 * trackIds, or both -- undefined/empty means "no scope narrowing at all"
 * (the unrestricted case). */
export interface PlanScopeSelector {
  submissionIds?: string[];
  trackIds?: string[];
}

/** DEC-572: the condition list every plan-scoped `submission` query in this
 * file filters by -- event eq, an optional (submissionIds OR
 * trackIds-EXISTS-over-submission_track) scope narrowing, and the plan's
 * own filters_json trackIds EXISTS narrowing. Extracted from
 * resolveReviewerSubmissions so countPlanScopedSubmissions (the
 * assignment-preview count) shares the EXACT same predicate rather than a
 * hand-copied twin that could silently drift from it. */
export function buildPlanScopeConditions(db: Db, plan: PlanRecord, selector?: PlanScopeSelector) {
  const conditions = [eq(schema.submission.eventId, plan.eventId)];

  const submissionScopes = selector?.submissionIds ?? [];
  const trackScopes = selector?.trackIds ?? [];
  if (submissionScopes.length > 0 || trackScopes.length > 0) {
    const scopeConds = [];
    if (submissionScopes.length > 0) scopeConds.push(inArray(schema.submission.id, submissionScopes));
    if (trackScopes.length > 0) {
      scopeConds.push(
        exists(
          db
            .select({ one: sql`1` })
            .from(schema.submissionTrack)
            .where(
              and(
                eq(schema.submissionTrack.submissionId, schema.submission.id),
                inArray(schema.submissionTrack.trackId, trackScopes),
              ),
            ),
        ),
      );
    }
    const scopeCond = scopeConds.length > 1 ? or(...scopeConds) : scopeConds[0];
    if (scopeCond) conditions.push(scopeCond);
  }

  const filterTracks = plan.filters?.trackIds;
  if (filterTracks && filterTracks.length > 0) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(schema.submissionTrack)
          .where(
            and(
              eq(schema.submissionTrack.submissionId, schema.submission.id),
              inArray(schema.submissionTrack.trackId, filterTracks),
            ),
          ),
      ),
    );
  }

  return conditions;
}

/** Resolves the submissions a single reviewer's plan_reviewer rows grant
 * access to (DEC-017 scope semantics), intersected with the plan's own
 * track filters -- DEC-439: cost scales with THIS reviewer's slice, not the
 * whole plan. Loads only this (plan,userId)'s plan_reviewer rows, then
 * issues one scoped `submission` query (EXISTS subqueries over
 * submission_track, never a whole-event track scan) whose semantics match
 * `resolveAssignments` (src/domain/evaluation.ts) exactly: an unrestricted
 * row (trackId and submissionId both null) grants every plan-filtered
 * submission; otherwise the union of explicit submissionId scopes and
 * submissions matching any trackId scope, always intersected with the
 * plan's own filters_json trackIds. A userId with no rows returns [].
 * DEC-449: this fn's only caller (the reviewer queue route) never reads
 * trackIds, so no track-id lookup is issued here at all -- callers that
 * need trackIds should use listPlanFilteredSubmissions instead. */
export async function resolveReviewerSubmissions(
  db: Db,
  plan: PlanRecord,
  userId: string,
): Promise<ReviewerScopedSubmission[]> {
  // DEC-439 amendment (wave 62): a per-submission reviewer scope writes one
  // plan_reviewer row per submission -- the same unbounded surface as the
  // matched-submissions query below. Ordered and capped at
  // MAX_REVIEWER_SCOPE_ROWS + 1, refusing loudly rather than silently
  // truncating a reviewer's own scope rows.
  const reviewerRows = await db
    .select({ trackId: schema.planReviewer.trackId, submissionId: schema.planReviewer.submissionId })
    .from(schema.planReviewer)
    .where(and(eq(schema.planReviewer.planId, plan.id), eq(schema.planReviewer.userId, userId)))
    .orderBy(asc(schema.planReviewer.createdAt), asc(schema.planReviewer.id))
    .limit(MAX_REVIEWER_SCOPE_ROWS + 1);
  if (reviewerRows.length > MAX_REVIEWER_SCOPE_ROWS) {
    throw new ApiError(
      "invalid",
      `This reviewer's scope would scan more than ${MAX_REVIEWER_SCOPE_ROWS} plan_reviewer rows -- narrow the reviewer's assignment scope first`,
    );
  }
  if (reviewerRows.length === 0) return [];

  const unrestricted = reviewerRows.some((r) => r.trackId === null && r.submissionId === null);
  const submissionScopes = [
    ...new Set(reviewerRows.filter((r) => r.submissionId !== null).map((r) => r.submissionId as string)),
  ];
  const trackScopes = [...new Set(reviewerRows.filter((r) => r.trackId !== null).map((r) => r.trackId as string))];
  if (!unrestricted && submissionScopes.length === 0 && trackScopes.length === 0) return [];

  const conditions = buildPlanScopeConditions(
    db,
    plan,
    unrestricted ? undefined : { submissionIds: submissionScopes, trackIds: trackScopes },
  );

  // DEC-346 amendment (wave 57), extended here (DEC-439 amendment, wave 62):
  // ordered deterministically and capped at MAX_PLAN_SUBMISSION_SCAN + 1 --
  // refuse loudly rather than silently truncate. This reviewer-scoped read's
  // matched submissions still feed buildReviewerQueue's fewest-ratings-first
  // JS slice (src/routes/review/reviewer.ts:212-214, DEC-466) -- bounding the
  // SQL that feeds it is exactly why that JS slice stays legal.
  // task w39-d (DEC-829 wave-39): the record-prefix lookup below consumes
  // nothing from `matched` -- issue both in one Promise.all wave instead of
  // sequential awaits.
  const [matched, eventRows] = await Promise.all([
    db
      .select({ id: schema.submission.id, seq: schema.submission.seq, title: schema.submission.title })
      .from(schema.submission)
      .where(and(...conditions))
      .orderBy(asc(schema.submission.seq), asc(schema.submission.id))
      .limit(MAX_PLAN_SUBMISSION_SCAN + 1),
    db
      .select({ recordPrefix: schema.event.recordPrefix })
      .from(schema.event)
      .where(eq(schema.event.id, plan.eventId))
      .limit(1),
  ]);
  if (matched.length > MAX_PLAN_SUBMISSION_SCAN) {
    throw new ApiError(
      "invalid",
      `This plan would scan more than ${MAX_PLAN_SUBMISSION_SCAN} submissions -- narrow the plan's track filter first`,
    );
  }
  if (matched.length === 0) return [];

  const recordPrefix = eventRows[0]?.recordPrefix ?? "SES";

  return matched.map((row) => ({
    id: row.id,
    ref: formatRef(recordPrefix, row.seq),
    title: row.title,
  }));
}

/** DEC-572: the assignment-preview count/list for the "assign this whole
 * track" reviewer-scope action (ABS-S2-D1) -- the organizer must see the
 * TRUE total (COUNT, not the page size) before the fan-out happens, plus a
 * bounded preview page to render. `items` is capped at 200 rows ordered
 * (seq asc, id asc) -- a LIMIT obliges a total order and the caller must
 * read `count`, never `items.length`, as the real number. */
export const SCOPE_PREVIEW_LIMIT = 200;

export async function countPlanScopedSubmissions(
  db: Db,
  plan: PlanRecord,
  opts: { trackId: string },
): Promise<{ count: number; items: ReviewerScopedSubmission[] }> {
  const conditions = buildPlanScopeConditions(db, plan, { trackIds: [opts.trackId] });

  const countRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.submission)
    .where(and(...conditions));
  const count = Number(countRows[0]?.count ?? 0);

  const rows = await db
    .select({ id: schema.submission.id, seq: schema.submission.seq, title: schema.submission.title })
    .from(schema.submission)
    .where(and(...conditions))
    .orderBy(asc(schema.submission.seq), asc(schema.submission.id))
    .limit(SCOPE_PREVIEW_LIMIT);

  const eventRows = await db
    .select({ recordPrefix: schema.event.recordPrefix })
    .from(schema.event)
    .where(eq(schema.event.id, plan.eventId))
    .limit(1);
  const recordPrefix = eventRows[0]?.recordPrefix ?? "SES";

  return {
    count,
    items: rows.map((row) => ({
      id: row.id,
      ref: formatRef(recordPrefix, row.seq),
      title: row.title,
    })),
  };
}

/** DEC-655: the ONE "does this submission match the plan's own track
 * filter" probe -- both the unrestricted and per-submission branches of
 * isSubmissionInReviewerScope below call this instead of each hand-rolling
 * an EXISTS(submission_track) check that could silently drift apart. An
 * empty/absent filterTracks means "no narrowing", i.e. always matches. */
async function matchesPlanFilterTracks(
  db: Db,
  submissionId: string,
  filterTracks: string[] | undefined,
): Promise<boolean> {
  if (!filterTracks || filterTracks.length === 0) return true;
  // DEC-558 wave-5 amendment: only `.length > 0` is read below -- WHICH
  // matching track row SQLite returns is never observed. .orderBy(...)
  // makes the pick deterministic regardless.
  const matchRows = await db
    .select({ trackId: schema.submissionTrack.trackId })
    .from(schema.submissionTrack)
    .where(
      and(eq(schema.submissionTrack.submissionId, submissionId), inArray(schema.submissionTrack.trackId, filterTracks)),
    )
    .orderBy(asc(schema.submissionTrack.trackId))
    .limit(1);
  return matchRows.length > 0;
}

/** DEC-655: does this submission satisfy the plan's OWN filters_json
 * trackIds (independent of any reviewer's plan_reviewer rows)? Reuses
 * buildPlanScopeConditions -- the same predicate every plan-scoped query in
 * this file shares -- rather than re-deriving the EXISTS(submission_track)
 * check inline at the POST /plans/:id/reviewers call site. */
export async function submissionMatchesPlanFilters(
  db: Db,
  plan: PlanRecord,
  submissionId: string,
): Promise<boolean> {
  // DEC-558 wave-5 amendment: conditions[0] is eq(schema.submission.id,
  // submissionId), submission's own primary key -- already narrows to at
  // most one row. .orderBy(...) is added anyway since the predicate is
  // built via array spread, not literally inline in this statement.
  const conditions = [eq(schema.submission.id, submissionId), ...buildPlanScopeConditions(db, plan)];
  const rows = await db
    .select({ id: schema.submission.id })
    .from(schema.submission)
    .where(and(...conditions))
    .orderBy(asc(schema.submission.id))
    .limit(1);
  return rows.length > 0;
}

/** Targeted per-submission scope check for the reviewer GET/PUT endpoints
 * (DEC-081): no full-set load. Loads only this (plan,user)'s plan_reviewer
 * rows, then does bounded, single-submission-scoped queries. DEC-655: every
 * branch (unrestricted, explicit submissionId, track) intersects the plan's
 * own filters_json trackIds via matchesPlanFilterTracks -- this must agree
 * with buildPlanScopeConditions/listPlanFilteredSubmissions for the same
 * plan+reviewer+submission, the two readers never disagree. */
export async function isSubmissionInReviewerScope(
  db: Db,
  plan: PlanRecord,
  userId: string,
  submissionId: string,
): Promise<boolean> {
  const rows = await db
    .select({ trackId: schema.planReviewer.trackId, submissionId: schema.planReviewer.submissionId })
    .from(schema.planReviewer)
    .where(and(eq(schema.planReviewer.planId, plan.id), eq(schema.planReviewer.userId, userId)))
    .orderBy(asc(schema.planReviewer.createdAt), asc(schema.planReviewer.id))
    .limit(MAX_REVIEWER_SCOPE_ROWS + 1);
  if (rows.length > MAX_REVIEWER_SCOPE_ROWS) {
    throw new ApiError(
      "invalid",
      `This reviewer's scope would scan more than ${MAX_REVIEWER_SCOPE_ROWS} plan_reviewer rows -- narrow the reviewer's assignment scope first`,
    );
  }
  if (rows.length === 0) return false;

  const filterTracks = plan.filters?.trackIds;
  const unrestricted = rows.some((r) => r.trackId === null && r.submissionId === null);

  if (unrestricted) {
    const subRows = await db
      .select({ id: schema.submission.id })
      .from(schema.submission)
      .where(and(eq(schema.submission.id, submissionId), eq(schema.submission.eventId, plan.eventId)))
      .limit(1);
    if (!subRows[0]) return false;
    return matchesPlanFilterTracks(db, submissionId, filterTracks);
  }

  // DEC-354: per-submission assignments must be bounded to plan.eventId
  // the same way the unrestricted (:139-145) and track (:166-177) branches
  // are, else a stale/foreign-event submissionId on the plan_reviewer row
  // silently grants scope across events.
  const submissionScopes = new Set(rows.filter((r) => r.submissionId !== null).map((r) => r.submissionId as string));
  if (submissionScopes.has(submissionId)) {
    const scopedRows = await db
      .select({ id: schema.submission.id })
      .from(schema.submission)
      .where(and(eq(schema.submission.id, submissionId), eq(schema.submission.eventId, plan.eventId)))
      .limit(1);
    if (!scopedRows[0]) return false;
    // DEC-655: the explicit-submissionId branch must intersect the plan's
    // own filters like every other reader (buildPlanScopeConditions,
    // the unrestricted branch above, the track branch below) instead of
    // returning true on event match alone.
    return matchesPlanFilterTracks(db, submissionId, filterTracks);
  }

  const trackScopes = [...new Set(rows.filter((r) => r.trackId !== null).map((r) => r.trackId as string))];
  if (trackScopes.length === 0) return false;

  const effectiveTracks = filterTracks && filterTracks.length > 0 ? trackScopes.filter((t) => filterTracks.includes(t)) : trackScopes;
  if (effectiveTracks.length === 0) return false;

  const matchRows = await db
    .select({ trackId: schema.submissionTrack.trackId })
    .from(schema.submissionTrack)
    .innerJoin(schema.submission, eq(schema.submission.id, schema.submissionTrack.submissionId))
    .where(
      and(
        eq(schema.submissionTrack.submissionId, submissionId),
        eq(schema.submission.eventId, plan.eventId),
        inArray(schema.submissionTrack.trackId, effectiveTracks),
      ),
    )
    .limit(1);
  return matchRows.length > 0;
}

export async function getSubmissionSummaryInEvent(
  db: Db,
  submissionId: string,
  eventId: string,
): Promise<SubmissionSummary | null> {
  const rows = await db
    .select()
    .from(schema.submission)
    .where(and(eq(schema.submission.id, submissionId), eq(schema.submission.eventId, eventId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const eventRows = await db
    .select({ recordPrefix: schema.event.recordPrefix })
    .from(schema.event)
    .where(eq(schema.event.id, eventId))
    .limit(1);
  const recordPrefix = eventRows[0]?.recordPrefix ?? "SES";
  const trackIds = await submissionTrackIdsForOne(db, submissionId);
  return {
    id: row.id,
    ref: formatRef(recordPrefix, row.seq),
    title: row.title,
    description: row.description,
    trackIds,
    status: row.status,
  };
}

/** DEC-623: resolves either an internal submission id OR a human ref (e.g.
 * 'SES-014') to the internal id, scoped to eventId. Tries the internal-id
 * path first (getSubmissionSummaryInEvent); on failure, reads the event's
 * record_prefix, parseRef()s the input against it, and looks up the
 * submission by (eventId, seq). Returns null when neither resolves. */
export async function findSubmissionIdByRefOrId(db: Db, eventId: string, input: string): Promise<string | null> {
  const byId = await getSubmissionSummaryInEvent(db, input, eventId);
  if (byId) return input;

  const eventRows = await db
    .select({ recordPrefix: schema.event.recordPrefix })
    .from(schema.event)
    .where(eq(schema.event.id, eventId))
    .limit(1);
  const recordPrefix = eventRows[0]?.recordPrefix;
  if (!recordPrefix) return null;

  const seq = parseRef(recordPrefix, input);
  if (seq === null) return null;

  // DEC-558 wave-5 amendment: submission_event_id_seq_idx (src/db/schema/
  // submissions.ts) is a uniqueIndex on exactly this (eventId, seq) tuple.
  const rows = await db
    .select({ id: schema.submission.id })
    .from(schema.submission)
    .where(and(eq(schema.submission.eventId, eventId), eq(schema.submission.seq, seq)))
    .limit(1);
  return rows[0]?.id ?? null;
}

/** DEC-924: the batched twin of findSubmissionIdByRefOrId -- resolves a
 * whole set of ref-or-id inputs to internal ids in ONE id-lookup query plus
 * (for the leftovers) ONE ref-lookup query, never a per-input round trip.
 * Same two-path resolution as the singular version: try each input as an
 * internal id first, then as a printed ref against the event's own
 * record_prefix. Returns a Map from the caller's original input string to
 * the resolved internal id -- inputs that resolve neither way are simply
 * absent from the map so the caller can name the offending refs. */
export async function findSubmissionIdsByRefsOrIds(db: Db, eventId: string, inputs: string[]): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();
  const unique = [...new Set(inputs)];
  if (unique.length === 0) return resolved;

  // Path 1: input is already an internal submission id.
  const remaining: string[] = [];
  for (const batch of chunkIds(unique)) {
    const rows = await db
      .select({ id: schema.submission.id })
      .from(schema.submission)
      .where(and(eq(schema.submission.eventId, eventId), inArray(schema.submission.id, batch)));
    const idsInBatch = new Set(rows.map((r) => r.id));
    for (const input of batch) {
      if (idsInBatch.has(input)) resolved.set(input, input);
      else remaining.push(input);
    }
  }
  if (remaining.length === 0) return resolved;

  // Path 2: input is a printed ref (e.g. SES-014) -- parse against the
  // event's own record_prefix, then look up by (eventId, seq).
  const eventRows = await db
    .select({ recordPrefix: schema.event.recordPrefix })
    .from(schema.event)
    .where(eq(schema.event.id, eventId))
    .limit(1);
  const recordPrefix = eventRows[0]?.recordPrefix;
  if (!recordPrefix) return resolved;

  const seqToInput = new Map<number, string>();
  for (const input of remaining) {
    const seq = parseRef(recordPrefix, input);
    if (seq !== null) seqToInput.set(seq, input);
  }
  const seqs = [...seqToInput.keys()];
  if (seqs.length === 0) return resolved;

  for (const batch of chunkIds(seqs.map(String))) {
    const batchSeqs = batch.map(Number);
    const rows = await db
      .select({ id: schema.submission.id, seq: schema.submission.seq })
      .from(schema.submission)
      .where(and(eq(schema.submission.eventId, eventId), inArray(schema.submission.seq, batchSeqs)));
    for (const row of rows) {
      const input = seqToInput.get(row.seq);
      if (input !== undefined) resolved.set(input, row.id);
    }
  }
  return resolved;
}

/** DEC-924/DEC-655: the batched twin of submissionMatchesPlanFilters -- ONE
 * query over the whole submissionIds set (bounded by the caller's own
 * parseBoundedIdArray cap) rather than a query per submission. Returns the
 * subset of submissionIds that satisfy the plan's own filters_json
 * trackIds (and are in the plan's event) -- ids absent from the returned
 * set failed the plan-filter check. */
export async function submissionsMatchingPlanFilters(db: Db, plan: PlanRecord, submissionIds: string[]): Promise<Set<string>> {
  const matched = new Set<string>();
  if (submissionIds.length === 0) return matched;
  for (const batch of chunkIds(submissionIds)) {
    const conditions = [inArray(schema.submission.id, batch), ...buildPlanScopeConditions(db, plan)];
    const rows = await db.select({ id: schema.submission.id }).from(schema.submission).where(and(...conditions));
    for (const row of rows) matched.add(row.id);
  }
  return matched;
}

export interface SpeakerSummary {
  contactId: string;
  name: string;
  company: string | null;
  title: string | null;
  /** DEC-561/DEC-562: never serialized to the client through this endpoint's
   * `detail.speakers` field (organizers use the admin submission detail for
   * that) -- callers that need it (DEC-018 wave-54 identity redaction) must
   * strip it before assigning speakers onto a response body. Selected here
   * (rather than a second query) purely so the reviewer.ts route can fold it
   * into the anonymization identity list without a new round-trip. */
  email: string;
}

/** DEC-561/DEC-562: reviewers never see contact.email through this endpoint's
 * response body (organizers use the admin submission detail for that);
 * `name` is derived server-side so the reviewer surface never has to
 * reassemble it. Ordered (participant.order asc, contact.id asc) --
 * DEC-562's canonical people order for any list of a submission's people. */
export async function listSpeakersForSubmission(db: Db, submissionId: string): Promise<SpeakerSummary[]> {
  const rows = await db
    .select({
      contactId: schema.contact.id,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      company: schema.contact.company,
      title: schema.contact.title,
      email: schema.contact.email,
    })
    .from(schema.participant)
    .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
    .where(eq(schema.participant.submissionId, submissionId))
    .orderBy(asc(schema.participant.order), asc(schema.contact.id));
  return rows.map((r) => ({
    contactId: r.contactId,
    name: `${r.firstName} ${r.lastName}`.trim(),
    company: r.company,
    title: r.title,
    email: r.email,
  }));
}

/** DEC-703/DEC-974: batched speaker-name lookup for an ORGANISER-ONLY results
 * page/export -- ONE query (per chunkIds batch, DEC-078) keyed to the
 * caller's own submission id set, never a per-submission read and never an
 * unscoped scan of participant/contact. Not-declined participant order only
 * (SCHEDULING_PARTICIPANT_STATUSES -- 'none'/'invited'/'accepted', the same
 * organiser-surface population the conflict engine and agenda card use, NOT
 * the public-facing visibleParticipantConditions()) ordered
 * (participant.order asc, contact.id asc -- DEC-561/DEC-562), mirroring
 * listSpeakersForSubmission but for many submissions at once. */
export async function listSpeakerNamesForSubmissions(db: Db, submissionIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (submissionIds.length === 0) return map;
  // DEC-829 (wave-29 amendment, applied to review by task w29-e): the
  // chunkIds batches over this already-scoped submission id set are
  // INDEPENDENT queries (disjoint id sets, no shared mutable server-side
  // state) -- issuing them concurrently via Promise.all instead of one
  // sequential await per batch cuts wall-clock latency roughly N-fold for a
  // results page's full-plan id set (e.g. ~23 batches at 2,000 submissions)
  // without scanning a single extra row; the driving relation stays exactly
  // this function's own submissionIds, just no longer serialized.
  const batches = await Promise.all(
    chunkIds(submissionIds).map((batch) =>
      db
        .select({
          submissionId: schema.participant.submissionId,
          firstName: schema.contact.firstName,
          lastName: schema.contact.lastName,
        })
        .from(schema.participant)
        .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
        .where(
          and(
            inArray(schema.participant.submissionId, batch),
            inArray(schema.participant.inviteStatus, [...SCHEDULING_PARTICIPANT_STATUSES]),
          ),
        )
        .orderBy(asc(schema.participant.order), asc(schema.contact.id)),
    ),
  );
  for (const rows of batches) {
    for (const row of rows) {
      const list = map.get(row.submissionId) ?? [];
      list.push(`${row.firstName} ${row.lastName}`.trim());
      map.set(row.submissionId, list);
    }
  }
  return map;
}

export interface SpeakerIdentity {
  name: string;
  email: string;
  company: string | null;
}

/** DEC-018 (wave-57 amendment): batched speaker-identity lookup for the
 * queue-title redaction the reviewer route runs when a plan is anonymized --
 * ONE query per chunkIds batch (DEC-078), mirroring
 * listSpeakerNamesForSubmissions but returning name/email/company instead of
 * bare names. Deliberately carries NO inviteStatus filter (unlike its
 * sibling, which is scoped to SCHEDULING_PARTICIPANT_STATUSES for a display
 * surface): a redaction identity set must be a superset of any display
 * predicate, never narrower, or a participant excluded from a display list
 * could still leave their name unredacted in free text. Ordered
 * (participant.order asc, contact.id asc -- DEC-561/DEC-562). Returns an
 * empty map for an empty id list. */
export async function listSpeakerIdentitiesForSubmissions(
  db: Db,
  submissionIds: string[],
): Promise<Map<string, SpeakerIdentity[]>> {
  const map = new Map<string, SpeakerIdentity[]>();
  if (submissionIds.length === 0) return map;
  for (const batch of chunkIds(submissionIds)) {
    const rows = await db
      .select({
        submissionId: schema.participant.submissionId,
        firstName: schema.contact.firstName,
        lastName: schema.contact.lastName,
        email: schema.contact.email,
        company: schema.contact.company,
      })
      .from(schema.participant)
      .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
      .where(inArray(schema.participant.submissionId, batch))
      .orderBy(asc(schema.participant.order), asc(schema.contact.id));
    for (const row of rows) {
      const list = map.get(row.submissionId) ?? [];
      list.push({ name: `${row.firstName} ${row.lastName}`.trim(), email: row.email, company: row.company });
      map.set(row.submissionId, list);
    }
  }
  return map;
}

/** DEC-703: batched track-name lookup for a results page/export, mirroring
 * listSpeakerNamesForSubmissions -- ONE query per chunkIds batch, keyed to
 * the caller's own submission id set. Ordered (track.position asc, track.id
 * asc) -- the event's own track order, never a hand-copied one. */
export async function listTrackNamesForSubmissions(db: Db, submissionIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (submissionIds.length === 0) return map;
  // DEC-829 (wave-29 amendment, applied to review by task w29-e): same
  // concurrent-batch shape as listSpeakerNamesForSubmissions above -- disjoint
  // id sets per batch, no ordering dependency ACROSS batches, so Promise.all
  // replaces N sequential round trips with N concurrent ones over the exact
  // same already-scoped submissionIds.
  const batches = await Promise.all(
    chunkIds(submissionIds).map((batch) =>
      db
        .select({
          submissionId: schema.submissionTrack.submissionId,
          name: schema.track.name,
        })
        .from(schema.submissionTrack)
        .innerJoin(schema.track, eq(schema.submissionTrack.trackId, schema.track.id))
        .where(inArray(schema.submissionTrack.submissionId, batch))
        .orderBy(asc(schema.track.position), asc(schema.track.id)),
    ),
  );
  for (const rows of batches) {
    for (const row of rows) {
      const list = map.get(row.submissionId) ?? [];
      list.push(row.name);
      map.set(row.submissionId, list);
    }
  }
  return map;
}

/** DEC-857: batched session_format-role answer lookup for the reviewer
 * queue -- ONE query per chunkIds batch (mirrors loadDurationMinBySubmission,
 * src/server/repo/agenda.ts:316-330), keyed to the caller's own submission id
 * set. The stored answer LABEL is returned verbatim (it already carries its
 * own "(N min)" suffix) -- never re-parsed or reformatted here. Null when a
 * submission has no format answer. */
export async function listFormatLabelsBySubmission(db: Db, submissionIds: string[]): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (submissionIds.length === 0) return map;
  // DEC-829 (wave-29 amendment, applied to review by task w29-e): concurrent
  // batches, same reasoning as listSpeakerNamesForSubmissions -- each
  // submission's own answer row lives in exactly one batch, so merge order
  // across batches is immaterial.
  const batches = await Promise.all(
    chunkIds(submissionIds).map((batch) =>
      db
        .select({
          submissionId: schema.submissionAnswer.submissionId,
          valueJson: schema.submissionAnswer.valueJson,
        })
        .from(schema.submissionAnswer)
        .where(
          and(
            inArray(schema.submissionAnswer.submissionId, batch),
            answerFieldRoleCondition("session_format"),
          ),
        ),
    ),
  );
  for (const rows of batches) {
    for (const row of rows) {
      map.set(row.submissionId, roleAnswerLabel(row.valueJson));
    }
  }
  return map;
}

/** DEC-857/DEC-986: batched audience_level-role answer lookup for the
 * reviewer queue AND the scorecard head -- exact twin of
 * listFormatLabelsBySubmission above (same chunkIds batching, ONE query per
 * chunk, keyed to the caller's own submission id set, never one query per
 * submission). The stored answer LABEL is returned verbatim -- never
 * re-parsed or reformatted here. Audience level is a session-shape fact (the
 * field lives on the CFP's session section), not a speaker one, so it is
 * never stripped by anonymizeForReviewer. Null when a submission has no
 * audience-level answer (including events whose CFP has no such field). */
export async function listAudienceLevelLabelsBySubmission(
  db: Db,
  submissionIds: string[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (submissionIds.length === 0) return map;
  // DEC-829 (wave-29 amendment, applied to review by task w29-e): concurrent
  // batches, same reasoning as listFormatLabelsBySubmission above.
  const batches = await Promise.all(
    chunkIds(submissionIds).map((batch) =>
      db
        .select({
          submissionId: schema.submissionAnswer.submissionId,
          valueJson: schema.submissionAnswer.valueJson,
        })
        .from(schema.submissionAnswer)
        .where(
          and(
            inArray(schema.submissionAnswer.submissionId, batch),
            answerFieldRoleCondition("audience_level"),
          ),
        ),
    ),
  );
  for (const rows of batches) {
    for (const row of rows) {
      map.set(row.submissionId, roleAnswerLabel(row.valueJson));
    }
  }
  return map;
}

export interface SubmissionAnswerRow {
  fieldId: string;
  section: "session" | "speaker";
  label: string;
  kind: string;
  value: unknown;
}

/** All answers for a submission (custom fields only, per DEC-016), joined to
 * their field def so callers can filter by section. Ordered (form_field.
 * position asc, form_field.id asc) -- DEC-562's canonical answer order. */
export async function listAnswersForSubmission(db: Db, submissionId: string): Promise<SubmissionAnswerRow[]> {
  const rows = await db
    .select({
      fieldId: schema.submissionAnswer.formFieldId,
      valueJson: schema.submissionAnswer.valueJson,
      section: schema.formField.section,
      label: schema.formField.label,
      kind: schema.formField.kind,
    })
    .from(schema.submissionAnswer)
    .innerJoin(schema.formField, eq(schema.submissionAnswer.formFieldId, schema.formField.id))
    .where(eq(schema.submissionAnswer.submissionId, submissionId))
    .orderBy(asc(schema.formField.position), asc(schema.formField.id));
  return rows.map((r) => ({
    fieldId: r.fieldId,
    section: r.section as "session" | "speaker",
    label: r.label,
    kind: r.kind,
    value: JSON.parse(r.valueJson) as unknown,
  }));
}

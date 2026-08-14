// Submissions in review scope: resolves which submissions a plan/reviewer
// can see, plus the summary/speaker/answer data reviewers need to render a
// submission (DEC-078/DEC-081/DEC-016/DEC-017/DEC-346).

import { and, asc, eq, exists, inArray, or, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { formatRef, parseRef } from "../../../domain/ids";
import { chunkIds } from "../../../lib/chunk";
import { AUDIENCE_LEVEL_FIELD_ID, SESSION_FORMAT_FIELD_ID } from "../../../forms/types";
import { visibleParticipantConditions } from "../public/gates";
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
 * (a) matched submissions — SQL-side track filter via submission_track join,
 * never an `inArray` over submission ids, ordered (seq asc, id asc) and
 * capped at MAX_PLAN_SUBMISSION_SCAN (DEC-346 amendment, wave 57: refuses
 * loudly rather than truncating past the cap); (b) trackIds for the MATCHED
 * submissions only, read id-scoped via chunkIds batches over submission_track
 * — no join against submission, so cost is proportional to the matched set. */
export async function listPlanFilteredSubmissions(
  db: Db,
  plan: PlanRecord,
  opts?: { withTrackIds?: boolean },
): Promise<PlanSubmissionRef[]> {
  const withTrackIds = opts?.withTrackIds ?? true;
  const eventRows = await db
    .select({ recordPrefix: schema.event.recordPrefix })
    .from(schema.event)
    .where(eq(schema.event.id, plan.eventId))
    .limit(1);
  const recordPrefix = eventRows[0]?.recordPrefix ?? "SES";

  const filterTracks = plan.filters?.trackIds;

  // (a) Matched submissions -- {id, seq, title} only (DEC-346: description
  // dropped -- no plan-scoped whole-set load needs it). DEC-346 amendment
  // (wave 57): ordered deterministically and capped at
  // MAX_PLAN_SUBMISSION_SCAN + 1 -- refuse loudly rather than silently
  // truncate once an event's matching submission count crosses the cap.
  let matched: { id: string; seq: number; title: string; status: string }[];
  if (filterTracks && filterTracks.length > 0) {
    // filterTracks is organizer-authored plan config (a handful of track
    // ids), not a request-scale id list -- this inArray is exempt from the
    // DEC-078 chunk requirement (bounded to ~25 params in practice).
    matched = await db
      .selectDistinct({
        id: schema.submission.id,
        seq: schema.submission.seq,
        title: schema.submission.title,
        status: schema.submission.status,
      })
      .from(schema.submission)
      .innerJoin(schema.submissionTrack, eq(schema.submissionTrack.submissionId, schema.submission.id))
      .where(and(eq(schema.submission.eventId, plan.eventId), inArray(schema.submissionTrack.trackId, filterTracks)))
      .orderBy(asc(schema.submission.seq), asc(schema.submission.id))
      .limit(MAX_PLAN_SUBMISSION_SCAN + 1);
  } else {
    matched = await db
      .select({
        id: schema.submission.id,
        seq: schema.submission.seq,
        title: schema.submission.title,
        status: schema.submission.status,
      })
      .from(schema.submission)
      .where(eq(schema.submission.eventId, plan.eventId))
      .orderBy(asc(schema.submission.seq), asc(schema.submission.id))
      .limit(MAX_PLAN_SUBMISSION_SCAN + 1);
  }
  if (matched.length > MAX_PLAN_SUBMISSION_SCAN) {
    throw new ApiError(
      "invalid",
      `This plan would scan more than ${MAX_PLAN_SUBMISSION_SCAN} submissions -- narrow the plan's track filter first`,
    );
  }

  // (b) trackIds for the MATCHED submissions only -- an id-scoped,
  // chunkIds-batched read of submission_track (DEC-346 amendment, wave 57):
  // no join against submission at all, so cost is proportional to the
  // matched set, never the whole event. Skipped entirely when withTrackIds
  // is false (DEC-439: callers that never read trackIds shouldn't pay for
  // this at all).
  const trackMap = new Map<string, string[]>();
  if (withTrackIds && matched.length > 0) {
    const matchedIds = matched.map((m) => m.id);
    for (const batch of chunkIds(matchedIds)) {
      const trackRows = await db
        .select({ submissionId: schema.submissionTrack.submissionId, trackId: schema.submissionTrack.trackId })
        .from(schema.submissionTrack)
        .where(inArray(schema.submissionTrack.submissionId, batch));
      for (const row of trackRows) {
        const list = trackMap.get(row.submissionId) ?? [];
        list.push(row.trackId);
        trackMap.set(row.submissionId, list);
      }
    }
  }

  return matched.map((row) => ({
    id: row.id,
    ref: formatRef(recordPrefix, row.seq),
    title: row.title,
    trackIds: trackMap.get(row.id) ?? [],
    status: row.status,
  }));
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
  const matched = await db
    .select({ id: schema.submission.id, seq: schema.submission.seq, title: schema.submission.title })
    .from(schema.submission)
    .where(and(...conditions))
    .orderBy(asc(schema.submission.seq), asc(schema.submission.id))
    .limit(MAX_PLAN_SUBMISSION_SCAN + 1);
  if (matched.length > MAX_PLAN_SUBMISSION_SCAN) {
    throw new ApiError(
      "invalid",
      `This plan would scan more than ${MAX_PLAN_SUBMISSION_SCAN} submissions -- narrow the plan's track filter first`,
    );
  }
  if (matched.length === 0) return [];

  const eventRows = await db
    .select({ recordPrefix: schema.event.recordPrefix })
    .from(schema.event)
    .where(eq(schema.event.id, plan.eventId))
    .limit(1);
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
  const matchRows = await db
    .select({ trackId: schema.submissionTrack.trackId })
    .from(schema.submissionTrack)
    .where(
      and(eq(schema.submissionTrack.submissionId, submissionId), inArray(schema.submissionTrack.trackId, filterTracks)),
    )
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
  const conditions = [eq(schema.submission.id, submissionId), ...buildPlanScopeConditions(db, plan)];
  const rows = await db.select({ id: schema.submission.id }).from(schema.submission).where(and(...conditions)).limit(1);
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
    .select()
    .from(schema.planReviewer)
    .where(and(eq(schema.planReviewer.planId, plan.id), eq(schema.planReviewer.userId, userId)));
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
}

/** DEC-561/DEC-562: reviewers never see contact.email through this endpoint
 * (organizers use the admin submission detail for that); `name` is derived
 * server-side so the reviewer surface never has to reassemble it. Ordered
 * (participant.order asc, contact.id asc) -- DEC-562's canonical people
 * order for any list of a submission's people. */
export async function listSpeakersForSubmission(db: Db, submissionId: string): Promise<SpeakerSummary[]> {
  const rows = await db
    .select({
      contactId: schema.contact.id,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      company: schema.contact.company,
      title: schema.contact.title,
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
  }));
}

/** DEC-703: batched speaker-name lookup for a results page/export -- ONE
 * query (per chunkIds batch, DEC-078) keyed to the caller's own submission
 * id set, never a per-submission read and never an unscoped scan of
 * participant/contact. Visible-participant order only (DEC-561/DEC-562:
 * participant.order asc, contact.id asc), mirroring listSpeakersForSubmission
 * but for many submissions at once. */
export async function listSpeakerNamesForSubmissions(db: Db, submissionIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (submissionIds.length === 0) return map;
  for (const batch of chunkIds(submissionIds)) {
    const rows = await db
      .select({
        submissionId: schema.participant.submissionId,
        firstName: schema.contact.firstName,
        lastName: schema.contact.lastName,
      })
      .from(schema.participant)
      .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
      .where(and(inArray(schema.participant.submissionId, batch), visibleParticipantConditions()))
      .orderBy(asc(schema.participant.order), asc(schema.contact.id));
    for (const row of rows) {
      const list = map.get(row.submissionId) ?? [];
      list.push(`${row.firstName} ${row.lastName}`.trim());
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
  for (const batch of chunkIds(submissionIds)) {
    const rows = await db
      .select({
        submissionId: schema.submissionTrack.submissionId,
        name: schema.track.name,
      })
      .from(schema.submissionTrack)
      .innerJoin(schema.track, eq(schema.submissionTrack.trackId, schema.track.id))
      .where(inArray(schema.submissionTrack.submissionId, batch))
      .orderBy(asc(schema.track.position), asc(schema.track.id));
    for (const row of rows) {
      const list = map.get(row.submissionId) ?? [];
      list.push(row.name);
      map.set(row.submissionId, list);
    }
  }
  return map;
}

/** DEC-857: batched SESSION_FORMAT_FIELD_ID answer lookup for the reviewer
 * queue -- ONE query per chunkIds batch (mirrors loadDurationMinBySubmission,
 * src/server/repo/agenda.ts:316-330), keyed to the caller's own submission id
 * set. The stored answer LABEL is returned verbatim (it already carries its
 * own "(N min)" suffix) -- never re-parsed or reformatted here. Null when a
 * submission has no format answer. */
export async function listFormatLabelsBySubmission(db: Db, submissionIds: string[]): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (submissionIds.length === 0) return map;
  for (const batch of chunkIds(submissionIds)) {
    const rows = await db
      .select({
        submissionId: schema.submissionAnswer.submissionId,
        valueJson: schema.submissionAnswer.valueJson,
      })
      .from(schema.submissionAnswer)
      .where(
        and(
          inArray(schema.submissionAnswer.submissionId, batch),
          eq(schema.submissionAnswer.formFieldId, SESSION_FORMAT_FIELD_ID),
        ),
      );
    for (const row of rows) {
      const parsed: unknown = JSON.parse(row.valueJson);
      map.set(row.submissionId, typeof parsed === "string" && parsed.length > 0 ? parsed : null);
    }
  }
  return map;
}

/** DEC-857: batched AUDIENCE_LEVEL_FIELD_ID answer lookup for the reviewer
 * queue and scorecard -- exact twin of listFormatLabelsBySubmission above
 * (same chunkIds batching, ONE query per chunk, never one per submission).
 * The stored answer LABEL is returned verbatim -- never re-parsed or
 * reformatted here. Null when a submission has no audience-level answer. */
export async function listAudienceLevelsBySubmission(db: Db, submissionIds: string[]): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (submissionIds.length === 0) return map;
  for (const batch of chunkIds(submissionIds)) {
    const rows = await db
      .select({
        submissionId: schema.submissionAnswer.submissionId,
        valueJson: schema.submissionAnswer.valueJson,
      })
      .from(schema.submissionAnswer)
      .where(
        and(
          inArray(schema.submissionAnswer.submissionId, batch),
          eq(schema.submissionAnswer.formFieldId, AUDIENCE_LEVEL_FIELD_ID),
        ),
      );
    for (const row of rows) {
      const parsed: unknown = JSON.parse(row.valueJson);
      map.set(row.submissionId, typeof parsed === "string" && parsed.length > 0 ? parsed : null);
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

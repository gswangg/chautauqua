// Submissions in review scope: resolves which submissions a plan/reviewer
// can see, plus the summary/speaker/answer data reviewers need to render a
// submission (DEC-078/DEC-081/DEC-016/DEC-017/DEC-346).

import { and, eq, exists, inArray, or, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { formatRef } from "../../../domain/ids";
import type { PlanRecord } from "./plans";
import { chunkIds } from "../../../lib/chunk";

/** DEC-346: the narrow shape every plan-scoped whole-set load returns --
 * `description` is never selected for these (list/queue/results/progress),
 * only getSubmissionSummaryInEvent's single-row lookup needs the abstract. */
export interface PlanSubmissionRef {
  id: string;
  ref: string;
  title: string;
  trackIds: string[];
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
 * Two joined, non-id-list queries (DEC-078/DEC-081): (a) matched submissions
 * — SQL-side track filter via submission_track join, never an `inArray`
 * over submission ids; (b) full trackIds for every submission in the event,
 * joined against submission by eventId (again no id-list binding), grouped
 * in JS against the matched set. */
export async function listPlanFilteredSubmissions(db: Db, plan: PlanRecord): Promise<PlanSubmissionRef[]> {
  const eventRows = await db
    .select({ recordPrefix: schema.event.recordPrefix })
    .from(schema.event)
    .where(eq(schema.event.id, plan.eventId))
    .limit(1);
  const recordPrefix = eventRows[0]?.recordPrefix ?? "SES";

  const filterTracks = plan.filters?.trackIds;

  // (a) Matched submissions -- {id, seq, title} only (DEC-346: description
  // dropped -- no plan-scoped whole-set load needs it).
  let matched: { id: string; seq: number; title: string }[];
  if (filterTracks && filterTracks.length > 0) {
    // filterTracks is organizer-authored plan config (a handful of track
    // ids), not a request-scale id list -- this inArray is exempt from the
    // DEC-078 chunk requirement (bounded to ~25 params in practice).
    matched = await db
      .selectDistinct({
        id: schema.submission.id,
        seq: schema.submission.seq,
        title: schema.submission.title,
      })
      .from(schema.submission)
      .innerJoin(schema.submissionTrack, eq(schema.submissionTrack.submissionId, schema.submission.id))
      .where(and(eq(schema.submission.eventId, plan.eventId), inArray(schema.submissionTrack.trackId, filterTracks)));
  } else {
    matched = await db
      .select({
        id: schema.submission.id,
        seq: schema.submission.seq,
        title: schema.submission.title,
      })
      .from(schema.submission)
      .where(eq(schema.submission.eventId, plan.eventId));
  }

  // (b) Full trackIds per matched submission, joined by event -- no id
  // binding at all, grouped against the matched set in JS.
  const trackRows = await db
    .select({ submissionId: schema.submissionTrack.submissionId, trackId: schema.submissionTrack.trackId })
    .from(schema.submissionTrack)
    .innerJoin(schema.submission, eq(schema.submission.id, schema.submissionTrack.submissionId))
    .where(eq(schema.submission.eventId, plan.eventId));

  const matchedIds = new Set(matched.map((m) => m.id));
  const trackMap = new Map<string, string[]>();
  for (const row of trackRows) {
    if (!matchedIds.has(row.submissionId)) continue;
    const list = trackMap.get(row.submissionId) ?? [];
    list.push(row.trackId);
    trackMap.set(row.submissionId, list);
  }

  return matched.map((row) => ({
    id: row.id,
    ref: formatRef(recordPrefix, row.seq),
    title: row.title,
    trackIds: trackMap.get(row.id) ?? [],
  }));
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
 * plan's own filters_json trackIds. A userId with no rows returns []. */
export async function resolveReviewerSubmissions(
  db: Db,
  plan: PlanRecord,
  userId: string,
): Promise<PlanSubmissionRef[]> {
  const reviewerRows = await db
    .select({ trackId: schema.planReviewer.trackId, submissionId: schema.planReviewer.submissionId })
    .from(schema.planReviewer)
    .where(and(eq(schema.planReviewer.planId, plan.id), eq(schema.planReviewer.userId, userId)));
  if (reviewerRows.length === 0) return [];

  const unrestricted = reviewerRows.some((r) => r.trackId === null && r.submissionId === null);
  const submissionScopes = [
    ...new Set(reviewerRows.filter((r) => r.submissionId !== null).map((r) => r.submissionId as string)),
  ];
  const trackScopes = [...new Set(reviewerRows.filter((r) => r.trackId !== null).map((r) => r.trackId as string))];
  if (!unrestricted && submissionScopes.length === 0 && trackScopes.length === 0) return [];

  const filterTracks = plan.filters?.trackIds;
  const conditions = [eq(schema.submission.eventId, plan.eventId)];

  if (!unrestricted) {
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

  const matched = await db
    .select({ id: schema.submission.id, seq: schema.submission.seq, title: schema.submission.title })
    .from(schema.submission)
    .where(and(...conditions));
  if (matched.length === 0) return [];

  const eventRows = await db
    .select({ recordPrefix: schema.event.recordPrefix })
    .from(schema.event)
    .where(eq(schema.event.id, plan.eventId))
    .limit(1);
  const recordPrefix = eventRows[0]?.recordPrefix ?? "SES";

  // trackIds for the matched (reviewer-scoped, not whole-event) set only,
  // chunked per DEC-078.
  const trackMap = new Map<string, string[]>();
  for (const idChunk of chunkIds(matched.map((m) => m.id))) {
    const trackRows = await db
      .select({ submissionId: schema.submissionTrack.submissionId, trackId: schema.submissionTrack.trackId })
      .from(schema.submissionTrack)
      .where(inArray(schema.submissionTrack.submissionId, idChunk));
    for (const row of trackRows) {
      const list = trackMap.get(row.submissionId) ?? [];
      list.push(row.trackId);
      trackMap.set(row.submissionId, list);
    }
  }

  return matched.map((row) => ({
    id: row.id,
    ref: formatRef(recordPrefix, row.seq),
    title: row.title,
    trackIds: trackMap.get(row.id) ?? [],
  }));
}

/** Targeted per-submission scope check for the reviewer GET/PUT endpoints
 * (DEC-081): no full-set load. Loads only this (plan,user)'s plan_reviewer
 * rows, then does bounded, single-submission-scoped queries. */
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
    return true;
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
  };
}

export interface SpeakerSummary {
  contactId: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string | null;
  title: string | null;
}

export async function listSpeakersForSubmission(db: Db, submissionId: string): Promise<SpeakerSummary[]> {
  const rows = await db
    .select({
      contactId: schema.contact.id,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      email: schema.contact.email,
      company: schema.contact.company,
      title: schema.contact.title,
    })
    .from(schema.participant)
    .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
    .where(eq(schema.participant.submissionId, submissionId));
  return rows;
}

export interface SubmissionAnswerRow {
  fieldId: string;
  section: "session" | "speaker";
  label: string;
  kind: string;
  value: unknown;
}

/** All answers for a submission (custom fields only, per DEC-016), joined to
 * their field def so callers can filter by section. */
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
    .where(eq(schema.submissionAnswer.submissionId, submissionId));
  return rows.map((r) => ({
    fieldId: r.fieldId,
    section: r.section as "session" | "speaker",
    label: r.label,
    kind: r.kind,
    value: JSON.parse(r.valueJson) as unknown,
  }));
}

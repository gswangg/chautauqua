// Review/evaluation repo layer (J4, DEC-018): the only code here that
// touches drizzle row types (DEC-012). Converts to/from the pure
// src/domain/evaluation.ts shapes. Track membership reads ONLY the
// submission_track join, per DEC-017.

import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId } from "../../domain/ids";
import { formatRef } from "../../domain/ids";
import type { EvaluationCriterionDef } from "../../domain/evaluation";
import { resolveAssignments } from "../../domain/evaluation";
import { ApiError } from "../http";
import { chunkIds } from "../../lib/chunk";

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export interface PlanRecord {
  id: string;
  eventId: string;
  name: string;
  instructions: string | null;
  openDate: number | null;
  closeDate: number | null;
  filters: { trackIds?: string[] } | null;
  anonymized: boolean;
  scale: { min: number; max: number };
  criteria: EvaluationCriterionDef[];
  rounds: number;
  currentRound: number;
  // DEC-147: parsed round -> criteria override map (round_criteria_json), or
  // null when the plan has no round-specific overrides. Resolve to an
  // effective criteria list ONLY via src/domain/evaluation.ts's
  // criteriaForRound() -- never re-derive the round-1/fallback logic here.
  roundCriteria: Record<string, EvaluationCriterionDef[]> | null;
  maxEvaluations: number | null;
  createdAt: number;
  updatedAt: number;
}

/** DEC-147: PlanRecord.roundCriteria is already parsed JSON; criteriaForRound
 * takes the raw JSON string, so call sites re-serialize via this helper
 * rather than duplicating the parse/fallback logic. */
export function roundCriteriaJsonOf(plan: PlanRecord): string | null {
  return plan.roundCriteria ? JSON.stringify(plan.roundCriteria) : null;
}

function toPlanRecord(row: typeof schema.evaluationPlan.$inferSelect): PlanRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    instructions: row.instructions,
    openDate: row.openDate ? row.openDate.getTime() : null,
    closeDate: row.closeDate ? row.closeDate.getTime() : null,
    filters: row.filtersJson ? (JSON.parse(row.filtersJson) as { trackIds?: string[] }) : null,
    anonymized: row.anonymized,
    scale: JSON.parse(row.scaleJson) as { min: number; max: number },
    criteria: JSON.parse(row.criteriaJson) as EvaluationCriterionDef[],
    rounds: row.rounds,
    currentRound: row.currentRound,
    roundCriteria: row.roundCriteriaJson
      ? (JSON.parse(row.roundCriteriaJson) as Record<string, EvaluationCriterionDef[]>)
      : null,
    maxEvaluations: row.maxEvaluations,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

export interface PlanInput {
  name: string;
  instructions?: string | null;
  openDate?: number | null;
  closeDate?: number | null;
  filters?: { trackIds?: string[] } | null;
  anonymized: boolean;
  scale: { min: number; max: number };
  criteria: EvaluationCriterionDef[];
  rounds?: number;
  roundCriteria?: Record<string, EvaluationCriterionDef[]> | null;
  maxEvaluations?: number | null;
}

export async function listPlansForEvent(db: Db, eventId: string): Promise<PlanRecord[]> {
  const rows = await db.select().from(schema.evaluationPlan).where(eq(schema.evaluationPlan.eventId, eventId));
  return rows.map(toPlanRecord);
}

export async function createPlan(db: Db, eventId: string, input: PlanInput): Promise<PlanRecord> {
  const now = new Date();
  const id = newId();
  await db.insert(schema.evaluationPlan).values({
    id,
    eventId,
    name: input.name,
    instructions: input.instructions ?? null,
    openDate: input.openDate ? new Date(input.openDate) : null,
    closeDate: input.closeDate ? new Date(input.closeDate) : null,
    filtersJson: input.filters ? JSON.stringify(input.filters) : null,
    anonymized: input.anonymized,
    scaleJson: JSON.stringify(input.scale),
    criteriaJson: JSON.stringify(input.criteria),
    rounds: input.rounds ?? 1,
    roundCriteriaJson: input.roundCriteria ? JSON.stringify(input.roundCriteria) : null,
    maxEvaluations: input.maxEvaluations ?? null,
    createdAt: now,
    updatedAt: now,
  });
  const created = await getPlanById(db, id);
  if (!created) throw new Error("createPlan: insert did not persist");
  return created;
}

export async function getPlanById(db: Db, planId: string): Promise<PlanRecord | null> {
  const rows = await db.select().from(schema.evaluationPlan).where(eq(schema.evaluationPlan.id, planId)).limit(1);
  const row = rows[0];
  return row ? toPlanRecord(row) : null;
}

/** Ownership check: does this plan belong to the given org (via its event)? */
export async function getPlanForOrg(db: Db, planId: string, orgId: string): Promise<PlanRecord | null> {
  const plan = await getPlanById(db, planId);
  if (!plan) return null;
  const eventRows = await db
    .select({ orgId: schema.event.orgId })
    .from(schema.event)
    .where(eq(schema.event.id, plan.eventId))
    .limit(1);
  if (eventRows[0]?.orgId !== orgId) return null;
  return plan;
}

export interface PlanPatch {
  name?: string;
  instructions?: string | null;
  openDate?: number | null;
  closeDate?: number | null;
  filters?: { trackIds?: string[] } | null;
  anonymized?: boolean;
  scale?: { min: number; max: number };
  criteria?: EvaluationCriterionDef[];
  rounds?: number;
  roundCriteria?: Record<string, EvaluationCriterionDef[]> | null;
  maxEvaluations?: number | null;
}

export async function updatePlan(db: Db, planId: string, patch: PlanPatch): Promise<PlanRecord> {
  await db
    .update(schema.evaluationPlan)
    .set({
      name: patch.name,
      instructions: patch.instructions !== undefined ? patch.instructions : undefined,
      openDate: patch.openDate !== undefined ? (patch.openDate === null ? null : new Date(patch.openDate)) : undefined,
      closeDate: patch.closeDate !== undefined ? (patch.closeDate === null ? null : new Date(patch.closeDate)) : undefined,
      filtersJson: patch.filters !== undefined ? (patch.filters ? JSON.stringify(patch.filters) : null) : undefined,
      anonymized: patch.anonymized,
      scaleJson: patch.scale !== undefined ? JSON.stringify(patch.scale) : undefined,
      criteriaJson: patch.criteria !== undefined ? JSON.stringify(patch.criteria) : undefined,
      rounds: patch.rounds,
      roundCriteriaJson:
        patch.roundCriteria !== undefined ? (patch.roundCriteria ? JSON.stringify(patch.roundCriteria) : null) : undefined,
      maxEvaluations: patch.maxEvaluations !== undefined ? patch.maxEvaluations : undefined,
      updatedAt: new Date(),
    })
    .where(eq(schema.evaluationPlan.id, planId));
  const updated = await getPlanById(db, planId);
  if (!updated) throw new Error(`plan ${planId} not found after update`);
  return updated;
}

/** DEC-082: advances the plan's current_round by one, e.g. once round N's
 * evaluations are done and the organizer wants round N+1 opened. Rereads the
 * plan first (never trusts a caller-passed stale record) and refuses to
 * advance past plan.rounds. */
export async function advancePlanRound(db: Db, planId: string): Promise<PlanRecord> {
  const plan = await getPlanById(db, planId);
  if (!plan) throw new ApiError("not_found", "Plan not found");
  if (plan.currentRound >= plan.rounds) {
    throw new ApiError("conflict", `Plan is already at its final round (${plan.rounds})`);
  }
  await db
    .update(schema.evaluationPlan)
    .set({ currentRound: plan.currentRound + 1, updatedAt: new Date() })
    .where(eq(schema.evaluationPlan.id, planId));
  const updated = await getPlanById(db, planId);
  if (!updated) throw new Error(`plan ${planId} not found after round advance`);
  return updated;
}

/** DEC-123: does any evaluation (any round) exist for this plan? Used to
 * guard criteria/scale mutation on PATCH /api/v1/plans/:id -- once an
 * evaluation is recorded, changing the criteria/scale shape would orphan it
 * into a 500ing results surface (aggregateSubmission's fail-loudly throw). */
export async function planHasEvaluations(db: Db, planId: string): Promise<boolean> {
  const rows = await db
    .select({ id: schema.evaluation.id })
    .from(schema.evaluation)
    .where(eq(schema.evaluation.planId, planId))
    .limit(1);
  return rows.length > 0;
}

/** DEC-213: distinct rounds that have at least one recorded evaluation, for
 * the PATCH /api/v1/plans/:id per-round freeze guard -- callers resolve
 * effective criteria (before/after) for each of these rounds rather than
 * treating the whole plan as frozen. */
export async function listRoundsWithEvaluations(db: Db, planId: string): Promise<number[]> {
  const rows = await db
    .selectDistinct({ round: schema.evaluation.round })
    .from(schema.evaluation)
    .where(eq(schema.evaluation.planId, planId));
  return rows.map((r) => r.round);
}

export async function deletePlan(db: Db, planId: string): Promise<void> {
  await db.delete(schema.planReviewer).where(eq(schema.planReviewer.planId, planId));
  await db.delete(schema.evaluation).where(eq(schema.evaluation.planId, planId));
  await db.delete(schema.evaluationPlan).where(eq(schema.evaluationPlan.id, planId));
}

// ---------------------------------------------------------------------------
// Reviewers (plan_reviewer scope rows — DEC-017)
// ---------------------------------------------------------------------------

export interface PlanReviewerRecord {
  id: string;
  planId: string;
  userId: string;
  trackId: string | null;
  submissionId: string | null;
}

function toPlanReviewerRecord(row: typeof schema.planReviewer.$inferSelect): PlanReviewerRecord {
  return {
    id: row.id,
    planId: row.planId,
    userId: row.userId,
    trackId: row.trackId,
    submissionId: row.submissionId,
  };
}

export async function listReviewerRowsForPlan(db: Db, planId: string): Promise<PlanReviewerRecord[]> {
  const rows = await db.select().from(schema.planReviewer).where(eq(schema.planReviewer.planId, planId));
  return rows.map(toPlanReviewerRecord);
}

export async function addReviewer(
  db: Db,
  planId: string,
  input: { userId: string; trackId?: string | null; submissionId?: string | null },
): Promise<PlanReviewerRecord> {
  const now = new Date();
  const id = newId();
  await db.insert(schema.planReviewer).values({
    id,
    planId,
    userId: input.userId,
    trackId: input.trackId ?? null,
    submissionId: input.submissionId ?? null,
    createdAt: now,
    updatedAt: now,
  });
  const rows = await db.select().from(schema.planReviewer).where(eq(schema.planReviewer.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw new Error("addReviewer: insert did not persist");
  return toPlanReviewerRecord(row);
}

/** Looks up a single plan_reviewer row by its own id (DEC-043/044: the
 * reviewer-management API addresses rows by id, not by scope tuple). */
export async function getReviewerRowById(db: Db, reviewerId: string): Promise<PlanReviewerRecord | null> {
  const rows = await db.select().from(schema.planReviewer).where(eq(schema.planReviewer.id, reviewerId)).limit(1);
  const row = rows[0];
  return row ? toPlanReviewerRecord(row) : null;
}

export async function removeReviewerById(db: Db, reviewerId: string): Promise<void> {
  await db.delete(schema.planReviewer).where(eq(schema.planReviewer.id, reviewerId));
}

export async function listPlanIdsForReviewer(db: Db, userId: string): Promise<string[]> {
  const rows = await db
    .select({ planId: schema.planReviewer.planId })
    .from(schema.planReviewer)
    .where(eq(schema.planReviewer.userId, userId));
  return [...new Set(rows.map((r) => r.planId))];
}

// ---------------------------------------------------------------------------
// Submissions in scope
// ---------------------------------------------------------------------------

export interface SubmissionSummary {
  id: string;
  ref: string;
  title: string;
  description: string | null;
  trackIds: string[];
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
export async function listPlanFilteredSubmissions(db: Db, plan: PlanRecord): Promise<SubmissionSummary[]> {
  const eventRows = await db
    .select({ recordPrefix: schema.event.recordPrefix })
    .from(schema.event)
    .where(eq(schema.event.id, plan.eventId))
    .limit(1);
  const recordPrefix = eventRows[0]?.recordPrefix ?? "SES";

  const filterTracks = plan.filters?.trackIds;

  // (a) Matched submissions -- {id, seq, title, description} only.
  let matched: { id: string; seq: number; title: string; description: string | null }[];
  if (filterTracks && filterTracks.length > 0) {
    // filterTracks is organizer-authored plan config (a handful of track
    // ids), not a request-scale id list -- this inArray is exempt from the
    // DEC-078 chunk requirement (bounded to ~25 params in practice).
    matched = await db
      .selectDistinct({
        id: schema.submission.id,
        seq: schema.submission.seq,
        title: schema.submission.title,
        description: schema.submission.description,
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
        description: schema.submission.description,
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
    description: row.description,
    trackIds: trackMap.get(row.id) ?? [],
  }));
}

/** Resolves the submissions a reviewer's plan_reviewer rows grant access to
 * (DEC-017 scope semantics), intersected with the plan's own track filters.
 * One set-based load plus the pure resolveAssignments core (DEC-081). */
export async function resolveReviewerSubmissions(
  db: Db,
  plan: PlanRecord,
  userId: string,
): Promise<SubmissionSummary[]> {
  const all = await listPlanFilteredSubmissions(db, plan);
  const reviewerRows = await listReviewerRowsForPlan(db, plan.id);
  const assignments = resolveAssignments(all, reviewerRows);
  return assignments.get(userId) ?? [];
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

  const submissionScopes = new Set(rows.filter((r) => r.submissionId !== null).map((r) => r.submissionId as string));
  if (submissionScopes.has(submissionId)) return true;

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

// ---------------------------------------------------------------------------
// Evaluations
// ---------------------------------------------------------------------------

export interface EvaluationRecord {
  id: string;
  planId: string;
  submissionId: string;
  reviewerId: string;
  round: number;
  scores: Record<string, number | string>;
  comment: string | null;
}

function toEvaluationRecord(row: typeof schema.evaluation.$inferSelect): EvaluationRecord {
  return {
    id: row.id,
    planId: row.planId,
    submissionId: row.submissionId,
    reviewerId: row.reviewerId,
    round: row.round,
    scores: JSON.parse(row.scoresJson) as Record<string, number | string>,
    comment: row.comment,
  };
}

/** DEC-087: `round` is a required third param -- every call site filters
 * server-side (SQL `where`) rather than loading the whole plan's evaluations
 * across all rounds and filtering in JS. */
export async function listEvaluationsForPlan(db: Db, planId: string, round: number): Promise<EvaluationRecord[]> {
  const rows = await db
    .select()
    .from(schema.evaluation)
    .where(and(eq(schema.evaluation.planId, planId), eq(schema.evaluation.round, round)));
  return rows.map(toEvaluationRecord);
}

export async function getEvaluation(
  db: Db,
  planId: string,
  submissionId: string,
  reviewerId: string,
  round: number,
): Promise<EvaluationRecord | null> {
  const rows = await db
    .select()
    .from(schema.evaluation)
    .where(
      and(
        eq(schema.evaluation.planId, planId),
        eq(schema.evaluation.submissionId, submissionId),
        eq(schema.evaluation.reviewerId, reviewerId),
        eq(schema.evaluation.round, round),
      ),
    )
    .limit(1);
  const row = rows[0];
  return row ? toEvaluationRecord(row) : null;
}

/** Count of evaluations recorded for a submission in a given round (DEC-081):
 * a targeted `count(*)` for the PUT cap check, not a full-plan load. The
 * round param is threaded through now so DEC-082 (multi-round) needs no
 * signature change later. */
export async function countEvaluationsForSubmission(
  db: Db,
  planId: string,
  submissionId: string,
  round: number,
): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.evaluation)
    .where(
      and(
        eq(schema.evaluation.planId, planId),
        eq(schema.evaluation.submissionId, submissionId),
        eq(schema.evaluation.round, round),
      ),
    );
  return Number(rows[0]?.count ?? 0);
}

/** Upserts a reviewer's evaluation for a submission+round (unique per
 * plan+submission+reviewer+round, per DEC-018). */
export async function upsertEvaluation(
  db: Db,
  input: {
    planId: string;
    submissionId: string;
    reviewerId: string;
    round: number;
    scores: Record<string, number | string>;
    comment?: string | null;
  },
): Promise<EvaluationRecord> {
  const existing = await getEvaluation(db, input.planId, input.submissionId, input.reviewerId, input.round);
  const now = new Date();
  if (existing) {
    await db
      .update(schema.evaluation)
      .set({
        scoresJson: JSON.stringify(input.scores),
        comment: input.comment ?? null,
        submittedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.evaluation.id, existing.id));
  } else {
    await db.insert(schema.evaluation).values({
      id: newId(),
      planId: input.planId,
      submissionId: input.submissionId,
      reviewerId: input.reviewerId,
      round: input.round,
      scoresJson: JSON.stringify(input.scores),
      comment: input.comment ?? null,
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }
  const saved = await getEvaluation(db, input.planId, input.submissionId, input.reviewerId, input.round);
  if (!saved) throw new Error("upsertEvaluation: row missing after write");
  return saved;
}

// ---------------------------------------------------------------------------
// Reviewer/user info
// ---------------------------------------------------------------------------

export interface ReviewerUserInfo {
  userId: string;
  email: string;
}

export async function getUsersByIds(db: Db, userIds: string[]): Promise<ReviewerUserInfo[]> {
  if (userIds.length === 0) return [];
  const rows: ReviewerUserInfo[] = [];
  for (const batch of chunkIds(userIds)) {
    const batchRows = await db
      .select({ userId: schema.user.id, email: schema.user.email })
      .from(schema.user)
      .where(inArray(schema.user.id, batch));
    rows.push(...batchRows);
  }
  return rows;
}

/** Confirms the user is a reviewer or organizer in this org, and (for
 * reviewers) resolves their contactId for merge-field rendering; throws
 * not_found rather than leaking existence across orgs. */
export async function requireOrgUser(db: Db, userId: string, orgId: string): Promise<{ role: string; email: string }> {
  const rows = await db
    .select({ role: schema.user.role, email: schema.user.email, orgId: schema.user.orgId })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);
  const row = rows[0];
  if (!row || row.orgId !== orgId) throw new ApiError("not_found", "User not found");
  return { role: row.role, email: row.email };
}

// ---------------------------------------------------------------------------
// Recusal (DEC-271, ABS-12): reviewer conflict-of-interest self-exclusion.
// ---------------------------------------------------------------------------

export interface RecusalRecord {
  id: string;
  planId: string;
  submissionId: string;
  userId: string;
  reason: string | null;
  createdAt: number;
}

function toRecusalRecord(row: typeof schema.reviewRecusal.$inferSelect): RecusalRecord {
  return {
    id: row.id,
    planId: row.planId,
    submissionId: row.submissionId,
    userId: row.userId,
    reason: row.reason,
    createdAt: row.createdAt.getTime(),
  };
}

/** Creates a recusal, or returns the existing row unchanged if one already
 * exists for this (plan, submission, user) -- idempotent per the unique
 * index, so callers can distinguish "created" (201) from "already existed"
 * (200) by comparing the returned row's id/createdAt to a pre-check, or by
 * using hasRecusal first. */
export async function createRecusal(
  db: Db,
  input: { planId: string; submissionId: string; userId: string; reason: string | null },
): Promise<RecusalRecord> {
  const existing = await hasRecusal(db, input.planId, input.submissionId, input.userId);
  if (existing) return existing;
  const now = new Date();
  await db.insert(schema.reviewRecusal).values({
    id: newId(),
    planId: input.planId,
    submissionId: input.submissionId,
    userId: input.userId,
    reason: input.reason,
    createdAt: now,
  });
  const created = await hasRecusal(db, input.planId, input.submissionId, input.userId);
  if (!created) throw new Error("createRecusal: row missing after write");
  return created;
}

export async function deleteRecusal(db: Db, planId: string, submissionId: string, userId: string): Promise<boolean> {
  const existing = await hasRecusal(db, planId, submissionId, userId);
  if (!existing) return false;
  await db
    .delete(schema.reviewRecusal)
    .where(
      and(
        eq(schema.reviewRecusal.planId, planId),
        eq(schema.reviewRecusal.submissionId, submissionId),
        eq(schema.reviewRecusal.userId, userId),
      ),
    );
  return true;
}

export async function hasRecusal(
  db: Db,
  planId: string,
  submissionId: string,
  userId: string,
): Promise<RecusalRecord | null> {
  const rows = await db
    .select()
    .from(schema.reviewRecusal)
    .where(
      and(
        eq(schema.reviewRecusal.planId, planId),
        eq(schema.reviewRecusal.submissionId, submissionId),
        eq(schema.reviewRecusal.userId, userId),
      ),
    )
    .limit(1);
  const row = rows[0];
  return row ? toRecusalRecord(row) : null;
}

/** All of a single reviewer's recusals within a plan -- for queue exclusion
 * and progress `assigned`/`recused` math. */
export async function listRecusalsForReviewer(db: Db, planId: string, userId: string): Promise<RecusalRecord[]> {
  const rows = await db
    .select()
    .from(schema.reviewRecusal)
    .where(and(eq(schema.reviewRecusal.planId, planId), eq(schema.reviewRecusal.userId, userId)));
  return rows.map(toRecusalRecord);
}

/** Every recusal on a plan, across all reviewers -- for the organizer
 * progress endpoint's per-reviewer `recused` counts. */
export async function listRecusalsForPlan(db: Db, planId: string): Promise<RecusalRecord[]> {
  const rows = await db.select().from(schema.reviewRecusal).where(eq(schema.reviewRecusal.planId, planId));
  return rows.map(toRecusalRecord);
}

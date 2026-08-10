// Review/evaluation repo layer (J4, DEC-018): the only code here that
// touches drizzle row types (DEC-012). Converts to/from the pure
// src/domain/evaluation.ts shapes. Track membership reads ONLY the
// submission_track join, per DEC-017.

import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId } from "../../domain/ids";
import { formatRef } from "../../domain/ids";
import type { EvaluationCriterionDef } from "../../domain/evaluation";
import { ApiError } from "../http";

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
  maxEvaluations: number | null;
  createdAt: number;
  updatedAt: number;
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
      maxEvaluations: patch.maxEvaluations !== undefined ? patch.maxEvaluations : undefined,
      updatedAt: new Date(),
    })
    .where(eq(schema.evaluationPlan.id, planId));
  const updated = await getPlanById(db, planId);
  if (!updated) throw new Error(`plan ${planId} not found after update`);
  return updated;
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

/** Removes every plan_reviewer row matching this exact (userId, trackId,
 * submissionId) scope for the plan. */
export async function removeReviewer(
  db: Db,
  planId: string,
  input: { userId: string; trackId?: string | null; submissionId?: string | null },
): Promise<void> {
  const trackId = input.trackId ?? null;
  const submissionId = input.submissionId ?? null;
  const rows = await listReviewerRowsForPlan(db, planId);
  const matches = rows.filter(
    (r) => r.userId === input.userId && r.trackId === trackId && r.submissionId === submissionId,
  );
  for (const match of matches) {
    await db.delete(schema.planReviewer).where(eq(schema.planReviewer.id, match.id));
  }
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

async function submissionTrackIds(db: Db, submissionIds: string[]): Promise<Map<string, string[]>> {
  if (submissionIds.length === 0) return new Map();
  const rows = await db
    .select({ submissionId: schema.submissionTrack.submissionId, trackId: schema.submissionTrack.trackId })
    .from(schema.submissionTrack)
    .where(inArray(schema.submissionTrack.submissionId, submissionIds));
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const list = map.get(row.submissionId) ?? [];
    list.push(row.trackId);
    map.set(row.submissionId, list);
  }
  return map;
}

/** All submissions in the plan's event, optionally narrowed by the plan's
 * filters_json (trackIds) and event record_prefix for ref formatting. */
export async function listPlanFilteredSubmissions(db: Db, plan: PlanRecord): Promise<SubmissionSummary[]> {
  const eventRows = await db
    .select({ recordPrefix: schema.event.recordPrefix })
    .from(schema.event)
    .where(eq(schema.event.id, plan.eventId))
    .limit(1);
  const recordPrefix = eventRows[0]?.recordPrefix ?? "SES";

  const subRows = await db.select().from(schema.submission).where(eq(schema.submission.eventId, plan.eventId));
  const trackMap = await submissionTrackIds(
    db,
    subRows.map((s) => s.id),
  );

  const filterTracks = plan.filters?.trackIds;
  return subRows
    .map((row) => ({
      id: row.id,
      ref: formatRef(recordPrefix, row.seq),
      title: row.title,
      description: row.description,
      trackIds: trackMap.get(row.id) ?? [],
    }))
    .filter((s) => !filterTracks || filterTracks.length === 0 || s.trackIds.some((t) => filterTracks.includes(t)));
}

/** Resolves the union of submission ids a reviewer's plan_reviewer rows
 * grant access to (DEC-017 scope semantics), intersected with the plan's
 * own track filters. */
export async function resolveReviewerSubmissions(
  db: Db,
  plan: PlanRecord,
  userId: string,
): Promise<SubmissionSummary[]> {
  const all = await listPlanFilteredSubmissions(db, plan);
  const reviewerRows = await listReviewerRowsForPlan(db, plan.id);
  const mine = reviewerRows.filter((r) => r.userId === userId);
  if (mine.length === 0) return [];

  const unrestricted = mine.some((r) => r.trackId === null && r.submissionId === null);
  if (unrestricted) return all;

  const trackScopes = new Set(mine.filter((r) => r.trackId !== null).map((r) => r.trackId as string));
  const submissionScopes = new Set(mine.filter((r) => r.submissionId !== null).map((r) => r.submissionId as string));

  return all.filter((s) => submissionScopes.has(s.id) || s.trackIds.some((t) => trackScopes.has(t)));
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
  const trackMap = await submissionTrackIds(db, [submissionId]);
  return {
    id: row.id,
    ref: formatRef(recordPrefix, row.seq),
    title: row.title,
    description: row.description,
    trackIds: trackMap.get(row.id) ?? [],
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

export async function listEvaluationsForPlan(db: Db, planId: string): Promise<EvaluationRecord[]> {
  const rows = await db.select().from(schema.evaluation).where(eq(schema.evaluation.planId, planId));
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
  const rows = await db
    .select({ userId: schema.user.id, email: schema.user.email })
    .from(schema.user)
    .where(inArray(schema.user.id, userIds));
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

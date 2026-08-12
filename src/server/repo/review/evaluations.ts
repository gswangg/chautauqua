// Evaluations (DEC-018): the recorded scores/comments a reviewer submits for
// a submission within a plan round.

import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { newId } from "../../../domain/ids";

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

/** DEC-439/DEC-440: payload-width twin of listEvaluationsForPlan for the
 * results endpoint -- selects only submission_id + scores_json (no id,
 * planId, reviewerId, round, comment, timestamps) since buildResults never
 * reads those columns. Same WHERE as listEvaluationsForPlan. */
export async function listEvaluationScoresForPlan(
  db: Db,
  planId: string,
  round: number,
): Promise<{ submissionId: string; scores: Record<string, number | string> }[]> {
  const rows = await db
    .select({
      submissionId: schema.evaluation.submissionId,
      scoresJson: schema.evaluation.scoresJson,
    })
    .from(schema.evaluation)
    .where(and(eq(schema.evaluation.planId, planId), eq(schema.evaluation.round, round)));
  return rows.map((r) => ({
    submissionId: r.submissionId,
    scores: JSON.parse(r.scoresJson) as Record<string, number | string>,
  }));
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

/** DEC-346/DEC-449: per-submission evaluation counts for a plan+round, via
 * one SQL `count(*) ... group by submission_id` -- replaces loading every
 * evaluation row for the round and reducing in JS (the reviewer queue's
 * prior approach). The plan+round WHERE already scopes the aggregate to a
 * single plan's single round, so this is exactly one D1 round trip
 * regardless of caller slice size; there is no id-list param to chunk
 * (DEC-449: the queue route reads the returned whole-round map only via
 * .get(id) for ids in its own already-scoped set, so this leaks nothing
 * while eliminating the DEC-078 chunking overhead entirely). This is a
 * COUNT, not a score aggregation -- DEC-440 governs aggregateSubmission/
 * aggregateDropdownCriterion only and is unaffected. */
export async function countEvaluationsBySubmission(
  db: Db,
  planId: string,
  round: number,
): Promise<Map<string, number>> {
  const rows = await db
    .select({ submissionId: schema.evaluation.submissionId, count: sql<number>`count(*)` })
    .from(schema.evaluation)
    .where(and(eq(schema.evaluation.planId, planId), eq(schema.evaluation.round, round)))
    .groupBy(schema.evaluation.submissionId);
  const result = new Map<string, number>();
  for (const r of rows) result.set(r.submissionId, Number(r.count));
  return result;
}

/** DEC-346: the set of submission ids a single reviewer has already rated in
 * a plan+round -- a targeted SQL select, not a filter over a full-round
 * evaluation load. */
export async function listSubmissionIdsRatedBy(
  db: Db,
  planId: string,
  round: number,
  reviewerId: string,
): Promise<Set<string>> {
  const rows = await db
    .select({ submissionId: schema.evaluation.submissionId })
    .from(schema.evaluation)
    .where(
      and(
        eq(schema.evaluation.planId, planId),
        eq(schema.evaluation.round, round),
        eq(schema.evaluation.reviewerId, reviewerId),
      ),
    );
  return new Set(rows.map((r) => r.submissionId));
}

/** DEC-351: reviewer+submission pairs completed for a plan+round -- a single
 * select of only reviewerId/submissionId (no scoresJson, no comment, no
 * toEvaluationRecord mapping) for /progress and /remind, which never need
 * scores. */
export async function listCompletedPairsForPlan(
  db: Db,
  planId: string,
  round: number,
): Promise<{ reviewerId: string; submissionId: string }[]> {
  const rows = await db
    .select({
      reviewerId: schema.evaluation.reviewerId,
      submissionId: schema.evaluation.submissionId,
    })
    .from(schema.evaluation)
    .where(and(eq(schema.evaluation.planId, planId), eq(schema.evaluation.round, round)));
  return rows;
}

export interface SubmissionEvaluationRow {
  planId: string;
  planName: string;
  round: number;
  reviewerName: string | null;
  scores: Record<string, number | string>;
  comment: string | null;
  submittedAt: number | null;
}

/** DEC-596: every evaluation recorded for a submission, across every plan it
 * has ever been scored under -- the organiser reads the SAME evaluation the
 * reviewer wrote, joined through evaluation_plan (for name/anonymized) and
 * user -> contact (for the reviewer's display name). reviewerName is null
 * exactly when the OWNING PLAN is anonymized -- decided here, server-side,
 * never left for the renderer to infer from an absent contact. Totally
 * ordered (planName, round, submittedAt, id asc) per DEC-534/558 so a
 * LIMIT-less list still has one deterministic shape. */
export async function listEvaluationsForSubmission(db: Db, submissionId: string): Promise<SubmissionEvaluationRow[]> {
  const rows = await db
    .select({
      planId: schema.evaluation.planId,
      planName: schema.evaluationPlan.name,
      anonymized: schema.evaluationPlan.anonymized,
      round: schema.evaluation.round,
      scoresJson: schema.evaluation.scoresJson,
      comment: schema.evaluation.comment,
      submittedAt: schema.evaluation.submittedAt,
      contactFirstName: schema.contact.firstName,
      contactLastName: schema.contact.lastName,
      userEmail: schema.user.email,
      evaluationId: schema.evaluation.id,
    })
    .from(schema.evaluation)
    .innerJoin(schema.evaluationPlan, eq(schema.evaluation.planId, schema.evaluationPlan.id))
    .innerJoin(schema.user, eq(schema.evaluation.reviewerId, schema.user.id))
    .leftJoin(schema.contact, eq(schema.user.contactId, schema.contact.id))
    .where(eq(schema.evaluation.submissionId, submissionId))
    .orderBy(
      asc(schema.evaluationPlan.name),
      asc(schema.evaluation.round),
      asc(schema.evaluation.submittedAt),
      asc(schema.evaluation.id),
    );

  return rows.map((r) => ({
    planId: r.planId,
    planName: r.planName,
    round: r.round,
    reviewerName: r.anonymized
      ? null
      : (r.contactFirstName && r.contactLastName ? `${r.contactFirstName} ${r.contactLastName}`.trim() : r.userEmail),
    scores: JSON.parse(r.scoresJson) as Record<string, number | string>,
    comment: r.comment,
    submittedAt: r.submittedAt ? r.submittedAt.getTime() : null,
  }));
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
  const now = new Date();
  // DEC-552: one atomic statement -- no read-then-write over the
  // evaluation_plan_submission_reviewer_round_idx uniqueIndex.
  await db
    .insert(schema.evaluation)
    .values({
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
    })
    .onConflictDoUpdate({
      target: [
        schema.evaluation.planId,
        schema.evaluation.submissionId,
        schema.evaluation.reviewerId,
        schema.evaluation.round,
      ],
      set: {
        scoresJson: JSON.stringify(input.scores),
        comment: input.comment ?? null,
        submittedAt: now,
        updatedAt: now,
      },
    });
  const saved = await getEvaluation(db, input.planId, input.submissionId, input.reviewerId, input.round);
  if (!saved) throw new Error("upsertEvaluation: row missing after write");
  return saved;
}

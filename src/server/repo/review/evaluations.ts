// Evaluations (DEC-018): the recorded scores/comments a reviewer submits for
// a submission within a plan round.

import { and, eq, sql } from "drizzle-orm";
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

/** DEC-346: per-submission evaluation counts for a plan+round, via SQL
 * `count(*) ... group by submission_id` -- replaces loading every evaluation
 * row for the round and reducing in JS (the reviewer queue's prior
 * approach). */
export async function countEvaluationsBySubmission(db: Db, planId: string, round: number): Promise<Map<string, number>> {
  const rows = await db
    .select({ submissionId: schema.evaluation.submissionId, count: sql<number>`count(*)` })
    .from(schema.evaluation)
    .where(and(eq(schema.evaluation.planId, planId), eq(schema.evaluation.round, round)))
    .groupBy(schema.evaluation.submissionId);
  return new Map(rows.map((r) => [r.submissionId, Number(r.count)]));
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

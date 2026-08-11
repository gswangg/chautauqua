// Reviewers (plan_reviewer scope rows -- DEC-017): the drizzle-row/domain
// boundary for who is assigned to review what within a plan.

import { eq } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { newId } from "../../../domain/ids";

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

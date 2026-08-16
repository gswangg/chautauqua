// Recusal (DEC-271, ABS-12): reviewer conflict-of-interest self-exclusion.

import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { newId } from "../../../domain/ids";
import { ApiError } from "../../http";
import { MAX_PLAN_EVALUATION_SCAN } from "./evaluations";

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

/** Creates a recusal, or leaves the existing row unchanged if one already
 * exists for this (plan, submission, user) -- DEC-552: one atomic INSERT ...
 * ON CONFLICT DO NOTHING against the uniqueIndex at src/db/schema.ts:376,
 * never a hasRecusal probe before the write. `created` tells the caller
 * whether this call's insert won the race (201) or a prior row already
 * existed (200). */
export async function createRecusal(
  db: Db,
  input: { planId: string; submissionId: string; userId: string; reason: string | null },
): Promise<{ recusal: RecusalRecord; created: boolean }> {
  const now = new Date();
  const inserted = await db
    .insert(schema.reviewRecusal)
    .values({
      id: newId(),
      planId: input.planId,
      submissionId: input.submissionId,
      userId: input.userId,
      reason: input.reason,
      createdAt: now,
    })
    .onConflictDoNothing({
      target: [schema.reviewRecusal.planId, schema.reviewRecusal.submissionId, schema.reviewRecusal.userId],
    })
    .returning({ id: schema.reviewRecusal.id });

  const insertedId = inserted[0]?.id;
  if (insertedId !== undefined) {
    return {
      recusal: {
        id: insertedId,
        planId: input.planId,
        submissionId: input.submissionId,
        userId: input.userId,
        reason: input.reason,
        createdAt: now.getTime(),
      },
      created: true,
    };
  }

  const existing = await hasRecusal(db, input.planId, input.submissionId, input.userId);
  if (!existing) throw new Error("createRecusal: conflict reported but no existing row found");
  return { recusal: existing, created: false };
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
  // DEC-558 wave-5 amendment: review_recusal_plan_submission_user_idx
  // (src/db/schema/review.ts) is a uniqueIndex on exactly this (planId,
  // submissionId, userId) tuple -- at most one row can match.
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
 * progress endpoint's per-reviewer `recused` counts, the distribute
 * preview's existing-coverage math, and the results export's per-submission
 * recusal count. Narrowed to submissionId + userId (DEC-346 amendment, wave
 * 62): every caller (src/routes/review/plans-progress.ts:63,179,
 * src/routes/review/plans-distribute.ts:75, src/routes/review/shared.ts:362)
 * reads only those two columns, never id/reason/createdAt. Totally ordered
 * (submissionId asc, id asc) and capped at MAX_PLAN_EVALUATION_SCAN + 1 --
 * shares evaluations.ts's cap rather than minting a second one, since a
 * plan's recusal count is bounded by the same submissions x reviewers
 * surface; refuses loudly rather than silently truncating once crossed. */
export async function listRecusalsForPlan(
  db: Db,
  planId: string,
): Promise<{ submissionId: string; userId: string }[]> {
  const rows = await db
    .select({
      id: schema.reviewRecusal.id,
      submissionId: schema.reviewRecusal.submissionId,
      userId: schema.reviewRecusal.userId,
    })
    .from(schema.reviewRecusal)
    .where(eq(schema.reviewRecusal.planId, planId))
    .orderBy(asc(schema.reviewRecusal.submissionId), asc(schema.reviewRecusal.id))
    .limit(MAX_PLAN_EVALUATION_SCAN + 1);
  if (rows.length > MAX_PLAN_EVALUATION_SCAN) {
    throw new ApiError(
      "invalid",
      `This plan would scan more than ${MAX_PLAN_EVALUATION_SCAN} evaluations -- narrow the plan's track filter first`,
    );
  }
  return rows.map((r) => ({ submissionId: r.submissionId, userId: r.userId }));
}

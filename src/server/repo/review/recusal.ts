// Recusal (DEC-271, ABS-12): reviewer conflict-of-interest self-exclusion.

import { and, eq } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { newId } from "../../../domain/ids";

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

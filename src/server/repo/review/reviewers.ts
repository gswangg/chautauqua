// Reviewers (plan_reviewer scope rows -- DEC-017): the drizzle-row/domain
// boundary for who is assigned to review what within a plan.

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { formatRef, newId } from "../../../domain/ids";
import { chunkIds, chunkRowsForInsert } from "../../../lib/chunk";
import { ApiError } from "../../http";
import { resolveReviewerScopeTrackId } from "../../../domain/evaluation";

// DEC-439 amendment (wave 62): the ceiling every unbounded plan_reviewer read
// in this module refuses past -- mirrors MAX_PLAN_SUBMISSION_SCAN
// (src/server/repo/review/submissions.ts:21). A pathological-data guard, not
// a functional limit: getReviewerScopeTrackId, listPlanIdsForReviewer, and
// resolveReviewerSubmissions' plan_reviewer read (submissions.ts) all
// `.limit(MAX_REVIEWER_SCOPE_ROWS + 1)` and throw rather than silently
// truncating a reviewer's scope rows once it crosses this.
export const MAX_REVIEWER_SCOPE_ROWS = 20000;

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

/** DEC-460/DEC-461: `page` is optional -- absent means the historical
 * unbounded read every internal (non-HTTP) caller needs (progress/results/
 * remind all load the full reviewer set for a plan). Deterministic order
 * (createdAt asc, id asc tiebreak) so LIMIT/OFFSET pages are stable. */
export async function listReviewerRowsForPlan(
  db: Db,
  planId: string,
  page?: { limit: number; offset: number },
): Promise<PlanReviewerRecord[]> {
  const base = db
    .select()
    .from(schema.planReviewer)
    .where(eq(schema.planReviewer.planId, planId))
    .orderBy(sql`${schema.planReviewer.createdAt} asc, ${schema.planReviewer.id} asc`);
  const rows = page ? await base.limit(page.limit).offset(page.offset) : await base;
  return rows.map(toPlanReviewerRecord);
}

/** Sibling count for listReviewerRowsForPlan's paged route (DEC-461c). */
export async function countReviewerRowsForPlan(db: Db, planId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.planReviewer)
    .where(eq(schema.planReviewer.planId, planId));
  return Number(rows[0]?.count ?? 0);
}

/** DEC-924 (amendment, wave 47): the set-based twin below -- inserts every row from
 * `inputs` (order preserved in the returned array) through
 * chunkRowsForInsert (DEC-528: chunked only for the D1 bound-parameter
 * ceiling, never a per-row insert loop), then ONE select keyed to the newly
 * generated ids. Callers that need all-or-nothing semantics must validate
 * every input BEFORE calling this -- there is no rollback here. */
export async function addReviewers(
  db: Db,
  planId: string,
  inputs: { userId: string; trackId?: string | null; submissionId?: string | null }[],
): Promise<PlanReviewerRecord[]> {
  if (inputs.length === 0) return [];
  const now = new Date();
  const rows = inputs.map((input) => ({
    id: newId(),
    planId,
    userId: input.userId,
    trackId: input.trackId ?? null,
    submissionId: input.submissionId ?? null,
    createdAt: now,
    updatedAt: now,
  }));
  for (const batch of chunkRowsForInsert(rows)) {
    await db.insert(schema.planReviewer).values(batch);
  }
  const ids = rows.map((r) => r.id);
  const inserted: (typeof schema.planReviewer.$inferSelect)[] = [];
  for (const idChunk of chunkIds(ids)) {
    inserted.push(...(await db.select().from(schema.planReviewer).where(inArray(schema.planReviewer.id, idChunk))));
  }
  const byId = new Map(inserted.map((row) => [row.id, toPlanReviewerRecord(row)]));
  return ids.map((id) => {
    const record = byId.get(id);
    if (!record) throw new Error("addReviewers: insert did not persist row " + id);
    return record;
  });
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

/** DEC-659: reviewer assignment scope speaks in names, not ULIDs -- batched
 * label lookups for the GET /plans/:id/reviewers mapper. ONE query over the
 * page's distinct non-null track ids (never a query per row). Ids with no
 * matching row (deleted track) are simply absent from the returned map so
 * the caller can render a "(removed)" label. */
export async function getTrackNamesByIds(db: Db, trackIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (trackIds.length === 0) return map;
  for (const batch of chunkIds(trackIds)) {
    const rows = await db
      .select({ id: schema.track.id, name: schema.track.name })
      .from(schema.track)
      .where(inArray(schema.track.id, batch));
    for (const row of rows) map.set(row.id, row.name);
  }
  return map;
}

export interface SubmissionLabel {
  ref: string;
  title: string;
}

/** DEC-659: ONE query over the page's distinct non-null submission ids,
 * joined to event for the record prefix so `ref` is the same formatRef
 * value POST /reviewers already accepts as input (DEC-623) -- the label the
 * organizer reads is the string they can type back. Ids with no matching
 * row (deleted submission) are absent from the map. */
export async function getSubmissionLabelsByIds(db: Db, submissionIds: string[]): Promise<Map<string, SubmissionLabel>> {
  const map = new Map<string, SubmissionLabel>();
  if (submissionIds.length === 0) return map;
  for (const batch of chunkIds(submissionIds)) {
    const rows = await db
      .select({
        id: schema.submission.id,
        title: schema.submission.title,
        seq: schema.submission.seq,
        recordPrefix: schema.event.recordPrefix,
      })
      .from(schema.submission)
      .innerJoin(schema.event, eq(schema.submission.eventId, schema.event.id))
      .where(inArray(schema.submission.id, batch));
    for (const row of rows) map.set(row.id, { ref: formatRef(row.recordPrefix, row.seq), title: row.title });
  }
  return map;
}

/** DEC-845: the reviewer queue header names the caller's OWN scope track (or
 * "all tracks"), not the plan-wide filters.trackIds. Returns null when the
 * caller has no rows, has any unrestricted row (trackId+submissionId both
 * null), or scopes across more than one distinct track -- all read as "All
 * tracks" rather than naming a single one. */
export async function getReviewerScopeTrackId(db: Db, planId: string, userId: string): Promise<string | null> {
  const rows = await db
    .select({ trackId: schema.planReviewer.trackId, submissionId: schema.planReviewer.submissionId })
    .from(schema.planReviewer)
    .where(and(eq(schema.planReviewer.planId, planId), eq(schema.planReviewer.userId, userId)))
    .orderBy(asc(schema.planReviewer.createdAt), asc(schema.planReviewer.id))
    .limit(MAX_REVIEWER_SCOPE_ROWS + 1);
  if (rows.length > MAX_REVIEWER_SCOPE_ROWS) {
    throw new ApiError(
      "invalid",
      `This reviewer's scope would scan more than ${MAX_REVIEWER_SCOPE_ROWS} plan_reviewer rows -- narrow the reviewer's assignment scope first`,
    );
  }
  return resolveReviewerScopeTrackId(rows);
}

export async function listPlanIdsForReviewer(db: Db, userId: string): Promise<string[]> {
  const rows = await db
    .select({ planId: schema.planReviewer.planId })
    .from(schema.planReviewer)
    .where(eq(schema.planReviewer.userId, userId))
    .orderBy(asc(schema.planReviewer.createdAt), asc(schema.planReviewer.id))
    .limit(MAX_REVIEWER_SCOPE_ROWS + 1);
  if (rows.length > MAX_REVIEWER_SCOPE_ROWS) {
    throw new ApiError(
      "invalid",
      `This reviewer's scope would scan more than ${MAX_REVIEWER_SCOPE_ROWS} plan_reviewer rows -- narrow the reviewer's assignment scope first`,
    );
  }
  return [...new Set(rows.map((r) => r.planId))];
}

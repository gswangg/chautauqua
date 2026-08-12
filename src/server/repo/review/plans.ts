// Evaluation plan repo layer (J4, DEC-018): the only code here that touches
// drizzle row types (DEC-012) for evaluation_plan. Converts to/from the pure
// src/domain/evaluation.ts shapes.

import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { newId } from "../../../domain/ids";
import type { EvaluationCriterionDef } from "../../../domain/evaluation";
import { ApiError } from "../../http";

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

/** DEC-460/DEC-461: `page` is optional -- absent means the historical
 * unbounded read every non-HTTP caller (e.g. files-authz.ts's
 * reviewerCanAccessSubmissionFile, which scans every plan to check
 * anonymized === false) still needs. Deterministic order (createdAt asc,
 * id asc tiebreak) so LIMIT/OFFSET pages are stable. */
export async function listPlansForEvent(
  db: Db,
  eventId: string,
  page?: { limit: number; offset: number },
): Promise<PlanRecord[]> {
  const base = db
    .select()
    .from(schema.evaluationPlan)
    .where(eq(schema.evaluationPlan.eventId, eventId))
    .orderBy(sql`${schema.evaluationPlan.createdAt} asc, ${schema.evaluationPlan.id} asc`);
  const rows = page ? await base.limit(page.limit).offset(page.offset) : await base;
  return rows.map(toPlanRecord);
}

/** Sibling count for listPlansForEvent's paged route (DEC-461c): the true
 * total over the same WHERE, never items.length. */
export async function countPlansForEvent(db: Db, eventId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.evaluationPlan)
    .where(eq(schema.evaluationPlan.eventId, eventId));
  return Number(rows[0]?.count ?? 0);
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

/** DEC-354: bounded existence check used by the reviewer-assignment write
 * path (POST /api/v1/plans/:id/reviewers) to reject a trackId that does
 * not name a track of the plan's own event, before any plan_reviewer row
 * is written. */
export async function trackExistsInEvent(db: Db, trackId: string, eventId: string): Promise<boolean> {
  const rows = await db
    .select({ id: schema.track.id })
    .from(schema.track)
    .where(and(eq(schema.track.id, trackId), eq(schema.track.eventId, eventId)))
    .limit(1);
  return rows.length > 0;
}

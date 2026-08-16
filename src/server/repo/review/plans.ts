// Evaluation plan repo layer (J4, DEC-018): the only code here that touches
// drizzle row types (DEC-012) for evaluation_plan. Converts to/from the pure
// src/domain/evaluation.ts shapes.

import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { newId } from "../../../domain/ids";
import type { EvaluationCriterionDef, RoundMetaEntry } from "../../../domain/evaluation";
import {
  parsePlanScale,
  parsePlanCriteria,
  parsePlanFilters,
  parseRoundCriteria,
  parseRoundMeta,
} from "../../../domain/evaluation/plan-json";
import { ApiError } from "../../http";
import { chunkIds } from "../../../lib/chunk";

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
  // DEC-147 amendment (wave 8, task w8-c): parsed round -> {name?, opensAt?,
  // closesAt?} override map (round_meta_json), or null when the plan has no
  // round-specific naming/window overrides. Resolve ONLY via
  // src/domain/evaluation.ts's roundMetaFor() -- never re-derive the
  // `Round ${n}` / plan-dates fallback here.
  roundMeta: Record<string, RoundMetaEntry> | null;
  maxEvaluations: number | null;
  // DEC-799: when `anonymized` last transitioned false -> true (null if
  // never anonymized, or legitimately switched off since). The ratchet
  // guard counts only evaluations submitted at/after this timestamp.
  anonymizedAt: number | null;
  createdAt: number;
  updatedAt: number;
  // DEC-522: the owning event's IANA timezone, joined in at read time so
  // isPlanOpen's day-label expansion is impossible to call without it (no
  // extra round trip -- every loader already needs the event row for the
  // org-ownership join).
  timezone: string;
}

/** DEC-147: PlanRecord.roundCriteria is already parsed JSON; criteriaForRound
 * takes the raw JSON string, so call sites re-serialize via this helper
 * rather than duplicating the parse/fallback logic. */
export function roundCriteriaJsonOf(plan: PlanRecord): string | null {
  return plan.roundCriteria ? JSON.stringify(plan.roundCriteria) : null;
}

function toPlanRecord(row: typeof schema.evaluationPlan.$inferSelect, timezone: string): PlanRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    instructions: row.instructions,
    openDate: row.openDate ? row.openDate.getTime() : null,
    closeDate: row.closeDate ? row.closeDate.getTime() : null,
    filters: parsePlanFilters(row.filtersJson, row.id),
    anonymized: row.anonymized,
    scale: parsePlanScale(row.scaleJson, row.id),
    criteria: parsePlanCriteria(row.criteriaJson, row.id),
    rounds: row.rounds,
    currentRound: row.currentRound,
    roundCriteria: parseRoundCriteria(row.roundCriteriaJson, row.id),
    // DEC-147 amendment (wave 8, task w8-c; wave 80): the JSON boundary this
    // task's house rule points at -- a malformed round_meta_json throws here
    // via plan-json.ts's parseRoundMeta, which reuses roundMetaFor's own
    // per-field validation rather than duplicating it.
    roundMeta: parseRoundMeta(row.roundMetaJson, row.id),
    maxEvaluations: row.maxEvaluations,
    anonymizedAt: row.anonymizedAt ? row.anonymizedAt.getTime() : null,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
    timezone,
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
  roundMeta?: Record<string, RoundMetaEntry> | null;
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
    .select({ plan: schema.evaluationPlan, timezone: schema.event.timezone })
    .from(schema.evaluationPlan)
    .innerJoin(schema.event, eq(schema.evaluationPlan.eventId, schema.event.id))
    .where(eq(schema.evaluationPlan.eventId, eventId))
    .orderBy(sql`${schema.evaluationPlan.createdAt} asc, ${schema.evaluationPlan.id} asc`);
  const rows = page ? await base.limit(page.limit).offset(page.offset) : await base;
  return rows.map((r) => toPlanRecord(r.plan, r.timezone));
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
    // DEC-799: created already anonymized -> the ratchet's clock starts now.
    anonymizedAt: input.anonymized ? now : null,
    scaleJson: JSON.stringify(input.scale),
    criteriaJson: JSON.stringify(input.criteria),
    rounds: input.rounds ?? 1,
    roundCriteriaJson: input.roundCriteria ? JSON.stringify(input.roundCriteria) : null,
    roundMetaJson: input.roundMeta ? JSON.stringify(input.roundMeta) : null,
    maxEvaluations: input.maxEvaluations ?? null,
    createdAt: now,
    updatedAt: now,
  });
  const created = await getPlanById(db, id);
  if (!created) throw new Error("createPlan: insert did not persist");
  return created;
}

export async function getPlanById(db: Db, planId: string): Promise<PlanRecord | null> {
  const rows = await db
    .select({ plan: schema.evaluationPlan, timezone: schema.event.timezone })
    .from(schema.evaluationPlan)
    .innerJoin(schema.event, eq(schema.evaluationPlan.eventId, schema.event.id))
    .where(eq(schema.evaluationPlan.id, planId))
    .limit(1);
  const row = rows[0];
  return row ? toPlanRecord(row.plan, row.timezone) : null;
}

/** DEC-829 (wave-33 amendment, task w33-b): batch resolve of a page of plan
 * ids for the reviewer landing screen (GET /api/v1/review/plans) -- replaces
 * a Promise.all(ids.map(getPlanById)) fan-out (up to MAX_PER_PAGE=200
 * statements) with one chunked `inArray` per ID_CHUNK_SIZE batch (see
 * src/lib/chunk.ts). Returns rows in the INPUT id order, with any id that
 * does not resolve to a plan silently omitted (mirroring the fan-out's prior
 * `.filter(p => p !== null)` behavior). */
export async function listPlansByIds(db: Db, planIds: string[]): Promise<PlanRecord[]> {
  const byId = new Map<string, PlanRecord>();
  for (const chunk of chunkIds(planIds)) {
    if (chunk.length === 0) continue;
    const rows = await db
      .select({ plan: schema.evaluationPlan, timezone: schema.event.timezone })
      .from(schema.evaluationPlan)
      .innerJoin(schema.event, eq(schema.evaluationPlan.eventId, schema.event.id))
      .where(inArray(schema.evaluationPlan.id, chunk));
    for (const row of rows) {
      byId.set(row.plan.id, toPlanRecord(row.plan, row.timezone));
    }
  }
  const out: PlanRecord[] = [];
  for (const id of planIds) {
    const plan = byId.get(id);
    if (plan) out.push(plan);
  }
  return out;
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
  roundMeta?: Record<string, RoundMetaEntry> | null;
  maxEvaluations?: number | null;
}

export async function updatePlan(db: Db, planId: string, patch: PlanPatch): Promise<PlanRecord> {
  // DEC-799: anonymizedAt tracks when `anonymized` last flipped false -> true
  // (the ratchet's clock start); it clears to null when anonymity is
  // legitimately switched off. Rereads the current row first (never trusts a
  // caller-passed stale record, mirroring advancePlanRound) so the
  // transition is detected against the true stored value, not the patch.
  let anonymizedAtPatch: Date | null | undefined;
  if (patch.anonymized !== undefined) {
    const current = await getPlanById(db, planId);
    if (!current) throw new ApiError("not_found", "Plan not found");
    if (patch.anonymized && !current.anonymized) {
      anonymizedAtPatch = new Date();
    } else if (!patch.anonymized && current.anonymized) {
      anonymizedAtPatch = null;
    }
  }
  await db
    .update(schema.evaluationPlan)
    .set({
      name: patch.name,
      instructions: patch.instructions !== undefined ? patch.instructions : undefined,
      openDate: patch.openDate !== undefined ? (patch.openDate === null ? null : new Date(patch.openDate)) : undefined,
      closeDate: patch.closeDate !== undefined ? (patch.closeDate === null ? null : new Date(patch.closeDate)) : undefined,
      filtersJson: patch.filters !== undefined ? (patch.filters ? JSON.stringify(patch.filters) : null) : undefined,
      anonymized: patch.anonymized,
      anonymizedAt: anonymizedAtPatch,
      scaleJson: patch.scale !== undefined ? JSON.stringify(patch.scale) : undefined,
      criteriaJson: patch.criteria !== undefined ? JSON.stringify(patch.criteria) : undefined,
      rounds: patch.rounds,
      roundCriteriaJson:
        patch.roundCriteria !== undefined ? (patch.roundCriteria ? JSON.stringify(patch.roundCriteria) : null) : undefined,
      roundMetaJson:
        patch.roundMeta !== undefined ? (patch.roundMeta ? JSON.stringify(patch.roundMeta) : null) : undefined,
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
  // DEC-558 wave-5 amendment: only `.length > 0` is read below -- WHICH
  // evaluation row SQLite returns is never observed, but .orderBy(...) is
  // added anyway so the pick is reproducible.
  const rows = await db
    .select({ id: schema.evaluation.id })
    .from(schema.evaluation)
    .where(eq(schema.evaluation.planId, planId))
    .orderBy(asc(schema.evaluation.id))
    .limit(1);
  return rows.length > 0;
}

/** DEC-624/DEC-799: count of SUBMITTED evaluations (submitted_at not null) on
 * this plan -- the ratchet guard for PATCH /api/v1/plans/:id turning
 * anonymized off. Draft (unsubmitted) evaluations don't count -- only a
 * submitted evaluation was actually recorded under the plan's anonymity
 * promise. When `sinceMs` is given (the plan's anonymizedAt), only
 * evaluations submitted at/after that timestamp count -- evaluations
 * submitted BEFORE anonymity was enabled were never made under an anonymity
 * promise and must not lock the plan into permanent anonymity. */
export async function countSubmittedEvaluationsForPlan(db: Db, planId: string, sinceMs?: number): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.evaluation)
    .where(
      and(
        eq(schema.evaluation.planId, planId),
        sql`${schema.evaluation.submittedAt} is not null`,
        sinceMs !== undefined ? gte(schema.evaluation.submittedAt, new Date(sinceMs)) : undefined,
      ),
    );
  return Number(rows[0]?.count ?? 0);
}

/** DEC-709: count of SUBMITTED evaluations for one specific round -- the
 * gate for POST /api/v1/plans/:id/waves: a wave only opens a fresh round
 * when the round it freezes actually froze something (a submitted score),
 * mirroring DEC-624's submitted-only ratchet rather than DEC-123's
 * any-evaluation-including-drafts guard. */
export async function countSubmittedEvaluationsForRound(db: Db, planId: string, round: number): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.evaluation)
    .where(
      and(
        eq(schema.evaluation.planId, planId),
        eq(schema.evaluation.round, round),
        sql`${schema.evaluation.submittedAt} is not null`,
      ),
    );
  return Number(rows[0]?.count ?? 0);
}

/** DEC-709: atomically opens a new wave -- rounds/currentRound both advance
 * to the new round number and roundCriteria carries the frozen round's
 * criteria forward as that new round's editable override, in one UPDATE
 * (read-then-write would race a concurrent evaluation submit into the very
 * round being frozen). */
export async function startNewWave(
  db: Db,
  planId: string,
  input: { newRound: number; roundCriteria: Record<string, EvaluationCriterionDef[]> },
): Promise<PlanRecord> {
  await db
    .update(schema.evaluationPlan)
    .set({
      rounds: input.newRound,
      currentRound: input.newRound,
      roundCriteriaJson: JSON.stringify(input.roundCriteria),
      updatedAt: new Date(),
    })
    .where(eq(schema.evaluationPlan.id, planId));
  const updated = await getPlanById(db, planId);
  if (!updated) throw new Error(`plan ${planId} not found after starting a new wave`);
  return updated;
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

/** DEC-676: recorded-evaluation count per round, keyed by round number as a
 * string -- surfaces DEC-213's existing server-side freeze in the plan
 * editor UI (a locked round names its own count) without the SPA
 * re-deriving listRoundsWithEvaluations' rule itself. */
export async function countEvaluationsByRound(db: Db, planId: string): Promise<Record<string, number>> {
  const rows = await db
    .select({ round: schema.evaluation.round, count: sql<number>`count(*)` })
    .from(schema.evaluation)
    .where(eq(schema.evaluation.planId, planId))
    .groupBy(schema.evaluation.round);
  const out: Record<string, number> = {};
  for (const r of rows) out[String(r.round)] = Number(r.count);
  return out;
}

export interface PlanDeleteImpact {
  reviewers: number;
  evaluationsSubmitted: number;
  evaluationsDraft: number;
  recusals: number;
}

/** DEC-929: plan deletion names what it destroys -- feeds the DELETE
 * confirmation dialog's prose. One grouped/aggregate query per table (never
 * a per-reviewer scan): distinct reviewer count from plan_reviewer,
 * submitted-vs-draft split from evaluation in a single grouped query, and a
 * plain count from review_recusal. */
export async function countPlanDeleteImpact(db: Db, planId: string): Promise<PlanDeleteImpact> {
  const [reviewerRows, evalRows, recusalRows] = await Promise.all([
    db
      .select({ count: sql<number>`count(distinct ${schema.planReviewer.userId})` })
      .from(schema.planReviewer)
      .where(eq(schema.planReviewer.planId, planId)),
    db
      .select({
        submitted: sql<number>`count(case when ${schema.evaluation.submittedAt} is not null then 1 end)`,
        draft: sql<number>`count(case when ${schema.evaluation.submittedAt} is null then 1 end)`,
      })
      .from(schema.evaluation)
      .where(eq(schema.evaluation.planId, planId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.reviewRecusal)
      .where(eq(schema.reviewRecusal.planId, planId)),
  ]);
  return {
    reviewers: Number(reviewerRows[0]?.count ?? 0),
    evaluationsSubmitted: Number(evalRows[0]?.submitted ?? 0),
    evaluationsDraft: Number(evalRows[0]?.draft ?? 0),
    recusals: Number(recusalRows[0]?.count ?? 0),
  };
}

/** DEC-929: deletes every row this plan owns across its four tables --
 * plan_reviewer (assignments), evaluation (scores), review_recusal
 * (conflict-of-interest opt-outs), and finally the evaluation_plan row
 * itself. Matches countPlanDeleteImpact's tally exactly so the confirm
 * dialog's numbers are never a lie about what this actually deletes. */
export async function deletePlan(db: Db, planId: string): Promise<void> {
  await db.delete(schema.planReviewer).where(eq(schema.planReviewer.planId, planId));
  await db.delete(schema.evaluation).where(eq(schema.evaluation.planId, planId));
  await db.delete(schema.reviewRecusal).where(eq(schema.reviewRecusal.planId, planId));
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

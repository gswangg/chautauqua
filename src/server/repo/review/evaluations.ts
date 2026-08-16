// Evaluations (DEC-018): the recorded scores/comments a reviewer submits for
// a submission within a plan round.

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { newId } from "../../../domain/ids";
import { resolveReviewerIdentity } from "../../../domain/review-identity";
import type { EvaluationCriterionDef } from "../../../domain/evaluation";
import { parsePlanCriteria, parsePlanScale } from "../../../domain/evaluation/plan-json";
import { parseEvaluationScoresJson } from "../../../domain/evaluation/scores-json";
import { ApiError } from "../../http";
import { chunkIds } from "../../../lib/chunk";
import { MAX_PLAN_SUBMISSION_SCAN } from "./submissions";

// DEC-346 amendment (wave 62): the ceiling listEvaluationScoresForPlan's
// scan refuses past -- mirrors MAX_PLAN_SUBMISSION_SCAN
// (src/server/repo/review/submissions.ts:21), but set higher because
// evaluations are submissions x reviewers (every submission can carry more
// than one evaluation row, one per assigned reviewer), so the same plan
// scans a strictly larger evaluation table than submission table.
export const MAX_PLAN_EVALUATION_SCAN = 50000;

// DEC-873 (wave 46 amendment): the ONE submitted-evaluation predicate every
// read side outside the draft's own resume read (getEvaluation) must carry
// in its WHERE -- a draft (submittedAt null) is not yet a recorded
// evaluation, so it must never count toward a cap, an aggregate, an
// "already rated" set, a queue's myScore, or the organiser's evaluations
// list. Previously inlined ad hoc at two call sites (results computation,
// progress pairs) while five siblings had no predicate at all -- see wave 46
// FINDINGS.
export function submittedEvaluationCondition() {
  return sql`${schema.evaluation.submittedAt} is not null`;
}

export interface EvaluationRecord {
  id: string;
  planId: string;
  submissionId: string;
  reviewerId: string;
  round: number;
  scores: Record<string, number | string>;
  comment: string | null;
  // DEC-873 (wave 27 amendment): null means this row is a draft -- only the
  // write stamps it, every read side treats null as "not yet submitted".
  submittedAt: number | null;
}

function toEvaluationRecord(row: typeof schema.evaluation.$inferSelect): EvaluationRecord {
  return {
    id: row.id,
    planId: row.planId,
    submissionId: row.submissionId,
    reviewerId: row.reviewerId,
    round: row.round,
    scores: parseEvaluationScoresJson(row.scoresJson, row.id),
    comment: row.comment,
    submittedAt: row.submittedAt ? row.submittedAt.getTime() : null,
  };
}

/** DEC-439/DEC-440: payload-width twin of the plan+round evaluation read for
 * the results endpoint -- selects only submission_id + scores_json (no id,
 * planId, reviewerId, round, comment, timestamps) since buildResults never
 * reads those columns. DEC-346 amendment (wave 62): totally ordered
 * (submissionId asc, id asc) and capped at MAX_PLAN_EVALUATION_SCAN + 1 --
 * refuses loudly rather than silently truncating once a plan's evaluation
 * count crosses the cap. */
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
    .where(
      and(
        eq(schema.evaluation.planId, planId),
        eq(schema.evaluation.round, round),
        // DEC-873 (wave 27 amendment): a draft (submittedAt null) never
        // enters the results/weighted-mean computation -- only a submitted
        // evaluation was actually recorded.
        submittedEvaluationCondition(),
      ),
    )
    .orderBy(asc(schema.evaluation.submissionId), asc(schema.evaluation.id))
    .limit(MAX_PLAN_EVALUATION_SCAN + 1);
  if (rows.length > MAX_PLAN_EVALUATION_SCAN) {
    throw new ApiError(
      "invalid",
      `This plan would scan more than ${MAX_PLAN_EVALUATION_SCAN} evaluations -- narrow the plan's track filter first`,
    );
  }
  return rows.map((r) => ({
    submissionId: r.submissionId,
    scores: parseEvaluationScoresJson(r.scoresJson, r.submissionId),
  }));
}

/** DEC-873 (wave 46 amendment): draft-inclusive by design -- this is the
 * one exception to submittedEvaluationCondition(). It is the reviewer's own
 * draft resume read (the PUT form loads whatever the reviewer last saved,
 * submitted or not) AND the source of the already-submitted guard at
 * reviewer.ts:356 (a route must read the row's own submittedAt to decide
 * whether a further draft write is refused). No other reader may reuse this
 * function's draft-inclusive result for a cap, aggregate, or list. */
export async function getEvaluation(
  db: Db,
  planId: string,
  submissionId: string,
  reviewerId: string,
  round: number,
): Promise<EvaluationRecord | null> {
  // DEC-558 wave-5 amendment: evaluation_plan_submission_reviewer_round_idx
  // (src/db/schema/review.ts) is a uniqueIndex on exactly this (planId,
  // submissionId, reviewerId, round) tuple -- at most one row can match.
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
        // DEC-873 (wave 46 amendment): another reviewer's unsubmitted
        // draft must never count against maxEvaluations -- the cap check
        // at reviewer.ts:361 counts recorded evaluations, not drafts.
        submittedEvaluationCondition(),
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
 * aggregateDropdownCriterion only and is unaffected.
 *
 * The `GROUP BY submission_id` means each returned row is one SUBMISSION,
 * not one evaluation row, so this scan is bounded by
 * MAX_PLAN_SUBMISSION_SCAN (mirroring listSubmissionsForPlan's cap on the
 * same population), not MAX_PLAN_EVALUATION_SCAN -- that constant bounds
 * ungrouped evaluation-row scans elsewhere in this file (evaluations are
 * submissions x reviewers, so it is deliberately set higher and would never
 * fire here, silently disabling the guard).
 *
 * DEC-829 (wave-29 amendment, applied to review by task w29-e; refined
 * wave-39 by task w39-d): `submissionIds` is an OPTIONAL id-scoped
 * narrowing. The reviewer queue (its one production caller with a natural
 * scope) passes its own resolveReviewerSubmissions-resolved ids. When those
 * ids fit in a SINGLE chunkIds batch (<= ID_CHUNK_SIZE), the driving
 * relation is this reviewer's own already-scoped set, never the plan's
 * whole population, matching DEC-829's "driving relation is the
 * already-scoped set, never a wider table" ruling -- one scoped GROUP BY.
 * When the ids span MORE than one batch (an unrestricted reviewer's scope
 * can be ~2000 ids, ~23 batches), chunking degenerates into a fan-out over
 * what is effectively the plan's whole population again; in that case this
 * falls through to the single unscoped plan+round GROUP BY below instead
 * (one round trip regardless of scope size), since the queue reads the
 * returned whole-round map only via .get(id) for ids in its own
 * already-scoped set, leaking nothing. Every other/whole-plan caller omits
 * the param entirely and always gets the unscoped GROUP BY, unchanged
 * (locked by test/review-repo-aggregates.test.ts's 2-arg contract). */
export async function countEvaluationsBySubmission(
  db: Db,
  planId: string,
  round: number,
  submissionIds?: string[],
): Promise<Map<string, number>> {
  if (submissionIds !== undefined) {
    const result = new Map<string, number>();
    if (submissionIds.length === 0) return result;
    const idBatches = chunkIds(submissionIds);
    // DEC-829 (wave-39 amendment): when the id-scoped narrowing would still
    // span MORE THAN ONE chunkIds batch (~2000 ids for an unrestricted
    // reviewer is ~23 GROUP BY statements), that's no longer "the
    // already-scoped set" -- it's the plan's whole population back again,
    // just chunked. Fall through to the single unscoped plan+round GROUP BY
    // below instead: its docstring already blesses the whole-round map as
    // leaking nothing, since every caller (the reviewer queue included)
    // reads it only via .get(id) over its own scoped set.
    if (idBatches.length > 1) {
      submissionIds = undefined;
    } else {
      const batch = idBatches[0];
      if (!batch) throw new Error("countEvaluationsBySubmission: unreachable -- non-empty ids with no batch");
      const rows = await db
        .select({ submissionId: schema.evaluation.submissionId, count: sql<number>`count(*)` })
        .from(schema.evaluation)
        .where(
          and(
            eq(schema.evaluation.planId, planId),
            eq(schema.evaluation.round, round),
            inArray(schema.evaluation.submissionId, batch),
            submittedEvaluationCondition(),
          ),
        )
        .groupBy(schema.evaluation.submissionId);
      for (const r of rows) result.set(r.submissionId, Number(r.count));
      return result;
    }
  }
  const rows = await db
    .select({ submissionId: schema.evaluation.submissionId, count: sql<number>`count(*)` })
    .from(schema.evaluation)
    .where(
      and(
        eq(schema.evaluation.planId, planId),
        eq(schema.evaluation.round, round),
        // DEC-873 (wave 46 amendment): a draft must not inflate
        // ratingsCount nor pull a submission out of needsMoreRatings (J4
        // fewest-ratings-first) before it is actually recorded.
        submittedEvaluationCondition(),
      ),
    )
    .groupBy(schema.evaluation.submissionId)
    .limit(MAX_PLAN_SUBMISSION_SCAN + 1);
  if (rows.length > MAX_PLAN_SUBMISSION_SCAN) {
    throw new ApiError(
      "invalid",
      `This plan would scan more than ${MAX_PLAN_SUBMISSION_SCAN} submissions -- narrow the plan's track filter first`,
    );
  }
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
        // DEC-873 (wave 46 amendment): a reviewer's own unsubmitted draft
        // must not mark that submission as already-rated.
        submittedEvaluationCondition(),
      ),
    );
  return new Set(rows.map((r) => r.submissionId));
}

/** DEC-831: this reviewer's own scores for a plan round, keyed by
 * submissionId -- read beside listSubmissionIdsRatedBy (same WHERE shape)
 * rather than a second pass over listEvaluationScoresForPlan, so the reviewer
 * queue's myScore column shares one query per reviewer per round.
 * DEC-346 amendment (wave 81): this was the only scores read in the module
 * with no ceiling -- its two siblings (listEvaluationScoresForPlan,
 * listEvaluatedPairsForPlan) already refuse loudly at
 * MAX_PLAN_EVALUATION_SCAN + 1 rather than silently truncating; this read is
 * scoped to a single reviewer within a single plan+round, so the same cap
 * (and the same total order) is a conservative, never-firing-in-practice
 * ceiling for that scope, not a new behavioral limit. */
export async function listEvaluationScoresForReviewer(
  db: Db,
  planId: string,
  round: number,
  reviewerId: string,
): Promise<Map<string, Record<string, number | string>>> {
  const rows = await db
    .select({
      submissionId: schema.evaluation.submissionId,
      scoresJson: schema.evaluation.scoresJson,
    })
    .from(schema.evaluation)
    .where(
      and(
        eq(schema.evaluation.planId, planId),
        eq(schema.evaluation.round, round),
        eq(schema.evaluation.reviewerId, reviewerId),
        // DEC-873 (wave 46 amendment): the queue's myScore must never be
        // read from a partial, unsubmitted draft.
        submittedEvaluationCondition(),
      ),
    )
    .orderBy(asc(schema.evaluation.submissionId), asc(schema.evaluation.id))
    .limit(MAX_PLAN_EVALUATION_SCAN + 1);
  if (rows.length > MAX_PLAN_EVALUATION_SCAN) {
    throw new ApiError(
      "invalid",
      `This plan would scan more than ${MAX_PLAN_EVALUATION_SCAN} evaluations -- narrow the plan's track filter first`,
    );
  }
  return new Map(
    rows.map((r) => [r.submissionId, parseEvaluationScoresJson(r.scoresJson, r.submissionId)]),
  );
}

/** DEC-707 (wave-3 amendment): every (reviewerId, submissionId) evaluated
 * pair for a plan+round, one query -- the /progress and /remind routes fold
 * this against each reviewer's OWN resolved-assigned submission set so
 * `completed` can never exceed `assigned` (the '37 of 34' bug: the prior
 * countCompletedByReviewerForPlan counted every evaluation row regardless of
 * whether the submission was still in that reviewer's scope). Mirrors
 * listEvaluationScoresForPlan's shape (submissionId + reviewerId only).
 * DEC-346 amendment (wave 66): this is the SAME plan+round,
 * submittedEvaluationCondition() WHERE as listEvaluationScoresForPlan, so it
 * gets the same treatment -- totally ordered (submissionId asc, id asc) and
 * capped at MAX_PLAN_EVALUATION_SCAN + 1, refusing loudly rather than
 * pulling an unbounded plan-wide evaluation table into the isolate. */
export async function listEvaluatedPairsForPlan(
  db: Db,
  planId: string,
  round: number,
): Promise<{ reviewerId: string; submissionId: string }[]> {
  const rows = await db
    .select({
      reviewerId: schema.evaluation.reviewerId,
      submissionId: schema.evaluation.submissionId,
      id: schema.evaluation.id,
    })
    .from(schema.evaluation)
    .where(
      and(
        eq(schema.evaluation.planId, planId),
        eq(schema.evaluation.round, round),
        // DEC-873 (wave 27 amendment): a draft never counts toward
        // progress's `completed` -- only a submitted evaluation is a
        // recorded pair.
        submittedEvaluationCondition(),
      ),
    )
    .orderBy(asc(schema.evaluation.submissionId), asc(schema.evaluation.id))
    .limit(MAX_PLAN_EVALUATION_SCAN + 1);
  if (rows.length > MAX_PLAN_EVALUATION_SCAN) {
    throw new ApiError(
      "invalid",
      `This plan would scan more than ${MAX_PLAN_EVALUATION_SCAN} evaluations -- narrow the plan's track filter first`,
    );
  }
  return rows.map((r) => ({ reviewerId: r.reviewerId, submissionId: r.submissionId }));
}

export interface SubmissionEvaluationRow {
  planId: string;
  planName: string;
  round: number;
  reviewerName: string;
  scores: Record<string, number | string>;
  comment: string | null;
  submittedAt: number | null;
}

/** DEC-596/DEC-736: every evaluation recorded for a submission, across every
 * plan it has ever been scored under -- the organiser reads the SAME
 * evaluation the reviewer wrote, joined through evaluation_plan (for name)
 * and user -> contact (for the reviewer's display name). The organiser is
 * always told who reviewed -- anonymization (DEC-736) hides the speaker
 * from the reviewer, never the reviewer's identity from the organiser.
 * Totally ordered (planName, round, submittedAt, id asc) per DEC-534/558 so
 * a LIMIT-less list still has one deterministic shape. */
export async function listEvaluationsForSubmission(
  db: Db,
  submissionId: string,
  planId?: string,
): Promise<SubmissionEvaluationRow[]> {
  const rows = await db
    .select({
      planId: schema.evaluation.planId,
      planName: schema.evaluationPlan.name,
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
    .where(
      // DEC-873 (wave 46 amendment): the organiser's Reviews section shows
      // only recorded evaluations -- a reviewer's draft-in-progress is not
      // yet visible to the organiser.
      planId
        ? and(
            eq(schema.evaluation.submissionId, submissionId),
            eq(schema.evaluation.planId, planId),
            submittedEvaluationCondition(),
          )
        : and(eq(schema.evaluation.submissionId, submissionId), submittedEvaluationCondition()),
    )
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
    reviewerName: resolveReviewerIdentity({
      firstName: r.contactFirstName,
      lastName: r.contactLastName,
      email: r.userEmail,
    }),
    scores: parseEvaluationScoresJson(r.scoresJson, r.evaluationId),
    comment: r.comment,
    submittedAt: r.submittedAt ? r.submittedAt.getTime() : null,
  }));
}

export interface PlanCriteriaInfo {
  criteria: EvaluationCriterionDef[];
  roundCriteriaJson: string | null;
  scale: { min: number; max: number };
}

/** DEC-723: batched plan lookup for an evaluations-for-submission read --
 * one `IN (...)` query over the DISTINCT planIds in the row set, never a
 * per-row plan fetch. Callers resolve each row's own round through
 * criteriaForRound(info.criteria, info.roundCriteriaJson, row.round). */
export async function listPlanCriteriaByIds(db: Db, planIds: string[]): Promise<Map<string, PlanCriteriaInfo>> {
  if (planIds.length === 0) return new Map();
  const rows = await db
    .select({
      id: schema.evaluationPlan.id,
      criteriaJson: schema.evaluationPlan.criteriaJson,
      roundCriteriaJson: schema.evaluationPlan.roundCriteriaJson,
      scaleJson: schema.evaluationPlan.scaleJson,
    })
    .from(schema.evaluationPlan)
    .where(inArray(schema.evaluationPlan.id, planIds));
  const result = new Map<string, PlanCriteriaInfo>();
  for (const r of rows) {
    result.set(r.id, {
      criteria: parsePlanCriteria(r.criteriaJson, r.id),
      roundCriteriaJson: r.roundCriteriaJson,
      scale: parsePlanScale(r.scaleJson, r.id),
    });
  }
  return result;
}

/** Upserts a reviewer's evaluation for a submission+round (unique per
 * plan+submission+reviewer+round, per DEC-018). DEC-873 (wave 27
 * amendment): `draft` (default false) decides whether this write stamps
 * submittedAt or clears it -- a draft row's submittedAt is always null, a
 * non-draft row's is always the write's own timestamp. Callers must have
 * already refused a draft write against a row that is already submitted
 * (see the route) -- this function itself trusts its caller and always
 * writes what it's given. */
export async function upsertEvaluation(
  db: Db,
  input: {
    planId: string;
    submissionId: string;
    reviewerId: string;
    round: number;
    scores: Record<string, number | string>;
    comment?: string | null;
    draft?: boolean;
  },
): Promise<EvaluationRecord> {
  const now = new Date();
  const submittedAt = input.draft ? null : now;
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
      submittedAt,
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
        submittedAt,
        updatedAt: now,
      },
    });
  const saved = await getEvaluation(db, input.planId, input.submissionId, input.reviewerId, input.round);
  if (!saved) throw new Error("upsertEvaluation: row missing after write");
  return saved;
}

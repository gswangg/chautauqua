// evaluations export (J12, DEC-027, DEC-529).

import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { formatRef } from "../../../domain/ids";
import { computeWeightedScore, criteriaForRound, type EvaluationCriterionDef } from "../../../domain/evaluation";
import { DEC_529, DEC_147, DEC_736 } from "../../../decisions";
import { ApiError } from "../../http";
import { resolveReviewerIdentity } from "../../../domain/review-identity";
import { submittedEvaluationCondition } from "../review/evaluations";
import { type ExportTable, EXPORT_MAX_ROWS, buildTable, nameCustomColumns } from "./table";
import { getRecordPrefix } from "./common";

// exportEvaluations below: labelled per-criterion columns + weightedScore,
// derived from the union of score keys present, replacing scoresJson.
void DEC_529;
// DEC-147 (wave 79 amendment): weightedScore resolves per (planId, round)
// through criteriaForRound -- the same door every screen uses -- instead of
// a per-plan-only criteria map, so a round override changes the export's
// arithmetic exactly the way it changes /plans/:id/results'.
void DEC_147;
// DEC-736 (wave 79 amendment): the export joins contact the same way the
// screen does and passes resolveReviewerIdentity the same row shape, so the
// two surfaces can only ever print the same name or the same email
// fallback. The fixed column is named "reviewer", not "reviewerEmail".
void DEC_736;

// DEC-529: label lookup for a plan's criteria -- walks the plan's own
// criteria_json array plus every array value of the parsed
// round_criteria_json override map (DEC-147's `{"<round>": Criterion[]}`
// shape), so a round-override-only criterion id still resolves a label.
// Malformed/empty JSON is tolerated (fail-loudly is for writes; an export
// reading possibly-legacy history must not 500 over a display label).
export function labelByCriterionId(criteriaJson: string, roundCriteriaJson: string | null): Map<string, string> {
  const labels = new Map<string, string>();
  const addAll = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const c of list) {
      if (c && typeof c === "object" && typeof (c as { id?: unknown }).id === "string" && typeof (c as { label?: unknown }).label === "string") {
        labels.set((c as { id: string }).id, (c as { label: string }).label);
      }
    }
  };
  try {
    addAll(JSON.parse(criteriaJson));
  } catch {
    /* legacy/malformed data: no base labels resolved */
  }
  if (roundCriteriaJson) {
    try {
      const overrides = JSON.parse(roundCriteriaJson);
      if (overrides && typeof overrides === "object") {
        for (const value of Object.values(overrides)) addAll(value);
      }
    } catch {
      /* legacy/malformed data: no override labels resolved */
    }
  }
  return labels;
}

interface EvaluationExportRow {
  planId: string;
  planName: string;
  ref: string;
  title: string;
  reviewer: string;
  round: number;
  scores: Record<string, unknown>;
  weightedScore: string;
  comment: string;
  submittedAt: string;
}

/** One dynamic score column, keyed by (planId, criterionId) so two plans'
 * same-labelled criteria never merge into one column. */
interface EvaluationScoreColumn {
  planId: string;
  criterionId: string;
  label: string;
}

const EVALUATIONS_FIXED_HEADER = ["planName", "ref", "title", "reviewer", "round", "comment", "submittedAt", "weightedScore"];
const FIXED_EVALUATIONS_COLUMN_NAMES = new Set<string>(EVALUATIONS_FIXED_HEADER);

/** Pure row-shaping for the evaluations export (DB-free, unit-tested
 * directly): derives the dynamic score columns from the UNION of score keys
 * actually present across the exported rows -- the load-bearing property
 * that no stored score value is ever dropped -- then renders each row's
 * cells, planName/weightedScore alongside the fixed columns.
 *
 * DEC-529 amendment (wave 4): within a plan, columns come out in the plan's
 * DECLARED criteria order (declaredOrderByPlan -- base criteria_json plus
 * every round_criteria_json override, unioned by the caller), matching what
 * /plans/:id/results renders. A score key present in the data but absent
 * from the declared list (a criterion removed from the plan after
 * submission, or legacy history) is still never dropped -- it is appended
 * after the declared columns, in stable first-seen order. Plans themselves
 * keep their existing first-appearance grouping. */
export function shapeEvaluationsExport(
  rows: EvaluationExportRow[],
  labelsByPlan: Map<string, Map<string, string>>,
  planNames: Map<string, string>,
  declaredOrderByPlan: Map<string, string[]>,
): ExportTable {
  const planOrder: string[] = [];
  const presentByPlan = new Map<string, Set<string>>();
  const firstSeenByPlan = new Map<string, string[]>();
  for (const r of rows) {
    if (!presentByPlan.has(r.planId)) {
      presentByPlan.set(r.planId, new Set());
      firstSeenByPlan.set(r.planId, []);
      planOrder.push(r.planId);
    }
    const present = presentByPlan.get(r.planId)!;
    const firstSeen = firstSeenByPlan.get(r.planId)!;
    for (const criterionId of Object.keys(r.scores)) {
      if (present.has(criterionId)) continue;
      present.add(criterionId);
      firstSeen.push(criterionId);
    }
  }

  const scoreColumns: EvaluationScoreColumn[] = [];
  for (const planId of planOrder) {
    const present = presentByPlan.get(planId)!;
    const declared = declaredOrderByPlan.get(planId) ?? [];
    const emitted = new Set<string>();
    const ordered: string[] = [];
    for (const criterionId of declared) {
      if (present.has(criterionId) && !emitted.has(criterionId)) {
        emitted.add(criterionId);
        ordered.push(criterionId);
      }
    }
    for (const criterionId of firstSeenByPlan.get(planId)!) {
      if (!emitted.has(criterionId)) {
        emitted.add(criterionId);
        ordered.push(criterionId);
      }
    }
    const planName = planNames.get(planId) ?? planId;
    for (const criterionId of ordered) {
      const label = labelsByPlan.get(planId)?.get(criterionId) ?? criterionId;
      scoreColumns.push({ planId, criterionId, label: `${planName}: ${label}` });
    }
  }

  const columnNames = nameCustomColumns(
    scoreColumns.map((c) => ({ fieldId: `${c.planId}:${c.criterionId}`, label: c.label })),
    FIXED_EVALUATIONS_COLUMN_NAMES,
  );

  const header = ["planName", "ref", "title", "reviewer", "round", "comment", "submittedAt", ...columnNames, "weightedScore"];

  const outRows = rows.map((r) => [
    r.planName,
    r.ref,
    r.title,
    r.reviewer,
    String(r.round),
    r.comment,
    r.submittedAt,
    ...scoreColumns.map((c) => {
      if (c.planId !== r.planId) return "";
      const value = r.scores[c.criterionId];
      return value === undefined ? "" : String(value);
    }),
    r.weightedScore,
  ]);

  return buildTable(header, outRows);
}

export interface EvaluationsExportParams {
  /** Must be a plan of THIS event -- a foreign/unknown planId is a loud
   * ApiError naming the field, never a silently empty CSV (w41-a). */
  planId?: string;
  round?: number;
}

export async function exportEvaluations(db: Db, eventId: string, params?: EvaluationsExportParams): Promise<ExportTable> {
  const recordPrefix = await getRecordPrefix(db, eventId);

  if (params?.planId !== undefined) {
    const planRows = await db
      .select({ id: schema.evaluationPlan.id })
      .from(schema.evaluationPlan)
      .where(and(eq(schema.evaluationPlan.id, params.planId), eq(schema.evaluationPlan.eventId, eventId)))
      .limit(1);
    if (planRows.length === 0) {
      throw new ApiError("invalid", `planId '${params.planId}' is not a plan of this event`, { planId: "unknown" });
    }
  }

  const conditions = [eq(schema.evaluationPlan.eventId, eventId)];
  if (params?.planId !== undefined) conditions.push(eq(schema.evaluationPlan.id, params.planId));
  if (params?.round !== undefined) conditions.push(eq(schema.evaluation.round, params.round));
  // DEC-873 (wave 54 amendment): every read side over schema.evaluation
  // outside getEvaluation's deliberate draft-inclusive exception must apply
  // the submitted-evaluation predicate below -- this CSV had no submitted
  // predicate and disagreed with GET /api/v1/plans/:id/results (which does
  // apply it) on row count, shipping in-progress reviewer drafts to
  // exporters.
  conditions.push(submittedEvaluationCondition());

  const rows = await db
    .select({
      planId: schema.evaluationPlan.id,
      planName: schema.evaluationPlan.name,
      criteriaJson: schema.evaluationPlan.criteriaJson,
      roundCriteriaJson: schema.evaluationPlan.roundCriteriaJson,
      scaleJson: schema.evaluationPlan.scaleJson,
      seq: schema.submission.seq,
      title: schema.submission.title,
      reviewerEmail: schema.user.email,
      contactFirstName: schema.contact.firstName,
      contactLastName: schema.contact.lastName,
      round: schema.evaluation.round,
      scoresJson: schema.evaluation.scoresJson,
      comment: schema.evaluation.comment,
      submittedAt: schema.evaluation.submittedAt,
    })
    .from(schema.evaluation)
    .innerJoin(schema.evaluationPlan, eq(schema.evaluation.planId, schema.evaluationPlan.id))
    .innerJoin(schema.submission, eq(schema.evaluation.submissionId, schema.submission.id))
    .innerJoin(schema.user, eq(schema.evaluation.reviewerId, schema.user.id))
    // DEC-736 (wave 79 amendment): joined the same way the organiser screen
    // (src/server/repo/review/evaluations.ts:400) does, so
    // resolveReviewerIdentity is fed the identical row shape on both sides.
    .leftJoin(schema.contact, eq(schema.user.contactId, schema.contact.id))
    .where(and(...conditions))
    .orderBy(asc(schema.submission.seq), asc(schema.evaluation.reviewerId), asc(schema.evaluation.round), asc(schema.evaluation.id))
    .limit(EXPORT_MAX_ROWS + 1);

  // DEC-027 amendment (wave 50): bound on the query — cap+1 evaluation rows
  // proves overflow before the per-plan label/criteria work below.
  if (rows.length > EXPORT_MAX_ROWS) {
    return buildTable([...EVALUATIONS_FIXED_HEADER], [], true);
  }

  const labelsByPlan = new Map<string, Map<string, string>>();
  const planNames = new Map<string, string>();
  const planBaseCriteria = new Map<string, EvaluationCriterionDef[]>();
  const planScale = new Map<string, { min: number; max: number } | undefined>();
  for (const r of rows) {
    if (!labelsByPlan.has(r.planId)) {
      labelsByPlan.set(r.planId, labelByCriterionId(r.criteriaJson, r.roundCriteriaJson));
    }
    planNames.set(r.planId, r.planName);
    if (!planBaseCriteria.has(r.planId)) {
      try {
        planBaseCriteria.set(r.planId, JSON.parse(r.criteriaJson) as EvaluationCriterionDef[]);
      } catch {
        planBaseCriteria.set(r.planId, []);
      }
    }
    if (!planScale.has(r.planId)) {
      try {
        planScale.set(r.planId, JSON.parse(r.scaleJson) as { min: number; max: number });
      } catch {
        planScale.set(r.planId, undefined);
      }
    }
  }

  // DEC-147 (wave 79 amendment): round resolution is memoised per
  // (planId, round) -- the same pair the query is already ordered by --
  // rather than re-parsed for every row of that round.
  const criteriaForRoundCache = new Map<string, EvaluationCriterionDef[]>();

  const exportRows: EvaluationExportRow[] = rows.map((r) => {
    const scores = JSON.parse(r.scoresJson) as Record<string, unknown>;
    const roundKey = `${r.planId}:${r.round}`;
    let roundCriteria = criteriaForRoundCache.get(roundKey);
    if (!roundCriteria) {
      const base = planBaseCriteria.get(r.planId) ?? [];
      roundCriteria = criteriaForRound(base, r.roundCriteriaJson, r.round);
      criteriaForRoundCache.set(roundKey, roundCriteria);
    }
    // DEC-529: computeWeightedScore expects only rating criteria (numeric,
    // weighted) -- filter to those, matching computeWeightedScore's own
    // contract. Deliberate exception to fail-loudly: an export reading
    // possibly-legacy history (missing scores, a plan with no rating
    // criteria) must render empty rather than 500 the whole export.
    let weightedScore = "";
    try {
      const ratingCriteria = roundCriteria
        .filter((c) => c.kind === "rating" && typeof c.weight === "number")
        .map((c) => ({ id: c.id, label: c.label, weight: c.weight as number }));
      const score = computeWeightedScore(scores as Record<string, number>, ratingCriteria, planScale.get(r.planId));
      weightedScore = String(score);
    } catch {
      weightedScore = "";
    }

    return {
      planId: r.planId,
      planName: r.planName,
      ref: formatRef(recordPrefix, r.seq),
      title: r.title,
      reviewer: resolveReviewerIdentity({
        firstName: r.contactFirstName,
        lastName: r.contactLastName,
        email: r.reviewerEmail,
      }),
      round: r.round,
      scores,
      weightedScore,
      comment: r.comment ?? "",
      submittedAt: r.submittedAt ? r.submittedAt.toISOString() : "",
    };
  });

  // DEC-529 amendment (wave 4): declared-order union, built from the
  // criteria this function already resolved above -- planBaseCriteria (the
  // plan's base declared order) plus criteriaForRoundCache's per-round
  // results (already memoised at criteriaForRoundCache, not re-parsed) --
  // so a round-override criterion lands at the override's declared
  // position, appended after any base criteria it didn't replace.
  const declaredOrderByPlan = new Map<string, string[]>();
  for (const [planId, base] of planBaseCriteria) {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const c of base) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      order.push(c.id);
    }
    const roundKeys = [...criteriaForRoundCache.keys()]
      .filter((key) => key.startsWith(`${planId}:`))
      .sort((a, b) => Number(a.slice(planId.length + 1)) - Number(b.slice(planId.length + 1)));
    for (const key of roundKeys) {
      for (const c of criteriaForRoundCache.get(key)!) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        order.push(c.id);
      }
    }
    declaredOrderByPlan.set(planId, order);
  }

  return shapeEvaluationsExport(exportRows, labelsByPlan, planNames, declaredOrderByPlan);
}

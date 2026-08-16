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
 * directly). DEC-529 (wave-5 amendment): score columns follow the plan's
 * DECLARED criteria order (`criteriaByPlan`, base criteria_json followed by
 * any round-override-only ids in ascending round order) rather than
 * `Object.keys` of whatever the rows happen to contain -- so integer-like
 * criterion ids no longer hoist to the front, and a declared-but-unscored
 * criterion still gets a column (empty cells). A score key present in the
 * stored data but absent from the plan's declared set is still never
 * dropped -- it is appended after the declared columns, sorted
 * lexicographically by "planId:criterionId". */
export function shapeEvaluationsExport(
  rows: EvaluationExportRow[],
  criteriaByPlan: Map<string, { id: string; label: string }[]>,
  planNames: Map<string, string>,
): ExportTable {
  const declaredColumns: EvaluationScoreColumn[] = [];
  const declaredKeys = new Set<string>();
  for (const [planId, criteria] of criteriaByPlan) {
    const planName = planNames.get(planId) ?? planId;
    for (const c of criteria) {
      declaredKeys.add(`${planId}:${c.id}`);
      declaredColumns.push({ planId, criterionId: c.id, label: `${planName}: ${c.label}` });
    }
  }

  const orphanKeys = new Set<string>();
  for (const r of rows) {
    for (const criterionId of Object.keys(r.scores)) {
      const key = `${r.planId}:${criterionId}`;
      if (declaredKeys.has(key)) continue;
      orphanKeys.add(key);
    }
  }
  const orphanColumns: EvaluationScoreColumn[] = [...orphanKeys].sort().map((key) => {
    const sep = key.indexOf(":");
    const planId = key.slice(0, sep);
    const criterionId = key.slice(sep + 1);
    const planName = planNames.get(planId) ?? planId;
    return { planId, criterionId, label: `${planName}: ${criterionId}` };
  });

  const scoreColumns: EvaluationScoreColumn[] = [...declaredColumns, ...orphanColumns];

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

  // DEC-529 (wave-5 amendment): per plan, the declared column order is the
  // base criteria_json array followed by any round-override-only criterion
  // ids in ascending round order -- reusing the same criteriaForRound door
  // and criteriaForRoundCache the weightedScore computation above already
  // populated, and labelByCriterionId for the label text, so the label
  // vocabulary keeps exactly one owner.
  const criteriaByPlan = new Map<string, { id: string; label: string }[]>();
  for (const planId of planNames.keys()) {
    const base = planBaseCriteria.get(planId) ?? [];
    const orderedIds: string[] = [];
    const seenIds = new Set<string>();
    for (const c of base) {
      if (seenIds.has(c.id)) continue;
      seenIds.add(c.id);
      orderedIds.push(c.id);
    }
    const rounds = [...new Set(rows.filter((r) => r.planId === planId).map((r) => r.round))].sort((a, b) => a - b);
    for (const round of rounds) {
      const roundCriteria = criteriaForRoundCache.get(`${planId}:${round}`) ?? [];
      for (const c of roundCriteria) {
        if (seenIds.has(c.id)) continue;
        seenIds.add(c.id);
        orderedIds.push(c.id);
      }
    }
    const labels = labelsByPlan.get(planId) ?? new Map<string, string>();
    criteriaByPlan.set(
      planId,
      orderedIds.map((id) => ({ id, label: labels.get(id) ?? id })),
    );
  }

  return shapeEvaluationsExport(exportRows, criteriaByPlan, planNames);
}

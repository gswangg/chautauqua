// Pure core (DEC-002: no node:/cloudflare/drizzle imports) — the ONE
// validated home for evaluation.scores_json. DEC-212 amendment (wave 81):
// before this module, the repo layer declared the column's parsed shape as
// `Record<string, number | string>` (evaluations.ts) while the domain layer
// declared it `Record<string, number>` (scoring.ts's EvaluationScores), and
// the bridge between the two was `e.scores as unknown as EvaluationScores`
// (routes/review/shared.ts) -- a double cast that overrules the type system
// and admits anything. computeWeightedScore's own guards (score < scale.min
// / score > scale.max) are both false for a non-numeric string, so a
// corrupted row reached `score * criterion.weight` as NaN and silently
// poisoned a plan's weighted mean and ranking. Modeled on
// src/forms/field-json.ts (the wave-79 sibling for form_field's two JSON
// columns): a named error class, a single parser, refuse loudly on anything
// that doesn't match the column's contract.
//
// THE TOLERANCE BOUNDARY, as a rule and not a schedule: a criterion score
// value is a string ONLY for a dropdown criterion's chosen option -- every
// other read of a score value is arithmetic (a rating criterion's weighted
// sum, a submission's per-criterion mean). parseEvaluationScoresJson accepts
// the column's declared write shape (number | string) because the row can
// legitimately hold both kinds of criteria. numericScoresFor is the
// boundary: it is the ONLY function in this module allowed to refuse a
// string, because it is the function that hands scores to something that
// multiplies them. A display projection (an export's per-criterion label
// column) may tolerate what arithmetic must not -- that tolerance belongs to
// the export's own reader, never to this parser.
//
// DEC-212 (wave-34 amendment), why one more reader degrades instead of
// throwing: numericScoresFor guards the two sites adjacent to a WRITE (a
// results table built moments after a reviewer's submit, an export run
// against live data) -- those callers own the row and a corrupt value there
// is a bug worth surfacing immediately. numericScoresOrNull guards the
// organiser's UNBOUNDED historical read (every evaluation a submission has
// EVER carried, across every plan it was ever scored under) -- one bad row
// years old must not 500 the whole list. Same contract, same refusal to
// coerce a string into arithmetic; the only difference is what happens on
// refusal: throw for a fresh write-adjacent read, null for a boundless
// historical one.

import type { EvaluationCriterion } from "./scoring";
import type { EvaluationScores } from "./scoring";

/** Thrown by parseEvaluationScoresJson/numericScoresFor when the stored JSON
 * does not match the shape evaluation.scores_json is contracted to hold.
 * Names the offending evaluation (or, where no evaluation id is available at
 * the call site, the submission) so a bad row is loud, not a silent NaN. */
export class EvaluationScoresJsonError extends Error {
  constructor(context: string, detail: string) {
    super(`evaluation ${context}.scores_json: ${detail}`);
    this.name = "EvaluationScoresJsonError";
  }
}

/** Parses evaluation.scores_json. Throws EvaluationScoresJsonError if the
 * JSON does not parse, or parses to something other than a plain object
 * (null, array, or primitive), or has any value that is neither a finite
 * number nor a string -- the column's two legitimate score shapes (a
 * rating's numeric score, a dropdown's chosen option string). Does NOT
 * validate against a plan's criteria list; that is numericScoresFor's job. */
export function parseEvaluationScoresJson(
  raw: string,
  context: string,
): Record<string, number | string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new EvaluationScoresJsonError(context, "not valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new EvaluationScoresJsonError(context, "must be an object");
  }
  const record = parsed as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    const isFiniteNumber = typeof value === "number" && Number.isFinite(value);
    const isString = typeof value === "string";
    if (!isFiniteNumber && !isString) {
      throw new EvaluationScoresJsonError(
        context,
        `score "${key}" must be a finite number or a string`,
      );
    }
  }
  return record as Record<string, number | string>;
}

/** Narrows a parsed scores map to the arithmetic-safe EvaluationScores shape
 * (Record<string, number>) for exactly the given criteria list. For each
 * criterion whose id is present in `scores`, the value must be a finite
 * NUMBER -- a numeric-looking STRING is refused too, since the writer
 * (upsertEvaluation) always stores a JS number for a rating criterion, so a
 * string in that slot is corruption, not a format variant. A criterion
 * absent from `scores` is left absent in the result (never coerced to 0 or
 * thrown here) so computeWeightedScore/aggregateSubmission keep their own
 * missing-score refusals unchanged. This is the ONLY function in this module
 * that may refuse a string -- see the module header for why. */
export function numericScoresFor(
  scores: Record<string, number | string>,
  criteria: EvaluationCriterion[],
  context: string,
): EvaluationScores {
  const out: EvaluationScores = {};
  for (const criterion of criteria) {
    if (!(criterion.id in scores)) continue;
    const value = scores[criterion.id];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new EvaluationScoresJsonError(
        context,
        `score for criterion "${criterion.id}" must be a finite number, got ${JSON.stringify(value)}`,
      );
    }
    out[criterion.id] = value;
  }
  return out;
}

/** DEC-212 (wave-34 amendment): the non-throwing sibling of numericScoresFor,
 * for the ONE caller that reads scores across an unbounded history rather
 * than adjacent to a write (the organiser's submission-evaluations list,
 * which spans every plan a submission was ever scored under). Returns null
 * -- never throws -- when `criteria` is empty, when any criterion id is
 * absent from `scores`, or when its value is not a finite number. Otherwise
 * returns the fully-numeric record for exactly the given criteria. This is
 * completeness as a NUMERIC test, not a presence test: the same function
 * that decides "is this scorecard complete enough to have a score" also
 * produces the record that arithmetic runs on, so the two can never
 * disagree. */
export function numericScoresOrNull(
  scores: Record<string, number | string>,
  criteria: EvaluationCriterion[],
): EvaluationScores | null {
  if (criteria.length === 0) return null;
  const out: EvaluationScores = {};
  for (const criterion of criteria) {
    const value = scores[criterion.id];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return null;
    }
    out[criterion.id] = value;
  }
  return out;
}

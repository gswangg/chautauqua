// Pure core (DEC-002: no node:/cloudflare/drizzle imports) — the ONE
// validated parser for submission_answer.value_json. DEC-718 amendment
// (wave 11): this is the last schema JSON column that had no read-side
// owner. Its write side already has a contract (src/server/repo/
// submit.ts's assertJsonRoundTrips, DEC-718 base decision), but that
// contract runs at insert time only — it never protected the six sites
// that read the column back with a bare `JSON.parse(...) as unknown` /
// `as AnswerMap` cast.
//
// The accepted shape is DERIVED, not invented, from every writer of this
// column: src/forms/validate.ts's validateAnswers is the ONE function that
// produces the `cleaned` AnswerMap that reaches
// src/server/repo/submit.ts's upsertSubmissionAnswers (the sole writer —
// src/server/repo/portal-edit.ts's save path calls upsertSubmissionAnswers
// too, and neither src/lib/submit-core.ts nor src/routes/portal/tasks.tsx
// write to submission_answer at all: tasks.tsx writes
// task_assignment.response_json, owned separately by
// src/forms/task-response.ts). validateAnswers's switch over FormFieldKind
// produces exactly three JS types into `cleaned`:
//   - text / long_text / dropdown / file -> string (dropdown is checked
//     against field.options, file is a non-empty opaque file-id string)
//   - checkbox -> boolean (canonicalizeOperand)
//   - number -> a finite number (Number.isFinite is enforced before
//     assignment; -0 is normalized to 0)
// A hidden or blank/absent answer is never written (validateAnswers
// strips/omits it; a blank on a visible optional field goes through
// DEC-842's clearedFieldIds and DELETES the row instead of storing null —
// see submit.ts's deleteSubmissionAnswer). So null, arrays, objects, and
// non-finite numbers are shapes NO writer can produce, and this parser
// throws on all of them rather than silently accepting a shape that could
// only arrive via a hand-edited row.
//
// Two readers of this same column are deliberately NOT converted to this
// parser, and stay hand-parsing on purpose:
//   - src/server/repo/form-roles.ts:45 roleAnswerLabel — DEC-592's
//     separate role-answer resolver. Its own header (form-roles.ts:34-44)
//     forbids conflating the role-answer grammar ("a stored label or
//     nothing") with the general custom-answer grammar this module owns;
//     mirrors plan-json.ts's DEC-147 exclusion of exports/evaluations.ts's
//     labelByCriterionId.
//   - src/server/repo/forms.ts:506 countAnswersByOptionValue — option-usage
//     counting is deliberately shape-tolerant (it accepts an array of
//     strings too, silently ignores non-string entries) so a future
//     multi-select answer or a legacy row doesn't break the "can this
//     option be removed" check; that tolerance is a stated feature there,
//     not a gap.

export type SubmissionAnswerValue = string | number | boolean;

/** Thrown by parseSubmissionAnswerValue when the stored JSON does not match
 * the shape submission_answer.value_json is contracted to hold. Names the
 * offending field id so a bad row is loud, not a silently blank answer. */
export class SubmissionAnswerJsonError extends Error {
  constructor(fieldId: string, detail: string) {
    super(`submission_answer value_json for field "${fieldId}": ${detail}`);
    this.name = "SubmissionAnswerJsonError";
  }
}

/** Parses submission_answer.value_json. Throws SubmissionAnswerJsonError if
 * the JSON does not parse, or parses to anything other than a string, a
 * finite number, or a boolean — the exact union src/forms/validate.ts's
 * validateAnswers can produce (see module header for the derivation). */
export function parseSubmissionAnswerValue(json: string, fieldId: string): SubmissionAnswerValue {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new SubmissionAnswerJsonError(fieldId, "not valid JSON");
  }
  if (typeof parsed === "string") return parsed;
  if (typeof parsed === "boolean") return parsed;
  if (typeof parsed === "number") {
    if (!Number.isFinite(parsed)) {
      throw new SubmissionAnswerJsonError(fieldId, "number must be finite");
    }
    return parsed;
  }
  throw new SubmissionAnswerJsonError(fieldId, "must be a string, number, or boolean");
}

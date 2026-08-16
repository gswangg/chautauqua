// Pure core (DEC-002: no node:/cloudflare/drizzle imports) — the ONE
// validated parser for the two form_field JSON columns, options_json and
// rule_json. DEC-008 amendment (wave 79): before this module, four repo
// sites each ran an unvalidated `JSON.parse(...) as string[]` /
// `as FormFieldRule` and already disagreed on the empty answer (`undefined`
// at three sites, `[]` at form-roles.ts). Worse, a rule object that survived
// JSON.parse without a usable fieldId/op/value didn't throw anywhere -- it
// silently fed resolveHiddenFieldIds (src/forms/visibility.ts), which took
// its missing-trigger branch and HID the field. A required question could
// vanish from a form with no error. Modeled on roundMetaFor
// (src/domain/evaluation/criteria.ts), which validates every field it reads
// and throws a named error on anything malformed, rather than
// criteriaForRound's silent `?? base` fallback.

import { FORM_FIELD_RULE_OPS, type FormFieldRule } from "./types";

/** Thrown by parseFieldOptions/parseFieldRule when the stored JSON does not
 * match the shape its column is contracted to hold. Names the offending
 * field id and column so a bad row is loud, not a silently-hidden field. */
export class FieldJsonError extends Error {
  constructor(fieldId: string, column: "options_json" | "rule_json", detail: string) {
    super(`form_field ${fieldId}.${column}: ${detail}`);
    this.name = "FieldJsonError";
  }
}

/** Parses form_field.options_json. Returns undefined for null/undefined/empty
 * input (no options stored). Throws FieldJsonError if the JSON parses but is
 * not an array of strings. */
export function parseFieldOptions(
  json: string | null | undefined,
  fieldId: string,
): string[] | undefined {
  if (json === null || json === undefined || json === "") return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new FieldJsonError(fieldId, "options_json", "not valid JSON");
  }
  if (!Array.isArray(parsed) || parsed.some((v) => typeof v !== "string")) {
    throw new FieldJsonError(fieldId, "options_json", "must be an array of strings");
  }
  return parsed as string[];
}

const RULE_OPS = new Set<string>(FORM_FIELD_RULE_OPS);

/** Parses form_field.rule_json. Returns undefined for null/undefined/empty
 * input (no rule stored). Throws FieldJsonError if the JSON parses but is
 * not a well-formed FormFieldRule: an object with a non-empty string
 * fieldId, an op in FORM_FIELD_RULE_OPS, and a value of the shape that op
 * implies -- `in` requires an array of strings (matching src/forms/
 * rule-match.ts's `Array.isArray(rule.value)` + string-candidate
 * expectation); `eq`/`ne` accept any JSON-representable scalar/value, since
 * rule-match.ts canonicalizes those per the trigger field's kind. */
export function parseFieldRule(
  json: string | null | undefined,
  fieldId: string,
): FormFieldRule | undefined {
  if (json === null || json === undefined || json === "") return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new FieldJsonError(fieldId, "rule_json", "not valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new FieldJsonError(fieldId, "rule_json", "must be an object");
  }
  const rule = parsed as Record<string, unknown>;
  if (typeof rule.fieldId !== "string" || rule.fieldId.trim() === "") {
    throw new FieldJsonError(fieldId, "rule_json", "fieldId must be a non-empty string");
  }
  if (typeof rule.op !== "string" || !RULE_OPS.has(rule.op)) {
    throw new FieldJsonError(fieldId, "rule_json", `op must be one of ${FORM_FIELD_RULE_OPS.join(", ")}`);
  }
  if (!("value" in rule)) {
    throw new FieldJsonError(fieldId, "rule_json", "value is required");
  }
  if (rule.op === "in") {
    if (!Array.isArray(rule.value) || rule.value.some((v) => typeof v !== "string")) {
      throw new FieldJsonError(fieldId, "rule_json", "op 'in' requires value to be an array of strings");
    }
  }
  return {
    fieldId: rule.fieldId,
    op: rule.op as FormFieldRule["op"],
    value: rule.value,
  };
}

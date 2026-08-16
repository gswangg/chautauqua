// Pure CFP form-builder validation helpers (DEC-008 shape from ./types).
// No node:/cloudflare/drizzle imports (DEC-002) — these are exercised
// directly by the route layer and by plain vitest.

import type { FormFieldDef, FormFieldKind, FormFieldRule, FormFieldRuleOp } from "./types";
import { FORM_FIELD_KINDS, FORM_FIELD_RULE_OPS } from "./types"; // DEC-615
import { MAX_NAME_LENGTH, MAX_TEXT_LENGTH } from "./validate"; // DEC-417
import { canonicalizeOperand } from "./rule-match"; // DEC-681
import { MAX_FIELD_OPTIONS } from "../domain/form-copy"; // w2-c
import { overCapCountMessage } from "../domain/cap-copy"; // DEC-422 amendment

// DEC-615 (wave 73): the ONE kind list, re-exported from the domain
// vocabulary so this module's population is the same array object.
export const FIELD_KINDS: readonly FormFieldKind[] = FORM_FIELD_KINDS;

const RULE_OPS: readonly FormFieldRuleOp[] = FORM_FIELD_RULE_OPS;

export type FieldErrors = Record<string, string>;

/** Shape accepted from the client when creating/patching a custom field. */
export interface FieldDefInput {
  section?: unknown;
  kind?: unknown;
  label?: unknown;
  helpText?: unknown;
  required?: unknown;
  options?: unknown;
  rule?: unknown;
  role?: unknown;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validates a rule reference against the field it lives on plus the other
 * fields already on the form. The rule's fieldId must reference an existing
 * field on the same form (never itself), and following the referenced
 * field's own rule chain must never lead back to `ownFieldId` (no cycles).
 * `ownFieldId` is undefined for a field being created (it has no id yet, so
 * it cannot appear in an existing chain).
 */
export function validateRuleReference(
  rule: FormFieldRule,
  fields: FormFieldDef[],
  ownFieldId?: string,
): string | undefined {
  if (!RULE_OPS.includes(rule.op)) {
    return "invalid rule operator";
  }
  if (typeof rule.fieldId !== "string" || rule.fieldId.length === 0) {
    return "rule.fieldId is required";
  }
  if (ownFieldId !== undefined && rule.fieldId === ownFieldId) {
    return "rule cannot reference its own field";
  }
  const byId = new Map(fields.map((f) => [f.id, f] as const));
  const target = byId.get(rule.fieldId);
  if (!target) {
    return "rule.fieldId must reference an existing field on this form";
  }
  if (rule.op === "in" && !Array.isArray(rule.value)) {
    return "rule.value must be an array for op 'in'";
  }
  if (rule.op === "in" && Array.isArray(rule.value) && rule.value.length > MAX_FIELD_OPTIONS) {
    return `rule.value must have at most ${MAX_FIELD_OPTIONS} entries for op 'in'`; // w2-c
  }

  // DEC-681: a rule's value is typed by its TRIGGER field's kind. Reject
  // rules that can never match against that kind, at write time, rather
  // than silently accepting a value that comparison will never satisfy
  // (the historical checkbox 'true'-vs-true bug this decision closes).
  const values = rule.op === "in" ? (rule.value as unknown[]) : [rule.value];
  if (target.kind === "file") {
    return "a file field cannot be a rule trigger";
  }
  if (target.kind === "checkbox") {
    if (values.some((v) => canonicalizeOperand("checkbox", v) === undefined)) {
      return "rule.value must be true or false for a checkbox trigger";
    }
  } else if (target.kind === "number") {
    if (values.some((v) => canonicalizeOperand("number", v) === undefined)) {
      return "rule.value must be a number for a number trigger";
    }
  } else if (target.kind === "dropdown") {
    const options = target.options ?? [];
    if (values.some((v) => typeof v !== "string" || !options.includes(v))) {
      return "rule.value must be one of the trigger field's options";
    }
  } else if (target.kind === "text" || target.kind === "long_text") {
    // w2-c: a text/long_text trigger's rule.value was not validated at all
    // (any type, any length) before landing in rule_json and being
    // serialized into the public CFP's inline rule JSON.
    if (values.some((v) => typeof v !== "string" || v.length > MAX_NAME_LENGTH)) {
      return `rule.value must be a string of at most ${MAX_NAME_LENGTH} characters for a text trigger`;
    }
  }

  // Walk the chain of rule.fieldId references starting at the target field;
  // if we ever reach ownFieldId the new rule would create a cycle.
  const seen = new Set<string>();
  let current: FormFieldDef | undefined = target;
  while (current?.rule) {
    if (seen.has(current.id)) break; // pre-existing cycle elsewhere; don't loop forever
    seen.add(current.id);
    const nextId = current.rule.fieldId;
    if (ownFieldId !== undefined && nextId === ownFieldId) {
      return "rule would create a visibility cycle";
    }
    current = byId.get(nextId);
  }
  return undefined;
}

/**
 * Validates a create/patch payload for a custom form field against the
 * DEC-008 FormFieldDef shape. `existingFields` is every field currently on
 * the form (used for rule-reference + cycle checks); `existing` is set when
 * validating an edit to an already-existing field (its id + stored kind —
 * PATCH may omit `kind` (unchanged) or send it (DEC-505 kind change), so the
 * dropdown-options rule must be checked against the field's *effective*
 * kind, not just a supplied one, otherwise `{"options": []}` silently bricks
 * a live dropdown — DEC-500). `options` is required whenever the field is
 * not ALREADY a dropdown: a create, or a patch that changes kind to
 * dropdown, must supply options; a patch on a field that is already a
 * dropdown may omit options (leaving them unchanged) — DEC-508.
 */
export function validateFieldDefInput(
  input: FieldDefInput,
  existingFields: FormFieldDef[],
  existing?: { id: string; kind: FormFieldKind },
): { ok: true } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const ownFieldId = existing?.id;

  if (input.section !== undefined && input.section !== "session" && input.section !== "speaker") {
    errors.section = "must be 'session' or 'speaker'";
  }

  if (input.kind !== undefined) {
    if (typeof input.kind !== "string" || !FIELD_KINDS.includes(input.kind as FormFieldKind)) {
      errors.kind = `must be one of: ${FIELD_KINDS.join(", ")}`;
    }
  }

  const effectiveKind: FormFieldKind | undefined =
    typeof input.kind === "string" && FIELD_KINDS.includes(input.kind as FormFieldKind)
      ? (input.kind as FormFieldKind)
      : existing?.kind;

  if (effectiveKind === "dropdown") {
    if (input.options !== undefined || existing === undefined || existing.kind !== "dropdown") {
      const options = input.options;
      if (!Array.isArray(options) || options.length === 0 || !options.every((o) => typeof o === "string")) {
        errors.options = "dropdown fields require a non-empty string array of options";
      } else if (options.length > MAX_FIELD_OPTIONS) {
        errors.options = overCapCountMessage(options.length, MAX_FIELD_OPTIONS, "option"); // w2-c, DEC-422 grammar
      } else if (options.some((o) => (o as string).length > MAX_NAME_LENGTH)) {
        errors.options = `each option must be at most ${MAX_NAME_LENGTH} characters`; // DEC-417
      }
    }
  } else if (input.options !== undefined && input.options !== null) {
    errors.options = "options apply only to dropdown fields";
  }

  if (input.label !== undefined && (typeof input.label !== "string" || input.label.trim().length === 0)) {
    errors.label = "required";
  } else if (input.label !== undefined && (input.label as string).length > MAX_NAME_LENGTH) {
    errors.label = `must be at most ${MAX_NAME_LENGTH} characters`; // DEC-417
  }

  if (
    input.helpText !== undefined &&
    input.helpText !== null &&
    typeof input.helpText === "string" &&
    input.helpText.length > MAX_TEXT_LENGTH
  ) {
    errors.helpText = `must be at most ${MAX_TEXT_LENGTH} characters`; // DEC-417
  }

  if (input.required !== undefined && typeof input.required !== "boolean") {
    errors.required = "must be a boolean";
  }

  if (input.rule !== undefined && input.rule !== null) {
    if (!isPlainRecord(input.rule)) {
      errors.rule = "invalid rule shape";
    } else {
      const rule = input.rule as unknown as FormFieldRule;
      const ruleError = validateRuleReference(rule, existingFields, ownFieldId);
      if (ruleError) errors.rule = ruleError;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return { ok: true };
}

/** True iff `orderedIds` is a permutation of `existingIds` (same members, no dupes/omissions). */
export function isPermutation(existingIds: string[], orderedIds: unknown): orderedIds is string[] {
  if (!Array.isArray(orderedIds)) return false;
  if (orderedIds.length !== existingIds.length) return false;
  if (!orderedIds.every((id) => typeof id === "string")) return false;
  const existing = new Set(existingIds);
  const seen = new Set<string>();
  for (const id of orderedIds) {
    if (!existing.has(id) || seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}

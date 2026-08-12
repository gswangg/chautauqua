// Pure CFP form-builder validation helpers (DEC-008 shape from ./types).
// No node:/cloudflare/drizzle imports (DEC-002) — these are exercised
// directly by the route layer and by plain vitest.

import type { FormFieldDef, FormFieldKind, FormFieldRule, FormFieldRuleOp } from "./types";
import { MAX_NAME_LENGTH, MAX_TEXT_LENGTH } from "./validate"; // DEC-417

export const FIELD_KINDS: readonly FormFieldKind[] = [
  "text",
  "long_text",
  "dropdown",
  "checkbox",
  "number",
  "file",
];

const RULE_OPS: readonly FormFieldRuleOp[] = ["eq", "ne", "in"];

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
 * a live dropdown — DEC-500).
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
    if (input.options !== undefined || existing === undefined) {
      const options = input.options;
      if (!Array.isArray(options) || options.length === 0 || !options.every((o) => typeof o === "string")) {
        errors.options = "dropdown fields require a non-empty string array of options";
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

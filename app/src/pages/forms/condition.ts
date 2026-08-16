// Pure formatter for the conditional-visibility rule shown on a field's
// FieldList row (DEC-650). A row must never render a raw fieldId -- it
// resolves the referenced field's label through `fieldsById`, or renders
// an explicit "a deleted field" fallback when the id no longer resolves
// (e.g. the referenced field was since removed).
import type { FormField, FormFieldRule, FormFieldRuleOp } from './types';

function formatValue(op: FormFieldRuleOp, value: unknown): string {
  if (op === 'in') {
    const values = Array.isArray(value) ? value : [value];
    return values.map((v) => `"${String(v)}"`).join(', ');
  }
  return `"${String(value)}"`;
}

// DEC-650 (wave-66 amendment): the ONE operator-label vocabulary -- both
// describeCondition's row prose and FieldModal's condition <select> render
// this, never a second map.
export function ruleOpLabel(op: FormFieldRuleOp): string {
  switch (op) {
    case 'eq':
      return 'is';
    case 'ne':
      return 'is not';
    case 'in':
      return 'is one of';
  }
}

/**
 * Describes a field's conditional-visibility rule in prose for the field
 * list row, e.g. `Shown when Format is "Workshop"`. An unresolved
 * fieldId (the referenced field was deleted) renders
 * `Shown when a deleted field matches` -- never the raw id.
 */
export function describeCondition(rule: FormFieldRule, fieldsById: Map<string, { label: string }>): string {
  const referenced = fieldsById.get(rule.fieldId);
  if (!referenced) {
    return 'Shown when a deleted field matches';
  }
  return `Shown when ${referenced.label} ${ruleOpLabel(rule.op)} ${formatValue(rule.op, rule.value)}`;
}

/** Builds the `fieldId -> {label}` lookup describeCondition needs from a form's field list. */
export function fieldsByIdMap(fields: Pick<FormField, 'id' | 'label'>[]): Map<string, { label: string }> {
  return new Map(fields.map((f) => [f.id, { label: f.label }]));
}

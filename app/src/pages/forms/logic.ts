// Pure helpers for the form-builder SPA: conditional-visibility rule
// serialization, reorder-list manipulation, and locked-field edit guards.
// No API/DOM dependencies so these are directly vitest-testable.
import type { FormField, FormFieldRule, FormFieldRuleOp } from './types';

/** Raw UI state for the conditional-visibility rule builder in FieldModal. */
export interface RuleBuilderState {
  fieldId: string;
  op: FormFieldRuleOp;
  value: string;
}

export const EMPTY_RULE_STATE: RuleBuilderState = { fieldId: '', op: 'eq', value: '' };

/**
 * Serializes a rule-builder's raw UI state into the form_field.rule_json
 * shape { fieldId, op, value }. An empty fieldId means "no condition", so
 * this returns undefined (the field is unconditionally visible). For op
 * 'in', value is split on commas into a trimmed, non-empty string array;
 * for 'eq'/'ne' it stays a single trimmed string.
 */
export function serializeRule(state: RuleBuilderState): FormFieldRule | undefined {
  if (state.fieldId.trim().length === 0) return undefined;
  const value =
    state.op === 'in'
      ? state.value
          .split(',')
          .map((v) => v.trim())
          .filter((v) => v.length > 0)
      : state.value.trim();
  return { fieldId: state.fieldId, op: state.op, value };
}

/** Inverse of serializeRule: turns a stored rule (or none) back into the
 * rule builder's raw UI state. */
export function deserializeRule(rule: FormFieldRule | undefined): RuleBuilderState {
  if (!rule) return { ...EMPTY_RULE_STATE };
  const value = Array.isArray(rule.value) ? rule.value.join(', ') : String(rule.value ?? '');
  return { fieldId: rule.fieldId, op: rule.op, value };
}

/**
 * Moves the id at `index` up (-1) or down (+1) within an ordered id list,
 * returning a new array (input is never mutated). No-ops (returns the same
 * array instance) when the move would go out of bounds.
 */
export function moveId(orderedIds: string[], index: number, direction: -1 | 1): string[] {
  const target = index + direction;
  if (index < 0 || index >= orderedIds.length || target < 0 || target >= orderedIds.length) {
    return orderedIds;
  }
  const next = orderedIds.slice();
  const a = next[index] as string;
  const b = next[target] as string;
  next[index] = b;
  next[target] = a;
  return next;
}

/** True iff `field` is a DEC-016 locked built-in (non-editable, non-removable). */
export function isLockedField(field: Pick<FormField, 'locked'>): boolean {
  return field.locked;
}

/**
 * Guards edit/delete actions against DEC-016 locked built-in fields. The UI
 * must never send edit/delete requests for locked fields; call this before
 * issuing the corresponding API call so a wiring mistake fails loudly
 * instead of silently hitting the server (which also rejects it).
 */
export function guardEditableField(field: Pick<FormField, 'locked'>, action: 'edit' | 'delete'): void {
  if (field.locked) {
    throw new Error(`Locked built-in fields cannot be ${action === 'edit' ? 'edited' : 'removed'}`);
  }
}

/** Fields eligible as a conditional-rule reference target for `field`: every
 * other field on the form ordered earlier (lower position) than it. When
 * `field` is undefined (creating a brand-new field, appended at the end),
 * every existing field qualifies. */
export function ruleReferenceCandidates(fields: FormField[], field?: Pick<FormField, 'id' | 'position'>): FormField[] {
  return fields
    .filter((f) => (field ? f.id !== field.id && f.position < field.position : true))
    .sort((a, b) => a.position - b.position);
}

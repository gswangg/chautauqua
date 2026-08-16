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
 * other field on the form ordered earlier (lower position) than it, and
 * never a file-kind field (a file upload cannot be a trigger -- there is
 * no canonical serialization of "what file was uploaded" to compare
 * against). When `field` is undefined (creating a brand-new field,
 * appended at the end), every existing non-file field qualifies. */
export function ruleReferenceCandidates(fields: FormField[], field?: Pick<FormField, 'id' | 'position'>): FormField[] {
  return fields
    .filter((f) => f.kind !== 'file')
    .filter((f) => (field ? f.id !== field.id && f.position < field.position : true))
    .sort((a, b) => a.position - b.position);
}

/** The kind of UI control the rule-builder's value field must render, keyed
 * by the SELECTED trigger field's kind (DEC-681: a rule's value is typed by
 * its trigger, not free text) so the authored value is always something the
 * trigger can actually match:
 *  - checkbox trigger -> boolean control (Yes/No, canonical 'true'/'false')
 *  - number trigger -> number control (a decimal string)
 *  - dropdown trigger -> options control (one of the trigger's own options)
 *  - anything else (text/long_text; file triggers are excluded from
 *    ruleReferenceCandidates) -> free text
 * `trigger` is undefined when no field is selected yet (rule.fieldId ===
 * ''), which also falls back to 'text'. */
export type RuleValueControl = 'boolean' | 'number' | 'options' | 'text';

export function ruleValueControl(trigger: Pick<FormField, 'kind'> | undefined): RuleValueControl {
  if (!trigger) return 'text';
  switch (trigger.kind) {
    case 'checkbox':
      return 'boolean';
    case 'number':
      return 'number';
    case 'dropdown':
      return 'options';
    default:
      return 'text';
  }
}

/** The value a rule-builder value control resets to whenever its control
 * kind changes (trigger swap or op swap) -- never a stale value the new
 * control can't represent. 'false' for boolean (an unchecked/"No" default
 * mirrors DEC-681's canonicalization of an unchecked checkbox), '' for
 * everything else (number/options/text all treat '' as "not yet chosen"). */
export function defaultRuleValue(control: RuleValueControl): string {
  return control === 'boolean' ? 'false' : '';
}

/** True iff `state` names a trigger field, i.e. a conditional-visibility
 * rule is set (mirrors serializeRule's own "no fieldId -> no condition"
 * test, so the two can never disagree about whether a rule exists). */
export function hasRule(state: RuleBuilderState): boolean {
  return state.fieldId.trim().length > 0;
}

/**
 * DEC-650(c): required and a visibility rule are mutually exclusive, and
 * that is enforced on SAVE, not merely captioned -- a submitter who cannot
 * see a question can never be blocked by it, so a hidden question is always
 * saved as `required: false` regardless of what the checkbox showed before
 * the rule was added.
 */
export function requiredForSave(required: boolean, rule: RuleBuilderState): boolean {
  return hasRule(rule) ? false : required;
}

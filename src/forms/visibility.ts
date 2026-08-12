import { lockedFieldName } from "./types";
import type { AnswerMap, FormFieldDef, FormFieldKind } from "./types";
import { ruleMatches } from "./rule-match";

// A field with no rule is always visible. A field with a rule is visible
// only when the referenced trigger field's current answer matches per the
// rule's operator, TYPED by the trigger field's kind (DEC-681 — see
// ./rule-match.ts). Basic show/hide only (DEC-008: "conditional fine for
// now") — no compound/boolean rule composition. `triggerKind` is undefined
// when the rule's fieldId doesn't resolve to a known field — same as an
// unknown trigger id, the field is hidden.
export function isVisible(
  field: FormFieldDef,
  answers: AnswerMap,
  triggerKind?: FormFieldKind,
): boolean {
  const rule = field.rule;
  if (!rule) return true;
  if (triggerKind === undefined) return false;

  return ruleMatches(rule, answers[rule.fieldId], triggerKind);
}

// DEC-532: visibility is transitive — a field whose rule points at a
// currently-hidden field is itself hidden, even if its own rule would
// otherwise evaluate true against the raw (stale) answer map. Computed as a
// monotone fixed point: fields only move visible -> hidden, so this
// terminates in at most fields.length passes. A field is hidden if (a) its
// rule names a fieldId that isn't in this field list, or (b) isVisible is
// false once every currently-hidden field's answer is removed from the
// answer map. A rule cycle (A gated on B, B gated on A) terminates rather
// than looping forever, since the fixed point converges as soon as a pass
// adds nothing new.
export function resolveHiddenFieldIds(
  fields: FormFieldDef[],
  answers: AnswerMap,
): Set<string> {
  const ids = new Set(fields.map((f) => f.id));
  const kindById = new Map(fields.map((f) => [f.id, f.kind] as const));
  const hidden = new Set<string>();

  let changed = true;
  while (changed) {
    changed = false;
    const effectiveAnswers: AnswerMap = { ...answers };
    for (const id of hidden) delete effectiveAnswers[id];

    for (const field of fields) {
      if (hidden.has(field.id)) continue;
      // DEC-625: a locked built-in field can never be hidden and can never
      // be given a visibility rule — skip it in both fixed-point branches
      // (missing-rule-target and rule-evaluates-false) regardless of
      // whether field.id arrives raw ('<formId>:title') or already short
      // ('title'); lockedFieldName handles both forms.
      if (lockedFieldName(field.id) !== null) continue;
      const rule = field.rule;
      if (rule && !ids.has(rule.fieldId)) {
        hidden.add(field.id);
        changed = true;
        continue;
      }
      if (!isVisible(field, effectiveAnswers, rule ? kindById.get(rule.fieldId) : undefined)) {
        hidden.add(field.id);
        changed = true;
      }
    }
  }

  return hidden;
}

// Builds a single visibility predicate from the FULL field list (a field in
// one section can gate a field in another section), resolving the
// transitive fixed point once up front. Keeps the same two-arg shape as
// isVisible so it drops directly into render sites' isVisible prop; the
// second argument is ignored since the hidden set is already resolved.
export function makeVisibilityPredicate(
  fields: FormFieldDef[],
  answers: AnswerMap,
): (field: FormFieldDef, answers: AnswerMap) => boolean {
  const hidden = resolveHiddenFieldIds(fields, answers);
  return (field: FormFieldDef) => !hidden.has(field.id);
}

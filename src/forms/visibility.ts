import type { AnswerMap, FormFieldDef } from "./types";

// A field with no rule is always visible. A field with a rule is visible
// only when the referenced trigger field's current answer matches per the
// rule's operator. Basic show/hide only (DEC-008: "conditional fine for
// now") — no compound/boolean rule composition.
export function isVisible(field: FormFieldDef, answers: AnswerMap): boolean {
  const rule = field.rule;
  if (!rule) return true;

  const actual = answers[rule.fieldId];

  switch (rule.op) {
    case "eq":
      return actual === rule.value;
    case "ne":
      return actual !== rule.value;
    case "in": {
      const candidates = rule.value;
      if (!Array.isArray(candidates)) return false;
      return candidates.includes(actual);
    }
    default: {
      const exhaustive: never = rule.op;
      throw new Error(`unknown rule op: ${exhaustive}`);
    }
  }
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
  const hidden = new Set<string>();

  let changed = true;
  while (changed) {
    changed = false;
    const effectiveAnswers: AnswerMap = { ...answers };
    for (const id of hidden) delete effectiveAnswers[id];

    for (const field of fields) {
      if (hidden.has(field.id)) continue;
      const rule = field.rule;
      if (rule && !ids.has(rule.fieldId)) {
        hidden.add(field.id);
        changed = true;
        continue;
      }
      if (!isVisible(field, effectiveAnswers)) {
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

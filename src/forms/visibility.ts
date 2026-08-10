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

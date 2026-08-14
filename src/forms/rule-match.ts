// Pure core (DEC-002: no node:/cloudflare/drizzle imports) — the ONE place
// a FormFieldRule is compared against an answer. DEC-681: a rule's value is
// typed by its TRIGGER field's kind, not by whatever raw type the answer
// happens to be. Before this module, a checkbox trigger's rule.value
// arrived as the string 'true' while the stored answer was the boolean
// true — `===` never matched, so a checkbox-gated rule could NEVER show its
// dependent field. Both the server (ruleMatches) and the browser toggler
// (RULE_MATCH_JS, embedded verbatim into the rendered page) canonicalize
// through the same rules, proven identical by a shared case table
// (RULE_MATCH_CASES) exercised against both in test/form-render-rules.test.ts.
// DEC-867: an unanswered field canonicalizes to undefined for EVERY kind
// (number '' / null / boolean-typed strings, text/long_text/dropdown/file
// blank strings) and undefined satisfies NO operator — eq, ne, and in all
// return false when the trigger's canonical value is undefined. The one
// exception is checkbox, whose absent answer canonicalizes to false (an
// unchecked box), not undefined — that's a real value, not an absence.

import type { FormFieldKind, FormFieldRule } from "./types";
import { DEC_681 } from "../decisions";

// Referenced for compile-checked dependency per DEC-681.
void DEC_681;

/**
 * Canonicalizes a raw answer/rule-value into the typed form comparisons
 * should use, per the trigger field's kind. Returns undefined when the
 * value is absent/unparseable for that kind — an undefined canonical value
 * never satisfies eq/in (see ruleMatches).
 */
export function canonicalizeOperand(
  kind: FormFieldKind,
  value: unknown,
): string | number | boolean | undefined {
  switch (kind) {
    case "checkbox": {
      if (value === undefined || value === null) return false; // absent = unchecked
      if (value === true || value === "true" || value === "on" || value === "yes" || value === "1") {
        return true;
      }
      if (value === false || value === "false" || value === "off" || value === "no" || value === "0") {
        return false;
      }
      return undefined;
    }
    case "number": {
      if (typeof value === "boolean") return undefined; // Number(true) === 1 would lie
      if (value === undefined || value === null) return undefined;
      if (typeof value === "string" && value.trim() === "") return undefined; // Number('') === 0 would lie
      const num = Number(value);
      return Number.isFinite(num) ? num : undefined;
    }
    case "text":
    case "long_text":
    case "dropdown":
    case "file": {
      if (value === undefined || value === null) return undefined;
      const str = String(value).trim();
      return str === "" ? undefined : str;
    }
    default: {
      const exhaustive: never = kind;
      throw new Error(`unknown field kind: ${exhaustive}`);
    }
  }
}

export function ruleMatches(
  rule: FormFieldRule,
  answer: unknown,
  triggerKind: FormFieldKind,
): boolean {
  const actual = canonicalizeOperand(triggerKind, answer);

  switch (rule.op) {
    case "eq": {
      if (actual === undefined) return false;
      return actual === canonicalizeOperand(triggerKind, rule.value);
    }
    case "ne": {
      if (actual === undefined) return false;
      const expected = canonicalizeOperand(triggerKind, rule.value);
      return actual !== expected;
    }
    case "in": {
      if (actual === undefined) return false;
      if (!Array.isArray(rule.value)) return false;
      return rule.value.some((candidate) => canonicalizeOperand(triggerKind, candidate) === actual);
    }
    default: {
      const exhaustive: never = rule.op;
      throw new Error(`unknown rule op: ${exhaustive}`);
    }
  }
}

// Browser twin of canonicalizeOperand/ruleMatches above, embedded verbatim
// as inline JS (no TS syntax, no imports) into the rendered form page by
// src/views/form-render.tsx's FieldRulesScript. Kept semantically identical
// to the TS implementation by a shared case table (RULE_MATCH_CASES),
// exercised against both via `new Function` in test/form-render-rules.test.ts.
export const RULE_MATCH_JS = `function chqCanonicalize(kind, value) {
  if (kind === 'checkbox') {
    if (value === undefined || value === null) return false;
    if (value === true || value === 'true' || value === 'on' || value === 'yes' || value === '1') return true;
    if (value === false || value === 'false' || value === 'off' || value === 'no' || value === '0') return false;
    return undefined;
  }
  if (kind === 'number') {
    if (typeof value === 'boolean') return undefined;
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'string' && value.trim() === '') return undefined;
    var num = Number(value);
    return isFinite(num) ? num : undefined;
  }
  if (value === undefined || value === null) return undefined;
  var str = String(value).trim();
  return str === '' ? undefined : str;
}
function chqRuleMatches(rule, value, kind) {
  var actual = chqCanonicalize(kind, value);
  if (rule.op === 'eq') {
    if (actual === undefined) return false;
    return actual === chqCanonicalize(kind, rule.value);
  }
  if (rule.op === 'ne') {
    if (actual === undefined) return false;
    var expected = chqCanonicalize(kind, rule.value);
    return actual !== expected;
  }
  if (rule.op === 'in') {
    if (actual === undefined) return false;
    if (!Array.isArray(rule.value)) return false;
    return rule.value.some(function (candidate) { return chqCanonicalize(kind, candidate) === actual; });
  }
  return true;
}`;

export const RULE_MATCH_CASES: {
  kind: FormFieldKind;
  answer: unknown;
  rule: FormFieldRule;
  expected: boolean;
}[] = [
  {
    kind: "checkbox",
    answer: true,
    rule: { fieldId: "trigger", op: "eq", value: "true" },
    expected: true,
  },
  {
    kind: "checkbox",
    answer: "true",
    rule: { fieldId: "trigger", op: "eq", value: true },
    expected: true,
  },
  {
    kind: "checkbox",
    answer: undefined,
    rule: { fieldId: "trigger", op: "ne", value: "true" },
    expected: true,
  },
  {
    kind: "checkbox",
    answer: "off",
    rule: { fieldId: "trigger", op: "eq", value: false },
    expected: true,
  },
  {
    kind: "number",
    answer: 5,
    rule: { fieldId: "trigger", op: "eq", value: "5" },
    expected: true,
  },
  {
    kind: "number",
    answer: "5",
    rule: { fieldId: "trigger", op: "eq", value: "5" },
    expected: true,
  },
  {
    kind: "number",
    answer: "abc",
    rule: { fieldId: "trigger", op: "eq", value: "5" },
    expected: false,
  },
  {
    kind: "dropdown",
    answer: "Workshop",
    rule: { fieldId: "trigger", op: "eq", value: "Workshop" },
    expected: true,
  },
  {
    kind: "dropdown",
    answer: "Workshop",
    rule: { fieldId: "trigger", op: "in", value: ["Workshop", "Panel"] },
    expected: true,
  },
  {
    kind: "text",
    answer: "  hello  ",
    rule: { fieldId: "trigger", op: "eq", value: "hello" },
    expected: true,
  },
  {
    kind: "number",
    answer: "",
    rule: { fieldId: "trigger", op: "eq", value: 0 },
    expected: false,
  },
  {
    kind: "number",
    answer: "   ",
    rule: { fieldId: "trigger", op: "eq", value: "0" },
    expected: false,
  },
  {
    kind: "number",
    answer: null,
    rule: { fieldId: "trigger", op: "eq", value: 0 },
    expected: false,
  },
  {
    kind: "number",
    answer: "",
    rule: { fieldId: "trigger", op: "ne", value: 0 },
    expected: false,
  },
  {
    kind: "text",
    answer: "",
    rule: { fieldId: "trigger", op: "ne", value: "Workshop" },
    expected: false,
  },
];

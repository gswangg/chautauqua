// w2-c: CFP form builder collection caps -- dropdown option COUNT and a
// text/long_text trigger's rule.value cardinality/length, both of which
// were unbounded and land in options_json/rule_json rendered on the public
// CFP (FieldRulesScript inlines rule_json as JSON on the public page).
import { describe, expect, it } from "vitest";
import type { FormFieldDef } from "../src/forms/types";
import { MAX_FIELD_OPTIONS } from "../src/domain/form-copy";
import { overCapCountMessage } from "../src/domain/cap-copy";
import { MAX_NAME_LENGTH } from "../src/forms/validate";
import { validateFieldDefInput, validateRuleReference } from "../src/forms/builder";

const titleField: FormFieldDef = {
  id: "title",
  section: "session",
  kind: "text",
  label: "Title",
  required: true,
  position: 0,
};

const textTrigger: FormFieldDef = {
  id: "track",
  section: "session",
  kind: "text",
  label: "Track",
  required: false,
  position: 1,
};

describe("validateFieldDefInput dropdown option count cap", () => {
  it("accepts exactly MAX_FIELD_OPTIONS options", () => {
    const options = Array.from({ length: MAX_FIELD_OPTIONS }, (_, i) => `opt-${i}`);
    const result = validateFieldDefInput({ kind: "dropdown", label: "Format", options }, [titleField]);
    expect(result.ok).toBe(true);
  });

  it("rejects MAX_FIELD_OPTIONS + 1 options", () => {
    const options = Array.from({ length: MAX_FIELD_OPTIONS + 1 }, (_, i) => `opt-${i}`);
    const result = validateFieldDefInput({ kind: "dropdown", label: "Format", options }, [titleField]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // DEC-422 amendment: the ONE over-cap grammar (states submitted count,
      // overage, and the limit) -- not the deleted bare `Max N` value.
      expect(result.errors.options).toBe(overCapCountMessage(MAX_FIELD_OPTIONS + 1, MAX_FIELD_OPTIONS, "option"));
      expect(result.errors.options).toContain(String(MAX_FIELD_OPTIONS + 1));
    }
  });
});

describe("validateRuleReference text/long_text trigger bounds", () => {
  it("accepts a string value at most MAX_NAME_LENGTH for a text trigger", () => {
    const rule = { fieldId: "track", op: "eq" as const, value: "x".repeat(MAX_NAME_LENGTH) };
    const error = validateRuleReference(rule, [textTrigger, titleField]);
    expect(error).toBeUndefined();
  });

  it("rejects a value longer than MAX_NAME_LENGTH for a text trigger", () => {
    const rule = { fieldId: "track", op: "eq" as const, value: "x".repeat(MAX_NAME_LENGTH + 1) };
    const error = validateRuleReference(rule, [textTrigger, titleField]);
    expect(error).toMatch(/at most/);
  });

  it("rejects a non-string value for a text trigger", () => {
    const rule = { fieldId: "track", op: "eq" as const, value: 42 };
    const error = validateRuleReference(rule, [textTrigger, titleField]);
    expect(error).toMatch(/string/);
  });

  it("rejects an 'in' array over MAX_FIELD_OPTIONS entries", () => {
    const rule = {
      fieldId: "track",
      op: "in" as const,
      value: Array.from({ length: MAX_FIELD_OPTIONS + 1 }, (_, i) => `v${i}`),
    };
    const error = validateRuleReference(rule, [textTrigger, titleField]);
    expect(error).toBe(`rule.value must have at most ${MAX_FIELD_OPTIONS} entries for op 'in'`);
  });

  it("accepts an 'in' array of exactly MAX_FIELD_OPTIONS entries with valid string values", () => {
    const rule = {
      fieldId: "track",
      op: "in" as const,
      value: Array.from({ length: MAX_FIELD_OPTIONS }, (_, i) => `v${i}`),
    };
    const error = validateRuleReference(rule, [textTrigger, titleField]);
    expect(error).toBeUndefined();
  });
});

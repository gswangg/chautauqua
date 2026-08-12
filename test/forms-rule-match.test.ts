// DEC-681: a rule's value is typed by its TRIGGER field's kind. Table-driven
// over the shared RULE_MATCH_CASES (also exercised against the browser twin
// RULE_MATCH_JS in test/form-render-rules.test.ts, proving parity).

import { describe, expect, it } from "vitest";
import { canonicalizeOperand, ruleMatches, RULE_MATCH_CASES } from "../src/forms/rule-match";
import { validateAnswers } from "../src/forms/validate";
import type { FormFieldDef } from "../src/forms/types";

describe("ruleMatches (DEC-681 shared case table)", () => {
  it.each(RULE_MATCH_CASES)(
    "kind=$kind op=$rule.op answer=$answer -> $expected",
    ({ kind, answer, rule, expected }) => {
      expect(ruleMatches(rule, answer, kind)).toBe(expected);
    },
  );
});

describe("canonicalizeOperand", () => {
  it("an absent checkbox answer canonicalizes to false", () => {
    expect(canonicalizeOperand("checkbox", undefined)).toBe(false);
    expect(canonicalizeOperand("checkbox", null)).toBe(false);
  });

  it("checkbox accepts common truthy/falsy spellings", () => {
    expect(canonicalizeOperand("checkbox", "on")).toBe(true);
    expect(canonicalizeOperand("checkbox", "1")).toBe(true);
    expect(canonicalizeOperand("checkbox", "off")).toBe(false);
    expect(canonicalizeOperand("checkbox", "0")).toBe(false);
  });

  it("number is undefined for non-finite/unparseable input", () => {
    expect(canonicalizeOperand("number", "abc")).toBeUndefined();
    expect(canonicalizeOperand("number", Infinity)).toBeUndefined();
    expect(canonicalizeOperand("number", true)).toBeUndefined();
  });

  it("text/dropdown/file trim and treat blank as absent", () => {
    expect(canonicalizeOperand("text", "  hi  ")).toBe("hi");
    expect(canonicalizeOperand("text", "   ")).toBeUndefined();
    expect(canonicalizeOperand("dropdown", undefined)).toBeUndefined();
  });
});

const formatCheckbox: FormFieldDef = {
  id: "wantsSwag",
  section: "session",
  kind: "checkbox",
  label: "Wants swag?",
  required: false,
  position: 0,
};

const sizeGatedByCheckbox: FormFieldDef = {
  id: "swagSize",
  section: "session",
  kind: "dropdown",
  label: "Swag size",
  required: true,
  position: 1,
  options: ["S", "M", "L"],
  rule: { fieldId: "wantsSwag", op: "eq", value: "true" },
};

const attendeesNumber: FormFieldDef = {
  id: "attendees",
  section: "session",
  kind: "number",
  label: "Expected attendees",
  required: false,
  position: 0,
};

const largeRoomGate: FormFieldDef = {
  id: "roomNote",
  section: "session",
  kind: "text",
  label: "Room note",
  required: true,
  position: 1,
  rule: { fieldId: "attendees", op: "eq", value: "5" },
};

describe("validateAnswers with a checkbox-gated rule (DEC-681 J1 fix)", () => {
  it("a checkbox trigger set to true satisfies rule.value 'true' — the field is visible and its answer stored", () => {
    const fields = [formatCheckbox, sizeGatedByCheckbox];
    const answers = { wantsSwag: true, swagSize: "M" };
    const result = validateAnswers(fields, answers);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.cleaned.swagSize).toBe("M");
    expect(result.hiddenFieldIds).not.toContain("swagSize");
  });

  it("a checkbox trigger left unchecked hides the gated field and strips its answer", () => {
    const fields = [formatCheckbox, sizeGatedByCheckbox];
    const answers = { swagSize: "M" };
    const result = validateAnswers(fields, answers);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.hiddenFieldIds).toContain("swagSize");
    expect(result.cleaned.swagSize).toBeUndefined();
  });
});

describe("validateAnswers with a number-gated rule resolves identically for '5' and 5", () => {
  it("string '5' answer matches rule.value '5'", () => {
    const result = validateAnswers([attendeesNumber, largeRoomGate], {
      attendees: "5",
      roomNote: "Book the big room",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.cleaned.roomNote).toBe("Book the big room");
  });

  it("numeric 5 answer matches rule.value '5' the same way", () => {
    const result = validateAnswers([attendeesNumber, largeRoomGate], {
      attendees: 5,
      roomNote: "Book the big room",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.cleaned.roomNote).toBe("Book the big room");
  });

  it("a non-matching number hides the gated field on both submit and edit paths", () => {
    const result = validateAnswers([attendeesNumber, largeRoomGate], {
      attendees: 12,
      roomNote: "stale",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.hiddenFieldIds).toContain("roomNote");
    expect(result.cleaned.roomNote).toBeUndefined();
  });
});

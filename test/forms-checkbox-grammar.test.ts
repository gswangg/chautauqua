// DEC-681: validateAnswers' checkbox branch must agree with the ONE shared
// grammar in canonicalizeOperand("checkbox", ...) — no second, hand-rolled
// Boolean(value) coercion. This pins both the individual cases and, via a
// single loop, the fact that the two readers agree on every input.

import { describe, expect, it } from "vitest";
import { validateAnswers } from "../src/forms/validate";
import { canonicalizeOperand } from "../src/forms/rule-match";
import type { FormFieldDef } from "../src/forms/types";

const requiredCheckbox: FormFieldDef = {
  id: "agree",
  section: "session",
  kind: "checkbox",
  label: "I agree",
  required: true,
  position: 0,
};

const optionalCheckbox: FormFieldDef = {
  id: "optIn",
  section: "session",
  kind: "checkbox",
  label: "Opt in",
  required: false,
  position: 0,
};

const FALSY_INPUTS: unknown[] = ["false", "off", "no", "0", false];
const TRUTHY_INPUTS: unknown[] = ["true", "on", "yes", "1", true];
const ALL_GRAMMAR_INPUTS: unknown[] = [...FALSY_INPUTS, ...TRUTHY_INPUTS];

describe("validateAnswers checkbox grammar (DEC-681)", () => {
  it("each falsy spelling stores false and FAILS a required checkbox", () => {
    for (const input of FALSY_INPUTS) {
      const result = validateAnswers([requiredCheckbox], { agree: input });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("unreachable");
      expect(result.errors.agree).toBe("required");
    }
  });

  it("each falsy spelling stores false on a non-required checkbox", () => {
    for (const input of FALSY_INPUTS) {
      const result = validateAnswers([optionalCheckbox], { optIn: input });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("unreachable");
      expect(result.cleaned.optIn).toBe(false);
    }
  });

  it("each truthy spelling stores true and passes a required checkbox", () => {
    for (const input of TRUTHY_INPUTS) {
      const result = validateAnswers([requiredCheckbox], { agree: input });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("unreachable");
      expect(result.cleaned.agree).toBe(true);
    }
  });

  it('"maybe" is outside the grammar and errors with "must be true or false"', () => {
    const result = validateAnswers([optionalCheckbox], { optIn: "maybe" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.errors.optIn).toBe("must be true or false");
  });

  it("for every grammar input, validateAnswers' stored value equals canonicalizeOperand('checkbox', input) — the two readers agree", () => {
    for (const input of ALL_GRAMMAR_INPUTS) {
      const expected = canonicalizeOperand("checkbox", input);
      const result = validateAnswers([optionalCheckbox], { optIn: input });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("unreachable");
      expect(result.cleaned.optIn).toBe(expected);
    }
  });
});

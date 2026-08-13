import { describe, expect, it } from "vitest";
import { NUMBER_FIELD_PATTERN, validateAnswers } from "../src/forms/validate";
import type { FormFieldDef } from "../src/forms/types";

// DEC-718: a number answer on the public CFP is a finite decimal number or
// an error. Before this fix, src/forms/validate.ts:118-125 rejected only
// Number.isNaN, so "1e999" (a value <input type="number"> will happily
// hand us) parsed to Infinity, passed validation, and submit.ts's
// JSON.stringify(Infinity) silently wrote `null` into a REQUIRED column —
// a validator bug that erased a required answer on the unauthenticated
// public path. "0x1f" was also silently reinterpreted as 31 by Number().

const numberField: FormFieldDef = {
  id: "field__count",
  section: "session",
  kind: "number",
  label: "Count",
  required: false,
  position: 0,
};

const requiredNumberField: FormFieldDef = {
  ...numberField,
  id: "field__required_count",
  required: true,
};

describe("NUMBER_FIELD_PATTERN — DEC-718 decimal grammar", () => {
  const accepted: Array<{ s: string; n: number }> = [
    { s: "0", n: 0 },
    { s: "1", n: 1 },
    { s: "-1", n: -1 },
    { s: "+1", n: 1 },
    { s: "3.14", n: 3.14 },
    { s: "-3.14", n: -3.14 },
    { s: ".5", n: 0.5 },
    { s: "-.5", n: -0.5 },
    { s: "1e3", n: 1000 },
    { s: "1E3", n: 1000 },
    { s: "1.5e-3", n: 0.0015 },
    { s: "-1.5e+3", n: -1500 },
    { s: "0.0", n: 0 },
  ];

  it.each(accepted)("accepts $s", ({ s, n }) => {
    expect(NUMBER_FIELD_PATTERN.test(s)).toBe(true);
    expect(Number(s)).toBe(n);
  });

  const rejected: string[] = [
    "1_000",
    "0x1f",
    "0o17",
    "0b101",
    "Infinity",
    "-Infinity",
    "NaN",
    ".",
    "-.",
    "5.",
    "1e",
    "1e+",
    "e5",
    "1..5",
    "1.2.3",
    " 1",
    "1 ",
    "1,000",
    "",
    "abc",
    "1e999x",
  ];

  it.each(rejected)("rejects %s", (s) => {
    expect(NUMBER_FIELD_PATTERN.test(s)).toBe(false);
  });
});

describe("validateAnswers — DEC-718 number field", () => {
  const matrix: Array<{ label: string; value: unknown; ok: boolean }> = [
    { label: "plain integer", value: 42, ok: true },
    { label: "plain float", value: 3.14, ok: true },
    { label: "negative float", value: -3.14, ok: true },
    { label: "numeric string integer", value: "42", ok: true },
    { label: "numeric string float", value: "3.14", ok: true },
    { label: "numeric string with exponent", value: "1.5e-3", ok: true },
    { label: "leading-dot decimal string", value: ".5", ok: true },
    { label: "boolean true", value: true, ok: false },
    { label: "boolean false", value: false, ok: false },
    { label: "array", value: [1, 2], ok: false },
    { label: "hex string", value: "0x1f", ok: false },
    { label: "octal-looking string", value: "0o17", ok: false },
    { label: "binary-looking string", value: "0b101", ok: false },
    { label: "underscore-grouped digits", value: "1_000", ok: false },
    { label: "the string Infinity", value: "Infinity", ok: false },
    { label: "the string NaN", value: "NaN", ok: false },
    { label: "bare dot", value: ".", ok: false },
    { label: "actual JS Infinity", value: Infinity, ok: false },
    { label: "actual JS NaN", value: NaN, ok: false },
    { label: "1e999 (parses to Infinity)", value: "1e999", ok: false },
    { label: "-1e999 (parses to -Infinity)", value: "-1e999", ok: false },
    { label: "trailing garbage", value: "1e999x", ok: false },
    { label: "an object", value: { a: 1 }, ok: false },
  ];

  it.each(matrix)("$label -> ok=$ok", ({ value, ok }) => {
    const result = validateAnswers([numberField], { [numberField.id]: value });
    expect(result.ok).toBe(ok);
    if (!result.ok) {
      expect(result.errors[numberField.id]).toBe("must be a number");
    }
  });

  it("0x1f is rejected as a field error, not silently reinterpreted as 31", () => {
    const result = validateAnswers([numberField], { [numberField.id]: "0x1f" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[numberField.id]).toBe("must be a number");
    }
  });

  it("a required number field with '1e999' returns a field error, not a persisted null", () => {
    const result = validateAnswers([requiredNumberField], {
      [requiredNumberField.id]: "1e999",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[requiredNumberField.id]).toBe("must be a number");
      // The whole point of DEC-718: the field must never reach `cleaned`
      // as a value that JSON.stringify would silently turn into null.
      expect(Object.keys(result.errors)).toContain(requiredNumberField.id);
    }
  });

  it("still allows an absent/blank required number field to report the plain 'required' error", () => {
    const result = validateAnswers([requiredNumberField], {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[requiredNumberField.id]).toBe("required");
    }
  });
});

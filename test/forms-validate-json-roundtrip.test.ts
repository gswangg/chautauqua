import { describe, expect, it } from "vitest";
import { validateAnswers } from "../src/forms/validate";
import { FIELD_KINDS } from "../src/forms/builder";
import type { FormFieldDef, FormFieldKind } from "../src/forms/types";

// DEC-718: a "must be a number" rejection only caught NaN, so 'Infinity',
// '-Infinity' and '1e400' validated as ok and were then flattened to the
// JSON literal `null` on persist — a REQUIRED answer silently vanished
// behind the submitter's success confirmation, with no error anywhere.
//
// This test closes the *class*, not the instance: it enumerates every kind
// in the field-kind vocabulary (imported from builder.ts — never
// hand-listed, per the field guide's enumeration rule) and asserts the
// general invariant that must hold for ANY value validateAnswers accepts:
// what comes out of `cleaned` must be exactly what a JSON round-trip
// through the store hands back. If a future kind or branch accepts a value
// that doesn't survive JSON.stringify/JSON.parse unchanged, this test
// fails without needing to know about that specific value in advance.

function fieldFor(kind: FormFieldKind, options?: string[]): FormFieldDef {
  return {
    id: `field__${kind}`,
    section: "session",
    kind,
    label: kind,
    required: false,
    position: 0,
    ...(options ? { options } : {}),
  };
}

const OVERSIZED_TEXT = "a".repeat(3000); // over MAX_TEXT_LENGTH, under MAX_LONG_TEXT_LENGTH
const OVERSIZED_LONG_TEXT = "a".repeat(25000); // over MAX_LONG_TEXT_LENGTH

// Hostile battery: values that are individually known to cause silent
// data-loss classes elsewhere (non-finite numbers, sign-losing -0,
// type-coercion surprises, oversized payloads, structurally "empty"
// containers).
const HOSTILE_VALUES: Array<{ label: string; value: unknown }> = [
  { label: "Infinity", value: Infinity },
  { label: "-Infinity", value: -Infinity },
  { label: "1e400 (overflow)", value: 1e400 },
  { label: "NaN", value: NaN },
  { label: "-0", value: -0 },
  { label: "true", value: true },
  { label: "false", value: false },
  { label: "empty array", value: [] },
  { label: "empty object", value: {} },
  { label: "oversized string (3000 chars)", value: OVERSIZED_TEXT },
  { label: "oversized string (25000 chars)", value: OVERSIZED_LONG_TEXT },
  { label: "empty string", value: "" },
  { label: "ordinary finite number", value: 42.5 },
  { label: "ordinary string", value: "hello" },
];

describe("validateAnswers — JSON round-trip closure (DEC-718)", () => {
  for (const kind of FIELD_KINDS) {
    describe(`kind: ${kind}`, () => {
      const field =
        kind === "dropdown"
          ? fieldFor(kind, ["hello", OVERSIZED_TEXT, OVERSIZED_LONG_TEXT])
          : fieldFor(kind);

      for (const { label, value } of HOSTILE_VALUES) {
        it(`whatever it accepts for ${label} round-trips through JSON unchanged`, () => {
          const result = validateAnswers([field], { [field.id]: value });
          if (!result.ok) {
            // Rejected input never reaches the store — nothing to check.
            return;
          }
          const roundTripped = JSON.parse(JSON.stringify(result.cleaned));
          expect(roundTripped).toEqual(result.cleaned);
        });
      }
    });
  }

  it("specifically rejects Infinity/-Infinity/overflow for number fields (DEC-718 regression)", () => {
    const field = fieldFor("number");
    for (const value of [Infinity, -Infinity, 1e400]) {
      const result = validateAnswers([field], { [field.id]: value });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[field.id]).toBe("must be a number");
      }
    }
  });

  it("still accepts and returns ordinary finite numbers for number fields", () => {
    const field = fieldFor("number");
    const result = validateAnswers([field], { [field.id]: 42.5 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cleaned[field.id]).toBe(42.5);
    }
  });

  it("normalizes -0 to 0 so cleaned already matches what JSON persistence would hand back", () => {
    const field = fieldFor("number");
    const result = validateAnswers([field], { [field.id]: -0 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.is(result.cleaned[field.id], -0)).toBe(false);
      expect(result.cleaned[field.id]).toBe(0);
    }
  });
});

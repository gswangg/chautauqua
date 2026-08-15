import { describe, expect, it } from "vitest";
import {
  MAX_LONG_TEXT_LENGTH,
  MAX_TEXT_LENGTH,
  validateAnswers,
} from "../src/forms/validate";
import type { FormFieldDef } from "../src/forms/types";
import { overCapSentence } from "../src/domain/cap-copy";

// DEC-124: server-side answer length caps. Both public submit (submit.tsx)
// and portal edit (portal/edit.tsx) call validateAnswers directly, so
// enforcing the cap here closes the abuse case for both submit paths
// without touching route files.

const textField: FormFieldDef = {
  id: "field__title",
  section: "session",
  kind: "text",
  label: "Title",
  required: false,
  position: 0,
};

const longTextField: FormFieldDef = {
  id: "field__description",
  section: "session",
  kind: "long_text",
  label: "Description",
  required: false,
  position: 1,
};

const dropdownField: FormFieldDef = {
  id: "field__track",
  section: "session",
  kind: "dropdown",
  label: "Track",
  required: false,
  position: 2,
  options: ["a", "b"],
};

const numberField: FormFieldDef = {
  id: "field__count",
  section: "session",
  kind: "number",
  label: "Count",
  required: false,
  position: 3,
};

const checkboxField: FormFieldDef = {
  id: "field__agree",
  section: "session",
  kind: "checkbox",
  label: "Agree",
  required: false,
  position: 4,
};

const fileField: FormFieldDef = {
  id: "field__attachment",
  section: "session",
  kind: "file",
  label: "Attachment",
  required: false,
  position: 5,
};

describe("validateAnswers — DEC-124 answer length caps", () => {
  it("accepts a text answer at exactly MAX_TEXT_LENGTH", () => {
    const value = "a".repeat(MAX_TEXT_LENGTH);
    const result = validateAnswers([textField], { [textField.id]: value });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cleaned[textField.id]).toBe(value);
    }
  });

  it("rejects a text answer one over MAX_TEXT_LENGTH with the exact message", () => {
    const value = "a".repeat(MAX_TEXT_LENGTH + 1);
    const result = validateAnswers([textField], { [textField.id]: value });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[textField.id]).toBe(overCapSentence(textField.label, value.length, MAX_TEXT_LENGTH));
    }
  });

  it("accepts a long_text answer at exactly MAX_LONG_TEXT_LENGTH", () => {
    const value = "a".repeat(MAX_LONG_TEXT_LENGTH);
    const result = validateAnswers([longTextField], { [longTextField.id]: value });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cleaned[longTextField.id]).toBe(value);
    }
  });

  it("rejects a long_text answer one over MAX_LONG_TEXT_LENGTH with the exact message", () => {
    const value = "a".repeat(MAX_LONG_TEXT_LENGTH + 1);
    const result = validateAnswers([longTextField], { [longTextField.id]: value });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[longTextField.id]).toBe(overCapSentence(longTextField.label, value.length, MAX_LONG_TEXT_LENGTH));
    }
  });

  it("rejects a 2MB long_text abuse payload — closes the reproduced abuse case", () => {
    const value = "a".repeat(2 * 1024 * 1024);
    const result = validateAnswers([longTextField], { [longTextField.id]: value });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[longTextField.id]).toBe(overCapSentence(longTextField.label, value.length, MAX_LONG_TEXT_LENGTH));
    }
  });

  it("records errors keyed on the correct field id when multiple fields are present", () => {
    const result = validateAnswers([textField, longTextField], {
      [textField.id]: "a".repeat(MAX_TEXT_LENGTH + 5),
      [longTextField.id]: "fine",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors)).toEqual([textField.id]);
      expect(result.errors[textField.id]).toContain("over");
    }
  });

  it("does not cap dropdown fields (bound to options)", () => {
    const result = validateAnswers([dropdownField], { [dropdownField.id]: "a" });
    expect(result.ok).toBe(true);
  });

  it("does not cap number fields", () => {
    const result = validateAnswers([numberField], { [numberField.id]: 12345 });
    expect(result.ok).toBe(true);
  });

  it("does not cap checkbox fields", () => {
    const result = validateAnswers([checkboxField], { [checkboxField.id]: true });
    expect(result.ok).toBe(true);
  });

  it("does not cap file fields (opaque file-id strings)", () => {
    const result = validateAnswers([fileField], { [fileField.id]: "file_abc123" });
    expect(result.ok).toBe(true);
  });

  // DEC-124 (wave 59 amendment): a field's own `maximum` narrows the kind
  // cap. Exercised directly against validateAnswers here (rather than only
  // via projectFieldForAnswers) so the enforcement is proven independent of
  // the projection that stamps it.
  describe("field.maximum narrows the kind cap", () => {
    const abstractField: FormFieldDef = { ...longTextField, maximum: 1200 };

    it("accepts exactly the field maximum", () => {
      const value = "a".repeat(1200);
      const result = validateAnswers([abstractField], { [abstractField.id]: value });
      expect(result.ok).toBe(true);
    });

    it("rejects one over the field maximum with the narrowed cap in the message", () => {
      const value = "a".repeat(1201);
      const result = validateAnswers([abstractField], { [abstractField.id]: value });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[abstractField.id]).toBe(overCapSentence(abstractField.label, value.length, 1200));
      }
    });

    it("a maximum GREATER than the kind cap does not widen it", () => {
      const widerField: FormFieldDef = { ...textField, maximum: MAX_TEXT_LENGTH + 500 };
      const value = "a".repeat(MAX_TEXT_LENGTH + 1);
      const result = validateAnswers([widerField], { [widerField.id]: value });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[widerField.id]).toBe(overCapSentence(widerField.label, value.length, MAX_TEXT_LENGTH));
      }
    });

    it("a long_text field with no maximum still allows up to MAX_LONG_TEXT_LENGTH (20000)", () => {
      const value = "a".repeat(20000);
      const result = validateAnswers([longTextField], { [longTextField.id]: value });
      expect(result.ok).toBe(true);
    });
  });
});

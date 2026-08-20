import { describe, expect, it } from "vitest";
import type { FormFieldDef } from "../src/forms/types";
import { FormField } from "../src/views/form-render";
import { validateAnswers, MAX_LONG_TEXT_LENGTH, resolvedTextCap } from "../src/forms/validate";

const textField: FormFieldDef = {
  id: "title",
  section: "session",
  kind: "text",
  label: "Title",
  required: true,
  position: 0,
  maximum: 200,
};

const longTextField: FormFieldDef = {
  id: "abstract",
  section: "session",
  kind: "long_text",
  label: "Abstract",
  required: true,
  position: 1,
};

const numberField: FormFieldDef = {
  id: "headcount",
  section: "session",
  kind: "number",
  label: "Headcount",
  required: false,
  position: 2,
  maximum: 50,
};

function render(field: FormFieldDef, value: unknown): string {
  return FormField({ field, value, visible: true }).toString();
}

describe("form-render caps (DEC-124 amendment)", () => {
  it("renders maxlength=200 for a text field with maximum 200, but no counter (DEC-909 wave-111: long-text only)", () => {
    const html = render(textField, "");
    expect(html).toContain('maxlength="200"');
    expect(html).not.toContain("chq-field-counter");
    expect(html).not.toContain("0 / 200");
  });

  it("renders maxlength equal to MAX_LONG_TEXT_LENGTH and a 0 / <cap> counter for a long_text with no maximum", () => {
    const html = render(longTextField, "");
    expect(html).toContain(`maxlength="${MAX_LONG_TEXT_LENGTH}"`);
    expect(html).toContain("chq-field-counter");
    expect(html).toContain(`0 / ${MAX_LONG_TEXT_LENGTH.toLocaleString("en-US")}`);
  });

  for (const field of [textField, longTextField]) {
    it(`${field.kind} field: rendered maxlength equals the exact length validateAnswers accepts`, () => {
      const cap = resolvedTextCap(field);
      const html = render(field, "");
      expect(html).toContain(`maxlength="${cap}"`);

      const okValue = "a".repeat(cap);
      const okResult = validateAnswers([field], { [field.id]: okValue });
      expect(okResult.ok).toBe(true);

      const tooLong = "a".repeat(cap + 1);
      const badResult = validateAnswers([field], { [field.id]: tooLong });
      expect(badResult.ok).toBe(false);
      if (!badResult.ok) {
        expect(badResult.errors[field.id]).toBeDefined();
      }
    });
  }

  it("renders no max attribute for a number field, even when field.maximum is set (w2-c, DEC-124 amendment: unbacked cap deleted)", () => {
    const html = render(numberField, "");
    expect(html).not.toContain("max=");
  });
});

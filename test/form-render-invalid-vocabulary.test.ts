import { describe, expect, it } from "vitest";
import type { FormFieldDef, FormFieldKind } from "../src/forms/types";
import { FormField } from "../src/views/form-render";

// DEC-124 (wave-24 amendment): one invalid vocabulary — a real aria-invalid
// attribute plus the chq-field-invalid class — for every FieldControl kind,
// never re-invented per control. This test enumerates every FormFieldKind so a
// seventh kind added to the switch in src/views/form-render.tsx fails here
// until it is wired into the same vocabulary.
const FIELDS: Record<FormFieldKind, FormFieldDef> = {
  text: {
    id: "title",
    section: "session",
    kind: "text",
    label: "Title",
    required: true,
    position: 0,
  },
  long_text: {
    id: "abstract",
    section: "session",
    kind: "long_text",
    label: "Abstract",
    required: true,
    position: 1,
  },
  dropdown: {
    id: "track",
    section: "session",
    kind: "dropdown",
    label: "Track",
    required: true,
    position: 2,
    options: ["A", "B"],
  },
  checkbox: {
    id: "agree",
    section: "session",
    kind: "checkbox",
    label: "Agree",
    required: true,
    position: 3,
  },
  number: {
    id: "headcount",
    section: "session",
    kind: "number",
    label: "Headcount",
    required: true,
    position: 4,
  },
  file: {
    id: "handout",
    section: "session",
    kind: "file",
    label: "Handout",
    required: true,
    position: 5,
  },
};

function render(field: FormFieldDef, error?: string): string {
  return FormField({ field, value: undefined, error, visible: true }).toString();
}

describe("form-render invalid vocabulary (DEC-124 wave-24 amendment)", () => {
  const kinds = Object.keys(FIELDS) as FormFieldKind[];

  it("enumerates all known FormFieldKinds (guards against a seventh kind slipping through uncovered)", () => {
    expect(kinds.sort()).toEqual(["checkbox", "dropdown", "file", "long_text", "number", "text"]);
  });

  for (const kind of kinds) {
    const field = FIELDS[kind];

    it(`${kind}: with an error carries aria-invalid="true" and the chq-field-invalid class`, () => {
      const html = render(field, "Required");
      expect(html).toContain('aria-invalid="true"');
      expect(html).toMatch(/class="[^"]*\bchq-field-invalid\b[^"]*"/);
    });

    it(`${kind}: without an error carries neither aria-invalid nor chq-field-invalid, and no empty class attribute`, () => {
      const html = render(field);
      expect(html).not.toContain("aria-invalid");
      expect(html).not.toContain("chq-field-invalid");
      expect(html).not.toMatch(/class=""/);
    });
  }
});

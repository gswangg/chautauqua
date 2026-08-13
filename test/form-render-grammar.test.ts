// DEC-909: the shared form renderer's field grammar -- micro-label, ' ·
// optional' marker (never ' *'), and the live long-text counter. Covers all
// three surfaces (/submit/:slug, /portal/edit, /portal/tasks) since they
// share this one renderer.
import { describe, expect, it } from "vitest";
import type { FormFieldDef } from "../src/forms/types";
import { FormField } from "../src/views/form-render";
import { MAX_LONG_TEXT_LENGTH } from "../src/forms/validate";

describe("form-render field grammar (DEC-909)", () => {
  it("a required short-text field carries no marker and no counter", () => {
    const field: FormFieldDef = {
      id: "title",
      section: "session",
      kind: "text",
      label: "Title",
      required: true,
      position: 0,
    };
    const html = FormField({ field, value: "My talk", visible: true }).toString();
    expect(html).not.toContain(" *");
    expect(html).not.toContain("chq-field-optional");
    expect(html).not.toContain("chq-field-counter");
  });

  it("an optional short-text field appends ' · optional' and carries no counter", () => {
    const field: FormFieldDef = {
      id: "notes",
      section: "session",
      kind: "text",
      label: "Notes for reviewers",
      required: false,
      position: 1,
    };
    const html = FormField({ field, value: undefined, visible: true }).toString();
    expect(html).toContain("chq-field-optional");
    expect(html).toContain(" · optional");
    expect(html).not.toContain("chq-field-counter");
  });

  it("a long-text field renders a live counter with the formatted default max and initial count", () => {
    const field: FormFieldDef = {
      id: "abstract",
      section: "session",
      kind: "long_text",
      label: "Abstract",
      required: true,
      position: 2,
    };
    const value = "x".repeat(412);
    const html = FormField({ field, value, visible: true }).toString();
    expect(html).toContain("chq-field-counter");
    expect(html).toContain(`412 / ${MAX_LONG_TEXT_LENGTH.toLocaleString("en-US")}`);
    expect(html).not.toContain(" *");
    expect(html).not.toContain("chq-field-optional");
  });

  it("a long-text field with its own maximum uses that maximum, thousands-separated", () => {
    const field: FormFieldDef = {
      id: "abstract2",
      section: "session",
      kind: "long_text",
      label: "Abstract",
      required: true,
      position: 3,
      maximum: 1200,
    };
    const value = "x".repeat(412);
    const html = FormField({ field, value, visible: true }).toString();
    expect(html).toContain("412 / 1,200");
  });

  it("a long-text field with no answer starts the counter at 0", () => {
    const field: FormFieldDef = {
      id: "abstract3",
      section: "session",
      kind: "long_text",
      label: "Abstract",
      required: true,
      position: 4,
      maximum: 1200,
    };
    const html = FormField({ field, value: undefined, visible: true }).toString();
    expect(html).toContain("0 / 1,200");
  });
});

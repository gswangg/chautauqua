// DEC-909: the shared form renderer's field grammar -- micro-label, ' ·
// optional' marker (never ' *'), and the live long-text counter. Covers all
// three surfaces (/submit/:slug, /portal/edit, /portal/tasks) since they
// share this one renderer.
import { describe, expect, it } from "vitest";
import type { FormFieldDef } from "../src/forms/types";
import { FormField } from "../src/views/form-render";
import { MAX_LONG_TEXT_LENGTH } from "../src/forms/validate";
import { allowedUploadExtensions, CFP_FILE_FIELD_KIND } from "../src/domain/files";

describe("form-render field grammar (DEC-909)", () => {
  // w1-a (DEC-124 amendment): the counter was widened from long_text-only
  // to text+long_text so a text field's cap (e.g. the locked title's
  // MAX_TEXT_LENGTH/maximum) is visible before submit, not just on refusal.
  it("a required short-text field carries no marker but does carry a counter", () => {
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
    expect(html).toContain("chq-field-counter");
  });

  it("an optional short-text field appends ' · optional' and still carries a counter", () => {
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
    expect(html).toContain("chq-field-counter");
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

  // w10-e (DEC-879 amendment), w54-d (DEC-879 amendment): a CFP file field's
  // accept attribute and its printed hint text must name the same
  // extensions — both derive from allowedUploadExtensions(CFP_FILE_FIELD_KIND),
  // not two independent lists, and CFP files are handout-tier (zip admitted,
  // video is not).
  it("a file field's accept attribute agrees with the printed hint (zip included, no video, CFP files are handout-tier)", () => {
    const field: FormFieldDef = {
      id: "slides",
      section: "session",
      kind: "file",
      label: "Slides",
      required: false,
      position: 5,
    };
    const html = FormField({ field, value: undefined, visible: true }).toString();
    for (const ext of allowedUploadExtensions(CFP_FILE_FIELD_KIND)) {
      expect(html).toContain(`.${ext}`);
    }
    expect(html).toContain(".zip");
    expect(html).not.toMatch(/\.(mp4|mov|webm)/);
  });
});

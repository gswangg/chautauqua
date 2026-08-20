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
  // w7-j (DEC-909 wave-111 amendment): the counter was narrowed back to
  // long_text-only -- the pack draws it exactly three times, all on the
  // Abstract field (long_text), never on a short text field. A short-text
  // field keeps its `maxlength`/validation cap (untouched) but carries no
  // counter affordance.
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

  it("an optional short-text field appends ' · optional' but carries no counter", () => {
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

  // DEC-909 wave-111: the pack draws the counter exactly three times in its
  // whole extent, all on the Abstract field of the CFP · 390 frame. The
  // citation itself sits on the assertion below, where the receipt scan
  // (app/src/frame-citation.scan.test.ts) can see its quote and its expect(.
  it("prints the frame's exact counter literal ('412 / 1,200') for a 412-char abstract against a 1,200 cap (frame :1037)", () => {
    const field: FormFieldDef = {
      id: "abstract-frame-1037",
      section: "session",
      kind: "long_text",
      label: "Abstract",
      required: true,
      position: 3,
      maximum: 1200,
    };
    const value = "x".repeat(412);
    const html = FormField({ field, value, visible: true }).toString();
    // docs/design/Chautauqua Public and Portal.dc.html:1037 `412 / 1,200`
    expect(html).toContain("412 / 1,200");
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

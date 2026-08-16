// Regression for the portal-edit 400 on forms with required file fields
// (DEC-109): extractAnswers never reads file inputs from the request body
// (files are read-only in the edit portal per DEC-041), but it must carry
// the already-stored file answer forward so validateAnswers doesn't see a
// missing required answer. A missing stored answer must still not be fatal
// here — the POST handler forces file-kind required to false before
// validating, since public submit (src/forms/validate.ts, unmodified) is
// the only place required files are truly enforced.

import { describe, expect, it } from "vitest";
import { extractAnswers } from "../src/routes/portal/edit";
import { validateAnswers } from "../src/forms/validate";
import type { FormFieldDef, AnswerMap } from "../src/forms/types";
import { fieldInputName } from "../src/views/form-render";

const FILE_FIELD: FormFieldDef = {
  id: "headshot",
  section: "speaker",
  kind: "file",
  label: "Headshot",
  required: true,
  position: 0,
};

const TEXT_FIELD: FormFieldDef = {
  id: "bio",
  section: "speaker",
  kind: "text",
  label: "Bio",
  required: false,
  position: 1,
};

const CHECKBOX_FIELD: FormFieldDef = {
  id: "agree",
  section: "speaker",
  kind: "checkbox",
  label: "Agree",
  required: false,
  position: 2,
};

describe("extractAnswers (portal edit, DEC-109)", () => {
  it("carries the stored file answer over when present, ignoring any body value", () => {
    const body: Record<string, unknown> = {
      [fieldInputName(FILE_FIELD.id)]: "malicious-client-supplied-value",
    };
    const stored: AnswerMap = { [FILE_FIELD.id]: "uploads/headshot-abc123.jpg" };
    const answers = extractAnswers([FILE_FIELD], body, stored).answers;
    expect(answers[FILE_FIELD.id]).toBe("uploads/headshot-abc123.jpg");
  });

  it("yields no key for a file field when no stored answer exists", () => {
    const answers = extractAnswers([FILE_FIELD], {}, {}).answers;
    expect(Object.prototype.hasOwnProperty.call(answers, FILE_FIELD.id)).toBe(false);
  });

  it("ignores a non-string or empty-string stored file answer", () => {
    const answers1 = extractAnswers([FILE_FIELD], {}, { [FILE_FIELD.id]: "" }).answers;
    expect(Object.prototype.hasOwnProperty.call(answers1, FILE_FIELD.id)).toBe(false);

    const answers2 = extractAnswers([FILE_FIELD], {}, { [FILE_FIELD.id]: 42 }).answers;
    expect(Object.prototype.hasOwnProperty.call(answers2, FILE_FIELD.id)).toBe(false);
  });

  it("checkbox behavior is unchanged: present body key -> true, absent -> false", () => {
    const present = extractAnswers([CHECKBOX_FIELD], { [fieldInputName(CHECKBOX_FIELD.id)]: "on" }, {}).answers;
    expect(present[CHECKBOX_FIELD.id]).toBe(true);

    const absent = extractAnswers([CHECKBOX_FIELD], {}, {}).answers;
    expect(absent[CHECKBOX_FIELD.id]).toBe(false);
  });

  it("text behavior is unchanged: reads from body, skips when absent", () => {
    const withValue = extractAnswers([TEXT_FIELD], { [fieldInputName(TEXT_FIELD.id)]: "hello" }, {}).answers;
    expect(withValue[TEXT_FIELD.id]).toBe("hello");

    const withoutValue = extractAnswers([TEXT_FIELD], {}, {}).answers;
    expect(Object.prototype.hasOwnProperty.call(withoutValue, TEXT_FIELD.id)).toBe(false);
  });
});

describe("extractAnswers + validateAnswers composition (DEC-109)", () => {
  function validateForEdit(fields: FormFieldDef[], answers: AnswerMap) {
    // Mirrors the POST handler in src/routes/portal/edit.tsx: file-kind
    // required is forced false since files are read-only here.
    return validateAnswers(
      fields.map((f) => (f.kind === "file" ? { ...f, required: false } : f)),
      answers,
    );
  }

  it("ok:true when a required file field has a stored answer", () => {
    const stored: AnswerMap = { [FILE_FIELD.id]: "uploads/headshot-abc123.jpg" };
    const answers = extractAnswers([FILE_FIELD], {}, stored).answers;
    const result = validateForEdit([FILE_FIELD], answers);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cleaned[FILE_FIELD.id]).toBe("uploads/headshot-abc123.jpg");
    }
  });

  it("ok:true when a required file field has no stored answer (required forced false)", () => {
    const answers = extractAnswers([FILE_FIELD], {}, {}).answers;
    const result = validateForEdit([FILE_FIELD], answers);
    expect(result.ok).toBe(true);
  });

  it("public submit path (validateAnswers unmodified) still rejects a missing required file", () => {
    const result = validateAnswers([FILE_FIELD], {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[FILE_FIELD.id]).toBe("required");
    }
  });
});

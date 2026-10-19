/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { DEFAULT_ONBOARDING_TASKS, FORM_TASK_FIELD_SPECS } from "../src/domain/acceptance";

describe("DEC-111 FORM_TASK_FIELD_SPECS covers every kind='form' onboarding template", () => {
  const formTemplateTitles = DEFAULT_ONBOARDING_TASKS.filter((t) => t.kind === "form").map((t) => t.title);

  it("has at least one form-kind template", () => {
    expect(formTemplateTitles.length).toBeGreaterThan(0);
  });

  it("has a FORM_TASK_FIELD_SPECS entry for every form-kind template title", () => {
    for (const title of formTemplateTitles) {
      const specs = FORM_TASK_FIELD_SPECS[title];
      expect(specs, `missing spec for ${title}`).toBeDefined();
      expect(specs?.length).toBeGreaterThan(0);
    }
  });

  it("every 'file' kind field is optional (a required upload can't be pre-filled by the organizer)", () => {
    for (const specs of Object.values(FORM_TASK_FIELD_SPECS)) {
      for (const spec of specs) {
        if (spec.kind === "file") {
          expect(spec.required, `file field "${spec.label}" must not be required`).toBe(false);
        }
      }
    }
  });

  it("required dropdown fields always have options", () => {
    for (const specs of Object.values(FORM_TASK_FIELD_SPECS)) {
      for (const spec of specs) {
        if (spec.kind === "dropdown" && spec.required) {
          expect(spec.options && spec.options.length > 0, `dropdown "${spec.label}" needs options`).toBe(true);
        }
      }
    }
  });

  it("matches the exact DEC-111 specs for the two must-have forms", () => {
    expect(FORM_TASK_FIELD_SPECS["Hotel stay requirement form"]).toEqual([
      { section: "speaker", kind: "dropdown", label: "Do you need a hotel room?", required: true, options: ["Yes", "No"] },
      { section: "speaker", kind: "text", label: "Check-in date", required: false },
      { section: "speaker", kind: "text", label: "Check-out date", required: false },
      { section: "speaker", kind: "long_text", label: "Special requests", required: false },
    ]);
    expect(FORM_TASK_FIELD_SPECS["Flight reimbursement form"]).toEqual([
      {
        section: "speaker",
        kind: "dropdown",
        label: "Do you need flight reimbursement?",
        required: true,
        options: ["Yes", "No"],
      },
      { section: "speaker", kind: "text", label: "Departure airport", required: false },
      { section: "speaker", kind: "number", label: "Estimated reimbursement amount (USD)", required: false },
      { section: "speaker", kind: "long_text", label: "Notes", required: false },
      { section: "speaker", kind: "file", label: "Receipt or booking confirmation", required: false },
    ]);
  });
});


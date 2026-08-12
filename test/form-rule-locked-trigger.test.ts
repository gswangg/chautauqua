// Regression for DEC-475: a form_field row's ruleJson references a locked
// trigger field by the builder's raw per-form PK ('<formId>:description'),
// minted at src/server/repo/forms.ts's lockedFieldId. The render/validate
// projections (getFormFields in src/server/repo/submit.ts,
// loadEditableSubmission in src/server/repo/portal-edit.ts) already
// normalize a locked row's own `id` to its short name (e.g. 'description')
// via lockedFieldName — this test proves `rule.fieldId` gets the identical
// normalization, since answers/isVisible/validateAnswers are all keyed by
// the short name. Before DEC-475, `rule.fieldId` was passed through
// unmapped, so any rule keyed on a locked trigger field silently and
// permanently evaluated against `answers['<formId>:description']`, which is
// always undefined.

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { getFormFields } from "../src/server/repo/submit";
import { loadEditableSubmission } from "../src/server/repo/portal-edit";
import { isVisible } from "../src/forms/visibility";
import { validateAnswers } from "../src/forms/validate";
import type { FormFieldDef } from "../src/forms/types";

const FORM_ID = "f1";

// A dependent custom field, gated on the locked 'description' field: the
// builder stores the rule against the raw PK '<formId>:description'.
const DEPENDENT_ROW = {
  id: "materials",
  formId: FORM_ID,
  section: "session",
  kind: "text",
  label: "Materials needed",
  helpText: null,
  required: true,
  position: 1,
  optionsJson: null,
  ruleJson: JSON.stringify({ fieldId: `${FORM_ID}:description`, op: "eq", value: "x" }),
  locked: false,
};

const LOCKED_DESCRIPTION_ROW = {
  id: `${FORM_ID}:description`,
  formId: FORM_ID,
  section: "session",
  kind: "long_text",
  label: "Description",
  helpText: null,
  required: true,
  position: 0,
  optionsJson: null,
  ruleJson: null,
  locked: true,
};

// ---------------------------------------------------------------------------
// Fake drizzle-style db, following the pattern in
// test/portal-edit-speaker-locked.test.ts / test/claim.test.ts.
// ---------------------------------------------------------------------------

function makeFakeSubmitDb(fieldRows: unknown[]) {
  function chainFor(rows: unknown[]) {
    const chain: Record<string, unknown> = {
      where: () => chain,
      orderBy: (): unknown[] => rows,
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(rows).then(resolve, reject),
    };
    return chain;
  }
  const db = {
    select() {
      return {
        from(table: unknown) {
          if (table !== schema.formField) throw new Error("fake db: unexpected table");
          return chainFor(fieldRows);
        },
      };
    },
  };
  return db as unknown as Db;
}

describe("getFormFields normalizes rule.fieldId (DEC-475)", () => {
  it("a rule referencing the raw locked PK comes back keyed by the short locked name", async () => {
    const db = makeFakeSubmitDb([LOCKED_DESCRIPTION_ROW, DEPENDENT_ROW]);
    const fields = await getFormFields(db, FORM_ID);
    const dependent = fields.find((f) => f.id === "materials");
    expect(dependent?.rule?.fieldId).toBe("description");
  });

  it("guard: no returned field's rule.fieldId contains ':'", async () => {
    const db = makeFakeSubmitDb([LOCKED_DESCRIPTION_ROW, DEPENDENT_ROW]);
    const fields = await getFormFields(db, FORM_ID);
    for (const f of fields) {
      if (f.rule) expect(f.rule.fieldId).not.toContain(":");
    }
  });
});

describe("loadEditableSubmission normalizes rule.fieldId (DEC-475)", () => {
  function makeFakePortalDb(fieldRows: unknown[]) {
    const mainRow = {
      submissionId: "s1",
      status: "pending",
      title: "My Talk",
      description: "desc",
      formId: FORM_ID,
      formCloseDate: null,
      formTracksJson: null,
      eventId: "e1",
      participantContactId: "c1",
    };
    const contactRow = {
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.test",
      title: null,
      company: null,
      bio: null,
    };
    function rowsFor(table: unknown): unknown[] {
      if (table === schema.participant) return [mainRow];
      if (table === schema.contact) return [contactRow];
      if (table === schema.formField) return fieldRows;
      if (table === schema.submissionAnswer) return [];
      if (table === schema.track) return [];
      if (table === schema.submissionTrack) return [];
      throw new Error("fake db: unexpected table in select");
    }
    function chainFor(rows: unknown[]) {
      const chain: Record<string, unknown> = {
        innerJoin: () => chain,
        leftJoin: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: (n: number) => Promise.resolve(rows.slice(0, n)),
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(rows).then(resolve, reject),
      };
      return chain;
    }
    const db = {
      select() {
        return {
          from(table: unknown) {
            return chainFor(rowsFor(table));
          },
        };
      },
    };
    return db as unknown as Db;
  }

  it("a rule referencing the raw locked PK comes back keyed by the short locked name", async () => {
    const db = makeFakePortalDb([LOCKED_DESCRIPTION_ROW, DEPENDENT_ROW]);
    const result = await loadEditableSubmission(db, "c1", "s1");
    expect(result).not.toBeNull();
    const dependent = result!.fields.find((f) => f.id === "materials");
    expect(dependent?.rule?.fieldId).toBe("description");
  });

  it("guard: no returned field's rule.fieldId contains ':'", async () => {
    const db = makeFakePortalDb([LOCKED_DESCRIPTION_ROW, DEPENDENT_ROW]);
    const result = await loadEditableSubmission(db, "c1", "s1");
    expect(result).not.toBeNull();
    for (const f of result!.fields) {
      if (f.rule) expect(f.rule.fieldId).not.toContain(":");
    }
  });
});

describe("regression: normalized rule correctly gates isVisible + validateAnswers (DEC-475)", () => {
  const descriptionField: FormFieldDef = {
    id: "description",
    section: "session",
    kind: "long_text",
    label: "Description",
    required: true,
    position: 0,
  };
  const dependentField: FormFieldDef = {
    id: "materials",
    section: "session",
    kind: "text",
    label: "Materials needed",
    required: true,
    position: 1,
    rule: { fieldId: "description", op: "eq", value: "x" },
  };
  const fields = [descriptionField, dependentField];

  it("shows and requires the dependent field when the trigger answer matches", () => {
    const answers = { description: "x" };
    expect(isVisible(dependentField, answers, "long_text")).toBe(true);

    const result = validateAnswers(fields, { description: "x" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.materials).toBe("required");
    }
  });

  it("hides and skips the dependent field when the trigger answer does not match", () => {
    const answers = { description: "y" };
    expect(isVisible(dependentField, answers, "long_text")).toBe(false);

    const result = validateAnswers(fields, { description: "y" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.prototype.hasOwnProperty.call(result.cleaned, "materials")).toBe(false);
    }
  });
});

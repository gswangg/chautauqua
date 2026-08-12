// Regression for DEC-501 (a portal edit never deletes answers for fields a
// rule has just hidden, so stale answers survive into reviews and exports).
//
// Two layers exercised here:
//   1. validateAnswers (src/forms/validate.ts) must name every rule-hidden
//      field in hiddenFieldIds — including a field hidden transitively
//      because its own driver field is itself hidden.
//   2. saveSubmissionEdits (src/server/repo/portal-edit.ts) must delete
//      submission_answer rows for those hidden field ids (excluding locked
//      built-ins, which are never rule-hidden and never stored there), and
//      must issue no delete at all when hiddenFieldIds is empty.
//
// Fake db harness mirrors test/portal-edit-speaker-locked.test.ts (dispatch
// by table identity).

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { saveSubmissionEdits } from "../src/server/repo/portal-edit";
import { validateAnswers } from "../src/forms/validate";
import type { FormFieldDef } from "../src/forms/types";

// ---------------------------------------------------------------------------
// validateAnswers: hiddenFieldIds
// ---------------------------------------------------------------------------

describe("validateAnswers hiddenFieldIds (DEC-501)", () => {
  const FORMAT_FIELD: FormFieldDef = {
    id: "format",
    section: "session",
    kind: "dropdown",
    label: "Format",
    required: true,
    position: 0,
    options: ["Talk", "Workshop"],
  };
  const WORKSHOP_LENGTH_FIELD: FormFieldDef = {
    id: "workshop_length",
    section: "session",
    kind: "text",
    label: "Workshop length",
    required: false,
    position: 1,
    rule: { fieldId: "format", op: "eq", value: "Workshop" },
  };
  // Transitive chain: only visible when workshop_length is visible AND its
  // driver (format) resolves to Workshop. If format is not Workshop,
  // workshop_length is hidden, and this field's own rule references
  // workshop_length directly — so it's hidden "because its own driver is
  // hidden", not because of a fresh evaluation against format.
  const WORKSHOP_DETAIL_FIELD: FormFieldDef = {
    id: "workshop_detail",
    section: "session",
    kind: "text",
    label: "Workshop detail",
    required: false,
    position: 2,
    rule: { fieldId: "workshop_length", op: "eq", value: "long" },
  };

  const fields = [FORMAT_FIELD, WORKSHOP_LENGTH_FIELD, WORKSHOP_DETAIL_FIELD];

  it("names every rule-hidden field, including one hidden via its own hidden driver", () => {
    const result = validateAnswers(fields, { format: "Talk" });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.hiddenFieldIds).toEqual(["workshop_length", "workshop_detail"]);
    expect(result.cleaned.workshop_length).toBeUndefined();
    expect(result.cleaned.workshop_detail).toBeUndefined();
  });

  it("is empty when all fields are visible", () => {
    const result = validateAnswers(fields, {
      format: "Workshop",
      workshop_length: "long",
      workshop_detail: "bring a laptop",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.hiddenFieldIds).toEqual([]);
    expect(result.cleaned.workshop_length).toBe("long");
    expect(result.cleaned.workshop_detail).toBe("bring a laptop");
  });
});

// ---------------------------------------------------------------------------
// saveSubmissionEdits: deletes stale hidden-field answers
// ---------------------------------------------------------------------------

interface FakeDbData {
  submissionRows?: unknown[];
  contactRows?: unknown[];
}

function makeFakeDb(data: FakeDbData) {
  const updates: Array<{ table: unknown; values: Record<string, unknown> }> = [];
  const inserts: Array<{ table: unknown; values: Record<string, unknown> }> = [];
  const deletes: Array<{ table: unknown }> = [];

  function rowsFor(table: unknown): unknown[] {
    if (table === schema.submission) return data.submissionRows ?? [];
    if (table === schema.contact) return data.contactRows ?? [];
    if (table === schema.submissionAnswer) return [];
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
    update(table: unknown) {
      return {
        set(values: Record<string, unknown>) {
          return {
            where: () => {
              updates.push({ table, values });
              return Promise.resolve();
            },
          };
        },
      };
    },
    insert(table: unknown) {
      return {
        values(values: Record<string, unknown>) {
          inserts.push({ table, values });
          return Promise.resolve();
        },
      };
    },
    delete(table: unknown) {
      return {
        where: () => {
          deletes.push({ table });
          return Promise.resolve();
        },
      };
    },
  };

  return { db: db as unknown as Db, updates, inserts, deletes };
}

describe("saveSubmissionEdits hidden-field answer cleanup (DEC-501)", () => {
  it("issues a delete for a hidden custom field's stale answer", async () => {
    const { db, deletes } = makeFakeDb({});
    await saveSubmissionEdits(
      db,
      "s1",
      "c1",
      { title: "T", description: "D", format: "Talk" },
      null,
      ["workshop_length"],
    );
    const answerDeletes = deletes.filter((d) => d.table === schema.submissionAnswer);
    expect(answerDeletes.length).toBe(1);
  });

  it("never deletes for a locked built-in id even if passed in hiddenFieldIds", async () => {
    const { db, deletes } = makeFakeDb({});
    await saveSubmissionEdits(
      db,
      "s1",
      "c1",
      { title: "T", description: "D" },
      null,
      ["first_name", "email"],
    );
    const answerDeletes = deletes.filter((d) => d.table === schema.submissionAnswer);
    expect(answerDeletes.length).toBe(0);
  });

  it("issues no delete at all when hiddenFieldIds is empty", async () => {
    const { db, deletes } = makeFakeDb({});
    await saveSubmissionEdits(db, "s1", "c1", { title: "T", description: "D" }, null, []);
    expect(deletes.length).toBe(0);
  });

  it("still upserts a visible custom answer and leaves other custom/locked data alone alongside a hidden-field delete", async () => {
    const { db, updates, inserts, deletes } = makeFakeDb({});
    await saveSubmissionEdits(
      db,
      "s1",
      "c1",
      { title: "T", description: "D", format: "Talk", other_field: "kept" },
      null,
      ["workshop_length"],
    );
    const answerInsert = inserts.find(
      (i) => i.table === schema.submissionAnswer && i.values.formFieldId === "other_field",
    );
    expect(answerInsert).toBeDefined();
    const answerDeletes = deletes.filter((d) => d.table === schema.submissionAnswer);
    expect(answerDeletes.length).toBe(1);
    // The contact row was never updated (no locked speaker name fields
    // present in this request).
    expect(updates.find((u) => u.table === schema.contact)).toBeUndefined();
  });
});

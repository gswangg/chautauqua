// Regression for DEC-121 (J2/J7 — speakers never re-enter data; edits land
// on the producer's contact record): portal-edit's locked speaker fields
// (first_name, last_name, email) must prefill from the contact row (never
// submission_answer), name edits must sync back onto contact, and email is
// read-only in this flow — never accepted from the request body, never
// written back to contact.
//
// This file exercises the real repo/extractAnswers code directly (no
// vi.mock of ../src/server/repo/portal-edit — see
// test/portal-edit-speaker-locked-route.test.ts for the mocked route-level
// checks, kept in a separate file because vi.mock is hoisted per-file and
// would otherwise shadow these direct calls).

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import type { Db } from "../src/server/context";
import { loadEditableSubmission, saveSubmissionEdits } from "../src/server/repo/portal-edit";
import { extractAnswers } from "../src/routes/portal/edit";
import { fieldInputName } from "../src/views/form-render";
import type { FormFieldDef } from "../src/forms/types";

// ---------------------------------------------------------------------------
// Minimal fake drizzle-style db (dispatches select/update by table identity,
// mirrors the pattern used in test/claim.test.ts).
// ---------------------------------------------------------------------------

interface FakeDbData {
  mainRows: unknown[];
  contactRows: unknown[];
  fieldRows: unknown[];
  answerRows?: unknown[];
  trackRows?: unknown[];
  submissionTrackRows?: unknown[];
  // DEC-158 (task w3-b): saveSubmissionEdits now reads the pre-edit
  // submission row to decide whether to append a submission_revision.
  // Empty by default: these tests aren't exercising the history feature,
  // so an empty pre-edit snapshot means the revision-append branch is
  // skipped (no insert() call, which this fake db doesn't support).
  submissionRows?: unknown[];
}

function makeFakeDb(data: FakeDbData) {
  const updates: Array<{ table: unknown; values: Record<string, unknown> }> = [];

  function rowsFor(table: unknown): unknown[] {
    if (table === schema.participant) return data.mainRows;
    if (table === schema.contact) return data.contactRows;
    if (table === schema.formField) return data.fieldRows;
    if (table === schema.submissionAnswer) return data.answerRows ?? [];
    if (table === schema.track) return data.trackRows ?? [];
    if (table === schema.submissionTrack) return data.submissionTrackRows ?? [];
    if (table === schema.submission) return data.submissionRows ?? [];
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
    insert() {
      throw new Error("fake db: insert not supported in this test");
    },
    delete() {
      throw new Error("fake db: delete not supported in this test");
    },
  };

  return { db: db as unknown as Db, updates };
}

const MAIN_ROW = {
  submissionId: "s1",
  status: "pending",
  title: "My Talk",
  description: "desc",
  formId: "f1",
  formCloseDate: null,
  formTracksJson: null,
  eventId: "e1",
  participantContactId: "c1",
};

const FIELD_ROWS = [
  { id: "first_name", section: "speaker", kind: "text", label: "First name", helpText: null, required: true, position: 0, optionsJson: null, ruleJson: null },
  { id: "last_name", section: "speaker", kind: "text", label: "Last name", helpText: null, required: true, position: 1, optionsJson: null, ruleJson: null },
  { id: "email", section: "speaker", kind: "text", label: "Email", helpText: null, required: true, position: 2, optionsJson: null, ruleJson: null },
];

describe("loadEditableSubmission (DEC-121 prefill)", () => {
  it("prefills first_name/last_name/email from the contact record, not submission_answer", async () => {
    const { db } = makeFakeDb({
      mainRows: [MAIN_ROW],
      contactRows: [{ firstName: "Jane", lastName: "Doe", email: "jane@example.test" }],
      fieldRows: FIELD_ROWS,
      answerRows: [],
    });
    const result = await loadEditableSubmission(db, "o1", "c1", "s1");
    expect(result).not.toBeNull();
    expect(result!.answers.first_name).toBe("Jane");
    expect(result!.answers.last_name).toBe("Doe");
    expect(result!.answers.email).toBe("jane@example.test");
  });
});

describe("saveSubmissionEdits (DEC-121 contact sync)", () => {
  it("syncs first_name/last_name onto the contact row and never touches email", async () => {
    const { db, updates } = makeFakeDb({ mainRows: [], contactRows: [], fieldRows: [] });
    await saveSubmissionEdits(
      db,
      "s1",
      "c1",
      { title: "T", description: "D", first_name: "NewFirst", last_name: "NewLast", email: "attacker@example.test" },
      null,
      [],
    );
    const contactUpdate = updates.find((u) => u.table === schema.contact);
    expect(contactUpdate).toBeDefined();
    expect(contactUpdate!.values.firstName).toBe("NewFirst");
    expect(contactUpdate!.values.lastName).toBe("NewLast");
    // The whole point of DEC-121: email is never synced from this path,
    // no matter what shows up in cleanedAnswers.
    expect(Object.prototype.hasOwnProperty.call(contactUpdate!.values, "email")).toBe(false);
  });

  it("does not touch the contact row when neither name field is present", async () => {
    const { db, updates } = makeFakeDb({ mainRows: [], contactRows: [], fieldRows: [] });
    await saveSubmissionEdits(db, "s1", "c1", { title: "T", description: "D" }, null, []);
    expect(updates.find((u) => u.table === schema.contact)).toBeUndefined();
  });
});

describe("extractAnswers (DEC-121 locked email carry-over)", () => {
  const EMAIL_FIELD: FormFieldDef = {
    id: "email",
    section: "speaker",
    kind: "text",
    label: "Email",
    required: true,
    position: 2,
  };

  it("never reads field__email from the body — carries the stored answer so required-validation still passes", () => {
    const stored = { email: "jane@example.test" };
    const answers = extractAnswers([EMAIL_FIELD], {}, stored).answers;
    expect(answers.email).toBe("jane@example.test");
  });

  it("a body-supplied field__email is ignored, even when present alongside a stored value", () => {
    const body: Record<string, unknown> = { [fieldInputName(EMAIL_FIELD.id)]: "attacker@example.test" };
    const stored = { email: "jane@example.test" };
    const answers = extractAnswers([EMAIL_FIELD], body, stored).answers;
    expect(answers.email).toBe("jane@example.test");
    expect(answers.email).not.toBe("attacker@example.test");
  });
});

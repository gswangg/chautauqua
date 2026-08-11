// DEC-291 repo-level regression: getAssignmentResponseDetail (src/server/
// repo/tasks.ts) parses task_assignment.response_json as an AnswerMap keyed
// by form_field.id and joins it against listFields in field order, so
// unanswered fields render with an empty-string value instead of being
// omitted, and array-valued answers are stringified as a comma-joined list.
// In-memory table-double fakeDb pattern from test/onboarding-late-
// participant.test.ts (no real-D1 harness exists in stage 1 per DEC-266).

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import { getAssignmentResponseDetail } from "../src/server/repo/tasks";
import type { Db } from "../src/server/context";

function fakeDb(seed: {
  taskAssignment?: unknown[];
  task?: unknown[];
  contact?: unknown[];
  formField?: unknown[];
}) {
  const state = {
    taskAssignment: [...(seed.taskAssignment ?? [])] as any[],
    task: [...(seed.task ?? [])] as any[],
    contact: [...(seed.contact ?? [])] as any[],
    formField: [...(seed.formField ?? [])] as any[],
  };

  function stateArrayFor(table: unknown): any[] | undefined {
    if (table === schema.taskAssignment) return state.taskAssignment;
    if (table === schema.task) return state.task;
    if (table === schema.contact) return state.contact;
    if (table === schema.formField) return state.formField;
    return undefined;
  }

  function makeChain(rows: unknown[]) {
    const chain: any = {
      innerJoin: () => chain,
      where: () => chain,
      limit: () => chain,
      // formField rows are pre-sorted by position in the seed, so a no-op
      // orderBy still yields deterministic field order for this test.
      orderBy: () => chain,
      then: (resolve: (v: unknown[]) => void) => resolve(rows),
    };
    return chain;
  }

  const db = {
    select: (_cols?: unknown) => ({
      from: (table: unknown) => makeChain([...(stateArrayFor(table) ?? [])]),
    }),
  };
  return { db: db as unknown as Db };
}

const ASSIGNMENT_ID = "assignment-1";
const TASK_ID = "task-1";
const FORM_ID = "form-1";
const CONTACT_ID = "contact-1";

// The fakeDb below performs no real join/projection — .from(taskAssignment)
// just returns the raw seeded rows, so every column the repo's select
// projects (including ones aliased from the joined task/contact tables) must
// already be denormalized onto the taskAssignment row, same convention as
// test/onboarding-late-participant.test.ts's fakeDb.
function baseTaskAssignmentRow(responseJson: string | null) {
  return {
    id: ASSIGNMENT_ID,
    taskId: TASK_ID,
    contactId: CONTACT_ID,
    status: "complete",
    completedAt: new Date(1700000000000),
    responseJson,
    taskTitle: "Hotel stay requirement form",
    taskKind: "form",
    formId: FORM_ID,
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
  };
}

const TASK_ROW = { id: TASK_ID, eventId: "event-1", title: "Hotel stay requirement form", kind: "form", formId: FORM_ID };
const CONTACT_ROW = { id: CONTACT_ID, firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" };

function fieldRow(id: string, label: string, kind = "text", position = 0) {
  return { id, formId: FORM_ID, section: "speaker", kind, label, helpText: null, required: false, position, optionsJson: null, ruleJson: null, locked: false };
}

describe("DEC-291 getAssignmentResponseDetail", () => {
  it("joins answers against fields in listFields order, blank value for an unanswered field", async () => {
    const { db } = fakeDb({
      taskAssignment: [baseTaskAssignmentRow(JSON.stringify({ "f-hotel": "The Grand" }))],
      task: [TASK_ROW],
      contact: [CONTACT_ROW],
      formField: [fieldRow("f-hotel", "Hotel name", "text", 0), fieldRow("f-notes", "Special requests", "text", 1)],
    });

    const detail = await getAssignmentResponseDetail(db, ASSIGNMENT_ID);
    expect(detail).not.toBeNull();
    expect(detail?.taskTitle).toBe("Hotel stay requirement form");
    expect(detail?.taskKind).toBe("form");
    expect(detail?.contact).toEqual({ id: CONTACT_ID, name: "Ada Lovelace", email: "ada@example.com" });
    expect(detail?.completedAt).toBe(1700000000000);
    expect(detail?.fields).toEqual([
      { label: "Hotel name", value: "The Grand" },
      { label: "Special requests", value: "" },
    ]);
  });

  it("stringifies an array-valued answer as a comma-joined list", async () => {
    const { db } = fakeDb({
      taskAssignment: [baseTaskAssignmentRow(JSON.stringify({ "f-modes": ["car", "train"] }))],
      task: [TASK_ROW],
      contact: [CONTACT_ROW],
      formField: [fieldRow("f-modes", "Travel modes", "checkbox", 0)],
    });

    const detail = await getAssignmentResponseDetail(db, ASSIGNMENT_ID);
    expect(detail?.fields).toEqual([{ label: "Travel modes", value: "car, train" }]);
  });

  it("returns an empty fields array (never throws) when no response has been saved yet", async () => {
    const { db } = fakeDb({
      taskAssignment: [baseTaskAssignmentRow(null)],
      task: [TASK_ROW],
      contact: [CONTACT_ROW],
      formField: [fieldRow("f-hotel", "Hotel name", "text", 0)],
    });

    const detail = await getAssignmentResponseDetail(db, ASSIGNMENT_ID);
    expect(detail?.fields).toEqual([{ label: "Hotel name", value: "" }]);
  });

  it("returns null for an assignment id that does not exist", async () => {
    const { db } = fakeDb({ taskAssignment: [], task: [TASK_ROW], contact: [CONTACT_ROW], formField: [] });
    const detail = await getAssignmentResponseDetail(db, "does-not-exist");
    expect(detail).toBeNull();
  });
});

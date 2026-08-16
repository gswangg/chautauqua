// DEC-291/DEC-694 (r2-Speakers reports em-dashes on completed responses):
// proves the speaker's saved form-task answers round-trip end to end —
// from the exact key-building pipeline POST /portal/tasks/:id/form uses
// (fieldInputName(field.id) -> validateAnswers -> saveTaskFormResponse),
// through GET /api/v1/task-assignments/:id/response
// (getAssignmentResponseDetail, keyed by the SAME listFields(...).id). A
// field-id shape mismatch between the two sides would silently render every
// answer as the empty-value em-dash, never throwing — this test would catch
// that regression where the mocked-repo route tests can't. In-memory
// table-double fakeDb pattern from test/task-assignment-response-detail.test.ts,
// extended with update() so the portal save is observable by the reader.

import { describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import { getAssignmentResponseDetail } from "../src/server/repo/tasks";
import { saveTaskFormResponse } from "../src/server/repo/portal";
import { validateAnswers } from "../src/forms/validate";
import { fieldInputName } from "../src/views/form-render";
import type { FormFieldDef, AnswerMap } from "../src/forms/types";
import type { Db } from "../src/server/context";

function fakeDb(seed: { taskAssignment?: unknown[]; task?: unknown[]; contact?: unknown[]; formField?: unknown[] }) {
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
      orderBy: () => chain,
      then: (resolve: (v: unknown[]) => void) => resolve(rows),
    };
    return chain;
  }

  const db = {
    select: (_cols?: unknown) => ({
      from: (table: unknown) => makeChain([...(stateArrayFor(table) ?? [])]),
    }),
    update: (table: unknown) => ({
      set: (patch: Record<string, unknown>) => ({
        where: () => {
          const write = async () => {
            const arr = stateArrayFor(table) ?? [];
            for (const row of arr) Object.assign(row, patch);
          };
          return { then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => write().then(resolve, reject) };
        },
      }),
    }),
  };
  return { db: db as unknown as Db, state };
}

const ASSIGNMENT_ID = "assignment-1";
const TASK_ID = "task-1";
const FORM_ID = "form-1";
const CONTACT_ID = "contact-1";

function fieldRow(id: string, label: string, kind = "text", position = 0) {
  return { id, formId: FORM_ID, section: "speaker", kind, label, helpText: null, required: false, position, optionsJson: null, ruleJson: null, locked: false };
}

describe("DEC-291/DEC-694: portal save -> organizer response-detail round-trip", () => {
  it("returns the speaker's actual saved values, not em-dashes, keyed by the SAME field ids the portal writer used", async () => {
    // FormFieldDef shape as listFields projects it (used by BOTH the portal
    // form renderer/writer and the organizer response-detail reader).
    const fields: FormFieldDef[] = [
      { id: "f-hotel", section: "speaker", kind: "text", label: "Hotel name", required: true, position: 0 },
      { id: "f-notes", section: "speaker", kind: "long_text", label: "Special requests", required: false, position: 1 },
    ];

    // Simulate the exact portal POST /tasks/:id/form body-parsing pipeline
    // (routes/portal/tasks.tsx): a submitted form body keyed by
    // fieldInputName(field.id), decoded back into an AnswerMap keyed by
    // field.id, then run through the same validateAnswers the route calls.
    const body: Record<string, unknown> = {
      [fieldInputName("f-hotel")]: "The Grand",
      [fieldInputName("f-notes")]: "Late check-in please",
    };
    const answers: AnswerMap = {};
    for (const field of fields) {
      const name = fieldInputName(field.id);
      const raw = body[name];
      if (raw === undefined) continue;
      answers[field.id] = typeof raw === "string" ? raw : String(raw);
    }
    const validation = validateAnswers(fields, answers);
    expect(validation.ok).toBe(true);
    if (!validation.ok) throw new Error("unreachable");

    const { db, state } = fakeDb({
      taskAssignment: [
        {
          id: ASSIGNMENT_ID,
          taskId: TASK_ID,
          contactId: CONTACT_ID,
          status: "pending",
          completedAt: null,
          responseJson: null,
          taskTitle: "Hotel stay requirement form",
          taskKind: "form",
          formId: FORM_ID,
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@example.com",
        },
      ],
      task: [{ id: TASK_ID, eventId: "event-1", title: "Hotel stay requirement form", kind: "form", formId: FORM_ID }],
      contact: [{ id: CONTACT_ID, firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" }],
      formField: [fieldRow("f-hotel", "Hotel name", "text", 0), fieldRow("f-notes", "Special requests", "long_text", 1)],
    });

    // The portal save path, exactly as routes/portal/tasks.tsx calls it.
    await saveTaskFormResponse(db, ASSIGNMENT_ID, CONTACT_ID, JSON.stringify(validation.cleaned));
    expect(state.taskAssignment[0].responseJson).toBe(JSON.stringify(validation.cleaned));

    // GET /api/v1/task-assignments/:id/response (org-scope check happens
    // separately at the route layer; this proves the value round-trip).
    const detail = await getAssignmentResponseDetail(db, ASSIGNMENT_ID);
    expect(detail).not.toBeNull();
    expect(detail?.fields).toEqual([
      { label: "Hotel name", value: "The Grand" },
      { label: "Special requests", value: "Late check-in please" },
    ]);
    // The regression this closes: neither value renders as the "no answer"
    // em-dash placeholder the ResponseModal falls back to for an empty string.
    for (const f of detail?.fields ?? []) {
      expect(f.value).not.toBe("");
    }
  });
});

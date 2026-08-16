// J6 onboarding tasks repo (DEC-023): organizer-facing response detail
// (GET /api/v1/task-assignments/:id/response — DEC-291). Split out of
// repo/tasks.ts for contention decomposition (no behavior change) — see
// repo/tasks.ts's barrel header.

import { eq, inArray } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { listFields } from "../forms";
import type { AnswerMap } from "../../../forms/types";
import { parseTaskResponse } from "../../../forms/task-response";
import { chunkIds } from "../../../lib/chunk";
import { answerDisplayText } from "../../../domain/answer-text";

export interface AssignmentResponseField {
  label: string;
  value: string;
  // Populated for fields whose def kind is 'file' when the answer id still
  // names a surviving `file` row (DEC-248 amendment, wave 10) — lets the
  // organizer view download the upload instead of seeing a raw id string.
  file?: { id: string; filename: string };
}

export interface AssignmentResponseDetail {
  assignmentId: string;
  taskTitle: string;
  taskKind: string;
  contact: { id: string; name: string; email: string };
  status: string;
  completedAt: number | null;
  fields: AssignmentResponseField[];
}

/** Organizer-facing view of a kind='form' task_assignment's saved answers
 * (DEC-291): parses response_json as an AnswerMap keyed by form_field.id and
 * joins it against listFields(db, task.formId) in field order, so the
 * organizer sees every field on the form (unanswered ones rendered with an
 * empty-string value, never omitted). Returns null when the assignment
 * doesn't exist — the route's org-scope check happens separately via
 * getAssignmentOwnership so a cross-org lookup 404s before this ever runs. */
export async function getAssignmentResponseDetail(
  db: Db,
  assignmentId: string,
): Promise<AssignmentResponseDetail | null> {
  const rows = await db
    .select({
      assignmentId: schema.taskAssignment.id,
      status: schema.taskAssignment.status,
      completedAt: schema.taskAssignment.completedAt,
      responseJson: schema.taskAssignment.responseJson,
      taskTitle: schema.task.title,
      taskKind: schema.task.kind,
      formId: schema.task.formId,
      contactId: schema.contact.id,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      email: schema.contact.email,
    })
    .from(schema.taskAssignment)
    .innerJoin(schema.task, eq(schema.taskAssignment.taskId, schema.task.id))
    .innerJoin(schema.contact, eq(schema.taskAssignment.contactId, schema.contact.id))
    .where(eq(schema.taskAssignment.id, assignmentId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const answers: AnswerMap = parseTaskResponse(row.responseJson, assignmentId);
  const fieldDefs = row.formId ? await listFields(db, row.formId) : [];

  // ONE batched select of (id, filename) over every file-kind field's answer
  // id — never a query per field. A file id with no surviving row simply
  // gets no map entry (deleted/foreign value), and that field falls back to
  // today's plain-string rendering.
  const fileAnswerIds = fieldDefs
    .filter((f) => f.kind === "file")
    .map((f) => answers[f.id])
    .filter((v): v is string => typeof v === "string" && v.length > 0);
  const fileMap = new Map<string, { id: string; filename: string }>();
  if (fileAnswerIds.length > 0) {
    for (const chunk of chunkIds(fileAnswerIds)) {
      const rows = await db
        .select({ id: schema.file.id, filename: schema.file.filename })
        .from(schema.file)
        .where(inArray(schema.file.id, chunk));
      for (const r of rows) fileMap.set(r.id, r);
    }
  }

  const fields: AssignmentResponseField[] = fieldDefs.map((f) => {
    const answer = answers[f.id];
    const file =
      f.kind === "file" && typeof answer === "string" && fileMap.has(answer) ? fileMap.get(answer) : undefined;
    return {
      label: f.label,
      value: answerDisplayText(answer),
      ...(file ? { file } : {}),
    };
  });

  return {
    assignmentId: row.assignmentId,
    taskTitle: row.taskTitle,
    taskKind: row.taskKind,
    contact: {
      id: row.contactId,
      name: `${row.firstName} ${row.lastName}`.trim(),
      email: row.email,
    },
    status: row.status,
    completedAt: row.completedAt ? row.completedAt.getTime() : null,
    fields,
  };
}

// Speaker task tables: task definitions and per-contact assignments. Split
// out of the former monolithic src/db/schema.ts (contention-hotspot
// decomposition; behavior-preserving).

import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { id, createdAt, updatedAt } from "./common";

export const task = sqliteTable(
  "task",
  {
    id: id(),
    eventId: text("event_id").notNull(),
    // 'general' | 'file_request' | 'form' — DEC-003
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    dueDate: integer("due_date", { mode: "timestamp_ms" }),
    required: integer("required", { mode: "boolean" }).notNull().default(false),
    // for kind='form' tasks, the form to fill out
    formId: text("form_id"),
    // migrations/0014 (DEC-240): 'presentation' | 'poster' | 'handout',
    // meaningful only when kind='file_request' — the content-pipeline file
    // kind portal uploads for this task should use (defaults to 'handout'
    // at the upload site when unset).
    deliverableKind: text("deliverable_kind"),
    // migrations/0036 (CNT-01): a free-text brief for the assignee — distinct
    // from `description`, shown on the speaker's own task row, never
    // required.
    instructions: text("instructions"),
    // migrations/0045 (DEC-746 wave-77 amendment): 'everyone' | 'targeted'
    // — see src/domain/task-kinds.ts's TASK_AUDIENCES. 'targeted' means this
    // task was created for an explicit contactIds subset and must NOT be
    // back-filled onto newly-active contacts at acceptance (DEC-932).
    audience: text("audience").notNull().default("everyone"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    task_event_id_idx: index("task_event_id_idx").on(t.eventId),
    task_form_id_idx: index("task_form_id_idx").on(t.formId),
    // DEC-111 amendment (wave 48): a task title is unique within its event —
    // see migrations/0032_task_title_unique.sql for the dedupe-then-index
    // migration and getOrCreateTask's insert-on-conflict-do-nothing shape.
    task_event_id_title_idx: uniqueIndex("task_event_id_title_idx").on(t.eventId, t.title),
  }),
);

export const taskAssignment = sqliteTable(
  "task_assignment",
  {
    id: id(),
    taskId: text("task_id").notNull(),
    contactId: text("contact_id").notNull(),
    status: text("status").notNull().default("pending"),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    completedBy: text("completed_by"),
    // migrations/0004 (DEC-017): kind='form' task answers, JSON map
    // fieldId->value.
    responseJson: text("response_json"),
    // migrations/0004 (DEC-017): kind='file_request' completion link.
    fileId: text("file_id"),
    // migrations/0004 (DEC-017): reminder dedupe, ms epoch (DEC-023).

    lastRemindedAt: integer("last_reminded_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    task_assignment_task_id_idx: index("task_assignment_task_id_idx").on(t.taskId),
    task_assignment_contact_id_idx: index("task_assignment_contact_id_idx").on(t.contactId),
    task_assignment_file_id_idx: index("task_assignment_file_id_idx").on(t.fileId),
    // DEC-556: one assignment per (task, contact) pair, enforced by the
    // database — see migrations/0019_join_table_uniqueness.sql.
    task_assignment_task_id_contact_id_idx: uniqueIndex("task_assignment_task_id_contact_id_idx").on(
      t.taskId,
      t.contactId,
    ),
  }),
);

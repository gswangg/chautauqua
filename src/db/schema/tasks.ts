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
    // migrations/0046 (multi-portal): 'person' | 'participation' -- whether a
    // portal item is about the person (shown once) or about each session or
    // sponsor company it covers. See src/domain/portals/items.ts.
    scope: text("scope").notNull().default("person"),
    // migrations/0046: file_request limits, enforced on upload. A string[] of
    // FILE_TYPE_GROUPS keys (src/domain/portals/file-types.ts); null = the
    // existing per-kind rules only.
    acceptedTypesJson: text("accepted_types_json"),
    maxSizeMb: integer("max_size_mb"),
    maxFiles: integer("max_files"),
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
    // migrations/0046 (multi-portal): '' for items about the person, or the
    // participation key for items about one session or sponsor company.
    scopeKey: text("scope_key").notNull().default(""),
    // 'direct' (assigned by an organizer, or predating portals) | 'portal'
    // (materialised from a portal item by src/server/repo/portals/reconcile.ts)
    source: text("source").notNull().default("direct"),
    // set when a portal-sourced row loses every portal that gave it; the
    // answer stays, the item leaves the participant's home
    detachedAt: integer("detached_at", { mode: "timestamp_ms" }),
    // portal rows only: the merged deadline (a day label, earliest across
    // the portals that bring it) and required flag, kept current by
    // reconcile.ts so the Speakers grid and reminders read portal items
    // without re-deriving every portal. Direct rows leave both null and keep
    // reading task.due_date / task.required.
    dueDate: integer("due_date", { mode: "timestamp_ms" }),
    required: integer("required", { mode: "boolean" }),
    // an organizer reopened a closed item for this person until this day
    // label (Portals frame flow 6: "Organizers can reopen it per person")
    reopenedUntil: integer("reopened_until", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    task_assignment_task_id_idx: index("task_assignment_task_id_idx").on(t.taskId),
    task_assignment_contact_id_idx: index("task_assignment_contact_id_idx").on(t.contactId),
    task_assignment_file_id_idx: index("task_assignment_file_id_idx").on(t.fileId),
    // DEC-556, widened by migrations/0046: one assignment per (task,
    // contact, scope) -- a portal item about each session a person speaks on
    // is one row per session.
    task_assignment_task_id_contact_id_scope_key_idx: uniqueIndex(
      "task_assignment_task_id_contact_id_scope_key_idx",
    ).on(t.taskId, t.contactId, t.scopeKey),
  }),
);

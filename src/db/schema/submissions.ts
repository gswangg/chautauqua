// Submission tables: submission, its form answers, track membership join,
// and participant (submission<->contact) links. Split out of the former
// monolithic src/db/schema.ts (contention-hotspot decomposition;
// behavior-preserving).

import { sqliteTable, text, integer, index, uniqueIndex, primaryKey } from "drizzle-orm/sqlite-core";
import { id, createdAt, updatedAt } from "./common";

export const submission = sqliteTable(
  "submission",
  {
    id: id(),
    eventId: text("event_id").notNull(),
    formId: text("form_id"),
    // integer, unique per event — display ref uses event.record_prefix
    seq: integer("seq").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    trackId: text("track_id"),
    // secondary tracks beyond the primary track_id, string[] of track ids
    additionalTrackIdsJson: text("additional_track_ids_json"),
    // 'pending' | 'accept_queue' | 'decline_queue' | 'accepted' | 'declined' (+ custom) — DEC-003
    status: text("status").notNull().default("pending"),
    // 'pending' | 'approved' | 'changes_requested' — DEC-003
    contentStatus: text("content_status").notNull().default("pending"),
    // nullable; guards idempotent acceptance side effects — DEC-009
    acceptedAt: integer("accepted_at", { mode: "timestamp_ms" }),
    // bumped by the caller on schedule-affecting changes — DEC-007
    icsSequence: integer("ics_sequence").notNull().default(0),
    // DEC-612: namespaced "<source>:<their id>" ref for idempotent import
    // re-runs; nullable, SQLite treats NULLs as distinct.
    externalRef: text("external_ref"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    submission_event_id_idx: index("submission_event_id_idx").on(t.eventId),
    submission_form_id_idx: index("submission_form_id_idx").on(t.formId),
    submission_track_id_idx: index("submission_track_id_idx").on(t.trackId),
    submission_event_id_status_idx: index("submission_event_id_status_idx").on(t.eventId, t.status),
    submission_event_id_seq_idx: uniqueIndex("submission_event_id_seq_idx").on(t.eventId, t.seq),
    // DEC-337 (w18): composite covering this wave's paginated submissions list.
    submission_event_id_created_at_idx: index("submission_event_id_created_at_idx").on(t.eventId, t.createdAt),
    // DEC-612: external_ref uniqueness scoped to the row's own owner.
    submission_event_id_external_ref_idx: uniqueIndex("submission_event_id_external_ref_idx").on(
      t.eventId,
      t.externalRef,
    ),
  }),
);

export const submissionAnswer = sqliteTable(
  "submission_answer",
  {
    id: id(),
    submissionId: text("submission_id").notNull(),
    formFieldId: text("form_field_id").notNull(),
    valueJson: text("value_json").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    submission_answer_submission_id_idx: index("submission_answer_submission_id_idx").on(t.submissionId),
    submission_answer_form_field_id_idx: index("submission_answer_form_field_id_idx").on(t.formFieldId),
    submission_answer_submission_id_form_field_id_idx: uniqueIndex("submission_answer_submission_id_form_field_id_idx").on(
      t.submissionId,
      t.formFieldId,
    ),
  }),
);

// DEC-015: talks are submitted to one or more tracks; track membership is a
// real join (never a form_field answer) so reviewer assignment, filtering,
// and the agenda can all key on it.
export const submissionTrack = sqliteTable(
  "submission_track",
  {
    submissionId: text("submission_id").notNull(),
    trackId: text("track_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => ({
    submission_track_pk: primaryKey({ columns: [t.submissionId, t.trackId] }),
    submission_track_submission_id_idx: index("submission_track_submission_id_idx").on(t.submissionId),
    submission_track_track_id_idx: index("submission_track_track_id_idx").on(t.trackId),
  }),
);

export const participant = sqliteTable(
  "participant",
  {
    id: id(),
    submissionId: text("submission_id").notNull(),
    contactId: text("contact_id").notNull(),
    role: text("role").notNull().default("speaker"),
    order: integer("order").notNull().default(0),
    visible: integer("visible", { mode: "boolean" }).notNull().default(true),
    // 'none' | 'invited' | 'accepted' | 'declined' — DEC-003
    inviteStatus: text("invite_status").notNull().default("none"),
    // DEC-258: frozen attribution snapshot of contact.title/company as of
    // participant creation. Nullable; public/export/ics reads use this
    // snapshot ONLY (no fallback to live contact). CRM/portal continue to
    // read the live contact fields — that split is deliberate.
    titleAtTime: text("title_at_time"),
    orgAtTime: text("org_at_time"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    participant_submission_id_idx: index("participant_submission_id_idx").on(t.submissionId),
    participant_contact_id_idx: index("participant_contact_id_idx").on(t.contactId),
    // DEC-556: one participant per (submission, contact) pair, enforced by
    // the database — see migrations/0019_join_table_uniqueness.sql.
    participant_submission_id_contact_id_idx: uniqueIndex("participant_submission_id_contact_id_idx").on(
      t.submissionId,
      t.contactId,
    ),
  }),
);

// migrations/0013_submission_revision.sql (DEC-158, task w3-b): CNT-11
// session content history. Appended by exactly two write paths (organizer
// PATCH /submissions/:id and portal-edit's locked-field sync), only when
// title/description actually changed; restore re-applies a snapshot
// through the same paths so it lands its own row too. editor_user_id is
// nullable because the portal-edit path is authenticated as a speaker
// contact, not a `user` row — editor_name is always a snapshot string so
// history reads correctly even if the editor is later renamed/deleted.
export const submissionRevision = sqliteTable(
  "submission_revision",
  {
    id: id(),
    submissionId: text("submission_id").notNull(),
    editorUserId: text("editor_user_id"),
    editorName: text("editor_name").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    createdAt: createdAt(),
  },
  (t) => ({
    submission_revision_submission_id_idx: index("submission_revision_submission_id_idx").on(t.submissionId),
    submission_revision_editor_user_id_idx: index("submission_revision_editor_user_id_idx").on(t.editorUserId),
  }),
);

// Speaker portal content tables: portal branding, resources, uploaded files,
// and file comments. Split out of the former monolithic src/db/schema.ts
// (contention-hotspot decomposition; behavior-preserving).

import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { id, createdAt, updatedAt } from "./common";
import { DEFAULT_PORTAL_SETTINGS } from "../../domain/portal-settings";

export const portalSettings = sqliteTable(
  "portal_settings",
  {
    id: id(),
    eventId: text("event_id").notNull(),
    logoUrl: text("logo_url"),
    accentColor: text("accent_color"),
    welcomeMessage: text("welcome_message"),
    showResources: integer("show_resources", { mode: "boolean" }).notNull().default(DEFAULT_PORTAL_SETTINGS.showResources),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    portal_settings_event_id_idx: uniqueIndex("portal_settings_event_id_idx").on(t.eventId),
  }),
);

export const resource = sqliteTable(
  "resource",
  {
    id: id(),
    eventId: text("event_id").notNull(),
    // 'file' | 'wiki'
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    // wiki page body (markdown/html) when kind='wiki'
    content: text("content"),
    // uploaded file when kind='file'
    fileId: text("file_id"),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    resource_event_id_idx: index("resource_event_id_idx").on(t.eventId),
    resource_file_id_idx: index("resource_file_id_idx").on(t.fileId),
  }),
);

export const file = sqliteTable(
  "file",
  {
    id: id(),
    // nullable: resource files (headshots, standalone resources) aren't
    // attached to a submission
    submissionId: text("submission_id"),
    // 'presentation' | 'poster' | 'handout' — DEC-003
    kind: text("kind").notNull(),
    filename: text("filename").notNull(),
    r2Key: text("r2_key").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    contentType: text("content_type").notNull(),
    // version chain — DEC-003
    previousFileId: text("previous_file_id"),
    // DEC-818: a version number is an identity, not a position among the
    // survivors — stored at insert time (1 + max over the chain, or 1 for a
    // new chain) so deleting a middle version never renumbers the rest.
    versionNo: integer("version_no"),
    uploadedByContactId: text("uploaded_by_contact_id"),
    // DEC-248 amendment (wave 10): set when this file was uploaded through a
    // kind='form' onboarding task field, so getTaskFileScope can resolve the
    // population even though task_assignment.file_id was never written.
    taskAssignmentId: text("task_assignment_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    file_submission_id_idx: index("file_submission_id_idx").on(t.submissionId),
    // DEC-818 amendment: the chain invariant is "at most one row may name a
    // given predecessor" — a concurrent re-upload against the same head must
    // be refused at the door, not renumbered. Partial (previous_file_id IS
    // NOT NULL) so chain roots (previousFileId=null) don't collide.
    file_previous_file_id_unique: uniqueIndex("file_previous_file_id_unique")
      .on(t.previousFileId)
      .where(sql`${t.previousFileId} is not null`),
    file_uploaded_by_contact_id_idx: index("file_uploaded_by_contact_id_idx").on(t.uploadedByContactId),
    file_task_assignment_id_idx: index("file_task_assignment_id_idx").on(t.taskAssignmentId),
  }),
);

export const fileComment = sqliteTable(
  "file_comment",
  {
    id: id(),
    fileId: text("file_id").notNull(),
    authorContactId: text("author_contact_id"),
    authorUserId: text("author_user_id"),
    body: text("body").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    file_comment_file_id_idx: index("file_comment_file_id_idx").on(t.fileId),
    file_comment_author_contact_id_idx: index("file_comment_author_contact_id_idx").on(t.authorContactId),
    file_comment_author_user_id_idx: index("file_comment_author_user_id_idx").on(t.authorUserId),
  }),
);

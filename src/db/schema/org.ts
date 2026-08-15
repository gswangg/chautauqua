// Org-level identity tables: org, user (org staff/reviewer/speaker accounts),
// auth sessions, and CRM contacts. Split out of the former monolithic
// src/db/schema.ts (contention-hotspot decomposition; behavior-preserving).

import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { id, createdAt, updatedAt } from "./common";

export const org = sqliteTable("org", {
  id: id(),
  name: text("name").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const user = sqliteTable(
  "user",
  {
    id: id(),
    orgId: text("org_id").notNull(),
    email: text("email").notNull(),
    // DEC-757: teammate display name, nullable, no backfill.
    name: text("name"),
    passwordHash: text("password_hash").notNull(),
    // 'organizer' | 'reviewer' | 'speaker' — DEC-004
    role: text("role").notNull(),
    // speaker users link to their person via contact_id — DEC-004
    contactId: text("contact_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    user_org_id_idx: index("user_org_id_idx").on(t.orgId),
    user_contact_id_idx: index("user_contact_id_idx").on(t.contactId),
    user_email_idx: uniqueIndex("user_email_idx").on(t.email),
  }),
);

export const authSession = sqliteTable(
  "auth_session",
  {
    id: id(),
    userId: text("user_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    auth_session_user_id_idx: index("auth_session_user_id_idx").on(t.userId),
    auth_session_token_hash_idx: uniqueIndex("auth_session_token_hash_idx").on(t.tokenHash),
  }),
);

export const contact = sqliteTable(
  "contact",
  {
    id: id(),
    orgId: text("org_id").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    company: text("company"),
    title: text("title"),
    bio: text("bio"),
    headshotUrl: text("headshot_url"),
    // DEC-773 amendment (w29-b): FK mirror of headshotUrl's
    // `/headshots/<fileId>` pattern -- headshotUrl stays the served path
    // (route/authz behavior unchanged), but files-library.ts's headshot
    // join predicate needs an indexable equality instead of the
    // string-concatenation predicate no index can serve.
    headshotFileId: text("headshot_file_id"),
    socialLinksJson: text("social_links_json"),
    notes: text("notes"),
    customFieldsJson: text("custom_fields_json"),
    // DEC-612: namespaced "<source>:<their id>" ref for idempotent import
    // re-runs; nullable, SQLite treats NULLs as distinct so hand-created
    // rows are untouched by the uniqueIndex below.
    externalRef: text("external_ref"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    contact_org_id_idx: index("contact_org_id_idx").on(t.orgId),
    contact_email_idx: index("contact_email_idx").on(t.email),
    // DEC-337 (w18): composite covering this wave's contacts list query.
    contact_org_id_last_name_first_name_idx: index("contact_org_id_last_name_first_name_idx").on(
      t.orgId,
      t.lastName,
      t.firstName,
    ),
    // DEC-612: external_ref uniqueness scoped to the row's own owner.
    contact_org_id_external_ref_idx: uniqueIndex("contact_org_id_external_ref_idx").on(
      t.orgId,
      t.externalRef,
    ),
    // DEC-773 amendment (w29-b): the files library's headshot join predicate.
    contact_headshot_file_id_idx: index("contact_headshot_file_id_idx").on(t.headshotFileId),
  }),
);

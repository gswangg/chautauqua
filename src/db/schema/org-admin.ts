// Org-admin tooling tables: bearer API tokens and Submissions saved views.
// Split out of the former monolithic src/db/schema.ts (contention-hotspot
// decomposition; behavior-preserving).

import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { id, createdAt, updatedAt } from "./common";

// migrations/0006_w4_api_token.sql (DEC-025, task w4-e): bearer API tokens
// (DEC-027). Plaintext ('chq_' + 40 lowercase base32 chars) is shown exactly
// once at creation; only its sha256 hex digest is persisted, plus the first
// 12 plaintext chars for display purposes.
export const apiToken = sqliteTable(
  "api_token",
  {
    id: id(),
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull(),
    tokenPrefix: text("token_prefix").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    api_token_token_hash_idx: uniqueIndex("api_token_token_hash_idx").on(t.tokenHash),
    api_token_org_id_idx: index("api_token_org_id_idx").on(t.orgId),
    api_token_created_by_user_id_idx: index("api_token_created_by_user_id_idx").on(t.createdByUserId),
  }),
);

// migrations/0007_w4_saved_view.sql (DEC-025, task w4-g): organizer-shared
// Submissions saved views. config_json shape per DEC-031: { q, status[],
// trackId, sort, columns[] } matching the landed submissions filter/column
// state shapes exactly.
// migrations/0028_saved_view_share.sql (DEC-904): a saved view is private
// until its author shares it. createdByUserId (nullable -- existing rows
// have no known author) + shared (NOT NULL default 1, so every pre-DEC-904
// row keeps today's fully-shared behaviour).
export const savedView = sqliteTable(
  "saved_view",
  {
    id: id(),
    eventId: text("event_id").notNull(),
    name: text("name").notNull(),
    configJson: text("config_json").notNull(),
    createdByUserId: text("created_by_user_id"),
    shared: integer("shared", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    saved_view_event_id_idx: index("saved_view_event_id_idx").on(t.eventId),
    saved_view_created_by_user_id_idx: index("saved_view_created_by_user_id_idx").on(t.createdByUserId),
  }),
);

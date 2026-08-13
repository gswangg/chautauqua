// Public embed tables. Split out of the former monolithic src/db/schema.ts
// (contention-hotspot decomposition; behavior-preserving).

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { id, createdAt, updatedAt } from "./common";

// migrations/0023_saved_embed.sql (DEC-785, task w3-d): a saved embed is the
// addressable unit behind /embed/e/:embedId — its snippet points at that
// URL, which renders `surface` with the options in options_json (the
// EmbedOptions shape minus `format`, which is its own column). Disabling
// (or deleting) it must have a visible public effect: the public route
// 404s rather than silently continuing to serve a disabled row.
export const embed = sqliteTable(
  "embed",
  {
    id: id(),
    orgId: text("org_id").notNull(),
    eventId: text("event_id").notNull(),
    name: text("name").notNull(),
    surface: text("surface").notNull(),
    format: text("format").notNull(),
    optionsJson: text("options_json").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    embed_org_id_idx: index("embed_org_id_idx").on(t.orgId),
    embed_event_id_idx: index("embed_event_id_idx").on(t.eventId),
  }),
);

// Event and CFP-form definition tables: event, form, form_field. Split out of
// the former monolithic src/db/schema.ts (contention-hotspot decomposition;
// behavior-preserving).

import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { id, createdAt, updatedAt } from "./common";

export const event = sqliteTable(
  "event",
  {
    id: id(),
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    location: text("location"),
    // IANA timezone string
    timezone: text("timezone").notNull(),
    // display ref = `${recordPrefix}-${seq}` e.g. SES-014 — DEC-003
    recordPrefix: text("record_prefix").notNull().default("SES"),
    brandingJson: text("branding_json"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    event_org_id_idx: index("event_org_id_idx").on(t.orgId),
    event_slug_idx: uniqueIndex("event_slug_idx").on(t.slug),
  }),
);

export const form = sqliteTable(
  "form",
  {
    id: id(),
    eventId: text("event_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    // w2-c: CFP form open/close window; description doubles as intro text.
    openDate: integer("open_date", { mode: "timestamp_ms" }),
    closeDate: integer("close_date", { mode: "timestamp_ms" }),
    // DEC-015: JSON array of track ids offered on this form; null/empty
    // means all event tracks are offered.
    tracksJson: text("tracks_json"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    form_event_id_idx: index("form_event_id_idx").on(t.eventId),
    // DEC-111 amendment (wave 55): form title uniqueness within an event is
    // a real DB constraint (migrations/0033_form_title_unique.sql) -- see
    // getOrCreateFormTaskForm in src/server/repo/submissions/status.ts.
    form_event_id_title_idx: uniqueIndex("form_event_id_title_idx").on(t.eventId, t.title),
  }),
);

export const formField = sqliteTable(
  "form_field",
  {
    id: id(),
    formId: text("form_id").notNull(),
    // 'session' | 'speaker' — DEC-008
    section: text("section").notNull(),
    // 'text' | 'long_text' | 'dropdown' | 'checkbox' | 'number' | 'file' — DEC-008
    kind: text("kind").notNull(),
    label: text("label").notNull(),
    helpText: text("help_text"),
    required: integer("required", { mode: "boolean" }).notNull().default(false),
    position: integer("position").notNull().default(0),
    // string[] for 'dropdown'
    optionsJson: text("options_json"),
    // { fieldId, op: 'eq'|'ne'|'in', value } for conditional visibility
    ruleJson: text("rule_json"),
    // locked built-ins (session Title/Description, speaker first/last/email)
    // are required + non-removable
    locked: integer("locked", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    form_field_form_id_idx: index("form_field_form_id_idx").on(t.formId),
    form_field_form_id_position_idx: index("form_field_form_id_position_idx").on(t.formId, t.position),
  }),
);

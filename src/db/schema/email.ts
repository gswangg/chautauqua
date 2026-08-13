// Email tables: templates and the dev-sink send log. Split out of the former
// monolithic src/db/schema.ts (contention-hotspot decomposition;
// behavior-preserving).

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { id, createdAt, updatedAt } from "./common";

export const emailTemplate = sqliteTable(
  "email_template",
  {
    id: id(),
    eventId: text("event_id").notNull(),
    name: text("name").notNull(),
    subject: text("subject").notNull(),
    bodyText: text("body_text").notNull(),
    bodyHtml: text("body_html"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    email_template_event_id_idx: index("email_template_event_id_idx").on(t.eventId),
  }),
);

export const emailLog = sqliteTable(
  "email_log",
  {
    id: id(),
    eventId: text("event_id").notNull(),
    templateId: text("template_id"),
    contactId: text("contact_id"),
    // DEC-603: one id minted per fan-out call, shared by every recipient row
    // of the same send (compose/bulk-email/reminders/reviewer-remind); null
    // on single sends (submit.tsx claim email, users.ts invite), which
    // render as their own one-row batch via COALESCE(batch_id, id).
    batchId: text("batch_id"),
    toEmail: text("to_email").notNull(),
    // rendered content inline — DEC-006
    subject: text("subject").notNull(),
    bodyText: text("body_text").notNull(),
    bodyHtml: text("body_html"),
    icsText: text("ics_text"),
    // migrations/0002: DEC-006 omitted this column, but the /dev/mailbox
    // download link needs the original filename (w2-i, additive per DEC-015).
    icsFilename: text("ics_filename"),
    provider: text("provider").notNull().default("dev"),
    status: text("status").notNull().default("sent"),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => ({
    email_log_event_id_idx: index("email_log_event_id_idx").on(t.eventId),
    email_log_template_id_idx: index("email_log_template_id_idx").on(t.templateId),
    email_log_contact_id_idx: index("email_log_contact_id_idx").on(t.contactId),
    // DEC-337 (w18): composite covering this wave's event email log queries.
    email_log_event_id_sent_at_idx: index("email_log_event_id_sent_at_idx").on(t.eventId, t.sentAt),
    // DEC-603: batch history grouping/filtering scoped by event.
    email_log_event_id_batch_id_idx: index("email_log_event_id_batch_id_idx").on(t.eventId, t.batchId),
    // DEC-267: batch_id must also lead some index on its own so a bare
    // COALESCE(batch_id, id) lookup isn't a full-table scan.
    email_log_batch_id_idx: index("email_log_batch_id_idx").on(t.batchId),
  }),
);

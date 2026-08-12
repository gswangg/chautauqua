// email_log repo functions (DEC-012: only repo/* touches drizzle row
// types). Backs both /dev/mailbox (dev-only sink viewer, DEC-005/DEC-006)
// and GET /api/v1/events/:eventId/email-log (J5 per-recipient history).

import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { likeContains } from "./like";

export interface EmailLogRow {
  id: string;
  eventId: string;
  eventName: string;
  templateId: string | null;
  contactId: string | null;
  toEmail: string;
  subject: string;
  bodyText: string;
  bodyHtml: string | null;
  icsText: string | null;
  icsFilename: string | null;
  provider: string;
  status: string;
  sentAt: number;
}

// DEC-543: the narrow projection listEmailLog actually returns — derived
// from the two list renderers (app/src/pages/comms/HistoryTab.tsx and the
// dev mailbox MailboxListPage in src/routes/dev/mailbox.tsx), neither of
// which displays bodyText/bodyHtml/icsText/icsFilename. Those fields are
// capped at MAX_RICH_TEXT_LENGTH and their HTML twin, so shipping them on
// every list page is an oversized payload (SPEC §7). getEmailLogById keeps
// the full EmailLogRow for the detail page and its .ics download.
export interface EmailLogListRow {
  id: string;
  eventName: string;
  toEmail: string;
  subject: string;
  status: string;
  sentAt: number;
}

export interface EmailLogListParams {
  eventId?: string;
  contactId?: string;
  status?: string;
  /** Case-insensitive substring match over subject or recipient email
   * (J5 Comms history tab search — DEC-013 ?q convention). */
  q?: string;
  page: number;
  perPage: number;
}

export interface EmailLogListResult {
  items: EmailLogListRow[];
  total: number;
}

function toRow(r: {
  id: string;
  eventId: string;
  eventName: string;
  templateId: string | null;
  contactId: string | null;
  toEmail: string;
  subject: string;
  bodyText: string;
  bodyHtml: string | null;
  icsText: string | null;
  icsFilename: string | null;
  provider: string;
  status: string;
  sentAt: Date;
}): EmailLogRow {
  return { ...r, sentAt: r.sentAt.getTime() };
}

function toListRow(r: {
  id: string;
  eventName: string;
  toEmail: string;
  subject: string;
  status: string;
  sentAt: Date;
}): EmailLogListRow {
  return { ...r, sentAt: r.sentAt.getTime() };
}

// DEC-543: LIST_COLUMNS is the narrow projection backing listEmailLog —
// exactly the fields the two list renderers display (id, eventName,
// toEmail, subject, status, sentAt). Kept distinct from SELECTED_COLUMNS
// (used only by getEmailLogById) so a schema rename can't accidentally
// widen the list payload back out.
const LIST_COLUMNS = {
  id: schema.emailLog.id,
  eventName: schema.event.name,
  toEmail: schema.emailLog.toEmail,
  subject: schema.emailLog.subject,
  status: schema.emailLog.status,
  sentAt: schema.emailLog.sentAt,
} as const;

const SELECTED_COLUMNS = {
  id: schema.emailLog.id,
  eventId: schema.emailLog.eventId,
  eventName: schema.event.name,
  templateId: schema.emailLog.templateId,
  contactId: schema.emailLog.contactId,
  toEmail: schema.emailLog.toEmail,
  subject: schema.emailLog.subject,
  bodyText: schema.emailLog.bodyText,
  bodyHtml: schema.emailLog.bodyHtml,
  icsText: schema.emailLog.icsText,
  icsFilename: schema.emailLog.icsFilename,
  provider: schema.emailLog.provider,
  status: schema.emailLog.status,
  sentAt: schema.emailLog.sentAt,
} as const;

/** Lists email_log rows newest-first, joined to event for display, with
 * optional eventId/contactId/status filters and DEC-013 pagination. */
export async function listEmailLog(db: Db, params: EmailLogListParams): Promise<EmailLogListResult> {
  const conditions = [];
  if (params.eventId) conditions.push(eq(schema.emailLog.eventId, params.eventId));
  if (params.contactId) conditions.push(eq(schema.emailLog.contactId, params.contactId));
  if (params.status) conditions.push(eq(schema.emailLog.status, params.status));
  if (params.q && params.q.trim() !== "") {
    // DEC-506: escape via likeContains + ESCAPE '\\' so a literal `%`/`_`
    // in the query string can't widen into a wildcard match.
    const like = likeContains(params.q.trim());
    conditions.push(
      or(
        sql`${schema.emailLog.subject} LIKE ${like} ESCAPE '\\' COLLATE NOCASE`,
        sql`${schema.emailLog.toEmail} LIKE ${like} ESCAPE '\\' COLLATE NOCASE`,
      ),
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const base = db
    .select(LIST_COLUMNS)
    .from(schema.emailLog)
    .innerJoin(schema.event, eq(schema.event.id, schema.emailLog.eventId));

  const filtered = where ? base.where(where) : base;
  const rows = await filtered
    // DEC-534: sentAt alone is not unique — a bulk compose send writes many
    // rows in the same millisecond, so page 2 could repeat/drop rows
    // without a unique tiebreak.
    .orderBy(desc(schema.emailLog.sentAt), asc(schema.emailLog.id))
    .limit(params.perPage)
    .offset((params.page - 1) * params.perPage);

  const countBase = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.emailLog)
    .innerJoin(schema.event, eq(schema.event.id, schema.emailLog.eventId));
  const countFiltered = where ? countBase.where(where) : countBase;
  const countRows = await countFiltered;
  const total = Number(countRows[0]?.count ?? 0);

  return { items: rows.map(toListRow), total };
}

export async function getEmailLogById(db: Db, id: string): Promise<EmailLogRow | null> {
  const rows = await db
    .select(SELECTED_COLUMNS)
    .from(schema.emailLog)
    .innerJoin(schema.event, eq(schema.event.id, schema.emailLog.eventId))
    .where(eq(schema.emailLog.id, id))
    .limit(1);
  const row = rows[0];
  return row ? toRow(row) : null;
}

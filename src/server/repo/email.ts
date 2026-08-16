// email_log repo functions (DEC-012: only repo/* touches drizzle row
// types). Backs both /dev/mailbox (dev-only sink viewer, DEC-005/DEC-006)
// and GET /api/v1/events/:eventId/email-log (J5 per-recipient history).

import { and, asc, desc, eq, gte, inArray, or, sql, type SQL } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { likeContains } from "./like";
import { chunkIds } from "../../lib/chunk";

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
//
// DEC-949 (wave 34 amendment): LIST_COLUMNS excludes bodyText/bodyHtml
// entirely, so the history LIST route (GET /api/v1/events/:eventId/email-log)
// never has a claim/reset URL to redact in the first place — only
// getEmailLogById's send-detail route (src/routes/comms/email-log.ts) needs
// redactCredentialUrls (src/auth/credential-urls.ts) applied. If a future
// change widens EmailLogListRow to include a body field, it must gain the
// same redaction the detail route has.
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
  /** DEC-546: org-scopes the dev mailbox to the viewer's own org. */
  orgId?: string;
  /** Case-insensitive substring match over subject or recipient email
   * (J5 Comms history tab search — DEC-013 ?q convention). */
  q?: string;
  /** DEC-603: filters to one batch's recipient rows, matching on the same
   * COALESCE(batch_id, id) expression listEmailBatches groups by — so a
   * legacy/NULL-batch row's own id is a valid batchKey too. */
  batchKey?: string;
  /** DEC-603 (wave-56 amendment): the History tab's template chip row —
   * unlike DEC-905's status/contactId/batchId, this one IS expressible at
   * batch grain (listEmailBatches already projects templateId per batch, via
   * MIN()), so it is pushed into the shared emailLogConditions/batchWhere
   * predicates rather than refused when combined with groupBy=batch. */
  templateId?: string;
  /** DEC-905: epoch-ms lower bound (inclusive) on sentAt, pushed into the
   * SQL WHERE clause — never a post-fetch filter — so the Comms head's
   * "N sent in the last 7 days" reads the window's own total rather than a
   * count computed over a page already narrowed by LIMIT/OFFSET. */
  since?: number;
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

// DEC-603: the totally-ordered batch key every send's recipient rows share —
// the fan-out's minted batch_id when present, else the row's own id (a
// legacy/NULL-batch row or a single send is its own one-row batch). Both
// listEmailBatches' GROUP BY and listEmailLog's ?batchId= filter match on
// this exact expression so the two stay in agreement.
const BATCH_KEY = sql<string>`coalesce(${schema.emailLog.batchId}, ${schema.emailLog.id})`;

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

/** w41-a: the WHERE-condition-building shared by listEmailLog and the J12
 * email-log export (src/server/repo/exports/email-log.ts) — the export's own
 * row query needs a column (templateId) the list's narrow DEC-543 projection
 * excludes, so it cannot reuse listEmailLog's row shape directly, but it MUST
 * reuse this exact predicate so "one predicate, two surfaces" holds: a
 * filtered export and the SAME filter through GET .../email-log agree on
 * which rows match, always. */
export function emailLogConditions(
  params: Pick<EmailLogListParams, "eventId" | "contactId" | "status" | "orgId" | "batchKey" | "since" | "q" | "templateId">,
) {
  const conditions = [];
  if (params.eventId) conditions.push(eq(schema.emailLog.eventId, params.eventId));
  if (params.contactId) conditions.push(eq(schema.emailLog.contactId, params.contactId));
  if (params.status) conditions.push(eq(schema.emailLog.status, params.status));
  if (params.orgId) conditions.push(eq(schema.event.orgId, params.orgId));
  if (params.batchKey) conditions.push(eq(BATCH_KEY, params.batchKey));
  if (params.templateId) conditions.push(eq(schema.emailLog.templateId, params.templateId));
  if (params.since !== undefined) conditions.push(gte(schema.emailLog.sentAt, new Date(params.since)));
  if (params.q && params.q.trim() !== "") {
    // DEC-506: escape via likeContains + ESCAPE '\\' so a literal `%`/`_`
    // in the query string can't widen into a wildcard match.
    const like = likeContains(params.q.trim());
    conditions.push(
      or(
        sql`${schema.emailLog.subject} LIKE ${like} ESCAPE '\\'`,
        sql`${schema.emailLog.toEmail} LIKE ${like} ESCAPE '\\'`,
      ),
    );
  }
  return conditions;
}

/** Lists email_log rows newest-first, joined to event for display, with
 * optional eventId/contactId/status filters and DEC-013 pagination. */
export async function listEmailLog(db: Db, params: EmailLogListParams): Promise<EmailLogListResult> {
  const conditions = emailLogConditions(params);
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

// DEC-890: the templates list's "Last used <date>" meta is DERIVED from
// email_log, never a new column on email_template. One grouped query over
// the whole event's email_log (MAX(sent_at) GROUP BY template_id), joined
// onto the templates page in memory by the caller -- never a per-row query,
// regardless of how many templates the page renders.
export async function listTemplateLastUsedAt(db: Db, eventId: string): Promise<Map<string, number>> {
  const rows = await db
    .select({
      templateId: schema.emailLog.templateId,
      lastUsedAt: sql<number>`max(${schema.emailLog.sentAt})`,
    })
    .from(schema.emailLog)
    .where(and(eq(schema.emailLog.eventId, eventId), sql`${schema.emailLog.templateId} is not null`))
    .groupBy(schema.emailLog.templateId);

  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.templateId) map.set(r.templateId, Number(r.lastUsedAt));
  }
  return map;
}

/** DEC-546: org-scoped — an id belonging to a different org's event returns
 * null (indistinguishable from a nonexistent id) rather than leaking cross-
 * org email content. */
export async function getEmailLogById(db: Db, id: string, orgId: string): Promise<EmailLogRow | null> {
  const rows = await db
    .select(SELECTED_COLUMNS)
    .from(schema.emailLog)
    .innerJoin(schema.event, eq(schema.event.id, schema.emailLog.eventId))
    .where(and(eq(schema.emailLog.id, id), eq(schema.event.orgId, orgId)))
    .limit(1);
  const row = rows[0];
  return row ? toRow(row) : null;
}

// DEC-603: one row per batch (a fan-out send's shared batch_id, or a legacy/
// NULL-batch row's own id), so the comms history tab shows "sent to N
// recipients" instead of N identical-looking rows.
export interface EmailBatchRow {
  batchKey: string;
  subject: string;
  sentAt: number;
  // DEC-851 wave-5 amendment: recipientCount (a bare COUNT(*)) was deleted
  // -- statusCounts already carries the same total as the sum of its own
  // values, and RecentSends.tsx's sentCountLabel derives from statusCounts,
  // never a raw recipientCount nobody read.
  statusCounts: Record<string, number>;
  // w41-g (DEC-751 amendment): the template that produced this batch, so
  // Recent Sends can name it instead of leaving a silent gap. A fan-out
  // send's recipient rows all share one templateId; MIN() is a safe
  // aggregate the same way subject's MIN() is above. Null for a hand-
  // written send with no template.
  templateId: string | null;
}

export interface EmailBatchListParams {
  eventId: string;
  q?: string;
  /** DEC-905: epoch-ms lower bound (inclusive) on sentAt, applied to BOTH
   * the page query and the total-count query so the envelope's `total` and
   * its `items` describe the same window (a batch is windowed on its own
   * MAX(sentAt), matching the row-level `since` filter listEmailLog uses). */
  since?: number;
  /** DEC-603 (wave-56 amendment): same templateId facet as the flat grain,
   * pushed into batchWhere so a batch grouping only surfaces batches whose
   * rows match the chip — never a post-fetch filter over the grouped
   * result. */
  templateId?: string;
  page: number;
  perPage: number;
}

export interface EmailBatchListResult {
  items: EmailBatchRow[];
  total: number;
}

function batchWhere(params: Pick<EmailBatchListParams, "eventId" | "q" | "since" | "templateId">) {
  const conditions: (SQL<unknown> | undefined)[] = [eq(schema.emailLog.eventId, params.eventId)];
  if (params.q && params.q.trim() !== "") {
    const like = likeContains(params.q.trim());
    conditions.push(
      or(
        sql`${schema.emailLog.subject} LIKE ${like} ESCAPE '\\'`,
        sql`${schema.emailLog.toEmail} LIKE ${like} ESCAPE '\\'`,
      ),
    );
  }
  if (params.since !== undefined) {
    conditions.push(gte(schema.emailLog.sentAt, new Date(params.since)));
  }
  if (params.templateId) {
    conditions.push(eq(schema.emailLog.templateId, params.templateId));
  }
  return and(...conditions);
}

/** Lists email_log rows grouped by BATCH_KEY, newest-batch-first, with
 * DEC-013 pagination. A second grouped-by-(batchKey,status) query supplies
 * each batch's per-status tally (statusCounts) — scoped to the page's own
 * batch keys (DEC-686), not the whole event, since a batch's rows can't be
 * split across pages but the event can have far more batches than fit on
 * one page. */
export async function listEmailBatches(db: Db, params: EmailBatchListParams): Promise<EmailBatchListResult> {
  const where = batchWhere(params);

  const rows = await db
    .select({
      batchKey: BATCH_KEY,
      subject: sql<string>`min(${schema.emailLog.subject})`,
      sentAt: sql<number>`max(${schema.emailLog.sentAt})`,
      templateId: sql<string | null>`min(${schema.emailLog.templateId})`,
    })
    .from(schema.emailLog)
    .where(where)
    .groupBy(BATCH_KEY)
    // DEC-534-style total order: sentAt alone repeats across batches sent in
    // the same request, so batchKey breaks the tie -- and MIN(id) breaks
    // BATCH_KEY itself for good measure, since it's the same expression
    // GROUP BY collapsed rows on.
    .orderBy(desc(sql`max(${schema.emailLog.sentAt})`), asc(BATCH_KEY), asc(sql`min(${schema.emailLog.id})`))
    .limit(params.perPage)
    .offset((params.page - 1) * params.perPage);

  const countRows = await db
    .select({ count: sql<number>`count(distinct ${BATCH_KEY})` })
    .from(schema.emailLog)
    .where(where);
  const total = Number(countRows[0]?.count ?? 0);

  const batchKeys = rows.map((r) => r.batchKey);
  const statusCountsByBatch = new Map<string, Record<string, number>>();
  if (batchKeys.length > 0) {
    for (const batch of chunkIds(batchKeys)) {
      const statusRows = await db
        .select({
          batchKey: BATCH_KEY,
          status: schema.emailLog.status,
          n: sql<number>`count(*)`,
        })
        .from(schema.emailLog)
        .where(and(where, inArray(BATCH_KEY, batch)))
        .groupBy(BATCH_KEY, schema.emailLog.status);
      for (const r of statusRows) {
        const counts = statusCountsByBatch.get(r.batchKey) ?? {};
        counts[r.status] = Number(r.n);
        statusCountsByBatch.set(r.batchKey, counts);
      }
    }
  }

  const items: EmailBatchRow[] = rows.map((r) => ({
    batchKey: r.batchKey,
    subject: r.subject,
    sentAt: Number(r.sentAt),
    statusCounts: statusCountsByBatch.get(r.batchKey) ?? {},
    templateId: r.templateId,
  }));

  return { items, total };
}

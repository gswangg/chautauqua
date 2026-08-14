// email-log export (J12, DEC-027).
// w41-a (DEC-027 wave-41 amendment): gains the History tab's own filter
// vocabulary (eventId/contactId/status/q/batchKey/since) rather than an
// unfilterable dump. The row query below reuses emailLogConditions -- the
// SAME predicate-building function listEmailLog (src/server/repo/email.ts)
// itself calls -- so a filtered export and the identical filter through GET
// .../email-log always agree on which rows match ("one predicate, two
// surfaces"), proven directly by test/exports-narrowing.test.ts.
//
// Deliberately does NOT call listEmailLog itself: that function's own row
// query uses the DEC-543 narrow LIST projection (no templateId, which this
// export's header has always included) and DEC-534's asc(id) tiebreak, while
// this export's own order is DEC-560's desc(id) tiebreak -- reusing
// listEmailLog's rows would either drop a column export callers already rely
// on or silently reorder them. Sharing the extracted predicate function
// (rather than the whole listEmailLog call) is the narrower, correct reuse:
// same WHERE, this kind's own SELECT/ORDER BY.
import { and, desc } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { emailLogConditions, type EmailLogListParams } from "../email";
import { type ExportTable, EXPORT_MAX_ROWS, buildTable } from "./table";

export interface EmailLogExportParams {
  contactId?: string;
  status?: string;
  q?: string;
  batchKey?: string;
  since?: number;
}

export async function exportEmailLog(db: Db, eventId: string, params?: EmailLogExportParams): Promise<ExportTable> {
  const header = ["sentAt", "toEmail", "subject", "status", "templateId"];

  const filterParams: Pick<EmailLogListParams, "eventId" | "contactId" | "status" | "orgId" | "batchKey" | "since" | "q"> = {
    eventId,
    contactId: params?.contactId,
    status: params?.status,
    q: params?.q,
    batchKey: params?.batchKey,
    since: params?.since,
  };
  const conditions = emailLogConditions(filterParams);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const base = db
    .select({
      sentAt: schema.emailLog.sentAt,
      toEmail: schema.emailLog.toEmail,
      subject: schema.emailLog.subject,
      status: schema.emailLog.status,
      templateId: schema.emailLog.templateId,
      id: schema.emailLog.id,
    })
    .from(schema.emailLog);

  const filtered = where ? base.where(where) : base;
  const rows = await filtered
    .orderBy(desc(schema.emailLog.sentAt), desc(schema.emailLog.id))
    .limit(EXPORT_MAX_ROWS + 1);

  // DEC-027 amendment (wave 50): bound on the query — cap+1 rows proves
  // overflow.
  if (rows.length > EXPORT_MAX_ROWS) {
    return buildTable(header, [], true);
  }

  const outRows = rows.map((r) => [r.sentAt.toISOString(), r.toEmail, r.subject, r.status, r.templateId ?? ""]);

  return buildTable(header, outRows);
}

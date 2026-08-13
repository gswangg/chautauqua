// email-log export (J12, DEC-027).

import { desc, eq } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { type ExportTable, EXPORT_MAX_ROWS, buildTable } from "./table";

export async function exportEmailLog(db: Db, eventId: string): Promise<ExportTable> {
  const header = ["sentAt", "toEmail", "subject", "status", "templateId"];

  const rows = await db
    .select({
      sentAt: schema.emailLog.sentAt,
      toEmail: schema.emailLog.toEmail,
      subject: schema.emailLog.subject,
      status: schema.emailLog.status,
      templateId: schema.emailLog.templateId,
      id: schema.emailLog.id,
    })
    .from(schema.emailLog)
    .where(eq(schema.emailLog.eventId, eventId))
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

// email-log export (J12, DEC-027).

import { desc, eq } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { type ExportTable, buildTable } from "./table";

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
    .orderBy(desc(schema.emailLog.sentAt), desc(schema.emailLog.id));

  const outRows = rows.map((r) => [r.sentAt.toISOString(), r.toEmail, r.subject, r.status, r.templateId ?? ""]);

  return buildTable(header, outRows);
}

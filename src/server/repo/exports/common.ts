// Shared DB helper used by every per-kind export module in this directory.

import { eq } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";

export async function getRecordPrefix(db: Db, eventId: string): Promise<string> {
  const rows = await db
    .select({ recordPrefix: schema.event.recordPrefix })
    .from(schema.event)
    .where(eq(schema.event.id, eventId))
    .limit(1);
  return rows[0]?.recordPrefix ?? "SES";
}

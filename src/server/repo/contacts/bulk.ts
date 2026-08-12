// Contacts repo: bulk email lookups (DEC-019/DEC-026): contacts by id,
// org-scoped. Split out of repo/contacts.ts (contention decomposition, no
// behavior change). See repo/contacts.ts for the module-level contract
// notes.

import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { chunkIds } from "../../../lib/chunk";
import { toRow, type ContactRow } from "./rows";

export async function findContactsForOrg(db: Db, ids: string[], orgId: string): Promise<ContactRow[]> {
  if (ids.length === 0) return [];
  const rows: (typeof schema.contact.$inferSelect)[] = [];
  for (const batch of chunkIds(ids)) {
    const batchRows = await db
      .select()
      .from(schema.contact)
      .where(and(eq(schema.contact.orgId, orgId), inArray(schema.contact.id, batch)));
    rows.push(...batchRows);
  }
  return rows.map(toRow);
}

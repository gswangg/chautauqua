// Contacts repo: segments (migrations/0005_w4_segment.sql, DEC-025/DEC-026).
// Split out of repo/contacts.ts (contention decomposition, no behavior
// change). See repo/contacts.ts for the module-level contract notes.

import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { newId } from "../../../domain/ids";
import type { SegmentRule } from "../../../domain/contacts";
import { ApiError } from "../../http";

export interface SegmentRow {
  id: string;
  orgId: string;
  name: string;
  rulesJson: string;
  createdAt: number;
  updatedAt: number;
}

function toSegmentRow(r: typeof schema.segment.$inferSelect): SegmentRow {
  return {
    id: r.id,
    orgId: r.orgId,
    name: r.name,
    rulesJson: r.rulesJson,
    createdAt: r.createdAt.getTime(),
    updatedAt: r.updatedAt.getTime(),
  };
}

/** Lists an org's segments, ordered deterministically by id asc. `page`
 * absent means today's unbounded behavior (internal callers are unaffected)
 * — see countSegmentsForOrg for the matching total (DEC-460/461). */
export async function listSegmentsForOrg(db: Db, orgId: string, page?: { limit: number; offset: number }): Promise<SegmentRow[]> {
  let query = db.select().from(schema.segment).where(eq(schema.segment.orgId, orgId)).orderBy(asc(schema.segment.id));
  if (page) {
    query = query.limit(page.limit).offset(page.offset) as typeof query;
  }
  const rows = await query;
  return rows.map(toSegmentRow);
}

/** Counts an org's segments (same WHERE as listSegmentsForOrg). */
export async function countSegmentsForOrg(db: Db, orgId: string): Promise<number> {
  const rows = await db.select({ count: sql<number>`count(*)` }).from(schema.segment).where(eq(schema.segment.orgId, orgId));
  return Number(rows[0]?.count ?? 0);
}

export async function findSegmentForOrg(db: Db, id: string, orgId: string): Promise<SegmentRow | null> {
  const rows = await db
    .select()
    .from(schema.segment)
    .where(and(eq(schema.segment.id, id), eq(schema.segment.orgId, orgId)))
    .limit(1);
  const row = rows[0];
  return row ? toSegmentRow(row) : null;
}

/** Org-scoped upsert-by-name (DEC-809): a re-save under an existing name
 * updates that row's rules rather than twinning it. One atomic write —
 * `segment_org_id_name_idx` (migrations/0031_segment_name_unique.sql) is
 * the DB contract this relies on, so a concurrent save can never twin the
 * row the way a read-then-write could. */
export async function upsertSegmentByName(db: Db, orgId: string, name: string, rules: SegmentRule[]): Promise<SegmentRow> {
  const id = newId();
  const now = new Date();
  const rows = await db
    .insert(schema.segment)
    .values({ id, orgId, name, rulesJson: JSON.stringify(rules), createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [schema.segment.orgId, schema.segment.name],
      set: { rulesJson: JSON.stringify(rules), updatedAt: now },
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error("segment upsert did not persist");
  return toSegmentRow(row);
}

/** Throws ApiError('invalid') when a name patch collides with another
 * segment in the same org — segment_org_id_name_idx (migrations/0031_
 * segment_name_unique.sql) is the DB contract this surfaces as a 400
 * rather than an uncaught 500. */
export async function patchSegment(db: Db, id: string, patch: { name?: string; rules?: SegmentRule[] }): Promise<SegmentRow> {
  try {
    await db
      .update(schema.segment)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.rules !== undefined ? { rulesJson: JSON.stringify(patch.rules) } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.segment.id, id));
  } catch (err) {
    if (err instanceof Error && /UNIQUE constraint failed/i.test(err.message) && err.message.includes("segment")) {
      throw new ApiError("invalid", "A segment with this name already exists", { name: "A segment with this name already exists" });
    }
    throw err;
  }
  const rows = await db.select().from(schema.segment).where(eq(schema.segment.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw new Error(`segment ${id} not found after update`);
  return toSegmentRow(row);
}

export async function deleteSegment(db: Db, id: string): Promise<void> {
  await db.delete(schema.segment).where(eq(schema.segment.id, id));
}

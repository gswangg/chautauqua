// Contacts repo: segments (migrations/0005_w4_segment.sql, DEC-025/DEC-026).
// Split out of repo/contacts.ts (contention decomposition, no behavior
// change). See repo/contacts.ts for the module-level contract notes.

import { and, eq } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { newId } from "../../../domain/ids";
import type { SegmentRule } from "../../../domain/contacts";

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

export async function listSegmentsForOrg(db: Db, orgId: string): Promise<SegmentRow[]> {
  const rows = await db.select().from(schema.segment).where(eq(schema.segment.orgId, orgId));
  return rows.map(toSegmentRow);
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

export async function createSegment(db: Db, orgId: string, name: string, rules: SegmentRule[]): Promise<SegmentRow> {
  const id = newId();
  const now = new Date();
  await db.insert(schema.segment).values({
    id,
    orgId,
    name,
    rulesJson: JSON.stringify(rules),
    createdAt: now,
    updatedAt: now,
  });
  const rows = await db.select().from(schema.segment).where(eq(schema.segment.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw new Error("segment insert did not persist");
  return toSegmentRow(row);
}

export async function patchSegment(db: Db, id: string, patch: { name?: string; rules?: SegmentRule[] }): Promise<SegmentRow> {
  await db
    .update(schema.segment)
    .set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.rules !== undefined ? { rulesJson: JSON.stringify(patch.rules) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.segment.id, id));
  const rows = await db.select().from(schema.segment).where(eq(schema.segment.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw new Error(`segment ${id} not found after update`);
  return toSegmentRow(row);
}

export async function deleteSegment(db: Db, id: string): Promise<void> {
  await db.delete(schema.segment).where(eq(schema.segment.id, id));
}

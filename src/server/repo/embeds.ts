// Saved embeds repo (DEC-785). Repo functions are the only code that
// touches drizzle row types (DEC-012); handlers in src/routes/api/embeds.ts
// and the public renderer in src/routes/public/saved-embed.tsx call these.

import { asc, eq, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId } from "../../domain/ids";
import { DEC_785 } from "../../decisions";

void DEC_785;

export interface EmbedRecord {
  id: string;
  orgId: string;
  eventId: string;
  name: string;
  surface: string;
  format: string;
  optionsJson: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

function toRecord(row: {
  id: string;
  orgId: string;
  eventId: string;
  name: string;
  surface: string;
  format: string;
  optionsJson: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): EmbedRecord {
  return {
    id: row.id,
    orgId: row.orgId,
    eventId: row.eventId,
    name: row.name,
    surface: row.surface,
    format: row.format,
    optionsJson: row.optionsJson,
    enabled: row.enabled,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

/** Ordered createdAt asc, id asc (field guide: pagination ONE shape + `id asc`
 * deterministic tiebreak). */
export async function listEmbeds(
  db: Db,
  eventId: string,
  page: { limit: number; offset: number },
): Promise<EmbedRecord[]> {
  const rows = await db
    .select()
    .from(schema.embed)
    .where(eq(schema.embed.eventId, eventId))
    .orderBy(asc(schema.embed.createdAt), asc(schema.embed.id))
    .limit(page.limit)
    .offset(page.offset);
  return rows.map(toRecord);
}

export async function countEmbeds(db: Db, eventId: string): Promise<number> {
  const rows = await db.select({ count: sql<number>`count(*)` }).from(schema.embed).where(eq(schema.embed.eventId, eventId));
  return Number(rows[0]?.count ?? 0);
}

export async function createEmbed(
  db: Db,
  orgId: string,
  eventId: string,
  name: string,
  surface: string,
  format: string,
  optionsJson: string,
): Promise<EmbedRecord> {
  const now = new Date();
  const id = newId();
  await db.insert(schema.embed).values({
    id,
    orgId,
    eventId,
    name,
    surface,
    format,
    optionsJson,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  });
  return {
    id,
    orgId,
    eventId,
    name,
    surface,
    format,
    optionsJson,
    enabled: true,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  };
}

/** Ownership lookup for the PATCH/DELETE-by-id routes — null if the embed
 * doesn't exist. */
export async function getEmbedOwnership(db: Db, id: string): Promise<{ orgId: string } | null> {
  const rows = await db.select({ orgId: schema.embed.orgId }).from(schema.embed).where(eq(schema.embed.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updateEmbed(
  db: Db,
  id: string,
  patch: { name?: string; enabled?: boolean; surface?: string; format?: string; optionsJson?: string },
): Promise<EmbedRecord | null> {
  const values: {
    name?: string;
    enabled?: boolean;
    surface?: string;
    format?: string;
    optionsJson?: string;
    updatedAt: Date;
  } = { updatedAt: new Date() };
  if (patch.name !== undefined) values.name = patch.name;
  if (patch.enabled !== undefined) values.enabled = patch.enabled;
  if (patch.surface !== undefined) values.surface = patch.surface;
  if (patch.format !== undefined) values.format = patch.format;
  if (patch.optionsJson !== undefined) values.optionsJson = patch.optionsJson;
  await db.update(schema.embed).set(values).where(eq(schema.embed.id, id));
  const rows = await db.select().from(schema.embed).where(eq(schema.embed.id, id)).limit(1);
  const row = rows[0];
  return row ? toRecord(row) : null;
}

export async function deleteEmbed(db: Db, id: string): Promise<void> {
  await db.delete(schema.embed).where(eq(schema.embed.id, id));
}

/** Public-side read for GET /embed/e/:embedId: returns the row regardless
 * of `enabled` (the caller decides the 404 boundary — DEC-785). Null if the
 * id doesn't exist at all. */
export async function getEmbedById(db: Db, id: string): Promise<EmbedRecord | null> {
  const rows = await db.select().from(schema.embed).where(eq(schema.embed.id, id)).limit(1);
  const row = rows[0];
  return row ? toRecord(row) : null;
}

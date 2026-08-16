// Saved embeds repo (DEC-785/DEC-822/DEC-839). Repo functions are the only
// code that touches drizzle row types (DEC-012); handlers in
// src/routes/api/embeds.ts and the public renderer in
// src/routes/public/saved-embed.tsx call these.

import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId } from "../../domain/ids";
import { DEC_785, DEC_822, DEC_839 } from "../../decisions";

void DEC_785;
void DEC_822;
void DEC_839;

/** DEC-839 wire contract: the parsed shape every embed's stored recipe
 * serialises to. Never the raw JSON string -- src/routes/api/embeds.ts
 * validates every key through the SAME parsers the live route runs before
 * it's ever stringified for storage, so parsing it back out here is a
 * structural re-hydrate, not a second validation pass. */
export interface EmbedOptions {
  trackId?: string;
  // DEC-774 (predates DEC-839's key list): the sessions surface's
  // format/room chip filters. Named sessionFormat for the same reason
  // app/src/pages/settings/embedSnippet.ts's EmbedOptions does — the public
  // query param is `format`, but that name is taken by the embed's own
  // output format column.
  sessionFormat?: string;
  roomId?: string;
  day?: string;
  q?: string;
  limit?: number;
  fields?: string[];
  accent?: string;
}

/** Structural re-hydrate of the stored options_json column into the DEC-839
 * parsed shape. Shared by the repo's own row serialisation (below) and the
 * public renderer (src/routes/public/saved-embed.tsx) -- ONE place parses
 * the stored JSON, per DEC-839's "parse in one place" contract. */
export function parseStoredEmbedOptions(raw: string): EmbedOptions {
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
  return parsed as EmbedOptions;
}

export interface EmbedRecord {
  id: string;
  orgId: string;
  eventId: string;
  name: string;
  surface: string;
  format: string;
  options: EmbedOptions;
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
    options: parseStoredEmbedOptions(row.optionsJson),
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
    options: parseStoredEmbedOptions(optionsJson),
    enabled: true,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  };
}

/** Ownership lookup for the PATCH/DELETE-by-id routes — null if the embed
 * doesn't exist. eventId is included so PATCH can validate that a
 * trackId/roomId supplied in `options` belongs to THIS embed's own event
 * (DEC-839 amendment — a cross-event id would silently desync the DEC-931
 * delete guard, which only scans embeds whose eventId matches). */
export async function getEmbedOwnership(
  db: Db,
  id: string,
): Promise<{ orgId: string; eventId: string; surface: string; options: EmbedOptions } | null> {
  const rows = await db
    .select({
      orgId: schema.embed.orgId,
      eventId: schema.embed.eventId,
      surface: schema.embed.surface,
      optionsJson: schema.embed.optionsJson,
    })
    .from(schema.embed)
    .where(eq(schema.embed.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { orgId: row.orgId, eventId: row.eventId, surface: row.surface, options: parseStoredEmbedOptions(row.optionsJson) };
}

/** DEC-839 amendment: existence checks for the trackId/roomId embed options
 * scoped to the embed's own event — a track/room from ANOTHER event must
 * never be stored. */
export async function trackBelongsToEvent(db: Db, trackId: string, eventId: string): Promise<boolean> {
  const rows = await db
    .select({ id: schema.track.id })
    .from(schema.track)
    .where(and(eq(schema.track.id, trackId), eq(schema.track.eventId, eventId)))
    .limit(1);
  return rows.length > 0;
}

export async function updateEmbed(
  db: Db,
  id: string,
  patch: { name?: string; surface?: string; format?: string; optionsJson?: string; enabled?: boolean },
): Promise<EmbedRecord | null> {
  const values: {
    name?: string;
    surface?: string;
    format?: string;
    optionsJson?: string;
    enabled?: boolean;
    updatedAt: Date;
  } = { updatedAt: new Date() };
  if (patch.name !== undefined) values.name = patch.name;
  if (patch.surface !== undefined) values.surface = patch.surface;
  if (patch.format !== undefined) values.format = patch.format;
  if (patch.optionsJson !== undefined) values.optionsJson = patch.optionsJson;
  if (patch.enabled !== undefined) values.enabled = patch.enabled;
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

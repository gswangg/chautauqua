// Data access for portal_settings (single row per event, upsert) and
// resource (wiki pages, task w4-h). Every lookup is scoped to the
// caller's event so cross-tenant IDs 404 (no IDOR) — mirrors
// src/server/repo/events.ts's pattern (DEC-012/013).

import { and, eq } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId } from "../../domain/ids";
import { ApiError } from "../http";

// ---------------------------------------------------------------------------
// Portal settings
// ---------------------------------------------------------------------------

export interface PortalSettingsRecord {
  id: string;
  eventId: string;
  logoUrl: string | null;
  accentColor: string | null;
  welcomeMessage: string | null;
  showResources: boolean;
  createdAt: number;
  updatedAt: number;
}

function toPortalSettingsRecord(row: typeof schema.portalSettings.$inferSelect): PortalSettingsRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    logoUrl: row.logoUrl,
    accentColor: row.accentColor,
    welcomeMessage: row.welcomeMessage,
    showResources: row.showResources,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

export async function getPortalSettingsForEvent(db: Db, eventId: string): Promise<PortalSettingsRecord | null> {
  const rows = await db
    .select()
    .from(schema.portalSettings)
    .where(eq(schema.portalSettings.eventId, eventId))
    .limit(1);
  const row = rows[0];
  return row ? toPortalSettingsRecord(row) : null;
}

export interface UpsertPortalSettingsInput {
  logoUrl?: string | null;
  accentColor?: string | null;
  welcomeMessage?: string | null;
  showResources?: boolean;
}

export interface PortalSettingsWriteFields {
  logoUrl: string | null;
  accentColor: string | null;
  welcomeMessage: string | null;
  showResources: boolean;
}

/**
 * Pure merge for the upsert: on insert, undefined fields default per-column
 * (showResources defaults true, others null); on update, undefined fields
 * are left unchanged (PUT is a partial-merge upsert, not a full replace).
 * Extracted so the merge semantics are unit-testable without a Db.
 */
export function mergePortalSettingsInput(
  existing: PortalSettingsRecord | null,
  input: UpsertPortalSettingsInput,
): PortalSettingsWriteFields {
  if (!existing) {
    return {
      logoUrl: input.logoUrl ?? null,
      accentColor: input.accentColor ?? null,
      welcomeMessage: input.welcomeMessage ?? null,
      showResources: input.showResources ?? true,
    };
  }
  return {
    logoUrl: input.logoUrl !== undefined ? input.logoUrl : existing.logoUrl,
    accentColor: input.accentColor !== undefined ? input.accentColor : existing.accentColor,
    welcomeMessage: input.welcomeMessage !== undefined ? input.welcomeMessage : existing.welcomeMessage,
    showResources: input.showResources !== undefined ? input.showResources : existing.showResources,
  };
}

/** Upserts the single portal_settings row for an event (unique index on event_id). */
export async function upsertPortalSettings(
  db: Db,
  eventId: string,
  input: UpsertPortalSettingsInput,
): Promise<PortalSettingsRecord> {
  const existing = await getPortalSettingsForEvent(db, eventId);
  const now = new Date();
  const fields = mergePortalSettingsInput(existing, input);

  if (!existing) {
    const id = newId();
    await db.insert(schema.portalSettings).values({
      id,
      eventId,
      ...fields,
      createdAt: now,
      updatedAt: now,
    });
    const created = await getPortalSettingsForEvent(db, eventId);
    if (!created) throw new Error("upsertPortalSettings: insert did not persist");
    return created;
  }

  await db
    .update(schema.portalSettings)
    .set({ ...fields, updatedAt: now })
    .where(eq(schema.portalSettings.eventId, eventId));

  const updated = await getPortalSettingsForEvent(db, eventId);
  if (!updated) throw new Error("updatePortalSettings: row disappeared after update");
  return updated;
}

// ---------------------------------------------------------------------------
// Resources (wiki pages via this API; kind='file' is a later wave)
// ---------------------------------------------------------------------------

export interface ResourceRecord {
  id: string;
  eventId: string;
  kind: string;
  title: string;
  content: string | null;
  fileId: string | null;
  position: number;
  createdAt: number;
  updatedAt: number;
}

function toResourceRecord(row: typeof schema.resource.$inferSelect): ResourceRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    kind: row.kind,
    title: row.title,
    content: row.content,
    fileId: row.fileId,
    position: row.position,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

/**
 * Pure event-scoping check for cross-tenant resource access: a resource
 * belongs to `eventId` only when its own event_id matches exactly (no
 * fallback, no org-blind trust of the URL param) — mirrors the 404-on-any-
 * mismatch pattern events.ts uses for tracks/rooms. Extracted so the IDOR
 * guard is unit-testable without a Db.
 */
export function resourceBelongsToEvent(actualEventId: string | null, eventId: string): boolean {
  return actualEventId !== null && actualEventId === eventId;
}

/** Only kind='wiki' resources can be edited via this API (file-kind resources are a later wave, DEC-029). */
export function isWikiResource(kind: string): boolean {
  return kind === "wiki";
}

export async function listResourcesForEvent(db: Db, eventId: string): Promise<ResourceRecord[]> {
  const rows = await db.select().from(schema.resource).where(eq(schema.resource.eventId, eventId));
  return rows.map(toResourceRecord).sort((a, b) => a.position - b.position);
}

export async function createWikiResource(
  db: Db,
  eventId: string,
  input: { title: string; content: string; position?: number },
): Promise<ResourceRecord> {
  const now = new Date();
  const id = newId();
  await db.insert(schema.resource).values({
    id,
    eventId,
    kind: "wiki",
    title: input.title,
    content: input.content,
    fileId: null,
    position: input.position ?? 0,
    createdAt: now,
    updatedAt: now,
  });
  const created = await getResourceForEvent(db, id, eventId);
  if (!created) throw new Error("createWikiResource: insert did not persist");
  return created;
}

export async function getResourceForEvent(db: Db, resourceId: string, eventId: string): Promise<ResourceRecord | null> {
  const rows = await db
    .select()
    .from(schema.resource)
    .where(and(eq(schema.resource.id, resourceId), eq(schema.resource.eventId, eventId)))
    .limit(1);
  const row = rows[0];
  return row ? toResourceRecord(row) : null;
}

/** Finds the event_id owning a resource row, with no org filter yet (helper for cross-table IDOR checks). */
export async function resourceEventId(db: Db, resourceId: string): Promise<string | null> {
  const rows = await db
    .select({ eventId: schema.resource.eventId })
    .from(schema.resource)
    .where(eq(schema.resource.id, resourceId))
    .limit(1);
  return rows[0]?.eventId ?? null;
}

export async function updateWikiResource(
  db: Db,
  resourceId: string,
  eventId: string,
  input: { title?: string; content?: string; position?: number },
): Promise<ResourceRecord> {
  const existing = await getResourceForEvent(db, resourceId, eventId);
  if (!existing) throw new ApiError("not_found", "Resource not found");
  if (!isWikiResource(existing.kind)) {
    throw new ApiError("invalid", "Only wiki resources can be edited via this API");
  }

  await db
    .update(schema.resource)
    .set({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.position !== undefined ? { position: input.position } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.resource.id, resourceId));

  const updated = await getResourceForEvent(db, resourceId, eventId);
  if (!updated) throw new Error("updateWikiResource: row disappeared after update");
  return updated;
}

export async function deleteResource(db: Db, resourceId: string, eventId: string): Promise<void> {
  const existing = await getResourceForEvent(db, resourceId, eventId);
  if (!existing) throw new ApiError("not_found", "Resource not found");

  await db.delete(schema.resource).where(eq(schema.resource.id, resourceId));
}

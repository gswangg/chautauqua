// Data access for portal_settings (single row per event, upsert) and
// resource (wiki pages, task w4-h). Every lookup is scoped to the
// caller's event so cross-tenant IDs 404 (no IDOR) — mirrors
// src/server/repo/events.ts's pattern (DEC-012/013).

import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId } from "../../domain/ids";
import { ApiError } from "../http";
import { DEC_461 } from "../../decisions";

void DEC_461;

/** DEC-461: optional trailing repo page param — see src/server/repo/events.ts
 * for the same shape. Absent means today's unbounded behavior (the portal
 * page renders every resource, no paging UI). */
export interface RepoPage {
  limit: number;
  offset: number;
}

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
  // DEC-558 (wave 75): portal_settings_event_id_idx is a uniqueIndex on
  // schema.portalSettings.eventId, so this predicate already narrows to at
  // most one row.
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

/** Upserts the single portal_settings row for an event (DEC-552: one atomic
 * INSERT ... ON CONFLICT DO UPDATE against the uniqueIndex on event_id at
 * src/db/schema.ts:505 — never a read-then-write). The `set` clause is built
 * from only the keys `input` actually defines, reproducing the prior
 * merge-with-existing semantics (undefined fields left unchanged on update)
 * without a probe read. */
export async function upsertPortalSettings(
  db: Db,
  eventId: string,
  input: UpsertPortalSettingsInput,
): Promise<PortalSettingsRecord> {
  const now = new Date();
  const insertFields = mergePortalSettingsInput(null, input);
  const set: Partial<PortalSettingsWriteFields> & { updatedAt: Date } = { updatedAt: now };
  if (input.logoUrl !== undefined) set.logoUrl = input.logoUrl;
  if (input.accentColor !== undefined) set.accentColor = input.accentColor;
  if (input.welcomeMessage !== undefined) set.welcomeMessage = input.welcomeMessage;
  if (input.showResources !== undefined) set.showResources = input.showResources;

  await db
    .insert(schema.portalSettings)
    .values({
      id: newId(),
      eventId,
      ...insertFields,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.portalSettings.eventId,
      set,
    });

  const updated = await getPortalSettingsForEvent(db, eventId);
  if (!updated) throw new Error("upsertPortalSettings: row missing after write");
  return updated;
}

// ---------------------------------------------------------------------------
// Resources (title and position editable for any kind; content is wiki-only)
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

/** Only kind='wiki' resources carry a page body: gates the `content` field on update, not title/position (DEC-029). */
export function isWikiResource(kind: string): boolean {
  return kind === "wiki";
}

export async function listResourcesForEvent(db: Db, eventId: string, page?: RepoPage): Promise<ResourceRecord[]> {
  const base = db
    .select()
    .from(schema.resource)
    .where(eq(schema.resource.eventId, eventId))
    .orderBy(asc(schema.resource.position), asc(schema.resource.id));
  const rows = page ? await base.limit(page.limit).offset(page.offset) : await base;
  return rows.map(toResourceRecord);
}

export async function countResourcesForEvent(db: Db, eventId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.resource)
    .where(eq(schema.resource.eventId, eventId));
  return Number(rows[0]?.count ?? 0);
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

export async function updateResource(
  db: Db,
  resourceId: string,
  eventId: string,
  input: { title?: string; content?: string; position?: number },
): Promise<ResourceRecord> {
  const existing = await getResourceForEvent(db, resourceId, eventId);
  if (!existing) throw new ApiError("not_found", "Resource not found");
  if (input.content !== undefined && !isWikiResource(existing.kind)) {
    throw new ApiError("invalid", "A file resource has no page body", { content: "A file resource has no page body" });
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
  if (!updated) throw new Error("updateResource: row disappeared after update");
  return updated;
}

/** Deletes a resource row; returns the linked file id when the resource was
 * kind='file' so the caller (route handler) can also delete the file row +
 * R2 object — repo functions don't own the FileStore port (DEC-012). */
export async function deleteResource(db: Db, resourceId: string, eventId: string): Promise<{ fileId: string | null }> {
  const existing = await getResourceForEvent(db, resourceId, eventId);
  if (!existing) throw new ApiError("not_found", "Resource not found");

  await db.delete(schema.resource).where(eq(schema.resource.id, resourceId));
  return { fileId: existing.fileId };
}

// ---------------------------------------------------------------------------
// File-kind resources (DEC-047): multipart create on this same API. The
// file row is kind='resource' with submissionId null — never one of
// domain/files.ts's submission-deliverable FileKind literals, so this
// inserts directly rather than going through repo/files.ts's insertFile
// (whose input type is pinned to FileKind).
// ---------------------------------------------------------------------------

export interface InsertResourceFileInput {
  filename: string;
  r2Key: string;
  sizeBytes: number;
  contentType: string;
}

export async function insertResourceFile(db: Db, input: InsertResourceFileInput): Promise<string> {
  const id = newId();
  const now = new Date();
  await db.insert(schema.file).values({
    id,
    submissionId: null,
    kind: "resource",
    filename: input.filename,
    r2Key: input.r2Key,
    sizeBytes: input.sizeBytes,
    contentType: input.contentType,
    previousFileId: null,
    uploadedByContactId: null,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function createFileResource(
  db: Db,
  eventId: string,
  input: { title: string; fileId: string; position?: number },
): Promise<ResourceRecord> {
  const now = new Date();
  const id = newId();
  await db.insert(schema.resource).values({
    id,
    eventId,
    kind: "file",
    title: input.title,
    content: null,
    fileId: input.fileId,
    position: input.position ?? 0,
    createdAt: now,
    updatedAt: now,
  });
  const created = await getResourceForEvent(db, id, eventId);
  if (!created) throw new Error("createFileResource: insert did not persist");
  return created;
}

/** Loads a file row's serving fields for the delete-cascade path — throws if
 * the id doesn't resolve to a row (fail loudly: deleteResource already
 * confirmed the resource had a non-null fileId, so a missing row is a data
 * invariant violation, not a normal not-found). */
export async function getFileForDelete(db: Db, fileId: string): Promise<{ r2Key: string }> {
  const rows = await db.select({ r2Key: schema.file.r2Key }).from(schema.file).where(eq(schema.file.id, fileId)).limit(1);
  const row = rows[0];
  if (!row) throw new Error(`getFileForDelete: file ${fileId} referenced by a resource row but missing`);
  return row;
}

export async function deleteFileRow(db: Db, fileId: string): Promise<void> {
  await db.delete(schema.file).where(eq(schema.file.id, fileId));
}

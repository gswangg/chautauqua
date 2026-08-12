// CRM sourcing pipeline repo (CRM-07/08, DEC-157). Only this module touches
// drizzle row types for pipeline_entry/pipeline_activity; handlers in
// src/routes/api/pipeline.ts call these. Never imports a mailer (DEC-157:
// pipeline moves/notes never send email).

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId } from "../../domain/ids";
import { chunkIds } from "../../lib/chunk";

export const PIPELINE_STAGES = ["identified", "contacted", "interested", "confirmed", "declined"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export function isPipelineStage(v: unknown): v is PipelineStage {
  return typeof v === "string" && (PIPELINE_STAGES as readonly string[]).includes(v);
}

export interface PipelineEntryRow {
  id: string;
  orgId: string;
  contactId: string;
  stage: PipelineStage;
  createdAt: number;
  updatedAt: number;
}

function toEntryRow(r: typeof schema.pipelineEntry.$inferSelect): PipelineEntryRow {
  return {
    id: r.id,
    orgId: r.orgId,
    contactId: r.contactId,
    stage: r.stage as PipelineStage,
    createdAt: r.createdAt.getTime(),
    updatedAt: r.updatedAt.getTime(),
  };
}

export interface PipelineActivityRow {
  id: string;
  entryId: string;
  kind: "move" | "note";
  body: string | null;
  fromStage: string | null;
  toStage: string | null;
  authorUserId: string;
  authorName: string;
  createdAt: number;
}

function toActivityRow(r: typeof schema.pipelineActivity.$inferSelect): PipelineActivityRow {
  return {
    id: r.id,
    entryId: r.entryId,
    kind: r.kind as "move" | "note",
    body: r.body,
    fromStage: r.fromStage,
    toStage: r.toStage,
    authorUserId: r.authorUserId,
    authorName: r.authorName,
    createdAt: r.createdAt.getTime(),
  };
}

export interface PipelineContactSummary {
  id: string;
  firstName: string;
  lastName: string;
  company: string | null;
  email: string;
}

/** Resolves a display name for an activity's author: the linked contact's
 * name if the user is contact-linked (rare for organizers), else their
 * email — mirrors src/server/repo/files.ts's listFileComments pattern. */
export async function resolveAuthorName(db: Db, userId: string): Promise<string> {
  const rows = await db
    .select({ email: schema.user.email, contactId: schema.user.contactId })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);
  const user = rows[0];
  if (!user) return "Unknown";
  if (user.contactId) {
    const contactRows = await db
      .select({ firstName: schema.contact.firstName, lastName: schema.contact.lastName })
      .from(schema.contact)
      .where(eq(schema.contact.id, user.contactId))
      .limit(1);
    const contact = contactRows[0];
    if (contact) return `${contact.firstName} ${contact.lastName}`.trim();
  }
  return user.email;
}

export async function findEntryById(db: Db, id: string): Promise<PipelineEntryRow | null> {
  const rows = await db.select().from(schema.pipelineEntry).where(eq(schema.pipelineEntry.id, id)).limit(1);
  const row = rows[0];
  return row ? toEntryRow(row) : null;
}

export async function findEntryForOrg(db: Db, id: string, orgId: string): Promise<PipelineEntryRow | null> {
  const rows = await db
    .select()
    .from(schema.pipelineEntry)
    .where(and(eq(schema.pipelineEntry.id, id), eq(schema.pipelineEntry.orgId, orgId)))
    .limit(1);
  const row = rows[0];
  return row ? toEntryRow(row) : null;
}

export async function findEntryByContact(db: Db, orgId: string, contactId: string): Promise<PipelineEntryRow | null> {
  const rows = await db
    .select()
    .from(schema.pipelineEntry)
    .where(and(eq(schema.pipelineEntry.orgId, orgId), eq(schema.pipelineEntry.contactId, contactId)))
    .limit(1);
  const row = rows[0];
  return row ? toEntryRow(row) : null;
}

export interface PipelineListItem {
  id: string;
  contactId: string;
  firstName: string;
  lastName: string;
  company: string | null;
  email: string;
  stage: PipelineStage;
  updatedAt: number;
}

/** Counts pipeline entries for an org (same WHERE as listPipelineForOrg),
 * used for the route's `total` alongside a bounded page (DEC-460/461). */
export async function countPipelineForOrg(db: Db, orgId: string): Promise<number> {
  const rows = await db.select({ count: sql<number>`count(*)` }).from(schema.pipelineEntry).where(eq(schema.pipelineEntry.orgId, orgId));
  return Number(rows[0]?.count ?? 0);
}

/** Lists pipeline entries for an org, joined (in application code, per
 * this repo's chunkIds/inArray convention elsewhere) against contact rows
 * for the card fields the board needs. Deterministic order: updatedAt desc,
 * id asc. `page` absent means today's unbounded behavior (internal callers
 * are unaffected); when present, only that page's rows are hydrated against
 * contacts, not the whole org's entries (DEC-460/461). */
export async function listPipelineForOrg(db: Db, orgId: string, page?: { limit: number; offset: number }): Promise<PipelineListItem[]> {
  let query = db
    .select()
    .from(schema.pipelineEntry)
    .where(eq(schema.pipelineEntry.orgId, orgId))
    .orderBy(desc(schema.pipelineEntry.updatedAt), asc(schema.pipelineEntry.id));
  if (page) {
    query = query.limit(page.limit).offset(page.offset) as typeof query;
  }
  const entries = (await query).map(toEntryRow);
  if (entries.length === 0) return [];

  const contactIds = [...new Set(entries.map((e) => e.contactId))];
  const contactMap = new Map<string, PipelineContactSummary>();
  for (const batch of chunkIds(contactIds)) {
    const rows = await db
      .select({
        id: schema.contact.id,
        firstName: schema.contact.firstName,
        lastName: schema.contact.lastName,
        company: schema.contact.company,
        email: schema.contact.email,
      })
      .from(schema.contact)
      .where(inArray(schema.contact.id, batch));
    for (const c of rows) contactMap.set(c.id, c);
  }

  return entries
    .map((e) => {
      const contact = contactMap.get(e.contactId);
      // Fail loudly: an entry whose contact vanished is a data-integrity
      // bug, not a state to render around silently.
      if (!contact) throw new Error(`pipeline_entry ${e.id} references missing contact ${e.contactId}`);
      return {
        id: e.id,
        contactId: e.contactId,
        firstName: contact.firstName,
        lastName: contact.lastName,
        company: contact.company,
        email: contact.email,
        stage: e.stage,
        updatedAt: e.updatedAt,
      };
    });
}

/** Enrolls a contact into the org pipeline at `stage`, appending a 'move'
 * activity from null -> stage. Caller must have already checked for an
 * existing entry (duplicate enrollment is a route-level 400, per DEC-157). */
export async function enrollContact(
  db: Db,
  orgId: string,
  contactId: string,
  stage: PipelineStage,
  actor: { userId: string; name: string },
): Promise<PipelineEntryRow> {
  const id = newId();
  const now = new Date();
  await db.insert(schema.pipelineEntry).values({
    id,
    orgId,
    contactId,
    stage,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.pipelineActivity).values({
    id: newId(),
    entryId: id,
    kind: "move",
    body: null,
    fromStage: null,
    toStage: stage,
    authorUserId: actor.userId,
    authorName: actor.name,
    createdAt: now,
  });
  const created = await findEntryById(db, id);
  if (!created) throw new Error("pipeline_entry insert did not persist");
  return created;
}

/** Moves an entry to a new stage, appending a 'move' activity (this table
 * IS the stage history, per DEC-157). */
export async function moveEntry(
  db: Db,
  entry: PipelineEntryRow,
  toStage: PipelineStage,
  actor: { userId: string; name: string },
): Promise<PipelineEntryRow> {
  const now = new Date();
  await db
    .update(schema.pipelineEntry)
    .set({ stage: toStage, updatedAt: now })
    .where(eq(schema.pipelineEntry.id, entry.id));
  await db.insert(schema.pipelineActivity).values({
    id: newId(),
    entryId: entry.id,
    kind: "move",
    body: null,
    fromStage: entry.stage,
    toStage,
    authorUserId: actor.userId,
    authorName: actor.name,
    createdAt: now,
  });
  const updated = await findEntryById(db, entry.id);
  if (!updated) throw new Error(`pipeline_entry ${entry.id} not found after update`);
  return updated;
}

/** Appends a 'note' activity to an entry's feed. */
export async function addNote(
  db: Db,
  entry: PipelineEntryRow,
  body: string,
  actor: { userId: string; name: string },
): Promise<PipelineActivityRow> {
  const id = newId();
  const now = new Date();
  await db.insert(schema.pipelineActivity).values({
    id,
    entryId: entry.id,
    kind: "note",
    body,
    fromStage: null,
    toStage: null,
    authorUserId: actor.userId,
    authorName: actor.name,
    createdAt: now,
  });
  return {
    id,
    entryId: entry.id,
    kind: "note",
    body,
    fromStage: null,
    toStage: null,
    authorUserId: actor.userId,
    authorName: actor.name,
    createdAt: now.getTime(),
  };
}

/** Newest-first activity feed for an entry (moves + notes together), per
 * CRM-08's "a general activity feed that includes the moves". */
export async function listActivityForEntry(db: Db, entryId: string): Promise<PipelineActivityRow[]> {
  const rows = await db
    .select()
    .from(schema.pipelineActivity)
    .where(eq(schema.pipelineActivity.entryId, entryId))
    .orderBy(desc(schema.pipelineActivity.createdAt));
  return rows.map(toActivityRow);
}

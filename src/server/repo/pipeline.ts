// CRM sourcing pipeline repo (CRM-07/08, DEC-157). Only this module touches
// drizzle row types for pipeline_entry/pipeline_activity; handlers in
// src/routes/api/pipeline.ts call these. Never imports a mailer (DEC-157:
// pipeline moves/notes never send email).

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId } from "../../domain/ids";
import { chunkIds } from "../../lib/chunk";
import { ApiError } from "../http";

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
  // DEC-821: fit score (integer 1-5) and rationale -- both nullable, and
  // absence is a visible 'Unrated' state, never an implied zero.
  fitScore: number | null;
  rationale: string | null;
}

function toEntryRow(r: typeof schema.pipelineEntry.$inferSelect): PipelineEntryRow {
  return {
    id: r.id,
    orgId: r.orgId,
    contactId: r.contactId,
    stage: r.stage as PipelineStage,
    createdAt: r.createdAt.getTime(),
    updatedAt: r.updatedAt.getTime(),
    fitScore: r.fitScore ?? null,
    rationale: r.rationale ?? null,
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
    .select({ email: schema.user.email, contactId: schema.user.contactId, name: schema.user.name })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);
  const user = rows[0];
  if (!user) throw new Error(`resolveAuthorName: no user row for ${userId}`);
  if (user.contactId) {
    const contactRows = await db
      .select({ firstName: schema.contact.firstName, lastName: schema.contact.lastName })
      .from(schema.contact)
      .where(eq(schema.contact.id, user.contactId))
      .limit(1);
    const contact = contactRows[0];
    if (contact) return `${contact.firstName} ${contact.lastName}`.trim();
  }
  if (user.name && user.name.trim()) return user.name;
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
  // DEC-558 (wave 75): pipeline_entry_org_id_contact_id_idx is a uniqueIndex
  // on (schema.pipelineEntry.orgId, schema.pipelineEntry.contactId), so this
  // predicate already narrows to at most one row.
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
  // DEC-803: the entry's updatedAt — only moveEntry/enrollContact write it,
  // so it IS the moment the card entered its current stage.
  stageSince: number;
  // DEC-803: newest move-to-declined activity's body, for entries whose
  // stage is 'declined'; null otherwise (including a declined entry whose
  // move activity somehow carries no reason — never invented).
  declineReason: string | null;
  // DEC-821: fit score (1-5) and rationale, both nullable.
  fitScore: number | null;
  rationale: string | null;
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
 * id asc. `page` is required (w56-e: only that page's rows are hydrated
 * against contacts, not the whole org's entries) -- src/routes/api/
 * pipeline.ts:106 is the sole caller and already pages (DEC-460/461). */
export async function listPipelineForOrg(db: Db, orgId: string, page: { limit: number; offset: number }): Promise<PipelineListItem[]> {
  const entries = (
    await db
      .select()
      .from(schema.pipelineEntry)
      .where(eq(schema.pipelineEntry.orgId, orgId))
      .orderBy(desc(schema.pipelineEntry.updatedAt), asc(schema.pipelineEntry.id))
      .limit(page.limit)
      .offset(page.offset)
  ).map(toEntryRow);
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

  // DEC-803: declineReason for the page's declined entries, read in ONE
  // chunked query over entry ids (never per card) — newest move-to-declined
  // activity's body per entry, picked in application code since D1/SQLite
  // has no simple "latest row per group" here.
  const declineReasonByEntryId = new Map<string, string | null>();
  const declinedEntryIds = entries.filter((e) => e.stage === "declined").map((e) => e.id);
  for (const batch of chunkIds(declinedEntryIds)) {
    const rows = await db
      .select({
        entryId: schema.pipelineActivity.entryId,
        body: schema.pipelineActivity.body,
        createdAt: schema.pipelineActivity.createdAt,
      })
      .from(schema.pipelineActivity)
      .where(
        and(
          inArray(schema.pipelineActivity.entryId, batch),
          eq(schema.pipelineActivity.kind, "move"),
          eq(schema.pipelineActivity.toStage, "declined"),
        ),
      );
    // Newest-wins per entry: rows aren't guaranteed ordered across a chunk,
    // so pick explicitly by createdAt rather than trust query order.
    const newestByEntry = new Map<string, { body: string | null; createdAt: number }>();
    for (const row of rows) {
      const createdAtMs = row.createdAt instanceof Date ? row.createdAt.getTime() : (row.createdAt as unknown as number);
      const current = newestByEntry.get(row.entryId);
      if (!current || createdAtMs > current.createdAt) {
        newestByEntry.set(row.entryId, { body: row.body, createdAt: createdAtMs });
      }
    }
    for (const [entryId, v] of newestByEntry) declineReasonByEntryId.set(entryId, v.body);
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
        stageSince: e.updatedAt,
        declineReason: e.stage === "declined" ? (declineReasonByEntryId.get(e.id) ?? null) : null,
        fitScore: e.fitScore,
        rationale: e.rationale,
      };
    });
}

/** Enrolls a contact into the org pipeline at `stage`, appending a 'move'
 * activity from null -> stage. DEC-552: the pipeline_entry insert is atomic
 * against the (orgId, contactId) uniqueIndex (src/db/schema.ts:669) — on
 * conflict it throws the same 'invalid' ApiError the caller used to raise
 * from a pre-check, before ever writing the pipeline_activity row. Callers
 * no longer need to pre-check for an existing entry. */
export async function enrollContact(
  db: Db,
  orgId: string,
  contactId: string,
  stage: PipelineStage,
  actor: { userId: string; name: string },
  options?: { fitScore?: number | null; rationale?: string | null; reason?: string | null },
): Promise<PipelineEntryRow> {
  const id = newId();
  const now = new Date();
  const inserted = await db
    .insert(schema.pipelineEntry)
    .values({
      id,
      orgId,
      contactId,
      stage,
      fitScore: options?.fitScore ?? null,
      rationale: options?.rationale ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({
      target: [schema.pipelineEntry.orgId, schema.pipelineEntry.contactId],
    })
    .returning({ id: schema.pipelineEntry.id });
  if (inserted.length === 0) {
    throw new ApiError("invalid", "Contact is already enrolled in the pipeline", { contactId: "already enrolled" });
  }
  await db.insert(schema.pipelineActivity).values({
    id: newId(),
    entryId: id,
    kind: "move",
    // DEC-803: an enroll straight into 'declined' writes its reason onto
    // this initial move activity row, in exactly the shape
    // declineReasonForEntry already reads (newest move-to-declined body).
    body: stage === "declined" ? (options?.reason ?? null) : null,
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
 * IS the stage history, per DEC-157). Callers must only invoke this for a
 * REAL stage change (toStage !== entry.stage) -- DEC-980: a same-stage or
 * fit-only PATCH must never reach here, since every call writes an activity
 * row and bumps updatedAt (which IS stageSince, DEC-803). */
export async function moveEntry(
  db: Db,
  entry: PipelineEntryRow,
  toStage: PipelineStage,
  actor: { userId: string; name: string },
  reason?: string | null,
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
    body: reason ?? null,
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

/** Newest move-to-declined activity's body for a single entry, or null if
 * it has none (DEC-803). Single-entry counterpart of listPipelineForOrg's
 * chunked declineReasonByEntryId lookup, for callers (the PATCH route) that
 * already have one entry in hand and never invent this value. */
export async function declineReasonForEntry(db: Db, entryId: string): Promise<string | null> {
  const rows = await db
    .select({ body: schema.pipelineActivity.body, createdAt: schema.pipelineActivity.createdAt })
    .from(schema.pipelineActivity)
    .where(
      and(
        eq(schema.pipelineActivity.entryId, entryId),
        eq(schema.pipelineActivity.kind, "move"),
        eq(schema.pipelineActivity.toStage, "declined"),
      ),
    )
    .orderBy(desc(schema.pipelineActivity.createdAt))
    .limit(1);
  return rows[0]?.body ?? null;
}

/** Updates an entry's fit score and/or rationale (DEC-821). Does not touch
 * stage, updatedAt, or write an activity row -- fit is orthogonal to the
 * stage-move history that pipeline_activity records. */
export async function updateEntryFit(
  db: Db,
  entryId: string,
  fit: { fitScore?: number | null; rationale?: string | null },
): Promise<PipelineEntryRow> {
  const patch: Partial<typeof schema.pipelineEntry.$inferInsert> = {};
  if ("fitScore" in fit) patch.fitScore = fit.fitScore ?? null;
  if ("rationale" in fit) patch.rationale = fit.rationale ?? null;
  if (Object.keys(patch).length > 0) {
    await db.update(schema.pipelineEntry).set(patch).where(eq(schema.pipelineEntry.id, entryId));
  }
  const updated = await findEntryById(db, entryId);
  if (!updated) throw new Error(`pipeline_entry ${entryId} not found after fit update`);
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
 * CRM-08's "a general activity feed that includes the moves". `page` is
 * required (w56-e: an unbounded read here was the same shape countPipelineForOrg
 * already guards against for the board) -- pair with countActivityForEntry
 * below for the route's `total`. */
export async function listActivityForEntry(
  db: Db,
  entryId: string,
  page: { limit: number; offset: number },
): Promise<PipelineActivityRow[]> {
  const rows = await db
    .select()
    .from(schema.pipelineActivity)
    .where(eq(schema.pipelineActivity.entryId, entryId))
    .orderBy(desc(schema.pipelineActivity.createdAt), asc(schema.pipelineActivity.id))
    .limit(page.limit)
    .offset(page.offset);
  return rows.map(toActivityRow);
}

/** Counts an entry's activity rows (same WHERE as listActivityForEntry),
 * used for the route's `total` alongside a bounded page. */
export async function countActivityForEntry(db: Db, entryId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.pipelineActivity)
    .where(eq(schema.pipelineActivity.entryId, entryId));
  return Number(rows[0]?.count ?? 0);
}

// Sessionboard import, layer 2 of 3 (DEC-612, DEC-613): the idempotent
// upsert applying plans produced by src/domain/sessionboard.ts. This is the
// ONE planner both dry run and real run go through -- dryRun below changes
// only whether the writes execute, never how created/updated/skipped are
// derived (DEC-613).

import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { newId } from "../../../domain/ids";
import { chunkIds } from "../../../lib/chunk";
import { isValidEmail } from "../../../domain/email";
import { submissionSeqSubquery } from "../submissions/seq";
import type { SbEntity, SbRowPlan } from "../../../domain/sessionboard";

export interface SbApplySkip {
  row: number;
  reason: string;
}

export interface SbApplyResult {
  created: number;
  updated: number;
  skipped: SbApplySkip[];
}

export interface ApplySessionboardPlansArgs {
  orgId: string;
  eventId: string;
  entity: SbEntity;
  plans: SbRowPlan[];
  dryRun: boolean;
}

/** Fetches every (external_ref -> id) pair already present for this owner
 * scope, chunked (DEC-078/D1 bound-parameter limit) over the distinct refs
 * this batch of plans actually references -- never the whole table. A NULL
 * external_ref column inside a negated predicate silently skips NULL rows
 * (DEC-612); this matches POSITIVELY (inArray) so that pitfall never
 * applies here. */
async function loadExistingRefs(
  db: Db,
  entity: SbEntity,
  orgId: string,
  eventId: string,
  refs: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (refs.length === 0) return out;
  if (entity === "contacts") {
    for (const batch of chunkIds(refs)) {
      const rows = await db
        .select({ id: schema.contact.id, externalRef: schema.contact.externalRef })
        .from(schema.contact)
        .where(and(eq(schema.contact.orgId, orgId), inArray(schema.contact.externalRef, batch)));
      for (const r of rows) {
        if (r.externalRef) out.set(r.externalRef, r.id);
      }
    }
    return out;
  }
  if (entity === "submissions") {
    for (const batch of chunkIds(refs)) {
      const rows = await db
        .select({ id: schema.submission.id, externalRef: schema.submission.externalRef })
        .from(schema.submission)
        .where(and(eq(schema.submission.eventId, eventId), inArray(schema.submission.externalRef, batch)));
      for (const r of rows) {
        if (r.externalRef) out.set(r.externalRef, r.id);
      }
    }
    return out;
  }
  // tracks
  for (const batch of chunkIds(refs)) {
    const rows = await db
      .select({ id: schema.track.id, externalRef: schema.track.externalRef })
      .from(schema.track)
      .where(and(eq(schema.track.eventId, eventId), inArray(schema.track.externalRef, batch)));
    for (const r of rows) {
      if (r.externalRef) out.set(r.externalRef, r.id);
    }
  }
  return out;
}

/** Every track already on the event, name (trimmed/lowercased) -> id --
 * used to resolve a submission plan's `trackName` value to a `track_id`.
 * A trackName with no match leaves trackId unresolved (the row still
 * imports; track linkage is best-effort, never a hard failure) rather than
 * auto-creating a track from a stray name a submissions-entity import
 * happens to carry. */
async function loadTrackNameMap(db: Db, eventId: string): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: schema.track.id, name: schema.track.name })
    .from(schema.track)
    .where(eq(schema.track.eventId, eventId));
  const out = new Map<string, string>();
  for (const r of rows) out.set(r.name.trim().toLowerCase(), r.id);
  return out;
}

export async function applySessionboardPlans(db: Db, args: ApplySessionboardPlansArgs): Promise<SbApplyResult> {
  const { orgId, eventId, entity, plans, dryRun } = args;

  const refs = [...new Set(plans.map((p) => p.externalRef).filter((r): r is string => r !== null))];
  const refMap = await loadExistingRefs(db, entity, orgId, eventId, refs);
  const trackNameMap = entity === "submissions" ? await loadTrackNameMap(db, eventId) : null;

  let created = 0;
  let updated = 0;
  const skipped: SbApplySkip[] = [];
  const now = () => new Date();

  for (const plan of plans) {
    if (!plan.externalRef) {
      skipped.push({ row: plan.row, reason: "Missing external id (Record ID)" });
      continue;
    }

    if (entity === "contacts" && plan.values.email !== undefined && !isValidEmail(plan.values.email)) {
      skipped.push({ row: plan.row, reason: "Invalid email" });
      continue;
    }

    const existingId = refMap.get(plan.externalRef);

    if (existingId === undefined) {
      // Create candidate: entity-specific required fields must be present
      // on FIRST sight of this external_ref (an update to an existing row
      // never re-checks these -- only the fields actually present in the
      // file are patched).
      if (entity === "contacts") {
        const { firstName, lastName, email } = plan.values;
        if (!firstName || !lastName || !email) {
          skipped.push({ row: plan.row, reason: "Missing required field(s): firstName, lastName, email" });
          continue;
        }
        const id = newId();
        if (!dryRun) {
          const ts = now();
          await db.insert(schema.contact).values({
            id,
            orgId,
            firstName,
            lastName,
            email,
            phone: plan.values.phone ?? null,
            company: plan.values.company ?? null,
            title: plan.values.title ?? null,
            bio: plan.values.bio ?? null,
            externalRef: plan.externalRef,
            createdAt: ts,
            updatedAt: ts,
          });
        }
        refMap.set(plan.externalRef, id);
        created++;
        continue;
      }
      if (entity === "submissions") {
        const { title } = plan.values;
        if (!title) {
          skipped.push({ row: plan.row, reason: "Missing required field(s): title" });
          continue;
        }
        const id = newId();
        const trackId = plan.values.trackName ? trackNameMap?.get(plan.values.trackName.trim().toLowerCase()) ?? null : null;
        if (!dryRun) {
          const ts = now();
          await db.insert(schema.submission).values({
            id,
            eventId,
            formId: null,
            seq: submissionSeqSubquery(eventId),
            title,
            description: plan.values.description ?? null,
            trackId,
            status: plan.values.status ?? "pending",
            contentStatus: "pending",
            externalRef: plan.externalRef,
            createdAt: ts,
            updatedAt: ts,
          });
        }
        refMap.set(plan.externalRef, id);
        created++;
        continue;
      }
      // tracks
      const { name } = plan.values;
      if (!name) {
        skipped.push({ row: plan.row, reason: "Missing required field(s): name" });
        continue;
      }
      const id = newId();
      if (!dryRun) {
        const ts = now();
        const nextPositionSql = sql<number>`(SELECT COALESCE(MAX(${schema.track.position}), -1) + 1 FROM ${schema.track} WHERE ${schema.track.eventId} = ${eventId})`;
        await db.insert(schema.track).values({
          id,
          eventId,
          name,
          color: plan.values.color ?? null,
          position: nextPositionSql,
          externalRef: plan.externalRef,
          createdAt: ts,
          updatedAt: ts,
        });
      }
      refMap.set(plan.externalRef, id);
      created++;
      continue;
    }

    // Update: only the fields present in this row's values are patched.
    if (!dryRun) {
      const ts = now();
      if (entity === "contacts") {
        const v = plan.values;
        await db
          .update(schema.contact)
          .set({
            ...(v.firstName !== undefined ? { firstName: v.firstName } : {}),
            ...(v.lastName !== undefined ? { lastName: v.lastName } : {}),
            ...(v.email !== undefined ? { email: v.email } : {}),
            ...(v.phone !== undefined ? { phone: v.phone } : {}),
            ...(v.company !== undefined ? { company: v.company } : {}),
            ...(v.title !== undefined ? { title: v.title } : {}),
            ...(v.bio !== undefined ? { bio: v.bio } : {}),
            updatedAt: ts,
          })
          .where(eq(schema.contact.id, existingId));
      } else if (entity === "submissions") {
        const v = plan.values;
        const trackId = v.trackName ? trackNameMap?.get(v.trackName.trim().toLowerCase()) : undefined;
        await db
          .update(schema.submission)
          .set({
            ...(v.title !== undefined ? { title: v.title } : {}),
            ...(v.description !== undefined ? { description: v.description } : {}),
            ...(trackId !== undefined ? { trackId } : {}),
            ...(v.status !== undefined ? { status: v.status } : {}),
            updatedAt: ts,
          })
          .where(eq(schema.submission.id, existingId));
      } else {
        const v = plan.values;
        await db
          .update(schema.track)
          .set({
            ...(v.name !== undefined ? { name: v.name } : {}),
            ...(v.color !== undefined ? { color: v.color } : {}),
            updatedAt: ts,
          })
          .where(eq(schema.track.id, existingId));
      }
    }
    updated++;
  }

  return { created, updated, skipped };
}

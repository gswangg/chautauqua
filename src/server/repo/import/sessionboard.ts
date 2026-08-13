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
import { findContactByEmail, replaceSubmissionTracks } from "../submit";
import { SESSIONBOARD_SOURCE, externalRef, type SbEntity, type SbRowPlan } from "../../../domain/sessionboard";

// DEC-675: the planner (src/domain/sessionboard.ts) is the ONE place that
// validates a submission status / participant order against the product's
// vocabulary and drops the key on an out-of-vocabulary value -- by the time
// a plan reaches this writer, `values.order` is either absent or already a
// validated non-negative base-10 integer string. Parsing an unvalidated
// string here would silently write NaN into the column, so this asserts the
// invariant instead of re-deriving it (fail loudly, no silent fallback).
function parseValidatedOrder(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`Unvalidated participant order reached the writer: "${value}" (planner should have dropped it)`);
  }
  return Number.parseInt(value, 10);
}

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

/** Resolves submission external_refs (already namespaced) -> submission id,
 * scoped to eventId. Chunked over the distinct refs referenced by this
 * batch, never the whole table. */
async function loadSubmissionIdsByRef(db: Db, eventId: string, refs: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (refs.length === 0) return out;
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

/** Resolves contact external_refs (already namespaced) -> id/title/company,
 * scoped to orgId. Chunked over the distinct refs referenced by this batch.
 * title/company are the LIVE contact values -- the caller snapshots them
 * onto a newly-created participant row (DEC-258). */
async function loadContactsByRef(
  db: Db,
  orgId: string,
  refs: string[],
): Promise<Map<string, { id: string; title: string | null; company: string | null }>> {
  const out = new Map<string, { id: string; title: string | null; company: string | null }>();
  if (refs.length === 0) return out;
  for (const batch of chunkIds(refs)) {
    const rows = await db
      .select({
        id: schema.contact.id,
        externalRef: schema.contact.externalRef,
        title: schema.contact.title,
        company: schema.contact.company,
      })
      .from(schema.contact)
      .where(and(eq(schema.contact.orgId, orgId), inArray(schema.contact.externalRef, batch)));
    for (const r of rows) {
      if (r.externalRef) out.set(r.externalRef, { id: r.id, title: r.title, company: r.company });
    }
  }
  return out;
}

/** Existing (submission_id, contact_id) participant pairs among the given
 * submission ids, chunked. Keyed by the same `${submissionId}:${contactId}`
 * shape the (submission_id, contact_id) uniqueIndex already names
 * (schema.ts:289) -- no third namespace, no migration (DEC-639). */
async function loadExistingParticipantPairs(db: Db, submissionIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (submissionIds.length === 0) return out;
  for (const batch of chunkIds(submissionIds)) {
    const rows = await db
      .select({
        id: schema.participant.id,
        submissionId: schema.participant.submissionId,
        contactId: schema.participant.contactId,
      })
      .from(schema.participant)
      .where(inArray(schema.participant.submissionId, batch));
    for (const r of rows) out.set(`${r.submissionId}:${r.contactId}`, r.id);
  }
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

  if (entity === "participants") {
    const sessionRefs = [
      ...new Set(
        plans
          .map((p) => p.values.sessionExternalId)
          .filter((v): v is string => v !== undefined)
          .map((v) => externalRef(SESSIONBOARD_SOURCE, v)),
      ),
    ];
    const speakerRefs = [
      ...new Set(
        plans
          .map((p) => p.values.speakerExternalId)
          .filter((v): v is string => v !== undefined)
          .map((v) => externalRef(SESSIONBOARD_SOURCE, v)),
      ),
    ];
    const submissionIdByRef = await loadSubmissionIdsByRef(db, eventId, sessionRefs);
    const contactByRef = await loadContactsByRef(db, orgId, speakerRefs);
    const submissionIds = [...new Set([...submissionIdByRef.values()])];
    const pairMap = await loadExistingParticipantPairs(db, submissionIds);

    for (const plan of plans) {
      const v = plan.values;

      const sessionRef = v.sessionExternalId ? externalRef(SESSIONBOARD_SOURCE, v.sessionExternalId) : null;
      const submissionId = sessionRef ? submissionIdByRef.get(sessionRef) : undefined;
      if (!submissionId) {
        skipped.push({
          row: plan.row,
          reason: `Unresolved session reference: ${v.sessionExternalId ?? "(missing)"}`,
        });
        continue;
      }

      let contactId: string | undefined;
      let titleAtTime: string | null = null;
      let orgAtTime: string | null = null;
      if (v.speakerExternalId) {
        const speakerRef = externalRef(SESSIONBOARD_SOURCE, v.speakerExternalId);
        const contact = contactByRef.get(speakerRef);
        if (contact) {
          contactId = contact.id;
          titleAtTime = contact.title;
          orgAtTime = contact.company;
        }
      }
      if (!contactId && v.speakerEmail) {
        const contact = await findContactByEmail(db, orgId, v.speakerEmail);
        if (contact) {
          contactId = contact.id;
          titleAtTime = contact.title;
          orgAtTime = contact.company;
        }
      }
      if (!contactId) {
        skipped.push({
          row: plan.row,
          reason: `Unresolved speaker reference: ${v.speakerExternalId ?? v.speakerEmail ?? "(missing)"}`,
        });
        continue;
      }

      const pairKey = `${submissionId}:${contactId}`;
      const existingId = pairMap.get(pairKey);

      if (existingId === undefined) {
        const id = newId();
        if (!dryRun) {
          const ts = now();
          const nextOrderSql = sql<number>`(SELECT COALESCE(MAX(${schema.participant.order}), -1) + 1 FROM ${schema.participant} WHERE ${schema.participant.submissionId} = ${submissionId})`;
          await db.insert(schema.participant).values({
            id,
            submissionId,
            contactId,
            role: v.role ?? "speaker",
            order: v.order !== undefined ? parseValidatedOrder(v.order) : nextOrderSql,
            // DEC-675/DEC-656: an imported co-presenter is RECORDED, not
            // published -- it reaches the public site only through the
            // organizer's existing Visible checkbox on the submission-detail
            // participants table, same as any other participant.
            visible: false,
            inviteStatus: "none",
            titleAtTime,
            orgAtTime,
            createdAt: ts,
            updatedAt: ts,
          });
        }
        pairMap.set(pairKey, id);
        created++;
        continue;
      }

      if (!dryRun) {
        const ts = now();
        await db
          .update(schema.participant)
          .set({
            ...(v.role !== undefined ? { role: v.role } : {}),
            ...(v.order !== undefined ? { order: parseValidatedOrder(v.order) } : {}),
            updatedAt: ts,
          })
          .where(eq(schema.participant.id, existingId));
      }
      updated++;
    }

    return { created, updated, skipped };
  }

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
        // DEC-855: submission_track is the only source of a submission's
        // tracks -- the submission row itself never carries a trackId.
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
            // DEC-675: the planner already dropped any status outside
            // SUBMISSION_STATUSES, so `values.status` here is either absent
            // (writer default: pending) or already a validated
            // SubmissionStatus literal -- never an unchecked pass-through.
            status: plan.values.status ?? "pending",
            contentStatus: "pending",
            externalRef: plan.externalRef,
            createdAt: ts,
            updatedAt: ts,
          });
          if (trackId) {
            await db.insert(schema.submissionTrack).values({ submissionId: id, trackId, createdAt: ts });
          }
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
        await db
          .update(schema.submission)
          .set({
            ...(v.title !== undefined ? { title: v.title } : {}),
            ...(v.description !== undefined ? { description: v.description } : {}),
            ...(v.status !== undefined ? { status: v.status } : {}),
            updatedAt: ts,
          })
          .where(eq(schema.submission.id, existingId));
        // DEC-855: an update that does not mention a track leaves the
        // existing submission_track rows alone -- only a row where
        // v.trackName is present (even if unresolved/blank) replaces the
        // full set via the one full-set-replace writer (DEC-598).
        if (v.trackName !== undefined) {
          const trackId = v.trackName ? trackNameMap?.get(v.trackName.trim().toLowerCase()) : undefined;
          await replaceSubmissionTracks(db, existingId, trackId ? [trackId] : []);
        }
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

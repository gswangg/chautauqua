// Sessionboard import, layer 2 of 3 (DEC-612, DEC-613): the idempotent
// upsert applying plans produced by src/domain/sessionboard.ts. This is the
// ONE planner both dry run and real run go through -- dryRun below changes
// only whether the writes execute, never how created/updated/skipped are
// derived (DEC-613).

import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { newId } from "../../../domain/ids";
import { chunkIds, chunkRowsForInsert } from "../../../lib/chunk";
import { isValidEmail, normalizeEmail } from "../../../domain/email";
import { submissionSeqSubquery } from "../submissions/seq";
import { replaceSubmissionTracks } from "../submit";
import { SESSIONBOARD_SOURCE, externalRef, type SbEntity, type SbRowPlan } from "../../../domain/sessionboard";
import { updateSubmissionStatuses } from "../submissions/status";
import type { SubmissionStatus } from "../../../domain/status";
import { DEC_717 } from "../../../decisions";

void DEC_717; // submission.status is written ONLY through updateSubmissionStatuses -- never a raw insert/update column -- so the J6 acceptance auto-creation always fires.

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

/** Resolves contact rows by normalized email (DEC-454: the ONE email-identity
 * rule, `normalizeEmail` -- never a second ad-hoc lower/trim), scoped to
 * orgId. Chunked over the distinct normalized emails this batch actually
 * references. Mirrors loadContactsByRef's shape so the row loop below never
 * awaits a lookup -- it only reads this map. */
async function loadContactsByEmail(
  db: Db,
  orgId: string,
  emails: string[],
): Promise<Map<string, { id: string; title: string | null; company: string | null }>> {
  const out = new Map<string, { id: string; title: string | null; company: string | null }>();
  if (emails.length === 0) return out;
  for (const batch of chunkIds(emails)) {
    const rows = await db
      .select({
        id: schema.contact.id,
        email: schema.contact.email,
        title: schema.contact.title,
        company: schema.contact.company,
      })
      .from(schema.contact)
      .where(and(eq(schema.contact.orgId, orgId), inArray(sql`lower(${schema.contact.email})`, batch)));
    for (const r of rows) {
      out.set(normalizeEmail(r.email), { id: r.id, title: r.title, company: r.company });
    }
  }
  return out;
}

/** One grouped MAX(order) query per chunk of submissionIds -- never a
 * correlated per-row sub-select, which cannot survive a multi-row insert.
 * A submission with no existing participants is simply absent from the
 * returned map; callers treat that as "next order is 0" (matching the old
 * sub-select's `COALESCE(MAX(order), -1) + 1` for an empty set). */
async function loadMaxOrderBySubmissionId(db: Db, submissionIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (submissionIds.length === 0) return out;
  for (const batch of chunkIds(submissionIds)) {
    const rows = await db
      .select({ submissionId: schema.participant.submissionId, maxOrder: sql<number>`max(${schema.participant.order})` })
      .from(schema.participant)
      .where(inArray(schema.participant.submissionId, batch))
      .groupBy(schema.participant.submissionId);
    for (const r of rows) {
      out.set(r.submissionId, Number(r.maxOrder));
    }
  }
  return out;
}

type ParticipantUpdateRow = {
  id: string;
  role?: string;
  order?: number;
};

// DEC-528 (wave 49 amendment): the accumulated participant updates are
// flushed HERE, after the row loop has finished resolving every id -- the
// loop itself never awaits an update. Rows are grouped by column-set
// SIGNATURE (which optional keys are present -- derived by enumerating each
// row's own keys, never a hand-listed enum that desyncs when
// ParticipantUpdateRow grows) and then by the actual VALUE TUPLE for that
// signature. Every row sharing a (signature, value tuple) sets the exact
// same columns to the exact same values, so it collapses into one
// `UPDATE ... WHERE id IN (...)` per chunk of that group's ids (chunked via
// chunkIds for the D1 bound-parameter ceiling) instead of one statement per
// row. A 500-row idempotent re-import (a handful of distinct role/order
// combinations) now pays O(distinct value tuples * chunks) statements, not
// O(rows).
async function flushParticipantUpdates(db: Db, rows: ParticipantUpdateRow[], ts: Date): Promise<void> {
  // Map from signature -> (value-tuple key -> { values, ids }).
  const groups = new Map<string, Map<string, { values: Record<string, unknown>; ids: string[] }>>();

  for (const row of rows) {
    const { id, ...set } = row;
    const keys = Object.keys(set).sort();
    const signature = keys.join(",");
    const valueKey = JSON.stringify(keys.map((k) => (set as Record<string, unknown>)[k]));

    let bySignature = groups.get(signature);
    if (!bySignature) {
      bySignature = new Map();
      groups.set(signature, bySignature);
    }
    let entry = bySignature.get(valueKey);
    if (!entry) {
      const values: Record<string, unknown> = {};
      for (const k of keys) values[k] = (set as Record<string, unknown>)[k];
      entry = { values, ids: [] };
      bySignature.set(valueKey, entry);
    }
    entry.ids.push(id);
  }

  for (const bySignature of groups.values()) {
    for (const { values, ids } of bySignature.values()) {
      for (const batch of chunkIds(ids)) {
        await db
          .update(schema.participant)
          .set({ ...values, updatedAt: ts })
          .where(inArray(schema.participant.id, batch));
      }
    }
  }
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
  // DEC-717: submission ids whose row carried a status value, grouped by
  // that status, applied AFTER the row loop via the one status writer
  // (updateSubmissionStatuses) so accepted_at + the J6 onboarding-task
  // auto-creation fire exactly as they would for any other status change.
  // Never populated/applied on a dry run (no writes).
  const statusIdsByStatus = new Map<SubmissionStatus, string[]>();

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

    // DEC-528 (wave 47 amendment): every id the row loop below needs is
    // resolved HERE, in the batched pre-pass -- the loop reads maps and
    // awaits nothing. The email fallback set is exactly the rows whose
    // speakerExternalId is absent/unresolved AND which carry a speakerEmail;
    // normalizeEmail is the ONE email-identity rule (DEC-454), applied at
    // both the lookup key and the map key so a row's email always matches
    // its own normalized form.
    const emailFallbackSet = new Set<string>();
    for (const plan of plans) {
      const v = plan.values;
      if (!v.speakerEmail) continue;
      const speakerRef = v.speakerExternalId ? externalRef(SESSIONBOARD_SOURCE, v.speakerExternalId) : null;
      const resolvedByRef = speakerRef ? contactByRef.get(speakerRef) : undefined;
      if (!resolvedByRef) emailFallbackSet.add(normalizeEmail(v.speakerEmail));
    }
    const contactByEmail = await loadContactsByEmail(db, orgId, [...emailFallbackSet]);
    // Pre-resolve each referenced submission's current MAX(order) ONCE --
    // the correlated per-row sub-select this replaces cannot survive a
    // multi-row insert. Orders assigned within this batch increment in JS
    // (Map mutated below) so two new rows for the same submission in one
    // import still land at consecutive orders, exactly as the old
    // sub-select (re-evaluated after each serial INSERT) would have.
    const maxOrderBySubmissionId = await loadMaxOrderBySubmissionId(db, submissionIds);

    type ParticipantCreateRow = {
      id: string;
      submissionId: string;
      contactId: string;
      role: string;
      order: number;
      visible: boolean;
      inviteStatus: string;
      titleAtTime: string | null;
      orgAtTime: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
    const createRows: ParticipantCreateRow[] = [];
    const updateRows: ParticipantUpdateRow[] = [];
    const ts = now();

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
        const contact = contactByEmail.get(normalizeEmail(v.speakerEmail));
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
        let order: number;
        if (v.order !== undefined) {
          order = parseValidatedOrder(v.order);
        } else {
          const current = maxOrderBySubmissionId.get(submissionId) ?? -1;
          order = current + 1;
          maxOrderBySubmissionId.set(submissionId, order);
        }
        if (!dryRun) {
          createRows.push({
            id,
            submissionId,
            contactId,
            role: v.role ?? "speaker",
            order,
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
        const hasRole = v.role !== undefined;
        const hasOrder = v.order !== undefined;
        if (hasRole || hasOrder) {
          updateRows.push({
            id: existingId,
            ...(hasRole ? { role: v.role as string } : {}),
            ...(hasOrder ? { order: parseValidatedOrder(v.order as string) } : {}),
          });
        }
      }
      updated++;
    }

    if (!dryRun) {
      for (const chunk of chunkRowsForInsert(createRows)) {
        if (chunk.length === 0) continue;
        await db.insert(schema.participant).values(chunk);
      }
      await flushParticipantUpdates(db, updateRows, ts);
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
          skipped.push({ row: plan.row, reason: "Missing required fields: firstName, lastName, email" });
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
          skipped.push({ row: plan.row, reason: "Missing required field: title" });
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
            // DEC-717: the raw insert always writes 'pending' -- a row
            // whose status the planner validated (DEC-675, SUBMISSION_STATUSES)
            // is applied AFTER the row loop through updateSubmissionStatuses,
            // the ONE status writer, so accepted_at + J6 onboarding tasks
            // fire on an imported acceptance exactly as on any other one.
            status: "pending",
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
        if (plan.values.status !== undefined && !dryRun) {
          const status = plan.values.status as SubmissionStatus;
          const arr = statusIdsByStatus.get(status) ?? [];
          arr.push(id);
          statusIdsByStatus.set(status, arr);
        }
        continue;
      }
      // tracks
      const { name } = plan.values;
      if (!name) {
        skipped.push({ row: plan.row, reason: "Missing required field: name" });
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
            // DEC-717: status is NEVER written here -- a row carrying a
            // status is applied AFTER the row loop through
            // updateSubmissionStatuses, the ONE status writer.
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
        if (v.status !== undefined) {
          const status = v.status as SubmissionStatus;
          const arr = statusIdsByStatus.get(status) ?? [];
          arr.push(existingId);
          statusIdsByStatus.set(status, arr);
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

  // DEC-717: apply every accumulated status, once per distinct status,
  // through the one status writer -- never on a dry run (no writes).
  if (!dryRun) {
    for (const [status, ids] of statusIdsByStatus) {
      await updateSubmissionStatuses(db, eventId, ids, status, now());
    }
  }

  return { created, updated, skipped };
}

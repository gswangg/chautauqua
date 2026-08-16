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
import { SESSIONBOARD_SOURCE, externalRef, type SbEntity, type SbRowPlan } from "../../../domain/sessionboard";
import { updateSubmissionStatuses } from "../submissions/status";
import { touchSubmissionsForContacts, touchSubmissionsForTracks } from "../submissions/touch";
import type { SubmissionStatus } from "../../../domain/status";
import { DEC_604, DEC_612, DEC_717 } from "../../../decisions";
import {
  MAX_PARTICIPANTS_PER_SUBMISSION,
  DEFAULT_PARTICIPANT_ROLE,
} from "../../../domain/participant-roles";
import { ApiError } from "../../http";
import { isUniqueViolation } from "../constraints";

void DEC_604; // wave-15 amendment: MAX_PARTICIPANTS_PER_SUBMISSION binds all four participant writer doors, and this one refuses in its OWN established grammar -- row-wise, so an over-cap participant row is SKIPPED into the existing `skipped: {row, reason}[]` channel rather than failing the whole import.
void DEC_717; // submission.status is written ONLY through updateSubmissionStatuses -- never a raw insert/update column -- so the J6 acceptance auto-creation always fires.
void DEC_612; // wave-54 amendment: contact identity resolves by normalized email BEFORE falling back to create, since a Sessionboard roster import and the CFP form both mint contacts and a ref-less CFP contact must not be duplicated. The (org_id, external_ref) uniqueIndex this decision names is a contract -- a ref is adopted by an email match only when the matched contact's own ref is null and no other row in this batch has already claimed it.

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
 * awaits a lookup -- it only reads this map. Also carries `externalRef`
 * (null-or-string) -- the contacts row loop (DEC-612 wave-54 amendment)
 * needs it to decide whether an email match may adopt the file row's ref. */
async function loadContactsByEmail(
  db: Db,
  orgId: string,
  emails: string[],
): Promise<Map<string, { id: string; title: string | null; company: string | null; externalRef: string | null }>> {
  const out = new Map<string, { id: string; title: string | null; company: string | null; externalRef: string | null }>();
  if (emails.length === 0) return out;
  for (const batch of chunkIds(emails)) {
    const rows = await db
      .select({
        id: schema.contact.id,
        email: schema.contact.email,
        title: schema.contact.title,
        company: schema.contact.company,
        externalRef: schema.contact.externalRef,
      })
      .from(schema.contact)
      .where(and(eq(schema.contact.orgId, orgId), inArray(sql`lower(${schema.contact.email})`, batch)));
    for (const r of rows) {
      out.set(normalizeEmail(r.email), { id: r.id, title: r.title, company: r.company, externalRef: r.externalRef });
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

// DEC-528 (wave 49 amendment, generalized wave 52): every batched update
// path in this file (participants, and now contacts/submissions/tracks
// below) shares this ONE grouping idiom rather than each inventing its own:
// rows are grouped by column-set SIGNATURE (which optional keys are present
// -- derived by enumerating each row's own keys, never a hand-listed enum
// that desyncs when a *UpdateRow type grows) and then by the actual VALUE
// TUPLE for that signature. Every row sharing a (signature, value tuple)
// sets the exact same columns to the exact same values, so it collapses
// into one `UPDATE ... WHERE id IN (...)` per chunk of that group's ids
// (chunked via chunkIds for the D1 bound-parameter ceiling) instead of one
// statement per row. A 500-row idempotent re-import (a handful of distinct
// value combinations) now pays O(distinct value tuples * chunks)
// statements, not O(rows).
function groupUpdateRows<T extends { id: string }>(
  rows: T[],
): Map<string, Map<string, { values: Record<string, unknown>; ids: string[] }>> {
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

  return groups;
}

async function flushParticipantUpdates(db: Db, rows: ParticipantUpdateRow[], ts: Date): Promise<void> {
  const groups = groupUpdateRows(rows);
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

type ContactUpdateRow = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
  company?: string | null;
  title?: string | null;
  bio?: string | null;
  // DEC-612 wave-54 amendment: set only when an email-matched contact's own
  // external_ref is null and this batch hasn't already claimed the file
  // row's ref for a different contact -- see the row loop below.
  externalRef?: string;
};

/** DEC-725 (wave-32 amendment): among `rows` that carry a firstName/lastName
 * key, finds the ids whose value actually differs from what's currently
 * stored — a same-string re-import (common for a recurring Sessionboard
 * sync) must not touch. One chunked pre-read (never per-row), mirroring the
 * `current`/`before` pre-fetch pattern the interactive CRUD writers use. */
async function findRenamedContactIds(db: Db, rows: ContactUpdateRow[]): Promise<string[]> {
  const candidates = rows.filter((r) => r.firstName !== undefined || r.lastName !== undefined);
  if (candidates.length === 0) return [];
  const byId = new Map(candidates.map((r) => [r.id, r]));
  const renamed: string[] = [];
  for (const batch of chunkIds([...byId.keys()])) {
    const existing = await db
      .select({ id: schema.contact.id, firstName: schema.contact.firstName, lastName: schema.contact.lastName })
      .from(schema.contact)
      .where(inArray(schema.contact.id, batch));
    for (const row of existing) {
      const candidate = byId.get(row.id);
      if (!candidate) continue;
      if (
        (candidate.firstName !== undefined && candidate.firstName !== row.firstName) ||
        (candidate.lastName !== undefined && candidate.lastName !== row.lastName)
      ) {
        renamed.push(row.id);
      }
    }
  }
  return renamed;
}

async function flushContactUpdates(db: Db, rows: ContactUpdateRow[], ts: Date): Promise<void> {
  const renamedContactIds = await findRenamedContactIds(db, rows);
  const groups = groupUpdateRows(rows);
  for (const bySignature of groups.values()) {
    for (const { values, ids } of bySignature.values()) {
      for (const batch of chunkIds(ids)) {
        await db
          .update(schema.contact)
          .set({ ...values, updatedAt: ts })
          .where(inArray(schema.contact.id, batch));
      }
    }
  }
  if (renamedContactIds.length > 0) await touchSubmissionsForContacts(db, renamedContactIds, ts);
}

type SubmissionUpdateRow = {
  id: string;
  title?: string;
  description?: string | null;
};

async function flushSubmissionUpdates(db: Db, rows: SubmissionUpdateRow[], ts: Date): Promise<void> {
  const groups = groupUpdateRows(rows);
  for (const bySignature of groups.values()) {
    for (const { values, ids } of bySignature.values()) {
      for (const batch of chunkIds(ids)) {
        await db
          .update(schema.submission)
          .set({ ...values, updatedAt: ts })
          .where(inArray(schema.submission.id, batch));
      }
    }
  }
}

type TrackUpdateRow = {
  id: string;
  name?: string;
  color?: string | null;
};

/** DEC-725 (wave-32 amendment): same shape as findRenamedContactIds, over
 * `track.name`. */
async function findRenamedTrackIds(db: Db, rows: TrackUpdateRow[]): Promise<string[]> {
  const candidates = rows.filter((r) => r.name !== undefined);
  if (candidates.length === 0) return [];
  const byId = new Map(candidates.map((r) => [r.id, r]));
  const renamed: string[] = [];
  for (const batch of chunkIds([...byId.keys()])) {
    const existing = await db
      .select({ id: schema.track.id, name: schema.track.name })
      .from(schema.track)
      .where(inArray(schema.track.id, batch));
    for (const row of existing) {
      const candidate = byId.get(row.id);
      if (candidate && candidate.name !== undefined && candidate.name !== row.name) {
        renamed.push(row.id);
      }
    }
  }
  return renamed;
}

async function flushTrackUpdates(db: Db, rows: TrackUpdateRow[], ts: Date): Promise<void> {
  const renamedTrackIds = await findRenamedTrackIds(db, rows);
  const groups = groupUpdateRows(rows);
  for (const bySignature of groups.values()) {
    for (const { values, ids } of bySignature.values()) {
      for (const batch of chunkIds(ids)) {
        await db
          .update(schema.track)
          .set({ ...values, updatedAt: ts })
          .where(inArray(schema.track.id, batch));
      }
    }
  }
  if (renamedTrackIds.length > 0) await touchSubmissionsForTracks(db, renamedTrackIds, ts);
}

/** Current MAX(seq) among the event's submissions -- the ONE pre-loaded
 * read a batched create pass increments in JS per created row, replacing
 * `submissionSeqSubquery`'s per-row correlated sub-select, which cannot
 * survive a multi-row VALUES insert. A single-row SQL MAX() aggregate --
 * DEC-528 wave-58 amendment: an unbounded per-row select-then-reduce over
 * every submission in the event to learn one integer is a whole-event scan
 * a dry run paid for nothing. 0 for the empty set (no submissions yet). The
 * UNIQUE (event_id, seq) index (schema.ts) still fails loudly on a
 * concurrent submit landing between this read and the batched insert below
 * -- no retry is added; a Sessionboard import racing a live submission
 * against the same event is the rare case that index exists to catch, not
 * the common case a retry loop would need to paper over.
 */
async function loadMaxSubmissionSeq(db: Db, eventId: string): Promise<number> {
  const [row] = await db
    .select({ maxSeq: sql<number>`max(${schema.submission.seq})` })
    .from(schema.submission)
    .where(eq(schema.submission.eventId, eventId));
  return row?.maxSeq == null ? 0 : Number(row.maxSeq);
}

/** Current MAX(position) among the event's tracks (-1 if none) -- same
 * batching rationale as loadMaxSubmissionSeq, replacing the per-row
 * correlated sub-select the track create path used to issue, and the same
 * DEC-528 wave-58 amendment: a single-row SQL MAX() aggregate rather than a
 * whole-event select-then-reduce. */
async function loadMaxTrackPosition(db: Db, eventId: string): Promise<number> {
  const [row] = await db
    .select({ maxPosition: sql<number>`max(${schema.track.position})` })
    .from(schema.track)
    .where(eq(schema.track.eventId, eventId));
  return row?.maxPosition == null ? -1 : Number(row.maxPosition);
}

export async function applySessionboardPlans(db: Db, args: ApplySessionboardPlansArgs): Promise<SbApplyResult> {
  const { orgId, eventId, entity, plans, dryRun } = args;

  const refs = [...new Set(plans.map((p) => p.externalRef).filter((r): r is string => r !== null))];
  const refMap = await loadExistingRefs(db, entity, orgId, eventId, refs);
  const trackNameMap = entity === "submissions" ? await loadTrackNameMap(db, eventId) : null;

  // DEC-612 (wave-54 amendment): contacts entity resolves identity by
  // normalized email BEFORE it is allowed to create -- a Sessionboard
  // roster import must chain onto a ref-less contact the CFP form already
  // created rather than duplicating it. Pre-loaded ONE batched map (no
  // per-row await) over the distinct normalized emails of rows whose
  // externalRef did not resolve against refMap as loaded above; the row
  // loop below never awaits this lookup, it only reads/mutates this map.
  let contactEmailMap: Map<string, { id: string; title: string | null; company: string | null; externalRef: string | null }> | null =
    null;
  if (entity === "contacts") {
    const emailFallbackSet = new Set<string>();
    for (const plan of plans) {
      if (!plan.externalRef || refMap.has(plan.externalRef)) continue;
      const email = plan.values.email;
      if (email && isValidEmail(email)) emailFallbackSet.add(normalizeEmail(email));
    }
    contactEmailMap = await loadContactsByEmail(db, orgId, [...emailFallbackSet]);
  }

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
    // DEC-604 (participant-cap amendment): running per-submission participant
    // count, seeded from the existing-pairs load above, enforced identically
    // on the dryRun and real-write paths (DEC-613: one planner, two modes) so
    // the Review step reports exactly the rows the real run will drop.
    const participantCountBySubmissionId = new Map<string, number>();
    for (const pairKey of pairMap.keys()) {
      const submissionId = pairKey.slice(0, pairKey.indexOf(":"));
      participantCountBySubmissionId.set(submissionId, (participantCountBySubmissionId.get(submissionId) ?? 0) + 1);
    }

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
        const currentCount = participantCountBySubmissionId.get(submissionId) ?? 0;
        if (currentCount >= MAX_PARTICIPANTS_PER_SUBMISSION) {
          skipped.push({
            row: plan.row,
            reason: `Submission ${submissionId} is already at the ${MAX_PARTICIPANTS_PER_SUBMISSION}-participant cap`,
          });
          continue;
        }
        participantCountBySubmissionId.set(submissionId, currentCount + 1);
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
            role: v.role ?? DEFAULT_PARTICIPANT_ROLE,
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

  // DEC-528 (wave 52): the one-time allocator preloads for the two
  // create-time sequential fields (submission.seq, track.position) --
  // resolved ONCE here and incremented in JS per created row below, because
  // a correlated per-row sub-select (the old submissionSeqSubquery / inline
  // track position sub-select) cannot survive a multi-row VALUES insert.
  let nextSubmissionSeq = entity === "submissions" ? await loadMaxSubmissionSeq(db, eventId) : 0;
  let nextTrackPosition = entity === "tracks" ? await loadMaxTrackPosition(db, eventId) : -1;

  type ContactCreateRow = {
    id: string;
    orgId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    company: string | null;
    title: string | null;
    bio: string | null;
    externalRef: string;
    createdAt: Date;
    updatedAt: Date;
  };
  type SubmissionCreateRow = {
    id: string;
    eventId: string;
    formId: null;
    seq: number;
    title: string;
    description: string | null;
    status: "pending";
    contentStatus: "pending";
    externalRef: string;
    createdAt: Date;
    updatedAt: Date;
  };
  type TrackCreateRow = {
    id: string;
    eventId: string;
    name: string;
    color: string | null;
    position: number;
    externalRef: string;
    createdAt: Date;
    updatedAt: Date;
  };
  type SubmissionTrackCreateRow = { submissionId: string; trackId: string; createdAt: Date };

  const contactCreateRows: ContactCreateRow[] = [];
  const submissionCreateRows: SubmissionCreateRow[] = [];
  const trackCreateRows: TrackCreateRow[] = [];
  const submissionTrackCreateRows: SubmissionTrackCreateRow[] = [];
  const contactUpdateRows: ContactUpdateRow[] = [];
  const submissionUpdateRows: SubmissionUpdateRow[] = [];
  const trackUpdateRows: TrackUpdateRow[] = [];
  // DEC-855 (update path): only a row whose trackName KEY is present gets an
  // entry here -- an absent key leaves existing tracks alone. Keyed by
  // submissionId so a duplicate external_ref appearing twice in one batch
  // resolves to its LAST value, same as the old serial-write ordering did.
  const trackReplaceBySubmissionId = new Map<string, string | null>();
  const rowTs = now();

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
        // DEC-612 (wave-54 amendment): an unresolved external_ref does not
        // mean "create" -- try the normalized-email identity first. A match
        // is an UPDATE through the same present-fields-only patch the
        // ref-match branch below applies (counted as `updated`, in BOTH
        // dryRun and apply, so the preview can never disagree with the
        // result). The match adopts this row's external_ref only when its
        // own ref is null and no other row in this batch has already
        // claimed it -- contactEmailMap's `externalRef` field is mutated in
        // place below the moment a ref is adopted, so a later row matching
        // the SAME email (or, via refMap, the SAME ref) reads that adoption
        // and never tries to re-claim it. This mirrors
        // src/server/repo/contacts/import.ts's in-batch chaining -- a
        // second file row with the same email lands on the same contact
        // instead of creating a second one.
        const email = plan.values.email;
        const emailKey = email && isValidEmail(email) ? normalizeEmail(email) : null;
        const emailMatch = emailKey ? contactEmailMap?.get(emailKey) : undefined;
        if (emailMatch) {
          const v = plan.values;
          const adoptRef = emailMatch.externalRef === null;
          if (!dryRun) {
            contactUpdateRows.push({
              id: emailMatch.id,
              ...(v.firstName !== undefined ? { firstName: v.firstName } : {}),
              ...(v.lastName !== undefined ? { lastName: v.lastName } : {}),
              ...(v.email !== undefined ? { email: v.email } : {}),
              ...(v.phone !== undefined ? { phone: v.phone } : {}),
              ...(v.company !== undefined ? { company: v.company } : {}),
              ...(v.title !== undefined ? { title: v.title } : {}),
              ...(v.bio !== undefined ? { bio: v.bio } : {}),
              ...(adoptRef ? { externalRef: plan.externalRef } : {}),
            });
          }
          if (adoptRef) {
            refMap.set(plan.externalRef, emailMatch.id);
            emailMatch.externalRef = plan.externalRef;
          }
          updated++;
          continue;
        }

        const { firstName, lastName, email: newEmail } = plan.values;
        if (!firstName || !lastName || !newEmail) {
          skipped.push({ row: plan.row, reason: "Missing required fields: firstName, lastName, email" });
          continue;
        }
        const id = newId();
        if (!dryRun) {
          contactCreateRows.push({
            id,
            orgId,
            firstName,
            lastName,
            email: newEmail,
            phone: plan.values.phone ?? null,
            company: plan.values.company ?? null,
            title: plan.values.title ?? null,
            bio: plan.values.bio ?? null,
            externalRef: plan.externalRef,
            createdAt: rowTs,
            updatedAt: rowTs,
          });
        }
        refMap.set(plan.externalRef, id);
        // Keep the email map current too (DEC-612 wave-54 amendment): a
        // later row in this same batch carrying a DIFFERENT external_ref
        // but the SAME email must chain onto this just-created contact
        // (src/server/repo/contacts/import.ts's in-batch chaining), not
        // create a second one -- contactEmailMap was pre-loaded only from
        // rows existing in the database before this call, so a fresh
        // in-batch create has to register itself here.
        contactEmailMap?.set(normalizeEmail(newEmail), {
          id,
          title: plan.values.title ?? null,
          company: plan.values.company ?? null,
          externalRef: plan.externalRef,
        });
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
          nextSubmissionSeq += 1;
          submissionCreateRows.push({
            id,
            eventId,
            formId: null,
            seq: nextSubmissionSeq,
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
            createdAt: rowTs,
            updatedAt: rowTs,
          });
          if (trackId) {
            submissionTrackCreateRows.push({ submissionId: id, trackId, createdAt: rowTs });
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
        nextTrackPosition += 1;
        trackCreateRows.push({
          id,
          eventId,
          name,
          color: plan.values.color ?? null,
          position: nextTrackPosition,
          externalRef: plan.externalRef,
          createdAt: rowTs,
          updatedAt: rowTs,
        });
      }
      refMap.set(plan.externalRef, id);
      created++;
      continue;
    }

    // Update: only the fields present in this row's values are patched.
    if (!dryRun) {
      if (entity === "contacts") {
        const v = plan.values;
        contactUpdateRows.push({
          id: existingId,
          ...(v.firstName !== undefined ? { firstName: v.firstName } : {}),
          ...(v.lastName !== undefined ? { lastName: v.lastName } : {}),
          ...(v.email !== undefined ? { email: v.email } : {}),
          ...(v.phone !== undefined ? { phone: v.phone } : {}),
          ...(v.company !== undefined ? { company: v.company } : {}),
          ...(v.title !== undefined ? { title: v.title } : {}),
          ...(v.bio !== undefined ? { bio: v.bio } : {}),
        });
      } else if (entity === "submissions") {
        const v = plan.values;
        submissionUpdateRows.push({
          id: existingId,
          ...(v.title !== undefined ? { title: v.title } : {}),
          ...(v.description !== undefined ? { description: v.description } : {}),
          // DEC-717: status is NEVER written here -- a row carrying a
          // status is applied AFTER the row loop through
          // updateSubmissionStatuses, the ONE status writer.
        });
        // DEC-855: an update that does not mention a track leaves the
        // existing submission_track rows alone -- only a row where
        // v.trackName is present (even if unresolved/blank) replaces the
        // full set. Accumulated here and applied as ONE chunked delete +
        // ONE chunked insert AFTER the row loop, mirroring the full-set-
        // replace writer's contract (DEC-598) without a per-row round trip.
        if (v.trackName !== undefined) {
          const trackId = v.trackName ? trackNameMap?.get(v.trackName.trim().toLowerCase()) : undefined;
          trackReplaceBySubmissionId.set(existingId, trackId ?? null);
        }
        if (v.status !== undefined) {
          const status = v.status as SubmissionStatus;
          const arr = statusIdsByStatus.get(status) ?? [];
          arr.push(existingId);
          statusIdsByStatus.set(status, arr);
        }
      } else {
        const v = plan.values;
        trackUpdateRows.push({
          id: existingId,
          ...(v.name !== undefined ? { name: v.name } : {}),
          ...(v.color !== undefined ? { color: v.color } : {}),
        });
      }
    }
    updated++;
  }

  if (!dryRun) {
    // DEC-111 amendment (findings wave 15): the refMap dedup above is an
    // application-level pre-read, not the gate -- a concurrent import run
    // against the same org/event can land its own create between that read
    // and these inserts. Each loop below is the authority: a raw D1 unique-
    // constraint failure on the entity's external_ref index is caught and
    // translated into a fail-loud ApiError rather than surfacing as a 500 --
    // anything else rethrows unchanged.
    for (const chunk of chunkRowsForInsert(contactCreateRows)) {
      if (chunk.length === 0) continue;
      try {
        await db.insert(schema.contact).values(chunk);
      } catch (err) {
        if (isUniqueViolation(err, "contact.external_ref")) {
          throw new ApiError("conflict", "A contact with this external reference already exists");
        }
        throw err;
      }
    }
    for (const chunk of chunkRowsForInsert(submissionCreateRows)) {
      if (chunk.length === 0) continue;
      try {
        await db.insert(schema.submission).values(chunk);
      } catch (err) {
        if (isUniqueViolation(err, "submission.external_ref")) {
          throw new ApiError("conflict", "A submission with this external reference already exists");
        }
        throw err;
      }
    }
    for (const chunk of chunkRowsForInsert(submissionTrackCreateRows)) {
      if (chunk.length === 0) continue;
      await db.insert(schema.submissionTrack).values(chunk);
    }
    for (const chunk of chunkRowsForInsert(trackCreateRows)) {
      if (chunk.length === 0) continue;
      try {
        await db.insert(schema.track).values(chunk);
      } catch (err) {
        if (isUniqueViolation(err, "track.external_ref")) {
          throw new ApiError("conflict", "A track with this external reference already exists");
        }
        throw err;
      }
    }

    await flushContactUpdates(db, contactUpdateRows, rowTs);
    await flushSubmissionUpdates(db, submissionUpdateRows, rowTs);
    await flushTrackUpdates(db, trackUpdateRows, rowTs);

    // Batched full-set-replace for every updated submission whose row
    // carried a trackName key: one chunked delete of every existing
    // submission_track row for those submissionIds, then one chunked
    // insert for the (submissionId, trackId) pairs that resolved.
    if (trackReplaceBySubmissionId.size > 0) {
      const submissionIds = [...trackReplaceBySubmissionId.keys()];
      for (const batch of chunkIds(submissionIds)) {
        await db.delete(schema.submissionTrack).where(inArray(schema.submissionTrack.submissionId, batch));
      }
      const replaceInsertRows: SubmissionTrackCreateRow[] = [];
      for (const [submissionId, trackId] of trackReplaceBySubmissionId) {
        if (trackId) replaceInsertRows.push({ submissionId, trackId, createdAt: rowTs });
      }
      for (const chunk of chunkRowsForInsert(replaceInsertRows)) {
        if (chunk.length === 0) continue;
        await db.insert(schema.submissionTrack).values(chunk);
      }
    }
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

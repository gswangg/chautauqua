// Repo layer for the public CFP submit flow (src/routes/public/submit.tsx).
// Per DEC-012: the only code here that touches drizzle row types; the pure
// cores (src/forms, src/lib/submit-core.ts) stay schema-free.

import { and, asc, eq, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { Db } from "../context";
import { newId } from "../../domain/ids";
import { chunkRowsForInsert } from "../../lib/chunk";
import { submissionSeqSubquery } from "./submissions/seq";
import { touchSubmissions } from "./submissions/touch";
import type { FormFieldDef, FormFieldKind, FormFieldSection, FormFieldRole, AnswerMap } from "../../forms/types";
import { lockedFieldName, projectFieldForAnswers } from "../../forms/types";
import { parseFieldOptions, parseFieldRule } from "../../forms/field-json";
import { DEC_258, DEC_718 } from "../../decisions";
import { DEFAULT_PARTICIPANT_ROLE } from "../../domain/participant-roles";

// Compile-checked dependency marker: createParticipant below snapshots
// DEC-258's title_at_time/org_at_time onto every new participant row.
void DEC_258;
// Referenced for compile-checked dependency per DEC-718: every accepted
// answer must survive a JSON round trip before it is written.
void DEC_718;

// DEC-718: a validator (src/forms/validate.ts) admitting a value it cannot
// actually persist would turn a required answer into a silent null in D1.
// This is the write-time backstop — deep-equal the value against its own
// JSON.parse(JSON.stringify(...)) round trip, and throw NAMING the field id
// if they diverge (NaN/Infinity/undefined/functions/symbols all diverge:
// JSON.stringify turns NaN/Infinity into "null" and undefined into the
// `undefined` return value, neither of which round-trips back to the
// original value).
function jsonDeepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => jsonDeepEqual(v, b[i]));
  }
  if (a !== null && b !== null && typeof a === "object" && typeof b === "object") {
    const aKeys = Object.keys(a as Record<string, unknown>);
    const bKeys = Object.keys(b as Record<string, unknown>);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((k) =>
      Object.prototype.hasOwnProperty.call(b, k) &&
      jsonDeepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    );
  }
  return false;
}

function assertJsonRoundTrips(fieldId: string, value: unknown): void {
  const json = JSON.stringify(value);
  if (json === undefined) {
    throw new Error(`submission answer for field "${fieldId}" is not JSON-serializable`);
  }
  const roundTripped: unknown = JSON.parse(json);
  if (!jsonDeepEqual(value, roundTripped)) {
    throw new Error(`submission answer for field "${fieldId}" does not survive a JSON round trip`);
  }
}

export interface EventRow {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  recordPrefix: string;
  timezone: string;
  brandingJson: string | null;
  // DEC-986 (wave 40 amendment): the public CFP header's date·venue
  // eyebrow is built from these three -- same columns PublicEvent
  // (src/server/repo/public/event.ts) already exposes for the sessions/
  // speakers/agenda header.
  startDate: string;
  endDate: string;
  location: string | null;
}

export interface FormRow {
  id: string;
  eventId: string;
  title: string;
  description: string | null;
  openDate: number | null;
  closeDate: number | null;
  tracksJson: string | null;
}

export interface TrackRow {
  id: string;
  name: string;
}

export async function getEventBySlug(db: Db, slug: string): Promise<EventRow | null> {
  // DEC-558 (wave 75): event_slug_idx is a uniqueIndex on schema.event.slug,
  // so this predicate already narrows to at most one row.
  const rows = await db.select().from(schema.event).where(eq(schema.event.slug, slug)).limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.orgId,
    name: row.name,
    slug: row.slug,
    recordPrefix: row.recordPrefix,
    timezone: row.timezone,
    brandingJson: row.brandingJson,
    startDate: row.startDate,
    endDate: row.endDate,
    location: row.location,
  };
}

/** Public CFP always targets the event's default form (DEC-015: an event
 * can have multiple forms, but /submit/:eventSlug has no form-id in path). */
export async function getDefaultForm(db: Db, eventId: string): Promise<FormRow | null> {
  // DEC-558 wave-5 amendment: (eventId, isDefault=true) has no declared
  // uniqueIndex (see findFormForEvent in ./forms.ts for the same gap).
  // .orderBy(...) makes the pick deterministic.
  const rows = await db
    .select()
    .from(schema.form)
    .where(and(eq(schema.form.eventId, eventId), eq(schema.form.isDefault, true)))
    .orderBy(asc(schema.form.id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    eventId: row.eventId,
    title: row.title,
    description: row.description,
    openDate: row.openDate ? row.openDate.getTime() : null,
    closeDate: row.closeDate ? row.closeDate.getTime() : null,
    tracksJson: row.tracksJson,
  };
}

export async function getFormFields(db: Db, formId: string): Promise<FormFieldDef[]> {
  const rows = await db
    .select()
    .from(schema.formField)
    .where(eq(schema.formField.formId, formId))
    .orderBy(asc(schema.formField.position));
  // DEC-050/DEC-475/DEC-486: build with RAW ids (locked rows carry a
  // per-form PK '${formId}:name') and project through projectFieldForAnswers
  // once, so the field's own id and its rule's fieldId are normalized to the
  // short locked name in the same expression and can never drift apart.
  return rows.map((row) =>
    projectFieldForAnswers({
      id: row.id,
      section: row.section as FormFieldSection,
      kind: row.kind as FormFieldKind,
      label: row.label,
      helpText: row.helpText ?? undefined,
      required: row.required,
      position: row.position,
      options: parseFieldOptions(row.optionsJson, row.id),
      rule: parseFieldRule(row.ruleJson, row.id),
      // DEC-592/DEC-755 (wave 10, task w10-b): role is the ONE matcher for
      // the two well-known CFP fields -- must ride along here so callers
      // (submit-post.tsx, submit-views.tsx) can resolve them by role instead
      // of a literal id.
      role: (row.role as FormFieldRole | null) ?? null,
    }),
  );
}

export async function getEventTracks(db: Db, eventId: string): Promise<TrackRow[]> {
  const rows = await db
    .select({ id: schema.track.id, name: schema.track.name })
    .from(schema.track)
    .where(eq(schema.track.eventId, eventId))
    .orderBy(asc(schema.track.position));
  return rows;
}

/** DEC-014: repeat submitters are matched to their existing contact by
 * case-insensitive email. */
export async function findContactByEmail(
  db: Db,
  orgId: string,
  email: string,
): Promise<{ id: string; title: string | null; company: string | null; bio: string | null } | null> {
  const rows = await db
    .select({
      id: schema.contact.id,
      title: schema.contact.title,
      company: schema.contact.company,
      bio: schema.contact.bio,
    })
    .from(schema.contact)
    .where(and(eq(schema.contact.orgId, orgId), sql`lower(${schema.contact.email}) = lower(${email})`))
    // DEC-558 (wave 75): contact.email has no uniqueIndex (duplicate
    // contacts sharing an email are a recognized state -- see contacts/
    // merge.ts) so this predicate can match more than one row. Absent SQLite
    // giving a deterministic total order, a repeat submitter could attach
    // to a different duplicate contact on different requests, silently
    // splitting their submission history. Order by createdAt asc so "the
    // existing contact" means the oldest/original contact row, tie-broken
    // by id asc.
    .orderBy(asc(schema.contact.createdAt), asc(schema.contact.id))
    .limit(1);
  return rows[0] ?? null;
}

export async function createContact(
  db: Db,
  params: {
    orgId: string;
    firstName: string;
    lastName: string;
    email: string;
    // DEC-321: default CFP now collects job title/company/bio directly onto
    // the contact so J10's public speakers list isn't blank for real
    // submitters.
    title?: string | null;
    company?: string | null;
    bio?: string | null;
  },
): Promise<string> {
  const id = newId();
  const now = new Date();
  await db.insert(schema.contact).values({
    id,
    orgId: params.orgId,
    firstName: params.firstName,
    lastName: params.lastName,
    email: params.email,
    title: params.title ?? null,
    company: params.company ?? null,
    bio: params.bio ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export interface CreateSubmissionParams {
  eventId: string;
  formId: string;
  title: string;
  description: string;
}

/** Creates the submission row per DEC-003/DEC-016: status 'pending',
 * title/description on real columns, seq allocated atomically within the
 * INSERT itself (DEC-100: submissionSeqSubquery), then read back by id so
 * the caller still gets `{ id, seq }`. */
export async function createSubmission(
  db: Db,
  params: CreateSubmissionParams,
): Promise<{ id: string; seq: number }> {
  const id = newId();
  const now = new Date();
  await db.insert(schema.submission).values({
    id,
    eventId: params.eventId,
    formId: params.formId,
    seq: submissionSeqSubquery(params.eventId),
    title: params.title,
    description: params.description,
    status: "pending",
    contentStatus: "pending",
    createdAt: now,
    updatedAt: now,
  });
  const rows = await db
    .select({ seq: schema.submission.seq })
    .from(schema.submission)
    .where(eq(schema.submission.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error(`createSubmission: submission ${id} not found after insert`);
  return { id, seq: row.seq };
}

export async function createParticipant(
  db: Db,
  params: {
    submissionId: string;
    contactId: string;
    /** DEC-258: contact's title/company at submit time, snapshotted onto
     * the new participant row. A freshly-created contact (no repeat-
     * submitter match) has neither field collected by the CFP form, so
     * callers pass null; a matched contact's caller passes the values
     * already read back by findContactByEmail — this function performs no
     * additional contact lookup of its own. */
    titleAtTime?: string | null;
    orgAtTime?: string | null;
  },
): Promise<void> {
  const now = new Date();
  await db.insert(schema.participant).values({
    id: newId(),
    submissionId: params.submissionId,
    contactId: params.contactId,
    role: DEFAULT_PARTICIPANT_ROLE,
    order: 0,
    visible: true,
    inviteStatus: "none",
    titleAtTime: params.titleAtTime ?? null,
    orgAtTime: params.orgAtTime ?? null,
    createdAt: now,
    updatedAt: now,
  });
}

export async function createSubmissionTracks(
  db: Db,
  submissionId: string,
  trackIds: string[],
): Promise<void> {
  if (trackIds.length === 0) return;
  const now = new Date();
  // DEC-598 (wave-10 amendment): trackIds are a SET at every boundary,
  // including the writer itself — a duplicate id reaching this far (any
  // caller, including sessionboard import) must not raise SQLITE_CONSTRAINT
  // on the [submissionId, trackId] primary key.
  const rows = Array.from(new Set(trackIds)).map((trackId) => ({ submissionId, trackId, createdAt: now }));
  // DEC-528: chunked by bound-parameter budget (columns-per-row derived).
  for (const chunk of chunkRowsForInsert(rows)) {
    await db.insert(schema.submissionTrack).values(chunk);
  }
  // DEC-725 amendment: unlike replaceSubmissionTracks below, this writer is
  // only ever called immediately after createSubmission (both the public
  // CFP route and the organizer create route insert the tracks in the same
  // request that just inserted the submission row itself) — the submission
  // row's own INSERT already stamped updatedAt to `now` moments earlier, so
  // there is no stale stamp to correct here. No touchSubmissions call.
}

/**
 * The ONE submission_track writer for a full-set replace (DEC-598): delete
 * every existing row for this submission, then insert the given set. Used by
 * both the speaker portal-edit path (src/server/repo/portal-edit.ts) and the
 * organizer PATCH /api/v1/submissions/:id path (src/routes/api/submissions.ts)
 * so the two call sites never drift into two different "replace" semantics.
 */
export async function replaceSubmissionTracks(
  db: Db,
  submissionId: string,
  trackIds: string[],
): Promise<void> {
  const now = new Date();
  await db.delete(schema.submissionTrack).where(eq(schema.submissionTrack.submissionId, submissionId));
  if (trackIds.length > 0) {
    // DEC-598 (wave-10 amendment): dedupe at the writer too — see
    // createSubmissionTracks above.
    const rows = Array.from(new Set(trackIds)).map((trackId) => ({ submissionId, trackId, createdAt: now }));
    // DEC-528: chunked by bound-parameter budget (columns-per-row derived).
    for (const chunk of chunkRowsForInsert(rows)) {
      await db.insert(schema.submissionTrack).values(chunk);
    }
  }
  // DEC-725 amendment: touch even on a delete-to-empty-set — the touch-on-
  // write shape must fire regardless of the resulting track count so a
  // watermark tick sees the change (an EXISTS-over-submission_track
  // predicate could not see a delete-with-nothing-reinserted at all — see
  // submissions/touch.ts header).
  await touchSubmissions(db, [submissionId], now);
}

/** Only custom (non-locked) fields get submission_answer rows — locked
 * built-ins persist to real columns instead (DEC-016). DEC-541: one
 * set-based, atomic upsert per chunk — schema.ts declares a uniqueIndex over
 * (submissionId, formFieldId), so a fresh create is just an upsert that
 * cannot conflict; this same function serves both create and edit paths.
 * Zero-statement no-op on empty input, and never reads before writing. */
export async function upsertSubmissionAnswers(
  db: Db,
  submissionId: string,
  answers: AnswerMap,
): Promise<void> {
  const now = new Date();
  const rows = Object.entries(answers)
    .filter(([fieldId]) => lockedFieldName(fieldId) === null)
    .map(([fieldId, value]) => {
      // DEC-718: fail loudly at the write rather than silently persisting
      // a `null` for a value the validator should never have admitted.
      assertJsonRoundTrips(fieldId, value);
      return {
        id: newId(),
        submissionId,
        formFieldId: fieldId,
        valueJson: JSON.stringify(value),
        createdAt: now,
        updatedAt: now,
      };
    });
  if (rows.length === 0) return;
  // DEC-528: chunked by bound-parameter budget (columns-per-row derived).
  for (const chunk of chunkRowsForInsert(rows)) {
    await db
      .insert(schema.submissionAnswer).values(chunk)
      .onConflictDoUpdate({
        target: [schema.submissionAnswer.submissionId, schema.submissionAnswer.formFieldId],
        set: { valueJson: sql`excluded.value_json`, updatedAt: now },
      });
  }
}

/** DEC-755 amendment (wave 10, task w10-b): deletes a single submission_answer
 * row by (submissionId, formFieldId) — the counterpart to upsertSubmissionAnswers
 * for a caller that wants to CLEAR a field's answer (e.g. PATCH {format:null})
 * rather than write a value. A no-op when no such row exists. */
export async function deleteSubmissionAnswer(db: Db, submissionId: string, formFieldId: string): Promise<void> {
  await db
    .delete(schema.submissionAnswer)
    .where(
      and(
        eq(schema.submissionAnswer.submissionId, submissionId),
        eq(schema.submissionAnswer.formFieldId, formFieldId),
      ),
    );
}

export interface InsertAttachmentFileInput {
  submissionId: string;
  filename: string;
  r2Key: string;
  sizeBytes: number;
  contentType: string;
  uploadedByContactId: string;
}

/** DEC-040: form-answer file uploads get a file row with kind 'attachment',
 * scoped to the new submission, uploaded by the submitting contact. Served
 * through the existing authenticated /files route — never a new path. */
export async function insertAttachmentFile(db: Db, input: InsertAttachmentFileInput): Promise<string> {
  const id = newId();
  const now = new Date();
  await db.insert(schema.file).values({
    id,
    submissionId: input.submissionId,
    kind: "attachment",
    filename: input.filename,
    r2Key: input.r2Key,
    sizeBytes: input.sizeBytes,
    contentType: input.contentType,
    previousFileId: null,
    uploadedByContactId: input.uploadedByContactId,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

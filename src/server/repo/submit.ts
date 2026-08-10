// Repo layer for the public CFP submit flow (src/routes/public/submit.tsx).
// Per DEC-012: the only code here that touches drizzle row types; the pure
// cores (src/forms, src/lib/submit-core.ts) stay schema-free.

import { and, asc, eq, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { Db } from "../context";
import { newId } from "../../domain/ids";
import { submissionSeqSubquery } from "./submissions/seq";
import type { FormFieldDef, FormFieldKind, FormFieldSection, FormFieldRule, AnswerMap } from "../../forms/types";
import { lockedFieldName } from "../../forms/types";

export interface EventRow {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  recordPrefix: string;
  timezone: string;
  brandingJson: string | null;
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
  };
}

/** Public CFP always targets the event's default form (DEC-015: an event
 * can have multiple forms, but /submit/:eventSlug has no form-id in path). */
export async function getDefaultForm(db: Db, eventId: string): Promise<FormRow | null> {
  const rows = await db
    .select()
    .from(schema.form)
    .where(and(eq(schema.form.eventId, eventId), eq(schema.form.isDefault, true)))
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
  return rows.map((row): FormFieldDef => ({
    // DEC-050: locked rows carry a per-form PK ('${formId}:name'); the
    // rendered form + validated/persisted answer map are keyed by the
    // short locked name (e.g. 'title'), never the raw PK.
    id: lockedFieldName(row.id) ?? row.id,
    section: row.section as FormFieldSection,
    kind: row.kind as FormFieldKind,
    label: row.label,
    helpText: row.helpText ?? undefined,
    required: row.required,
    position: row.position,
    options: row.optionsJson ? (JSON.parse(row.optionsJson) as string[]) : undefined,
    rule: row.ruleJson ? (JSON.parse(row.ruleJson) as FormFieldRule) : undefined,
  }));
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
): Promise<{ id: string } | null> {
  const rows = await db
    .select({ id: schema.contact.id })
    .from(schema.contact)
    .where(and(eq(schema.contact.orgId, orgId), sql`lower(${schema.contact.email}) = lower(${email})`))
    .limit(1);
  return rows[0] ?? null;
}

export async function createContact(
  db: Db,
  params: { orgId: string; firstName: string; lastName: string; email: string },
): Promise<string> {
  const id = newId();
  const now = new Date();
  await db.insert(schema.contact).values({
    id,
    orgId: params.orgId,
    firstName: params.firstName,
    lastName: params.lastName,
    email: params.email,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function findUserByEmail(db: Db, email: string): Promise<{ id: string } | null> {
  const rows = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(sql`lower(${schema.user.email}) = lower(${email})`)
    .limit(1);
  return rows[0] ?? null;
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
  params: { submissionId: string; contactId: string },
): Promise<void> {
  const now = new Date();
  await db.insert(schema.participant).values({
    id: newId(),
    submissionId: params.submissionId,
    contactId: params.contactId,
    role: "speaker",
    order: 0,
    visible: true,
    inviteStatus: "none",
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
  await db.insert(schema.submissionTrack).values(
    trackIds.map((trackId) => ({ submissionId, trackId, createdAt: now })),
  );
}

/** Only custom (non-locked) fields get submission_answer rows — locked
 * built-ins persist to real columns instead (DEC-016). */
export async function createSubmissionAnswers(
  db: Db,
  submissionId: string,
  answers: AnswerMap,
): Promise<void> {
  const now = new Date();
  const rows = Object.entries(answers)
    .filter(([fieldId]) => lockedFieldName(fieldId) === null)
    .map(([fieldId, value]) => ({
      id: newId(),
      submissionId,
      formFieldId: fieldId,
      valueJson: JSON.stringify(value),
      createdAt: now,
      updatedAt: now,
    }));
  if (rows.length === 0) return;
  await db.insert(schema.submissionAnswer).values(rows);
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

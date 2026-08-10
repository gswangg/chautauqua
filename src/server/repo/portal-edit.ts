// Repo layer for speaker submission editing (src/routes/portal/edit.tsx),
// per DEC-041 + DEC-012 (repo layer is the only place that touches drizzle
// row types) + DEC-016 (locked fields persist to real columns, not
// submission_answer).
//
// Scoping is absolute: loadEditableSubmission joins through participant on
// contactId — a submissionId belonging to someone else's contact (or a
// foreign org) resolves to null, which the caller renders as a 404. Never
// trust a :id path param without this check.

import { and, eq } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { Db } from "../context";
import { newId } from "../../domain/ids";
import type { FormFieldDef, FormFieldKind, FormFieldSection, FormFieldRule, AnswerMap } from "../../forms/types";
import { LOCKED_SESSION_FIELDS, LOCKED_SPEAKER_FIELDS, lockedFieldName } from "../../forms/types";
import type { SubmissionStatus } from "../../domain/status";
import { resolveOfferedTrackIds } from "../../lib/submit-core";

export interface EditableSubmission {
  id: string;
  status: SubmissionStatus;
  title: string;
  description: string | null;
}

export interface EditableForm {
  id: string;
  closeDate: number | null;
}

export interface EditableTrack {
  id: string;
  name: string;
}

export interface EditableSubmissionData {
  submission: EditableSubmission;
  form: EditableForm;
  fields: FormFieldDef[];
  answers: AnswerMap;
  offeredTrackIds: string[];
  allTracks: EditableTrack[];
  selectedTrackIds: string[];
}

/**
 * Loads everything the edit form needs for exactly one of the speaker's own
 * submissions. Returns null when the submission doesn't exist, belongs to a
 * different org, or the requesting contact is not among its participants —
 * every case renders as a 404 to the caller (no IDOR).
 */
export async function loadEditableSubmission(
  db: Db,
  contactId: string,
  submissionId: string,
): Promise<EditableSubmissionData | null> {
  const rows = await db
    .select({
      submissionId: schema.submission.id,
      status: schema.submission.status,
      title: schema.submission.title,
      description: schema.submission.description,
      formId: schema.form.id,
      formCloseDate: schema.form.closeDate,
      formTracksJson: schema.form.tracksJson,
      eventId: schema.event.id,
      participantContactId: schema.participant.contactId,
    })
    .from(schema.participant)
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .innerJoin(schema.event, eq(schema.submission.eventId, schema.event.id))
    .leftJoin(schema.form, eq(schema.submission.formId, schema.form.id))
    .where(and(eq(schema.submission.id, submissionId), eq(schema.participant.contactId, contactId)));

  const row = rows[0];
  if (!row || !row.formId) return null;

  const contactRows = await db
    .select({ firstName: schema.contact.firstName, lastName: schema.contact.lastName, email: schema.contact.email })
    .from(schema.contact)
    .where(eq(schema.contact.id, contactId));
  const contact = contactRows[0];
  if (!contact) return null;

  const fieldRows = await db
    .select()
    .from(schema.formField)
    .where(eq(schema.formField.formId, row.formId));
  const fields: FormFieldDef[] = fieldRows
    .map((f): FormFieldDef => ({
      // DEC-050: locked rows carry a per-form PK; normalize to the short
      // locked name so the shared renderer/validator/answer-map keying
      // matches the public submit path.
      id: lockedFieldName(f.id) ?? f.id,
      section: f.section as FormFieldSection,
      kind: f.kind as FormFieldKind,
      label: f.label,
      helpText: f.helpText ?? undefined,
      required: f.required,
      position: f.position,
      options: f.optionsJson ? (JSON.parse(f.optionsJson) as string[]) : undefined,
      rule: f.ruleJson ? (JSON.parse(f.ruleJson) as FormFieldRule) : undefined,
    }))
    .sort((a, b) => a.position - b.position);

  const answerRows = await db
    .select({ fieldId: schema.submissionAnswer.formFieldId, valueJson: schema.submissionAnswer.valueJson })
    .from(schema.submissionAnswer)
    .where(eq(schema.submissionAnswer.submissionId, submissionId));
  const answers: AnswerMap = {};
  for (const a of answerRows) {
    answers[a.fieldId] = JSON.parse(a.valueJson);
  }
  // DEC-016: locked fields live on real submission columns, not
  // submission_answer — surface them into the same answers map so the
  // shared form renderer can prefill them uniformly.
  answers[LOCKED_SESSION_FIELDS[0]] = row.title;
  answers[LOCKED_SESSION_FIELDS[1]] = row.description ?? "";
  // DEC-121: speakers never re-enter their own contact data — prefill the
  // locked speaker fields (name/email) from the contact record, never from
  // submission_answer.
  answers[LOCKED_SPEAKER_FIELDS[0]] = contact.firstName;
  answers[LOCKED_SPEAKER_FIELDS[1]] = contact.lastName;
  answers[LOCKED_SPEAKER_FIELDS[2]] = contact.email;

  const allTrackRows = await db
    .select({ id: schema.track.id, name: schema.track.name })
    .from(schema.track)
    .where(eq(schema.track.eventId, row.eventId));
  const offeredTrackIds = resolveOfferedTrackIds(row.formTracksJson, allTrackRows.map((t) => t.id));

  const selectedTrackRows = await db
    .select({ trackId: schema.submissionTrack.trackId })
    .from(schema.submissionTrack)
    .where(eq(schema.submissionTrack.submissionId, submissionId));

  return {
    submission: {
      id: row.submissionId,
      status: row.status as SubmissionStatus,
      title: row.title,
      description: row.description,
    },
    form: { id: row.formId, closeDate: row.formCloseDate ? row.formCloseDate.getTime() : null },
    fields,
    answers,
    offeredTrackIds,
    allTracks: allTrackRows,
    selectedTrackIds: selectedTrackRows.map((t) => t.trackId),
  };
}

/**
 * Applies validated edits to an already-scoped submission (the caller must
 * have already run loadEditableSubmission + the edit-lock check). Locked
 * fields (DEC-016) sync into submission.title/description; every other
 * cleaned answer replaces its submission_answer row. Tracks are only
 * touched when trackIds is non-null (canEditTracks gate is enforced by the
 * caller, not here).
 */
export async function saveSubmissionEdits(
  db: Db,
  submissionId: string,
  contactId: string,
  cleanedAnswers: AnswerMap,
  trackIds: string[] | null,
): Promise<void> {
  const now = new Date();
  const title = cleanedAnswers[LOCKED_SESSION_FIELDS[0]];
  const description = cleanedAnswers[LOCKED_SESSION_FIELDS[1]];
  await db
    .update(schema.submission)
    .set({
      title: typeof title === "string" ? title : undefined,
      description: typeof description === "string" ? description : undefined,
      updatedAt: now,
    })
    .where(eq(schema.submission.id, submissionId));

  // DEC-121: edits to the locked speaker name fields land on the contact
  // record (J2/J7 — the producer's shared record), never on
  // submission_answer. Email is intentionally never synced from this path.
  const firstName = cleanedAnswers[LOCKED_SPEAKER_FIELDS[0]];
  const lastName = cleanedAnswers[LOCKED_SPEAKER_FIELDS[1]];
  const contactUpdate: Partial<{ firstName: string; lastName: string; updatedAt: Date }> = {};
  if (typeof firstName === "string" && firstName.length > 0) contactUpdate.firstName = firstName;
  if (typeof lastName === "string" && lastName.length > 0) contactUpdate.lastName = lastName;
  if (Object.keys(contactUpdate).length > 0) {
    contactUpdate.updatedAt = now;
    await db.update(schema.contact).set(contactUpdate).where(eq(schema.contact.id, contactId));
  }

  const customEntries = Object.entries(cleanedAnswers).filter(([fieldId]) => lockedFieldName(fieldId) === null);
  for (const [fieldId, value] of customEntries) {
    const existing = await db
      .select({ id: schema.submissionAnswer.id })
      .from(schema.submissionAnswer)
      .where(
        and(eq(schema.submissionAnswer.submissionId, submissionId), eq(schema.submissionAnswer.formFieldId, fieldId)),
      )
      .limit(1);
    if (existing[0]) {
      await db
        .update(schema.submissionAnswer)
        .set({ valueJson: JSON.stringify(value), updatedAt: now })
        .where(eq(schema.submissionAnswer.id, existing[0].id));
    } else {
      await db.insert(schema.submissionAnswer).values({
        id: newId(),
        submissionId,
        formFieldId: fieldId,
        valueJson: JSON.stringify(value),
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  if (trackIds !== null) {
    await db.delete(schema.submissionTrack).where(eq(schema.submissionTrack.submissionId, submissionId));
    if (trackIds.length > 0) {
      await db.insert(schema.submissionTrack).values(
        trackIds.map((trackId) => ({ submissionId, trackId, createdAt: now })),
      );
    }
  }
}

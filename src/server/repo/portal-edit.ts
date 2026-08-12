// Repo layer for speaker submission editing (src/routes/portal/edit.tsx),
// per DEC-041 + DEC-012 (repo layer is the only place that touches drizzle
// row types) + DEC-016 (locked fields persist to real columns, not
// submission_answer).
//
// Scoping is absolute: loadEditableSubmission joins through participant on
// contactId — a submissionId belonging to someone else's contact (or a
// foreign org) resolves to null, which the caller renders as a 404. Never
// trust a :id path param without this check.

import { and, eq, inArray } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { Db } from "../context";
import { appendSubmissionRevision } from "./revisions";
import { bumpIcsSequences } from "./ics-sequence";
import { upsertSubmissionAnswers, replaceSubmissionTracks } from "./submit";
import type { FormFieldDef, FormFieldKind, FormFieldSection, FormFieldRule, AnswerMap } from "../../forms/types";
import { LOCKED_SESSION_FIELDS, LOCKED_SPEAKER_FIELDS, lockedFieldName, projectFieldForAnswers } from "../../forms/types";
import type { SubmissionStatus } from "../../domain/status";
import { resolveOfferedTrackIds } from "../../lib/submit-core";
import { ACTIVE_INVITE_STATUSES } from "../../domain/acceptance";
import { chunkIds } from "../../lib/chunk";

export interface EditableSubmission {
  id: string;
  status: SubmissionStatus;
  title: string;
  description: string | null;
}

export interface EditableForm {
  id: string;
  closeDate: number | null;
  timezone: string;
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
      eventTimezone: schema.event.timezone,
      participantContactId: schema.participant.contactId,
    })
    .from(schema.participant)
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .innerJoin(schema.event, eq(schema.submission.eventId, schema.event.id))
    .leftJoin(schema.form, eq(schema.submission.formId, schema.form.id))
    .where(
      and(
        eq(schema.submission.id, submissionId),
        eq(schema.participant.contactId, contactId),
        inArray(schema.participant.inviteStatus, ACTIVE_INVITE_STATUSES),
      ),
    );

  const row = rows[0];
  if (!row || !row.formId) return null;

  const contactRows = await db
    .select({
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      email: schema.contact.email,
      title: schema.contact.title,
      company: schema.contact.company,
      bio: schema.contact.bio,
    })
    .from(schema.contact)
    .where(eq(schema.contact.id, contactId));
  const contact = contactRows[0];
  if (!contact) return null;

  const fieldRows = await db
    .select()
    .from(schema.formField)
    .where(eq(schema.formField.formId, row.formId));
  // DEC-050/DEC-475/DEC-486: build with RAW ids (locked rows carry a
  // per-form PK) and project through projectFieldForAnswers once, so the
  // shared renderer/validator/answer-map keying (id + rule.fieldId) is
  // normalized in the same expression and can never drift apart.
  const fields: FormFieldDef[] = fieldRows
    .map((f) =>
      projectFieldForAnswers({
        id: f.id,
        section: f.section as FormFieldSection,
        kind: f.kind as FormFieldKind,
        label: f.label,
        helpText: f.helpText ?? undefined,
        required: f.required,
        position: f.position,
        options: f.optionsJson ? (JSON.parse(f.optionsJson) as string[]) : undefined,
        rule: f.ruleJson ? (JSON.parse(f.ruleJson) as FormFieldRule) : undefined,
      }),
    )
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
  // DEC-321: mirrors DEC-121 — prefill the appended job_title/company/bio
  // locked fields from the contact record too.
  answers[LOCKED_SPEAKER_FIELDS[3]] = contact.title ?? "";
  answers[LOCKED_SPEAKER_FIELDS[4]] = contact.company ?? "";
  answers[LOCKED_SPEAKER_FIELDS[5]] = contact.bio ?? "";

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
    form: {
      id: row.formId,
      closeDate: row.formCloseDate ? row.formCloseDate.getTime() : null,
      timezone: row.eventTimezone,
    },
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
  hiddenFieldIds: string[],
): Promise<void> {
  const now = new Date();
  const title = cleanedAnswers[LOCKED_SESSION_FIELDS[0]];
  const description = cleanedAnswers[LOCKED_SESSION_FIELDS[1]];

  // DEC-158 (CNT-11): snapshot pre-edit title/description so the
  // post-update append below can tell whether the locked fields actually
  // changed. Also grab the contact's current name for the editor_name
  // snapshot in case only firstName/lastName (and not title/description)
  // changed this request.
  const beforeRows = await db
    .select({ title: schema.submission.title, description: schema.submission.description })
    .from(schema.submission)
    .where(eq(schema.submission.id, submissionId))
    .limit(1);
  const before = beforeRows[0];

  const contactBeforeRows = await db
    .select({ firstName: schema.contact.firstName, lastName: schema.contact.lastName })
    .from(schema.contact)
    .where(eq(schema.contact.id, contactId))
    .limit(1);
  const contactBefore = contactBeforeRows[0];

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
  const contactUpdate: Partial<{
    firstName: string;
    lastName: string;
    title: string | null;
    company: string | null;
    bio: string | null;
    updatedAt: Date;
  }> = {};
  if (typeof firstName === "string" && firstName.length > 0) contactUpdate.firstName = firstName;
  if (typeof lastName === "string" && lastName.length > 0) contactUpdate.lastName = lastName;
  // DEC-415 (J7): job_title/company/bio are locked speaker fields (DEC-321)
  // rendered and validated by the portal edit form, but saveSubmissionEdits
  // was silently discarding them — they never landed on the contact row and
  // never went through submission_answer either. Mirror the exact semantics
  // of POST /portal/profile (src/routes/portal/profile.tsx:278-280): trim,
  // empty string clears to null. A key that's entirely absent from
  // cleanedAnswers means "not submitted this request" and must leave the
  // stored column untouched — only a present key (including "") writes.
  const jobTitle = cleanedAnswers[LOCKED_SPEAKER_FIELDS[3]];
  const company = cleanedAnswers[LOCKED_SPEAKER_FIELDS[4]];
  const bio = cleanedAnswers[LOCKED_SPEAKER_FIELDS[5]];
  if (typeof jobTitle === "string") contactUpdate.title = jobTitle.trim() || null;
  if (typeof company === "string") contactUpdate.company = company.trim() || null;
  if (typeof bio === "string") contactUpdate.bio = bio.trim() || null;
  if (Object.keys(contactUpdate).length > 0) {
    contactUpdate.updatedAt = now;
    await db.update(schema.contact).set(contactUpdate).where(eq(schema.contact.id, contactId));
  }

  if (before) {
    const newTitle = typeof title === "string" ? title : before.title;
    const newDescription = typeof description === "string" ? description : before.description;
    if (newTitle !== before.title || newDescription !== before.description) {
      const resolvedFirstName = contactUpdate.firstName ?? contactBefore?.firstName ?? "";
      const resolvedLastName = contactUpdate.lastName ?? contactBefore?.lastName ?? "";
      const editorName = `${resolvedFirstName} ${resolvedLastName}`.trim() || "Speaker";
      await appendSubmissionRevision(db, {
        submissionId,
        editorUserId: null,
        editorName,
        title: newTitle,
        description: newDescription,
      });
      await bumpIcsSequences(db, [submissionId]); // DEC-519: title/description are VEVENT fields
    }
  }

  // DEC-541: one set-based, atomic upsert (ON CONFLICT DO UPDATE against the
  // (submissionId, formFieldId) uniqueIndex) — never a per-field
  // read-then-write loop.
  await upsertSubmissionAnswers(db, submissionId, cleanedAnswers);

  // DEC-501: a rule can hide a field that previously had an answer (e.g.
  // switching format from Workshop -> Talk hides workshop_length). Deleting
  // only from the upsert loop above would leave that stale answer behind —
  // still visible in the organizer detail view, reviewer sessionAnswers,
  // and CSV/JSON exports. Delete stale answers for hidden fields here,
  // excluding locked built-ins (never rule-hidden, never stored as
  // submission_answer rows in the first place).
  const hiddenCustomFieldIds = hiddenFieldIds.filter((fieldId) => lockedFieldName(fieldId) === null);
  if (hiddenCustomFieldIds.length > 0) {
    for (const batch of chunkIds(hiddenCustomFieldIds)) {
      await db
        .delete(schema.submissionAnswer)
        .where(
          and(
            eq(schema.submissionAnswer.submissionId, submissionId),
            inArray(schema.submissionAnswer.formFieldId, batch),
          ),
        );
    }
  }

  if (trackIds !== null) {
    await replaceSubmissionTracks(db, submissionId, trackIds);
  }
}

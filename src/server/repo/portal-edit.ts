// Repo layer for speaker submission editing (src/routes/portal/edit.tsx),
// per DEC-041 + DEC-012 (repo layer is the only place that touches drizzle
// row types) + DEC-016 (locked fields persist to real columns, not
// submission_answer).
//
// Scoping is absolute: loadEditableSubmission joins through participant on
// contactId — a submissionId belonging to someone else's contact (or a
// foreign org) resolves to null, which the caller renders as a 404. Never
// trust a :id path param without this check.

import { and, eq, inArray, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { Db } from "../context";
import { appendSubmissionRevision, ensureBaselineRevision } from "./revisions";
import { bumpIcsSequences } from "./ics-sequence";
import { upsertSubmissionAnswers, replaceSubmissionTracks, findContactByEmail, createContact } from "./submit";
import type { FormFieldDef, FormFieldKind, FormFieldSection, FormFieldRule, AnswerMap } from "../../forms/types";
import { LOCKED_SESSION_FIELDS, LOCKED_SPEAKER_FIELDS, lockedFieldName, projectFieldForAnswers } from "../../forms/types";
import type { SubmissionStatus } from "../../domain/status";
import { resolveOfferedTrackIds } from "../../lib/submit-core";
import { ACTIVE_INVITE_STATUSES, PORTAL_VISIBLE_INVITE_STATUSES } from "../../domain/acceptance";
import { chunkIds } from "../../lib/chunk";
import { newId } from "../../domain/ids";
import { isValidEmail, normalizeEmail } from "../../domain/email";
import { isCoPresenterRoleValue, participantRoleLabel, MAX_PARTICIPANTS_PER_SUBMISSION } from "../../domain/participant-roles";
import { MAX_NAME_LENGTH } from "../../forms/validate";
import { overCapFieldMessage, participantCapRefusalMessage } from "../../domain/cap-copy";
import { DEC_604, DEC_656, DEC_842, DEC_866, DEC_997 } from "../../decisions";
import { touchSubmissions, touchSubmissionsForContacts } from "./submissions/touch";

// touch DEC constant so the dependency is compile-checked (field guide convention)
void DEC_604;
void DEC_656;
void DEC_842;
void DEC_866;
void DEC_997;

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
 *
 * DEC-317 (wave-50 amendment) + DEC-962: the org gate is enforced IN the
 * query via `eq(schema.event.orgId, orgId)`, never as an app-code
 * post-filter — a same-contactId participant row on a submission belonging
 * to a foreign org must contribute no row, by construction.
 */
export async function loadEditableSubmission(
  db: Db,
  orgId: string,
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
        eq(schema.event.orgId, orgId),
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
  clearedFieldIds: string[] = [],
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
    .select({
      title: schema.submission.title,
      description: schema.submission.description,
      createdAt: schema.submission.createdAt,
    })
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

  // DEC-962 wave-58 amendment: this write's ownership key is contactId, not
  // eventId — the portal's per-speaker isolation boundary (same one
  // loadEditableSubmission's own read query joins on, DEC-962 wave-47
  // amendment), not the organizer's per-event boundary files-content-
  // status.ts's writes use. The predicate is carried in the WHERE itself as
  // a correlated EXISTS over participant, mirroring the wave-47 read-side
  // idiom, rather than trusting the caller's prior loadEditableSubmission
  // check alone.
  await db
    .update(schema.submission)
    .set({
      title: typeof title === "string" ? title : undefined,
      description: typeof description === "string" ? description : undefined,
      updatedAt: now,
    })
    .where(
      and(
        eq(schema.submission.id, submissionId),
        sql`exists (select 1 from ${schema.participant} where ${schema.participant.submissionId} = ${schema.submission.id} and ${schema.participant.contactId} = ${contactId} and ${inArray(schema.participant.inviteStatus, ACTIVE_INVITE_STATUSES)})`,
      ),
    );

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
  // DEC-842: validateAnswers now strips a blank from `cleaned` entirely (it
  // is never an empty string there), so a clear is signalled via
  // clearedFieldIds instead — write NULL when the locked field's id is in
  // that set; the "absent key leaves the column untouched" rule is
  // unchanged for ids that are neither present-cleaned nor cleared.
  const jobTitle = cleanedAnswers[LOCKED_SPEAKER_FIELDS[3]];
  const company = cleanedAnswers[LOCKED_SPEAKER_FIELDS[4]];
  const bio = cleanedAnswers[LOCKED_SPEAKER_FIELDS[5]];
  const clearedSet = new Set(clearedFieldIds);
  if (typeof jobTitle === "string") contactUpdate.title = jobTitle.trim() || null;
  else if (clearedSet.has(LOCKED_SPEAKER_FIELDS[3])) contactUpdate.title = null;
  if (typeof company === "string") contactUpdate.company = company.trim() || null;
  else if (clearedSet.has(LOCKED_SPEAKER_FIELDS[4])) contactUpdate.company = null;
  if (typeof bio === "string") contactUpdate.bio = bio.trim() || null;
  else if (clearedSet.has(LOCKED_SPEAKER_FIELDS[5])) contactUpdate.bio = null;
  if (Object.keys(contactUpdate).length > 0) {
    contactUpdate.updatedAt = now;
    await db.update(schema.contact).set(contactUpdate).where(eq(schema.contact.id, contactId));
  }
  // DEC-725 (wave-32 amendment): the submission row being edited is already
  // unconditionally touched above, but a speaker's name change is a
  // CONTACT-level rename that also shows up in every OTHER submission this
  // contact presents on (co-presented talks, other tracks/events) — those
  // are never touched by the plain submission UPDATE above. Bump only when
  // the name actually changed, mirroring DEC-519's same-string no-op rule.
  if (
    contactBefore &&
    ((contactUpdate.firstName !== undefined && contactUpdate.firstName !== contactBefore.firstName) ||
      (contactUpdate.lastName !== undefined && contactUpdate.lastName !== contactBefore.lastName))
  ) {
    await touchSubmissionsForContacts(db, [contactId], now);
  }

  if (before) {
    const newTitle = typeof title === "string" ? title : before.title;
    const newDescription = typeof description === "string" ? description : before.description;
    if (newTitle !== before.title || newDescription !== before.description) {
      // DEC-158 wave-59 amendment: stamp the ORIGINAL (pre-edit) content as
      // revision #1 before appending the actual edit's snapshot — a no-op
      // once the submission has any revision at all.
      await ensureBaselineRevision(db, submissionId, {
        title: before.title,
        description: before.description,
        at: before.createdAt,
      });
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
  // DEC-842: a submitted blank on a visible, non-required custom field is
  // the same kind of "no longer has a stored answer" case as a hidden
  // field — reuse the exact same deletion path rather than adding a second
  // delete mechanism.
  const hiddenCustomFieldIds = [...new Set([...hiddenFieldIds, ...clearedFieldIds])].filter(
    (fieldId) => lockedFieldName(fieldId) === null,
  );
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

// ---------------------------------------------------------------------------
// DEC-604: speaker self-add of a co-presenter. Bounded by the same edit-lock
// canEditSubmission check the caller runs before saveSubmissionEdits — this
// module performs no edit-lock check of its own, matching the rest of this
// file's convention that the route handler is the single place the lock is
// enforced.
// ---------------------------------------------------------------------------

export interface PortalParticipant {
  id: string;
  contactId: string;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  visible: boolean;
}

/** Current participants on one of the speaker's own submissions, in display
 * order. Caller is expected to have already scoped submissionId via
 * loadEditableSubmission — this performs no ownership check of its own.
 * Filters through PORTAL_VISIBLE_INVITE_STATUSES (mirrors
 * getPortalSubmissionDetail) so a declined invitation never shows here.
 * DEC-866: `name` prefers the row's nameAtTime snapshot (set only by
 * addCoPresenter, below) over the joined contact's live name — a matched
 * existing contact's real CRM identity is never echoed back to the speaker
 * who merely typed an email address. Rows this path did not create
 * (nameAtTime NULL: the original CFP submitter, organizer invites) fall
 * back to the live contact name exactly as before. */
export async function getPortalParticipants(db: Db, submissionId: string): Promise<PortalParticipant[]> {
  const rows = await db
    .select({
      id: schema.participant.id,
      contactId: schema.participant.contactId,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      email: schema.contact.email,
      role: schema.participant.role,
      order: schema.participant.order,
      visible: schema.participant.visible,
      nameAtTime: schema.participant.nameAtTime,
    })
    .from(schema.participant)
    .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
    .where(
      and(
        eq(schema.participant.submissionId, submissionId),
        inArray(schema.participant.inviteStatus, PORTAL_VISIBLE_INVITE_STATUSES),
      ),
    )
    .orderBy(schema.participant.order);
  return rows.map((r) => ({
    id: r.id,
    contactId: r.contactId,
    name: r.nameAtTime?.trim() || `${r.firstName} ${r.lastName}`.trim(),
    email: r.email,
    role: r.role,
    roleLabel: participantRoleLabel(r.role),
    visible: r.visible,
  }));
}

// DEC-604 (MAX_PARTICIPANTS_PER_SUBMISSION now lives in
// src/domain/participant-roles.ts, DEC-422 wave-67 amendment): 1 original
// submitter + up to 5 self-added co-presenters. The spec text is "cap at 5
// co-presenters per submission" — read narrowly as a cap of 5 participant
// rows ADDED THROUGH THIS ENDPOINT, so the submission (which starts with
// exactly one participant: the CFP submitter) may never exceed 6
// participant rows via this path. Organizer-side invites (POST
// /api/v1/submissions/:id/participants) are a separate, uncapped path and
// are not counted differently here — this cap is a simple total row-count
// check against the submission's existing participant rows.

export interface AddCoPresenterInput {
  submissionId: string;
  orgId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export type AddCoPresenterResult =
  | { ok: true }
  | { ok: false; errors: Record<string, string> };

// DEC-604 (wave-56 amendment): the join table's uniqueIndex
// (migrations/0019_join_table_uniqueness.sql) is the arbiter of a duplicate
// co-presenter — the client cannot pre-empt it. Exported so the portal
// edit view can detect THIS specific server-only rejection (a "who did NOT
// happen" banner, docs/eval-findings.md's "Speaker portal" section) without
// re-deriving it from validation-error field messages that share the same
// `errors.email` key.
export const CO_PRESENTER_DUPLICATE_MESSAGE = "This person is already a participant on this submission";

/** Adds a co-presenter to one of the speaker's own submissions. Caller must
 * have already verified canEditSubmission and that submissionId/orgId scope
 * to this speaker's own contact. Resolves the email against the org's
 * contacts case-insensitively (the same findContactByEmail the CFP submit
 * path uses, src/routes/public/submit.tsx) and — per DEC-604 — writes NO
 * field onto a matched existing contact; a fresh email creates a contact
 * carrying first/last/email only. The (submission_id, contact_id)
 * uniqueIndex (migrations/0019_join_table_uniqueness.sql) is the duplicate
 * contract: a conflicting insert is caught via onConflictDoNothing and
 * surfaced as a field error, never a 500.
 *
 * DEC-866: the participant row also carries nameAtTime = the SUBMITTED
 * first/last name, on BOTH branches (matched existing contact and freshly
 * created contact). getPortalParticipants renders nameAtTime in preference
 * to the joined contact's live name — a speaker who typed a co-presenter's
 * name against an email that happens to match someone else's CRM record
 * must never have that other identity echoed back to them. */
export async function addCoPresenter(db: Db, input: AddCoPresenterInput): Promise<AddCoPresenterResult> {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = normalizeEmail(input.email);
  const errors: Record<string, string> = {};
  if (!firstName) errors.firstName = "First name is required";
  else if (firstName.length > MAX_NAME_LENGTH) errors.firstName = overCapFieldMessage(firstName.length, MAX_NAME_LENGTH);
  if (!lastName) errors.lastName = "Last name is required";
  else if (lastName.length > MAX_NAME_LENGTH) errors.lastName = overCapFieldMessage(lastName.length, MAX_NAME_LENGTH);
  if (!isValidEmail(email)) errors.email = "Enter a valid email address";
  if (!isCoPresenterRoleValue(input.role)) errors.role = "Choose a role";
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const countRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.participant)
    .where(eq(schema.participant.submissionId, input.submissionId));
  const count = countRows[0]?.count ?? 0;
  if (count >= MAX_PARTICIPANTS_PER_SUBMISSION) {
    // Names the real total (MAX_PARTICIPANTS_PER_SUBMISSION) via the one
    // cap grammar (participantCapRefusalMessage, src/domain/cap-copy.ts) --
    // an organizer-invited participant already counts toward this
    // submission's total, so the true remaining co-presenter headroom can
    // be less than MAX_PARTICIPANTS_PER_SUBMISSION - 1, and a count read
    // above the cap (the organizer door has no pre-write check of its own)
    // must never be presented as a position inside a remaining allowance.
    return {
      ok: false,
      errors: {
        role: participantCapRefusalMessage(count, MAX_PARTICIPANTS_PER_SUBMISSION),
      },
    };
  }

  const existing = await findContactByEmail(db, input.orgId, email);
  let contactId: string;
  let titleAtTime: string | null;
  let orgAtTime: string | null;
  if (existing) {
    // DEC-604: an existing contact is never written to from this path.
    contactId = existing.id;
    titleAtTime = existing.title;
    orgAtTime = existing.company;
  } else {
    contactId = await createContact(db, { orgId: input.orgId, firstName, lastName, email });
    titleAtTime = null;
    orgAtTime = null;
  }

  const now = new Date();
  // order = max(order)+1 computed INSIDE the insert (field guide: a
  // position/order column nobody sets on create is dead), mirroring
  // src/server/repo/participants.ts:inviteParticipant.
  const nextOrderSql = sql<number>`(SELECT COALESCE(MAX(${schema.participant.order}), -1) + 1 FROM ${schema.participant} WHERE ${schema.participant.submissionId} = ${input.submissionId})`;
  const inserted = await db
    .insert(schema.participant)
    .values({
      id: newId(),
      submissionId: input.submissionId,
      contactId,
      role: input.role,
      order: nextOrderSql,
      // DEC-866: the submitted name, never the CRM identity — see
      // getPortalParticipants above.
      nameAtTime: `${firstName} ${lastName}`.trim(),
      // DEC-656 (amends DEC-604): a speaker-added co-presenter is RECORDED,
      // not PUBLISHED. This participant lands visible=false and reaches the
      // public site only through the organizer's existing visibility toggle
      // — no speaker-portal action here publishes a name/email server-side.
      visible: false,
      // DEC-317 Amendment (wave 37): a speaker-named co-presenter is an
      // UNTRUSTED write path and must never mint an active grant directly —
      // it lands 'invited', exactly like the organizer's own add-participant
      // path (src/server/repo/participants.ts:inviteParticipant). The row is
      // portal-visible (PORTAL_VISIBLE_INVITE_STATUSES) for reading —  the
      // named contact sees a pending invitation — but gains read/write
      // access, comms-recipient status, and onboarding tasks only after they
      // accept via POST /portal/invitations/:id (src/routes/portal/index.tsx).
      // DEC-604 still stands: no email is sent from this path — accepting
      // requires the named contact to already be signed into the portal and
      // see the pending invitation there.
      inviteStatus: "invited",
      titleAtTime,
      orgAtTime,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: [schema.participant.submissionId, schema.participant.contactId] })
    .returning({ id: schema.participant.id });
  if (!inserted[0]) {
    return { ok: false, errors: { email: CO_PRESENTER_DUPLICATE_MESSAGE } };
  }
  // DEC-725 amendment: a newly-added (pending) co-presenter changes the
  // submission's published Speakers cell composition once accepted — see
  // submissions/touch.ts header.
  await touchSubmissions(db, [input.submissionId], now);
  return { ok: true };
}

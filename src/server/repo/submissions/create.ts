// Submissions repo: create (manual session creation) + clone. Split out of
// repo/submissions.ts (contention decomposition, no behavior change). See
// repo/submissions.ts for the module-level contract notes.

import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { newId } from "../../../domain/ids";
import { submissionSeqSubquery } from "./seq";
import { normalizeEmail } from "../../../domain/email";
import { DEC_258, DEC_275, DEC_542, DEC_755, DEC_765 } from "../../../decisions";
import { chunkRowsForInsert } from "../../../lib/chunk";
import { DEFAULT_PARTICIPANT_ROLE } from "../../../domain/participant-roles";

// Compile-checked dependency marker: createSubmission's participant insert
// below snapshots DEC-258's title_at_time/org_at_time.
void DEC_258;
// Compile-checked dependency marker: cloneSubmission's participant copy
// below implements DEC-275 (active-only, invite_status reset to 'none').
void DEC_275;
// Compile-checked dependency marker: cloneSubmission's child-row inserts
// below are set-based (chunkRowsForInsert), not per-row loops (DEC-542).
void DEC_542;
// Compile-checked dependency marker: findOrCreateContact's case-insensitive
// email match below implements DEC-755.
void DEC_755;
// Compile-checked dependency marker: createSubmission's contact input below
// accepts a `role` (default 'speaker') and an optional `contactId` shape
// that links an already-owned contact by id, skipping findOrCreateContact
// entirely (DEC-765).
void DEC_765;

export interface CreateSubmissionInput {
  title: string;
  description?: string | null;
  contact?:
    | { email: string; firstName: string; lastName: string; role?: string }
    | {
        /** DEC-765: link an already-owned contact by id — skips
         * findOrCreateContact entirely (no email round-trip, no risk of
         * minting a duplicate contact). title/company are still snapshotted
         * onto the participant row (DEC-258) from the caller-supplied
         * values, since this shape carries no fresh contact record to
         * re-query. */
        contactId: string;
        title?: string | null;
        company?: string | null;
        role?: string;
      }
    | null;
  /** Submission status at creation (DEC-156 push-to-event creates directly
   * as 'accepted'; every other caller keeps the 'pending' default). */
  status?: "pending" | "accepted";
}

export interface FoundOrCreatedContact {
  id: string;
  /** DEC-258: title/company as of this call — null for a freshly-created
   * contact (this input shape collects no such fields), or the matched
   * existing contact's current values. Callers snapshot these onto the new
   * participant row rather than issuing a second contact lookup. */
  title: string | null;
  company: string | null;
}

/** Shared with ./participants (co-presenter invite) — not re-exported from
 * the repo/submissions barrel, this stays internal to the split modules. */
export async function findOrCreateContact(
  db: Db,
  orgId: string,
  input: { email: string; firstName: string; lastName: string },
  now: Date,
): Promise<FoundOrCreatedContact> {
  const email = normalizeEmail(input.email);
  // DEC-755: contact identity within an org is (orgId, lower(email)) on
  // every find-or-create path -- matches submit.ts's findContactByEmail so
  // a differently-cased address (e.g. Jordan@X.com vs jordan@x.com) reuses
  // the existing contact instead of minting a duplicate.
  // DEC-558 wave-5 amendment: contact.email has no uniqueIndex (duplicate
  // contacts sharing an email are a recognized state -- see contacts/
  // merge.ts), so this predicate can match more than one row. Same
  // resolution as findContactByEmail (submit.ts): order by createdAt asc,
  // tie-broken by id asc, so "the existing contact" is stable across calls.
  const existing = await db
    .select({ id: schema.contact.id, title: schema.contact.title, company: schema.contact.company })
    .from(schema.contact)
    .where(and(eq(schema.contact.orgId, orgId), sql`lower(${schema.contact.email}) = lower(${email})`))
    .orderBy(asc(schema.contact.createdAt), asc(schema.contact.id))
    .limit(1);
  if (existing[0]) return existing[0];

  const id = newId();
  await db.insert(schema.contact).values({
    id,
    orgId,
    firstName: input.firstName,
    lastName: input.lastName,
    email,
    createdAt: now,
    updatedAt: now,
  });
  return { id, title: null, company: null };
}

export async function createSubmission(
  db: Db,
  eventId: string,
  orgId: string,
  input: CreateSubmissionInput,
): Promise<string> {
  const now = new Date();
  const id = newId();

  await db.insert(schema.submission).values({
    id,
    eventId,
    formId: null,
    seq: submissionSeqSubquery(eventId),
    title: input.title,
    description: input.description ?? null,
    status: input.status ?? "pending",
    contentStatus: "pending",
    createdAt: now,
    updatedAt: now,
  });

  if (input.contact) {
    const contact: FoundOrCreatedContact =
      "contactId" in input.contact
        ? { id: input.contact.contactId, title: input.contact.title ?? null, company: input.contact.company ?? null }
        : await findOrCreateContact(db, orgId, input.contact, now);
    await db.insert(schema.participant).values({
      id: newId(),
      submissionId: id,
      contactId: contact.id,
      role: input.contact.role ?? DEFAULT_PARTICIPANT_ROLE,
      order: 0,
      visible: true,
      inviteStatus: "none",
      titleAtTime: contact.title,
      orgAtTime: contact.company,
      createdAt: now,
      updatedAt: now,
    });
  }

  return id;
}

export interface UpdateSubmissionFieldsInput {
  title?: string;
  description?: string | null;
}

/** CNT-09: organizer edit of title/description (route: PATCH
 * /api/v1/submissions/:id in routes/api/submissions.ts). Only the fields
 * present in `fields` are updated; updatedAt is always bumped.
 *
 * DEC-962 wave-58 amendment: scoped on eventId in the WHERE — both callers
 * (routes/api/submissions.ts's PATCH and revision-restore handlers) already
 * hold eventId from their own getSubmissionOwnership lookup, so this write
 * carries scope of its own rather than depending on the caller's prior
 * ownership check alone. */
export async function updateSubmissionFields(
  db: Db,
  eventId: string,
  submissionId: string,
  fields: UpdateSubmissionFieldsInput,
): Promise<void> {
  await db
    .update(schema.submission)
    .set({ ...fields, updatedAt: new Date() })
    .where(and(eq(schema.submission.eventId, eventId), eq(schema.submission.id, submissionId)));
}

/**
 * Clone a submission: fresh copy with 'pending' status/contentStatus, a new
 * seq, and copies of submission_track / submission_answer / ACTIVE
 * participant rows (DEC-275). File, evaluation, schedule_slot and
 * file_comment rows are never copied.
 *
 * A submission with zero participants (either because the source had none,
 * or because every source participant was 'invited'/'declined' and thus
 * excluded by DEC-275) is a legitimate 'TBA' session — createSubmission's
 * `contact` input is optional (src/routes/api/submissions.ts:103), and
 * acceptance planning for a participant-less submission is a documented
 * no-op, not an error.
 */
export async function cloneSubmission(
  db: Db,
  submissionId: string,
): Promise<{ id: string; droppedFileAnswers: number }> {
  const rows = await db
    .select()
    .from(schema.submission)
    .where(eq(schema.submission.id, submissionId))
    .limit(1);
  const original = rows[0];
  if (!original) throw new Error(`cloneSubmission: submission ${submissionId} not found`);

  const now = new Date();
  const newSubmissionId = newId();

  await db.insert(schema.submission).values({
    id: newSubmissionId,
    eventId: original.eventId,
    formId: original.formId,
    seq: submissionSeqSubquery(original.eventId),
    title: `${original.title} (copy)`,
    description: original.description,
    trackId: original.trackId,
    status: "pending",
    contentStatus: "pending",
    createdAt: now,
    updatedAt: now,
  });

  const trackRows = await db
    .select({ trackId: schema.submissionTrack.trackId })
    .from(schema.submissionTrack)
    .where(eq(schema.submissionTrack.submissionId, submissionId));
  const newTrackRows = trackRows.map((t) => ({
    submissionId: newSubmissionId,
    trackId: t.trackId,
    createdAt: now,
  }));
  for (const chunk of chunkRowsForInsert(newTrackRows)) {
    await db.insert(schema.submissionTrack).values(chunk);
  }

  const answerRows = await db
    .select({ formFieldId: schema.submissionAnswer.formFieldId, valueJson: schema.submissionAnswer.valueJson })
    .from(schema.submissionAnswer)
    .where(eq(schema.submissionAnswer.submissionId, submissionId));
  // DEC-275 wave-51 amendment: a file answer's value is a file id owned by
  // the ORIGINAL submission (submission-delete.ts:307's cascade trigger
  // fires on that submission, not the clone) -- copying the row would alias
  // another submission's upload. The original answer SELECT above stays
  // exactly as-is (never an innerJoin on form_field: an answer whose
  // formFieldId no longer resolves must never be silently dropped here);
  // this is one extra set-based query to find file-kind field ids to filter
  // out, not a rewrite of the base query.
  let fileFieldIds: Set<string> = new Set();
  if (original.formId) {
    const fileFields = await db
      .select({ id: schema.formField.id })
      .from(schema.formField)
      .where(and(eq(schema.formField.formId, original.formId), eq(schema.formField.kind, "file")));
    fileFieldIds = new Set(fileFields.map((f) => f.id));
  }
  const droppedFileAnswers = fileFieldIds.size > 0 ? answerRows.filter((a) => fileFieldIds.has(a.formFieldId)).length : 0;
  const newAnswerRows = answerRows
    .filter((a) => !fileFieldIds.has(a.formFieldId))
    .map((a) => ({
      id: newId(),
      submissionId: newSubmissionId,
      formFieldId: a.formFieldId,
      valueJson: a.valueJson,
      createdAt: now,
      updatedAt: now,
    }));
  for (const chunk of chunkRowsForInsert(newAnswerRows)) {
    await db.insert(schema.submissionAnswer).values(chunk);
  }

  const participantRows = await db
    .select({
      id: schema.participant.id,
      contactId: schema.participant.contactId,
      role: schema.participant.role,
      order: schema.participant.order,
      visible: schema.participant.visible,
      inviteStatus: schema.participant.inviteStatus,
      titleAtTime: schema.participant.titleAtTime,
      orgAtTime: schema.participant.orgAtTime,
    })
    .from(schema.participant)
    .where(eq(schema.participant.submissionId, submissionId));
  const newParticipantRows = participantRows
    .filter((p) => p.inviteStatus === "none" || p.inviteStatus === "accepted")
    .map((p) => ({
      id: newId(),
      submissionId: newSubmissionId,
      contactId: p.contactId,
      role: p.role,
      order: p.order,
      visible: p.visible,
      inviteStatus: "none" as const,
      titleAtTime: p.titleAtTime,
      orgAtTime: p.orgAtTime,
      createdAt: now,
      updatedAt: now,
    }));
  for (const chunk of chunkRowsForInsert(newParticipantRows)) {
    await db.insert(schema.participant).values(chunk);
  }

  return { id: newSubmissionId, droppedFileAnswers };
}

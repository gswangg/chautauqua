// Submissions repo: create (manual session creation) + clone. Split out of
// repo/submissions.ts (contention decomposition, no behavior change). See
// repo/submissions.ts for the module-level contract notes.

import { and, eq } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { newId } from "../../../domain/ids";
import { submissionSeqSubquery } from "./seq";
import { normalizeEmail } from "../../../domain/email";
import { DEC_258, DEC_275 } from "../../../decisions";

// Compile-checked dependency marker: createSubmission's participant insert
// below snapshots DEC-258's title_at_time/org_at_time.
void DEC_258;
// Compile-checked dependency marker: cloneSubmission's participant copy
// below implements DEC-275 (active-only, invite_status reset to 'none').
void DEC_275;

export interface CreateSubmissionInput {
  title: string;
  description?: string | null;
  contact?: { email: string; firstName: string; lastName: string } | null;
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
  const existing = await db
    .select({ id: schema.contact.id, title: schema.contact.title, company: schema.contact.company })
    .from(schema.contact)
    .where(and(eq(schema.contact.orgId, orgId), eq(schema.contact.email, email)))
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
    const contact = await findOrCreateContact(db, orgId, input.contact, now);
    await db.insert(schema.participant).values({
      id: newId(),
      submissionId: id,
      contactId: contact.id,
      role: "speaker",
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
 * present in `fields` are updated; updatedAt is always bumped. */
export async function updateSubmissionFields(
  db: Db,
  submissionId: string,
  fields: UpdateSubmissionFieldsInput,
): Promise<void> {
  await db
    .update(schema.submission)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(schema.submission.id, submissionId));
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
export async function cloneSubmission(db: Db, submissionId: string): Promise<string> {
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
  for (const t of trackRows) {
    await db.insert(schema.submissionTrack).values({
      submissionId: newSubmissionId,
      trackId: t.trackId,
      createdAt: now,
    });
  }

  const answerRows = await db
    .select({ formFieldId: schema.submissionAnswer.formFieldId, valueJson: schema.submissionAnswer.valueJson })
    .from(schema.submissionAnswer)
    .where(eq(schema.submissionAnswer.submissionId, submissionId));
  for (const a of answerRows) {
    await db.insert(schema.submissionAnswer).values({
      id: newId(),
      submissionId: newSubmissionId,
      formFieldId: a.formFieldId,
      valueJson: a.valueJson,
      createdAt: now,
      updatedAt: now,
    });
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
  for (const p of participantRows) {
    if (p.inviteStatus !== "none" && p.inviteStatus !== "accepted") continue;
    await db.insert(schema.participant).values({
      id: newId(),
      submissionId: newSubmissionId,
      contactId: p.contactId,
      role: p.role,
      order: p.order,
      visible: p.visible,
      inviteStatus: "none",
      titleAtTime: p.titleAtTime,
      orgAtTime: p.orgAtTime,
      createdAt: now,
      updatedAt: now,
    });
  }

  return newSubmissionId;
}

// Contacts repo: push to event (CRM-10, DEC-156). Split out of
// repo/contacts.ts (contention decomposition, no behavior change). See
// repo/contacts.ts for the module-level contract notes.

import { and, eq } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { createSubmission } from "../submissions/create";
import { updateSubmissionStatuses } from "../submissions";
import { insertActiveParticipants, getParticipantCount } from "../participants";
import { DEC_156, DEC_542, DEC_765, DEC_810, DEC_909 } from "../../../decisions";
import type { ContactRow } from "./rows";

// Compile-checked dependency marker: pushContactToEvent below implements
// DEC-156's push-to-event contract (accepted submission, pending content,
// no email).
void DEC_156;
// Compile-checked dependency marker: pushContactToEvent/pushContactsToEvent
// below link the caller's already-owned contact by id (never re-resolve by
// email through findOrCreateContact), and pass the chosen role through to
// participant.role (DEC-765).
void DEC_765;
// Compile-checked dependency marker: pushContactToEvent/pushContactsToEvent
// below take `title` as a plain string -- no 'Invited: <First> <Last>'
// fallback and no other invented text. DEC-909 wave-128 amendment made the
// roster-add session title OPTIONAL, so callers may now pass "" through
// here; this module still never substitutes anything for what the caller
// gave it (DEC-810's other half -- never invents, and per DEC-909 now also
// never duplicates, see findSubmissionByExactTitle below).
void DEC_810;
// Compile-checked dependency marker: findSubmissionByExactTitle below is
// the ONE place (server-side) an exact-title match against an event's
// existing sessions is made before minting a new one -- a roster add with a
// typed title that matches references the existing submission instead of
// creating a duplicate (DEC-909 wave-128 clause b).
void DEC_909;
// Compile-checked dependency marker: pushContactsToEvent's participant
// attach below is one chunked insertActiveParticipants call
// (chunkRowsForInsert), not a per-contact loop (DEC-542).
void DEC_542;

/**
 * Looks up an existing submission in `eventId` whose title exactly matches
 * `title` (case-sensitive, exact string equality -- DEC-909 wave-128 clause
 * b: "an exact match... references that session; only an unmatched title
 * mints a new one"). Never called with a blank title -- clause (b) only
 * applies "when a title IS typed"; a blank/optional title always mints
 * (see attachOrCreateRosterSession below). Returns the submission id, or
 * undefined if no session in this event carries that exact title.
 */
export async function findSubmissionByExactTitle(
  db: Db,
  eventId: string,
  title: string,
): Promise<string | undefined> {
  const rows = await db
    .select({ id: schema.submission.id })
    .from(schema.submission)
    .where(and(eq(schema.submission.eventId, eventId), eq(schema.submission.title, title)))
    .limit(1);
  return rows[0]?.id;
}

/**
 * DEC-909 wave-128 clauses (a) and (b), landing together: a roster add's
 * session title is optional (a), and a typed title that exactly matches an
 * existing session in this event REFERENCES it instead of minting a
 * duplicate (b). `title` is the caller's trimmed input -- "" when the
 * organiser left the field blank. A blank title always mints a fresh
 * (empty-titled) session via pushContactToEvent, since clause (b)'s
 * matching is scoped to a typed title only; an empty title matching every
 * other blank-titled roster add would silently merge unrelated people onto
 * one session, which is exactly the "sessions nobody planned" problem
 * clause (a) exists to avoid. A non-blank title that matches an existing
 * session in this event attaches the contact as an ACTIVE participant
 * (insertActiveParticipants -- visible, inviteStatus 'none', the same
 * roster-membership shape pushContactsToEvent already gives a batch import)
 * rather than creating a second session with the same name. Returns the
 * submission id the contact ended up on.
 */
export async function attachOrCreateRosterSession(
  db: Db,
  eventId: string,
  orgId: string,
  contact: Pick<ContactRow, "id" | "email" | "firstName" | "lastName" | "title" | "company">,
  title: string,
  role?: string,
): Promise<string> {
  if (title !== "") {
    const existingSubmissionId = await findSubmissionByExactTitle(db, eventId, title);
    if (existingSubmissionId !== undefined) {
      await insertActiveParticipants(db, existingSubmissionId, [
        {
          contactId: contact.id,
          role: role && role.trim() ? role : "speaker",
          order: await getParticipantCount(db, existingSubmissionId),
          titleAtTime: contact.title,
          orgAtTime: contact.company,
        },
      ]);
      return existingSubmissionId;
    }
  }
  return pushContactToEvent(db, eventId, orgId, contact, title, role);
}

/**
 * Pushes an already-org-owned contact into an event as an organizer-invited
 * submission: status 'accepted', content_status left at its default
 * 'pending' (createSubmission's default), the caller-supplied title (DEC-810
 * — no fallback), and the contact as a visible participant with the given
 * role (default 'speaker'). Links the caller's contact by id (DEC-765) —
 * createSubmission's `contactId` input shape skips findOrCreateContact
 * entirely, so this never re-resolves the contact by email and never risks
 * minting a duplicate when the CRM address and a submission-path address
 * differ. Sends no email. Caller is expected to have already verified the
 * contact and event both belong to the caller's org, and that `title` is a
 * non-empty string.
 *
 * P1 fix (w1-f): this used to insert the submission directly with
 * status: 'accepted', which skips updateSubmissionStatuses's acceptance
 * planner entirely (that only fires on a tracked pending->accepted
 * transition, DEC-079) — so a CRM-pushed contact never got the event's
 * assignToAllAccepted onboarding tasks and was invisible on the Speakers
 * onboarding grid (src/server/repo/tasks.ts's getOnboardingGrid renders
 * task_assignment rows, not submissions). Creating as 'pending' and then
 * driving it through updateSubmissionStatuses (the same path triage/bulk
 * accept uses) runs that planner so the contact gets onboarding tasks and
 * shows up on Speakers, while still sending no email (DEC-009 invariant #1
 * — updateSubmissionStatuses has no mailer import) and reaching the exact
 * same final status='accepted' DEC-156 requires.
 */
export async function pushContactToEvent(
  db: Db,
  eventId: string,
  orgId: string,
  contact: Pick<ContactRow, "id" | "email" | "firstName" | "lastName" | "title" | "company">,
  title: string,
  role?: string,
): Promise<string> {
  const submissionId = await createSubmission(db, eventId, orgId, {
    title,
    contact: { contactId: contact.id, title: contact.title, company: contact.company, role },
  });
  await updateSubmissionStatuses(db, eventId, [submissionId], "accepted", new Date());
  return submissionId;
}

/**
 * Batch-roster counterpart to pushContactToEvent, for CSV import + eventId
 * (src/routes/api/contacts/import.ts's /contacts/import). DEC-810 amendment
 * (wave 59): a batch roster add is ONE session for the whole batch, not one
 * identical session per imported row. Creates exactly ONE submission (via
 * createSubmission, using the FIRST contact for its DEC-765 contactId/
 * title/company attribution), attaches every REMAINING contact as an
 * ACTIVE participant (role 'speaker', visible=true, inviteStatus='none' --
 * never 'invited', see insertActiveParticipants) in one chunked set-based
 * insert (DEC-542), then runs updateSubmissionStatuses ONCE (DEC-079's
 * acceptance planner, a single set-based pass over the one submission id).
 * Same DEC-156 contract as pushContactToEvent otherwise: status accepted,
 * content_status pending, no email. Returns the single submission id.
 * Caller must not call this with an empty `contacts` list -- there is no
 * batch to push, so no submission id to hand back (fail loudly rather than
 * mint a sentinel); import.ts guards this before calling.
 */
export async function pushContactsToEvent(
  db: Db,
  eventId: string,
  orgId: string,
  contacts: Pick<ContactRow, "id" | "email" | "firstName" | "lastName" | "title" | "company">[],
  title: string,
): Promise<string> {
  if (contacts.length === 0) {
    throw new Error("pushContactsToEvent: contacts must be non-empty -- caller should skip the call instead");
  }
  const [lead, ...rest] = contacts as [
    Pick<ContactRow, "id" | "email" | "firstName" | "lastName" | "title" | "company">,
    ...Pick<ContactRow, "id" | "email" | "firstName" | "lastName" | "title" | "company">[],
  ];

  const submissionId = await createSubmission(db, eventId, orgId, {
    title,
    contact: { contactId: lead.id, title: lead.title, company: lead.company },
  });

  await insertActiveParticipants(
    db,
    submissionId,
    rest.map((contact, idx) => ({
      contactId: contact.id,
      role: "speaker",
      order: idx + 1,
      titleAtTime: contact.title,
      orgAtTime: contact.company,
    })),
  );

  await updateSubmissionStatuses(db, eventId, [submissionId], "accepted", new Date());
  return submissionId;
}

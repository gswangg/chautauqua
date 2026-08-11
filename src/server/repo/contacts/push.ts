// Contacts repo: push to event (CRM-10, DEC-156). Split out of
// repo/contacts.ts (contention decomposition, no behavior change). See
// repo/contacts.ts for the module-level contract notes.

import type { Db } from "../../context";
import { createSubmission } from "../submissions/create";
import { updateSubmissionStatuses } from "../submissions";
import { DEC_156 } from "../../../decisions";
import type { ContactRow } from "./rows";

// Compile-checked dependency marker: pushContactToEvent below implements
// DEC-156's push-to-event contract (accepted submission, pending content,
// no email).
void DEC_156;

/**
 * Pushes an already-org-owned contact into an event as an organizer-invited
 * submission: status 'accepted', content_status left at its default
 * 'pending' (createSubmission's default), title defaulting to
 * 'Invited: <FirstName> <LastName>', and the contact as a visible
 * participant. Reuses createSubmission's contact-linking plumbing
 * (findOrCreateContact matches this contact's own email, so no duplicate
 * contact is created) rather than hand-rolling submission/participant
 * inserts. Sends no email. Caller is expected to have already verified the
 * contact and event both belong to the caller's org.
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
  contact: Pick<ContactRow, "email" | "firstName" | "lastName">,
  title: string | undefined,
): Promise<string> {
  const resolvedTitle = title && title.trim() ? title.trim() : `Invited: ${contact.firstName} ${contact.lastName}`;
  const submissionId = await createSubmission(db, eventId, orgId, {
    title: resolvedTitle,
    contact: { email: contact.email, firstName: contact.firstName, lastName: contact.lastName },
  });
  await updateSubmissionStatuses(db, eventId, [submissionId], "accepted", new Date());
  return submissionId;
}

/**
 * Set-based counterpart to pushContactToEvent (DEC-357), for batch roster
 * adds (CSV import + eventId, src/routes/api/contacts.ts's /contacts/import).
 * Creates one submission per contact via the same per-row createSubmission
 * (deliberately NOT a multi-row insert: submissionSeqSubquery at
 * src/server/repo/submit.ts:225 evaluates against the pre-statement table
 * state, so a multi-row VALUES would collide on seq), applying the same
 * `Invited: <First> <Last>` default title per contact when no title is
 * given, then runs updateSubmissionStatuses ONCE over every created id
 * (instead of once per contact) so the acceptance planner (DEC-079) does a
 * single set-based pass. Same DEC-156 contract as pushContactToEvent:
 * status accepted, content_status pending, visible participant, no email.
 * Returns submission ids in input order.
 */
export async function pushContactsToEvent(
  db: Db,
  eventId: string,
  orgId: string,
  contacts: Pick<ContactRow, "id" | "email" | "firstName" | "lastName">[],
  title?: string,
): Promise<string[]> {
  const resolvedTitle = title && title.trim() ? title.trim() : undefined;
  const submissionIds: string[] = [];
  for (const contact of contacts) {
    const contactTitle = resolvedTitle ?? `Invited: ${contact.firstName} ${contact.lastName}`;
    const submissionId = await createSubmission(db, eventId, orgId, {
      title: contactTitle,
      contact: { email: contact.email, firstName: contact.firstName, lastName: contact.lastName },
    });
    submissionIds.push(submissionId);
  }
  if (submissionIds.length > 0) {
    await updateSubmissionStatuses(db, eventId, submissionIds, "accepted", new Date());
  }
  return submissionIds;
}

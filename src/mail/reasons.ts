// DEC-441 amendment (wave 48): the ONE composer for the footer's
// `You are receiving this because ${reason}` clause (src/mail/shell.ts).
// Chautauqua Comms.dc.html's four worked `why` values are all complete
// sentences that both end in a full stop AND name the sending event
// ("You are receiving this because you submitted a talk to DevFlow Conf
// 2027."); every send path must call exactly one of the builders below so
// there is a single owner for that register instead of eight hand-typed
// strings drifting independently (DEC-613's second-copy trap). No free-text
// `reason` parameter is permitted at any renderEmailHtml call site --
// test/mail-reason-vocabulary.scan.test.ts enforces that mechanically.
//
// A handful of paths anchor their email against an event only for
// email_log's NOT NULL event_id (DEC-006) and have no event genuinely
// "in scope" as far as the reason's meaning goes (auth-reset, the
// org-level welcome email). Those still take the event name and still
// name it -- the frame settles the axis for every worked example, and no
// call site is exempted -- but a null anchor (content-notes' optional
// event, the reviewer-reminder's optional event) falls back to the literal
// "this event" so the sentence is always whole, never a bare fragment.

const FALLBACK_EVENT_NAME = "this event";

function nameOrFallback(eventName: string | null): string {
  return eventName && eventName.trim() !== "" ? eventName : FALLBACK_EVENT_NAME;
}

/** src/server/repo/tasks/reminders.ts -- task-due reminder email. */
export function outstandingTasksReason(eventName: string): string {
  return `you have outstanding tasks for ${eventName}.`;
}

/** src/routes/content-notes.ts -- organizer note-on-submission email. */
export function submissionNoteReason(eventName: string | null, requestChanges: boolean): string {
  const suffix = requestChanges ? " requesting changes" : "";
  return `an organizer left a note on your submission${suffix} for ${nameOrFallback(eventName)}.`;
}

/** src/routes/comms/portal-invites.ts -- speaker-portal invite email. */
export function portalInviteReason(eventName: string): string {
  return `you're being invited to the speaker portal for ${eventName}.`;
}

/** src/routes/comms/compose-core.ts (composeEmailShellOptions) -- shared by
 * /compose/send and /compose/preview. */
export function participantReason(eventName: string): string {
  return `you're a participant in a submission at ${eventName}.`;
}

/** src/routes/public/submit-post.tsx -- talk-submission confirmation email. */
export function submissionConfirmedReason(eventName: string): string {
  return `you submitted a talk to ${eventName}.`;
}

/** src/routes/review/plans-progress.ts -- reviewer outstanding-evaluations
 * reminder; names both the plan (the frame has no worked example for a
 * plan-scoped reminder, so the plan name is retained alongside the event)
 * and the event itself. */
export function reviewerOutstandingReason(eventName: string | null, planName: string): string {
  return `you're a reviewer with outstanding evaluations in "${planName}" at ${nameOrFallback(eventName)}.`;
}

/** src/routes/auth-reset.tsx -- password reset email. Not conceptually
 * event-scoped (a reset is account-level; the event is only the
 * email_log anchor, DEC-006), but every worked frame example names an
 * event, and this path does have one in scope -- narrowest reading,
 * flagged for the scribe. */
export function passwordResetReason(eventName: string): string {
  return `you requested a password reset for your account at ${eventName}.`;
}

/** src/routes/api/users.ts -- org user welcome email. Same event-anchor
 * caveat as passwordResetReason; falls back when the org has no anchor
 * event (still guarded upstream by anchorEventId, but the type is
 * nullable so the fallback keeps the sentence whole regardless). */
export function accountCreatedReason(eventName: string | null): string {
  return `an organizer created a reviewer/organizer account for you at ${nameOrFallback(eventName)}.`;
}

/** src/routes/api/contacts/bulk-email.ts -- organizer bulk-email send. */
export function bulkEmailReason(eventName: string): string {
  return `an organizer sent a bulk email to contacts of ${eventName}.`;
}

/** src/server/repo/portals/notify.ts -- someone gained items in their portal. */
export function portalNewItemsReason(eventName: string): string {
  return `something new was added to your portal for ${eventName}.`;
}

/** src/server/repo/portals/mail.ts -- an invitation to speak. */
export function invitationToSpeakReason(eventName: string): string {
  return `the organizers of ${eventName} invited you to speak.`;
}

/** src/server/repo/portals/mail.ts -- a sponsor-session decision, a new
 * sponsor speaker's welcome, or a team invite. */
export function sponsorReason(eventName: string, companyName: string): string {
  return `you're a contact for ${companyName} at ${eventName}.`;
}

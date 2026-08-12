// Speaker portal repo functions, per DEC-005 (/portal SSR) + DEC-012 (repo
// layer is the only place that touches drizzle row types) + DEC-016 (locked
// fields live on submission/contact columns, not submission_answer).
//
// This module holds the pure, no-IO helpers shared across the other
// portal/* submodules — statuses/ownership checks with no db dependency, so
// they're unit-tested directly against tiny fakes/values.
//
// Scoping is absolute: every query in the sibling submodules filters by the
// speaker's own contact_id (never trusts a submission/contact id from the
// request without verifying ownership first) — see assertSpeakerContactId
// and isOwnedByContact below.

import type { SubmissionStatus } from "../../../domain/status";

/** Speaker-facing status label: internal queue states never leak (per the
 * field guide invariant) — pending/accept_queue/decline_queue all collapse
 * to 'Under review'. */
export type SpeakerStatusLabel = "Under review" | "Accepted" | "Not accepted";

export function speakerStatusLabel(status: SubmissionStatus): SpeakerStatusLabel {
  switch (status) {
    case "pending":
    case "accept_queue":
    case "decline_queue":
    case "waitlisted":
      return "Under review";
    case "accepted":
      return "Accepted";
    case "declined":
      return "Not accepted";
    default: {
      const exhaustive: never = status;
      throw new Error(`Unknown submission status '${exhaustive}'`);
    }
  }
}

/** Fail-loud guard: speaker-role sessions must always carry a contact_id
 * (DEC-004: speaker users link via user.contact_id). A speaker auth without
 * one is data corruption, not a recoverable condition. */
export function assertSpeakerContactId(auth: { role: string; contactId?: string } | undefined): string {
  if (!auth || auth.role !== "speaker") {
    throw new Error("assertSpeakerContactId called without a speaker auth session");
  }
  if (!auth.contactId) {
    throw new Error("Speaker auth session is missing contact_id — invariant violated");
  }
  return auth.contactId;
}

/** Pure ownership check: is `contactId` among the submission's participants?
 * Never trust a submission id from the request without running this (or the
 * equivalent query-level filter) first — no IDOR. */
export function isOwnedByContact(participantContactIds: readonly string[], contactId: string): boolean {
  return participantContactIds.includes(contactId);
}

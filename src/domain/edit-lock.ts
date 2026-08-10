// Pure edit-lock rules for speaker submission editing (J2/CFP-06, DEC-041).
// Web APIs only (DEC-002) — no node:/cloudflare/drizzle imports.

import { isFormClosed } from "../lib/submit-core";

/** A submission remains editable by its speaker when it has been accepted
 * (accepted speakers keep editing regardless of the form's close date), or
 * while the form's window is still open. Every other status (pending,
 * accept_queue, decline_queue, declined) follows the close-date gate. */
export function canEditSubmission(status: string, closeDate: number | null, now: number): boolean {
  return status === "accepted" || !isFormClosed(closeDate, now);
}

/** Track selection editing follows the close-date gate only — even an
 * accepted speaker cannot change tracks once the form has closed (tracks
 * drive reviewer/agenda assignment that's already settled by acceptance). */
export function canEditTracks(closeDate: number | null, now: number): boolean {
  return !isFormClosed(closeDate, now);
}

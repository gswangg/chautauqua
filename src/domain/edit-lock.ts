// Pure edit-lock rules for speaker submission editing (J2/CFP-06, DEC-041).
// Web APIs only (DEC-002) — no node:/cloudflare/drizzle imports.

import { isFormClosed } from "../lib/submit-core";

/** DEC-041 amendment (gate-6 diagnostic, CFP-16 FAIL): the close-date gate
 * binds EVERY status. The old accepted-status exception let a speaker edit
 * an accepted talk's title/abstract forever after the call closed —
 * measured live by the eval, and contradicting the portal ruling ("title
 * and abstract stay organiser-only post-acceptance"). While the window is
 * open, every status edits; once it closes, nobody speaker-side does
 * (organizer-side editing is a different route and unaffected).
 * DEC-522: closeDate is a DAY LABEL, expanded to the event-local end-of-day
 * instant by isFormClosed. */
export function canEditSubmission(
  status: string,
  closeDate: number | null,
  now: number,
  timeZone: string,
): boolean {
  void status;
  return !isFormClosed(closeDate, now, timeZone);
}

/** Deliverable uploads and file comments KEEP the accepted-status
 * exception canEditSubmission lost (CFP-16 amendment above): an accepted
 * speaker's obligations — slides, recordings, comment threads — run well
 * past the CFP window, so the close date must not lock the content flow.
 * Only the submission's own text/answers lock at close. */
export function canUploadDeliverables(
  status: string,
  closeDate: number | null,
  now: number,
  timeZone: string,
): boolean {
  return status === "accepted" || !isFormClosed(closeDate, now, timeZone);
}

/** Track selection editing follows the close-date gate only — even an
 * accepted speaker cannot change tracks once the form has closed (tracks
 * drive reviewer/agenda assignment that's already settled by acceptance).
 * DEC-522: closeDate is a DAY LABEL, expanded event-local. */
export function canEditTracks(closeDate: number | null, now: number, timeZone: string): boolean {
  return !isFormClosed(closeDate, now, timeZone);
}

// Pure edit-lock rules for speaker submission editing (J2/CFP-06, DEC-041).
// Web APIs only (DEC-002) — no node:/cloudflare/drizzle imports.

import { isFormClosed } from "../lib/submit-core";

/** DEC-041 amendment (wave 6, restored): an accepted speaker keeps editing
 * their submission (title/abstract) after the CFP closes — docs/clarifications.md:39,
 * SPEC.md:297-298, and the vendored frame (docs/design/Chautauqua Public and
 * Portal.dc.html:597-620, "Edit your session", only Session length disabled)
 * all agree on this. A prior wave's CFP-16 diagnostic dropped the exception;
 * per docs/README.md's precedence order (clarifications > brief > sessionboard-
 * reference > eval-rubric) that diagnostic is a recorded forfeit, not binding.
 * Every other status locks at close.
 * DEC-522: closeDate is a DAY LABEL, expanded to the event-local end-of-day
 * instant by isFormClosed. */
export function canEditSubmission(
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

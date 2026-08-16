// Reviewer identity resolution (DEC-622, DEC-736): one resolver so the
// evaluations screen and the evaluations export can never disagree about
// who a reviewer's identity is shown as. DEC-736 supersedes DEC-622's
// null-iff-anonymized rule: anonymization hides the SPEAKER from the
// REVIEWER, never the reviewer's identity from the organiser -- the
// organiser is always told who reviewed.
//
// ## Amendment (wave 5, sha ee8ceffa): a reviewer whose stored name is a
// mononym (only firstName OR only lastName present -- DEC-986's single
// public Name control never rejects such a name) is a PERSON, not a
// missing name (DEC-757). This resolver now delegates to
// personNameOrEmail (src/domain/person-name.ts, the one owner of a
// person's display-name join, DEC-613) instead of a both-required ladder,
// so a mononym reviewer reads as their name rather than their email.

import { personNameOrEmail, type PersonNameOrEmailRow } from "./person-name";

export type ReviewerIdentityRow = PersonNameOrEmailRow;

/** Prefers the person's name (mononym-safe) when any part is non-empty,
 * else falls back to the reviewer's email. Never returns null -- the
 * organiser is always told who reviewed (DEC-736). */
export function resolveReviewerIdentity(row: ReviewerIdentityRow): string {
  return personNameOrEmail(row);
}

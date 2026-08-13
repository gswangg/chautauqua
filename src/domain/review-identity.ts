// Reviewer identity resolution (DEC-622, DEC-736): one resolver so the
// evaluations screen and the evaluations export can never disagree about
// who a reviewer's identity is shown as. DEC-736 supersedes DEC-622's
// null-iff-anonymized rule: anonymization hides the SPEAKER from the
// REVIEWER, never the reviewer's identity from the organiser -- the
// organiser is always told who reviewed.

export interface ReviewerIdentityRow {
  firstName?: string | null;
  lastName?: string | null;
  email: string;
}

/** Prefers "First Last" when BOTH names are non-empty, else falls back to
 * the reviewer's email. Never returns null -- the organiser is always told
 * who reviewed (DEC-736). */
export function resolveReviewerIdentity(row: ReviewerIdentityRow): string {
  return row.firstName && row.lastName ? `${row.firstName} ${row.lastName}`.trim() : row.email;
}

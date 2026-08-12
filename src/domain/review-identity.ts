// Blind-review identity resolution (DEC-622): one resolver so the
// evaluations screen and the evaluations export can never disagree about
// who a reviewer's identity is shown as when a plan is anonymized.

export interface ReviewerIdentityRow {
  anonymized: boolean;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
}

/** Returns null iff row.anonymized (caller renders the withheld cell, never
 * blank -- see ANONYMIZED_REVIEWER_CELL). Otherwise prefers "First Last"
 * when BOTH names are non-empty, else falls back to the reviewer's email. */
export function resolveReviewerIdentity(row: ReviewerIdentityRow): string | null {
  if (row.anonymized) return null;
  return row.firstName && row.lastName ? `${row.firstName} ${row.lastName}`.trim() : row.email;
}

export const ANONYMIZED_REVIEWER_CELL = "(anonymized)";

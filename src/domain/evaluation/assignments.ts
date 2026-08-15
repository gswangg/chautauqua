// Evaluation domain core (SPEC J4), pure module (DEC-002): no node:/cloudflare/
// drizzle imports, plain interfaces only — testable under plain vitest.
//
// Split out of the former monolithic src/domain/evaluation.ts (contention
// decomposition, no behavior change) -- see src/domain/evaluation.ts for
// the re-export barrel.

export interface ReviewerScopeRow {
  userId: string;
  trackId: string | null;
  submissionId: string | null;
}

/**
 * Pure set-based assignment resolution (DEC-081): given the plan-filtered
 * submissions and every plan_reviewer row for a plan, returns a map of
 * userId -> assigned submissions. A reviewer with any unrestricted row
 * (trackId and submissionId both null) is assigned every submission in
 * `all`; otherwise a reviewer is assigned the union of their explicit
 * submission scopes and submissions matching one of their track scopes.
 * A userId with no rows at all is simply absent from the returned map.
 */
export function resolveAssignments<T extends { id: string; trackIds: string[] }>(
  all: T[],
  reviewerRows: ReviewerScopeRow[],
): Map<string, T[]> {
  const rowsByUser = new Map<string, ReviewerScopeRow[]>();
  for (const row of reviewerRows) {
    const list = rowsByUser.get(row.userId) ?? [];
    list.push(row);
    rowsByUser.set(row.userId, list);
  }

  const result = new Map<string, T[]>();
  for (const [userId, rows] of rowsByUser) {
    const unrestricted = rows.some((r) => r.trackId === null && r.submissionId === null);
    if (unrestricted) {
      result.set(userId, all);
      continue;
    }
    const submissionScopes = new Set(rows.filter((r) => r.submissionId !== null).map((r) => r.submissionId as string));
    const trackScopes = new Set(rows.filter((r) => r.trackId !== null).map((r) => r.trackId as string));
    const assigned = all.filter((item) => submissionScopes.has(item.id) || item.trackIds.some((t) => trackScopes.has(t)));
    result.set(userId, assigned);
  }
  return result;
}

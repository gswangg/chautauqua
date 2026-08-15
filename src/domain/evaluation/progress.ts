// Evaluation domain core (SPEC J4), pure module (DEC-002): no node:/cloudflare/
// drizzle imports, plain interfaces only — testable under plain vitest.
//
// Reviewer progress state + reminder scope (DEC-707): the mock's vocabulary
// is DONE / N TO GO / NOT STARTED, and a reminder's label must name exactly
// who it sends to -- ONE predicate here, imported by both
// POST /plans/:id/remind and the Review landing's SPA label. Split out of
// the former monolithic src/domain/evaluation.ts (contention decomposition,
// no behavior change) -- see src/domain/evaluation.ts for the re-export
// barrel.

export type ReviewerProgressState = "done" | "not_started" | "in_progress";

/** DEC-707: a reviewer with nothing assigned reads as "done" (vacuously
 * complete -- there is no queue to work), never "not started". */
export function reviewerProgressState({
  assigned,
  completed,
}: {
  assigned: number;
  completed: number;
}): ReviewerProgressState {
  if (completed >= assigned) return "done";
  if (completed === 0) return "not_started";
  return "in_progress";
}

/** DEC-845/w5-f: a reviewer's own track scope, resolved from THEIR
 * plan_reviewer scope rows for one plan -- the same pure fold
 * getReviewerScopeTrackId (server/repo/review/reviewers.ts) wraps with a
 * DB read, factored out so the progress endpoint can resolve it for every
 * reviewer from rows it already has in memory (no query per reviewer). A
 * row with both trackId and submissionId null means "no track restriction"
 * (null result); more than one distinct trackId across the reviewer's rows
 * is not a single scope either (null result) -- only a reviewer whose scope
 * rows agree on exactly one track resolves to that track's id. */
export function resolveReviewerScopeTrackId(rows: { trackId: string | null; submissionId: string | null }[]): string | null {
  if (rows.length === 0) return null;
  const unrestricted = rows.some((r) => r.trackId === null && r.submissionId === null);
  if (unrestricted) return null;
  const trackIds = [...new Set(rows.filter((r) => r.trackId !== null).map((r) => r.trackId as string))];
  if (trackIds.length !== 1) return null;
  return trackIds[0] ?? null;
}

export interface RemindTargetRow {
  userId: string;
  assigned: number;
  completed: number;
}

/**
 * DEC-707: selects which reviewer rows a reminder send targets. 'not_started'
 * is the landing page's tertiary "Remind the N not started" link; 'incomplete'
 * (any non-done state) is the broader batch POST /plans/:id/remind defaults
 * to. Both the route and the SPA label MUST call this -- a hand-copied
 * predicate in either place is exactly the drift DEC-707 forbids.
 */
export function selectRemindTargets<T extends RemindTargetRow>(
  rows: T[],
  scope: "not_started" | "incomplete",
): T[] {
  if (scope === "not_started") {
    return rows.filter((r) => reviewerProgressState(r) === "not_started");
  }
  return rows.filter((r) => reviewerProgressState(r) !== "done");
}

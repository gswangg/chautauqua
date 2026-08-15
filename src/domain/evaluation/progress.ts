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

/** DEC-845 amendment (docs/clarifications.md:18): a reviewer's own track
 * scope, resolved from THEIR plan_reviewer scope rows for one plan -- the
 * same pure fold getReviewerScopeTrackIds (server/repo/review/reviewers.ts)
 * wraps with a DB read, factored out so the progress endpoint can resolve
 * it for every reviewer from rows it already has in memory (no query per
 * reviewer). A row with both trackId and submissionId null means "no track
 * restriction" ([] result, genuinely unrestricted -- reads as "All tracks"
 * downstream); otherwise the unique trackIds the reviewer's rows name,
 * which may be one or MANY -- a reviewer on two or more tracks must be
 * named, not folded into null/"All tracks" (that was the DEC-845 bug this
 * amendment fixes). */
export function resolveReviewerScopeTrackIds(rows: { trackId: string | null; submissionId: string | null }[]): string[] {
  if (rows.length === 0) return [];
  const unrestricted = rows.some((r) => r.trackId === null && r.submissionId === null);
  if (unrestricted) return [];
  return [...new Set(rows.filter((r) => r.trackId !== null).map((r) => r.trackId as string))];
}

/** DEC-845 amendment: renders a reviewer's resolved scope track names for
 * display -- null for an unrestricted reviewer ("All tracks" in the SPA),
 * otherwise every name sorted ascending and joined with ' · ' (no
 * truncation -- a reviewer on many tracks is named in full, not summarized
 * to a count). */
export function formatReviewerScopeLabel(trackNames: string[]): string | null {
  if (trackNames.length === 0) return null;
  return [...trackNames].sort((a, b) => a.localeCompare(b)).join(" · ");
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

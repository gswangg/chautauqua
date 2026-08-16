// Evaluation domain core (SPEC J4), pure module (DEC-002): no node:/cloudflare/
// drizzle imports, plain interfaces only — testable under plain vitest.
//
// Split out of the former monolithic src/domain/evaluation.ts (contention
// decomposition, no behavior change) -- see src/domain/evaluation.ts for
// the re-export barrel.

export interface ReviewerQueueItem {
  submissionId: string;
  ratingsCount: number;
  alreadyRatedByMe: boolean;
  // DEC-845: this reviewer's OWN blended score (computeWeightedScore, see
  // evaluation/scoring.ts), null when they have not scored the submission
  // yet. Optional on input -- callers that don't yet have it can omit it
  // and it reads as null on output -- but always present on every returned
  // item.
  myScore?: number | null;
}

export interface OrderedReviewerQueueItem {
  submissionId: string;
  myScore: number | null;
}

/**
 * Builds a reviewer's queue ordering: returns EVERY item (DEC-561 --
 * completed work sinks to the bottom instead of vanishing), sorted by
 * (alreadyRatedByMe ? 1 : 0) asc first, then ratingsCount asc, then
 * submissionId asc, then original index -- so everything actionable stays
 * fewest-ratings-first ahead of everything already rated by this reviewer.
 * DEC-845: each returned item also carries the reviewer's own `myScore`
 * (passed through verbatim, defaulting to null) -- callers no longer need a
 * second pass over the ordered ids to attach it.
 */
export function buildReviewerQueue(items: ReviewerQueueItem[]): OrderedReviewerQueueItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const aRated = a.item.alreadyRatedByMe ? 1 : 0;
      const bRated = b.item.alreadyRatedByMe ? 1 : 0;
      if (aRated !== bRated) return aRated - bRated;
      if (a.item.ratingsCount !== b.item.ratingsCount) {
        return a.item.ratingsCount - b.item.ratingsCount;
      }
      if (a.item.submissionId !== b.item.submissionId) {
        return a.item.submissionId < b.item.submissionId ? -1 : 1;
      }
      return a.index - b.index;
    })
    .map(({ item }) => ({ submissionId: item.submissionId, myScore: item.myScore ?? null }));
}

/**
 * True when a submission still needs more ratings under the plan's
 * maxEvaluationsPerSubmission cap. With no cap, always true (unbounded).
 */
export function needsMoreRatings(
  item: { ratingsCount: number },
  cap: number | undefined,
): boolean {
  if (cap === undefined) return true;
  return item.ratingsCount < cap;
}

/**
 * DEC-707 (wave-74 amendment): a reviewer's "assigned" denominator must
 * honor the plan's per-submission evaluation cap, or a submission already
 * saturated by OTHER reviewers is permanently "assigned but unreachable" --
 * `completed` can never reach it (the actionable queue,
 * src/routes/review/reviewer.ts, already refuses to let this reviewer rate
 * it), so `reviewerProgressState` never returns 'done' and
 * `/plans/:id/remind` nags a reviewer with nothing left to do.
 *
 * Kept iff this reviewer has already rated it (their own completed work
 * must never be evicted from the denominator -- `completed <= assigned`
 * stays an invariant), OR the submission still needsMoreRatings under the
 * cap. Reuses needsMoreRatings (not a re-typed `>=`) so the actionable
 * queue and this denominator can never drift apart. With no cap, returns
 * `assigned` unchanged (byte-identical -- regression pin).
 */
export function assignedExcludingSaturated<T extends { id: string }>(
  assigned: T[],
  ratingsBySubmissionId: Map<string, number>,
  ratedByThisReviewer: Set<string>,
  maxEvaluations?: number,
): T[] {
  if (maxEvaluations === undefined) return assigned;
  return assigned.filter((item) => {
    if (ratedByThisReviewer.has(item.id)) return true;
    const ratingsCount = ratingsBySubmissionId.get(item.id) ?? 0;
    return needsMoreRatings({ ratingsCount }, maxEvaluations);
  });
}

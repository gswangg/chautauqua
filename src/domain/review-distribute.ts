// DEC-786: even distribution of reviewer assignments, behind a preview.
// DEC-824: a cap per reviewer for this run, plus an honest shortfall.
// Amendment (wave 52): resolve scope the way every other reader does --
// coverage/eligibility must agree with resolveAssignments (src/domain/
// evaluation.ts), not with a flat userId pool that ignores track scope.
// Pure: no clock, no randomness, no node:/cloudflare imports -- the route
// resolves ids/names, this module only decides WHICH pairs to add.
import { DEC_786, DEC_824 } from "../decisions";

void DEC_786; // distributeAssignments below
void DEC_824; // capPerReviewer + shortfall below

export interface DistributePair {
  userId: string;
  submissionId: string;
}

/** Amendment (wave 52): a reviewer's scope for ELIGIBILITY purposes -- broad
 * means "eligible for any submission" (an all-null plan_reviewer row, i.e.
 * DEC-786's 'All submissions', OR simply no trackId-scoped row at all --
 * an explicit single-submission pick never narrows a reviewer's eligibility
 * for OTHER submissions). A non-broad reviewer is eligible only for a
 * submission whose trackIds intersect `trackIds` here. */
export interface DistributeReviewerScope {
  userId: string;
  broad: boolean;
  trackIds: string[];
}

export interface DistributeSubmission {
  id: string;
  trackIds: string[];
}

export interface DistributeAssignmentsInput {
  submissions: DistributeSubmission[];
  reviewers: DistributeReviewerScope[];
  reviewsPerSubmission: number;
  /** Amendment (wave 52): the caller resolves this through the SAME
   * resolution resolveAssignments (src/domain/evaluation.ts) produces --
   * a broad reviewer already covers every submission here, a track-scoped
   * reviewer already covers every submission in their tracks, an explicit
   * single-submission pick covers only that submission. This is coverage
   * and running load, not a record of rows written by a prior run alone. */
  existing: DistributePair[];
  recused: DistributePair[];
  /** DEC-824: this run's own cap -- a reviewer already carrying `capPerReviewer`
   * assignments (existing + everything proposed earlier in this same run) is
   * skipped exactly like a recused reviewer. `null` means uncapped. */
  capPerReviewer: number | null;
}

/** DEC-824: what distributeAssignments could NOT do, per submission, with a
 * closed-vocabulary reason -- an auto-distribute that silently under-fills is
 * worse than none. 'no_eligible_reviewer' also covers a submission whose
 * only remaining reviewers are wrong-track (amendment, wave 52) -- a
 * reviewer who was never eligible is not "at the cap". */
export interface DistributeShortfall {
  submissionId: string;
  missing: number;
  reason: "cap_reached" | "no_eligible_reviewer";
}

export interface DistributeResult {
  created: DistributePair[];
  shortfall: DistributeShortfall[];
}

function pairKey(p: { userId: string; submissionId: string }): string {
  return `${p.userId}::${p.submissionId}`;
}

/**
 * For each submission (in the given order), fills up to
 * `reviewsPerSubmission` distinct reviewers by repeatedly picking the
 * eligible reviewer with the fewest assignments so far -- counting both
 * `existing` pairs (the caller's resolved coverage/load, see
 * DistributeAssignmentsInput.existing) and everything already assigned
 * earlier in this same run -- tiebreaking on ascending userId. Recused
 * pairs, pairs already present in `existing`, reviewers already at
 * `capPerReviewer` (DEC-824), and reviewers whose track scope excludes this
 * submission (amendment, wave 52) are never proposed. A submission left
 * short because the only remaining reviewers are wrong-track reports
 * 'no_eligible_reviewer'; 'cap_reached' is reserved for a reviewer who WAS
 * eligible but at the cap. Returns ONLY the newly proposed pairs (never
 * re-includes `existing`) plus the shortfall this run could not meet, so
 * running this function twice with the first run's `created` folded into
 * `existing` proposes nothing new (idempotent).
 */
export function distributeAssignments(input: DistributeAssignmentsInput): DistributeResult {
  const { submissions, reviewers, reviewsPerSubmission, existing, recused, capPerReviewer } = input;

  const existingKeys = new Set(existing.map(pairKey));
  const recusedKeys = new Set(recused.map(pairKey));

  // Running assignment count per reviewer: starts from `existing` (the
  // caller's resolved coverage/load), then grows as this run proposes new
  // pairs.
  const countByUser = new Map<string, number>();
  for (const r of reviewers) countByUser.set(r.userId, 0);
  for (const pair of existing) {
    if (!countByUser.has(pair.userId)) continue; // reviewer no longer in the pool
    countByUser.set(pair.userId, (countByUser.get(pair.userId) ?? 0) + 1);
  }

  // Per-submission set of reviewers already covering it (existing pairs),
  // so a submission already at/over its target is not double-assigned.
  const coveredBySubmission = new Map<string, Set<string>>();
  for (const pair of existing) {
    const set = coveredBySubmission.get(pair.submissionId) ?? new Set<string>();
    set.add(pair.userId);
    coveredBySubmission.set(pair.submissionId, set);
  }

  const created: DistributePair[] = [];
  const shortfall: DistributeShortfall[] = [];

  for (const submission of submissions) {
    const submissionId = submission.id;
    const covered = coveredBySubmission.get(submissionId) ?? new Set<string>();
    let need = reviewsPerSubmission - covered.size;
    while (need > 0) {
      let best: string | null = null;
      let bestCount = Infinity;
      // DEC-824: a reviewer at the cap is skipped exactly like a recused
      // reviewer -- but we still track whether an ELIGIBLE one existed
      // (ignoring the cap) so the shortfall reason distinguishes "capped
      // out" from "genuinely no one eligible" (which now also covers
      // wrong-track, amendment wave 52).
      let anyEligibleIgnoringCap = false;
      for (const scope of reviewers) {
        const userId = scope.userId;
        if (covered.has(userId)) continue;
        const key = pairKey({ userId, submissionId });
        if (existingKeys.has(key) || recusedKeys.has(key)) continue;
        const eligible = scope.broad || scope.trackIds.some((t) => submission.trackIds.includes(t));
        if (!eligible) continue; // wrong track: never proposed, never counted as "existed"
        anyEligibleIgnoringCap = true;
        const count = countByUser.get(userId) ?? 0;
        if (capPerReviewer !== null && count >= capPerReviewer) continue;
        if (count < bestCount || (count === bestCount && best !== null && userId < best)) {
          best = userId;
          bestCount = count;
        }
      }
      if (best === null) {
        shortfall.push({
          submissionId,
          missing: need,
          reason: anyEligibleIgnoringCap ? "cap_reached" : "no_eligible_reviewer",
        });
        break; // no eligible reviewer left for this submission
      }
      created.push({ userId: best, submissionId });
      covered.add(best);
      coveredBySubmission.set(submissionId, covered);
      countByUser.set(best, (countByUser.get(best) ?? 0) + 1);
      need -= 1;
    }
  }

  return { created, shortfall };
}

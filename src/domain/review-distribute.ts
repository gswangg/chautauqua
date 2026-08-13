// DEC-786: even distribution of reviewer assignments, behind a preview.
// DEC-824: a cap per reviewer for this run, plus an honest shortfall.
// Pure: no clock, no randomness, no node:/cloudflare imports -- the route
// resolves ids/names, this module only decides WHICH pairs to add.
import { DEC_786, DEC_824 } from "../decisions";

void DEC_786; // distributeAssignments below
void DEC_824; // capPerReviewer + shortfall below

export interface DistributePair {
  userId: string;
  submissionId: string;
}

export interface DistributeAssignmentsInput {
  submissionIds: string[];
  reviewerUserIds: string[];
  reviewsPerSubmission: number;
  existing: DistributePair[];
  recused: DistributePair[];
  /** DEC-824: this run's own cap -- a reviewer already carrying `capPerReviewer`
   * assignments (existing + everything proposed earlier in this same run) is
   * skipped exactly like a recused reviewer. `null` means uncapped. */
  capPerReviewer: number | null;
}

/** DEC-824: what distributeAssignments could NOT do, per submission, with a
 * closed-vocabulary reason -- an auto-distribute that silently under-fills is
 * worse than none. */
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
 * `existing` rows and everything already assigned earlier in this same
 * run -- tiebreaking on ascending userId. Recused pairs, pairs already
 * present in `existing`, and (DEC-824) reviewers already at `capPerReviewer`
 * are never proposed. Returns ONLY the newly proposed pairs (never
 * re-includes `existing`) plus the shortfall this run could not meet, so
 * running this function twice with the first run's `created` folded into
 * `existing` proposes nothing new (idempotent).
 */
export function distributeAssignments(input: DistributeAssignmentsInput): DistributeResult {
  const { submissionIds, reviewerUserIds, reviewsPerSubmission, existing, recused, capPerReviewer } = input;

  const existingKeys = new Set(existing.map(pairKey));
  const recusedKeys = new Set(recused.map(pairKey));

  // Running assignment count per reviewer: starts from `existing`, then
  // grows as this run proposes new pairs.
  const countByUser = new Map<string, number>();
  for (const id of reviewerUserIds) countByUser.set(id, 0);
  for (const pair of existing) {
    if (!countByUser.has(pair.userId)) continue; // reviewer no longer in the pool
    countByUser.set(pair.userId, (countByUser.get(pair.userId) ?? 0) + 1);
  }

  // Per-submission set of reviewers already covering it (existing rows),
  // so a submission already at/over its target is not double-assigned.
  const coveredBySubmission = new Map<string, Set<string>>();
  for (const pair of existing) {
    const set = coveredBySubmission.get(pair.submissionId) ?? new Set<string>();
    set.add(pair.userId);
    coveredBySubmission.set(pair.submissionId, set);
  }

  const created: DistributePair[] = [];
  const shortfall: DistributeShortfall[] = [];

  for (const submissionId of submissionIds) {
    const covered = coveredBySubmission.get(submissionId) ?? new Set<string>();
    let need = reviewsPerSubmission - covered.size;
    while (need > 0) {
      let best: string | null = null;
      let bestCount = Infinity;
      // DEC-824: a reviewer at the cap is skipped exactly like a recused
      // reviewer -- but we still track whether one existed (ignoring the
      // cap) so the shortfall reason distinguishes "capped out" from
      // "genuinely no one eligible".
      let anyIgnoringCap = false;
      for (const userId of reviewerUserIds) {
        if (covered.has(userId)) continue;
        const key = pairKey({ userId, submissionId });
        if (existingKeys.has(key) || recusedKeys.has(key)) continue;
        anyIgnoringCap = true;
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
          reason: anyIgnoringCap ? "cap_reached" : "no_eligible_reviewer",
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

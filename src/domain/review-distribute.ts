// DEC-786: even distribution of reviewer assignments, behind a preview.
// Pure: no clock, no randomness, no node:/cloudflare imports -- the route
// resolves ids/names, this module only decides WHICH pairs to add.

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
}

function pairKey(p: { userId: string; submissionId: string }): string {
  return `${p.userId}::${p.submissionId}`;
}

/**
 * For each submission (in the given order), fills up to
 * `reviewsPerSubmission` distinct reviewers by repeatedly picking the
 * eligible reviewer with the fewest assignments so far -- counting both
 * `existing` rows and everything already assigned earlier in this same
 * run -- tiebreaking on ascending userId. Recused pairs and pairs already
 * present in `existing` are never proposed. Returns ONLY the newly
 * proposed pairs (never re-includes `existing`), so running this function
 * twice with the first run's output folded into `existing` proposes
 * nothing new (idempotent).
 */
export function distributeAssignments(input: DistributeAssignmentsInput): DistributePair[] {
  const { submissionIds, reviewerUserIds, reviewsPerSubmission, existing, recused } = input;

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

  for (const submissionId of submissionIds) {
    const covered = coveredBySubmission.get(submissionId) ?? new Set<string>();
    let need = reviewsPerSubmission - covered.size;
    while (need > 0) {
      let best: string | null = null;
      let bestCount = Infinity;
      for (const userId of reviewerUserIds) {
        if (covered.has(userId)) continue;
        const key = pairKey({ userId, submissionId });
        if (existingKeys.has(key) || recusedKeys.has(key)) continue;
        const count = countByUser.get(userId) ?? 0;
        if (count < bestCount || (count === bestCount && best !== null && userId < best)) {
          best = userId;
          bestCount = count;
        }
      }
      if (best === null) break; // no eligible reviewer left for this submission
      created.push({ userId: best, submissionId });
      covered.add(best);
      coveredBySubmission.set(submissionId, covered);
      countByUser.set(best, (countByUser.get(best) ?? 0) + 1);
      need -= 1;
    }
  }

  return created;
}

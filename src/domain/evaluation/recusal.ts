// Evaluation domain core (SPEC J4), pure module (DEC-002): no node:/cloudflare/
// drizzle imports, plain interfaces only — testable under plain vitest.
//
// Recusal (DEC-271, ABS-12): reviewer conflict-of-interest self-exclusion.
// Pure set-partitioning logic lives here; the repo layer has no real-D1 test
// harness, so this is the tested core. Split out of the former monolithic
// src/domain/evaluation.ts (contention decomposition, no behavior change)
// -- see src/domain/evaluation.ts for the re-export barrel.

// DEC-425 wave-67 amendment: the recusal reason's free-text cap, previously
// hand-typed as `500` at the length comparison AND the refusal message in
// src/routes/review/recusals.ts -- single-sourced here so both read the same
// number.
export const MAX_RECUSAL_REASON_LENGTH = 500;

/**
 * Splits a reviewer's queue/scope items into { kept, recused } by
 * submissionId membership in `recusedIds`. Order of `kept` is preserved.
 */
export function partitionRecused<T extends { submissionId: string }>(
  items: T[],
  recusedIds: Set<string>,
): { kept: T[]; recused: T[] } {
  const kept: T[] = [];
  const recused: T[] = [];
  for (const item of items) {
    if (recusedIds.has(item.submissionId)) recused.push(item);
    else kept.push(item);
  }
  return { kept, recused };
}

/**
 * Filters a reviewer's assigned submissions down to those they have not
 * recused themselves from, for progress-endpoint `assigned` counts.
 */
export function assignedExcludingRecused<T extends { id: string }>(
  assigned: T[],
  recusedIds: Set<string>,
): T[] {
  return assigned.filter((item) => !recusedIds.has(item.id));
}

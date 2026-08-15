// DEC-856 amendment: refusals must never name unresolvable rows by their raw
// (ULID) id in a user-facing string -- a producer reading the response can't
// act on an opaque id, and printing it is how a stale-selection refusal ends
// up looking like a bug report instead of a next step. Every "some of your
// selected ids don't resolve" refusal across the app builds its message
// through this ONE helper: a count of what's unresolvable, the names of
// whatever DID resolve (so the caller can see what's still valid), and, when
// nothing resolved at all, an explicit "your selection is stale" sentence
// plus the refresh action -- never the id list itself.
export function describeUnresolvedSelection(
  resolvedNames: string[],
  missingCount: number,
  refreshHint: string,
): string {
  if (resolvedNames.length === 0) {
    return `selection is stale -- none of the selected rows could be found; ${refreshHint}`;
  }
  const noun = missingCount === 1 ? "row" : "rows";
  return `${missingCount} selected ${noun} no longer available; only ${resolvedNames.join(", ")} could be resolved -- ${refreshHint}`;
}

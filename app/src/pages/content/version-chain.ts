import { DELIVERABLE_KINDS, type DeliverableFile, type DeliverableKind } from './types';

/**
 * Orders a flat list of files belonging to ONE version chain newest-first,
 * by following previousFileId links (DEC-020: the chain). A file is a
 * "head" (latest version) when no other file in the set points at it via
 * previousFileId. There should normally be exactly one head per kind, but
 * this tolerates multiple independent chains (e.g. stale data) by ordering
 * heads newest-created-first and walking each chain to completion before
 * moving to the next head.
 */
export function orderVersionsNewestFirst(files: DeliverableFile[]): DeliverableFile[] {
  return orderVersionChains(files).flat();
}

/**
 * Same traversal as orderVersionsNewestFirst, but keeps each independent
 * previousFileId chain as its own sub-array (chains newest-head-first,
 * chains themselves ordered by their head's createdAt, newest first).
 * Two files sharing a `kind` are NOT necessarily versions of the same
 * document (e.g. a task-upload chain and a separately-uploaded organizer
 * chain can coexist for one submission+kind) -- callers that compute a
 * "v2/v3" label must number within a file's own chain, not by its flat
 * position across every chain, or unrelated documents get mislabeled as
 * later/earlier versions of each other.
 */
export function orderVersionChains(files: DeliverableFile[]): DeliverableFile[][] {
  const byId = new Map(files.map((f) => [f.id, f]));
  const referencedAsPrevious = new Set(files.map((f) => f.previousFileId).filter((id): id is string => id !== null));

  const heads = files
    .filter((f) => !referencedAsPrevious.has(f.id))
    .sort((a, b) => b.createdAt - a.createdAt);

  const chains: DeliverableFile[][] = [];
  const visited = new Set<string>();

  for (const head of heads) {
    const chain: DeliverableFile[] = [];
    let current: DeliverableFile | undefined = head;
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      chain.push(current);
      current = current.previousFileId ? byId.get(current.previousFileId) : undefined;
    }
    if (chain.length > 0) chains.push(chain);
  }

  // Any files not reachable from a head (broken chain data) still get shown,
  // newest first, rather than silently dropped -- each treated as its own
  // one-file "chain" so it never inherits another chain's version numbers.
  const stragglers = files.filter((f) => !visited.has(f.id)).sort((a, b) => b.createdAt - a.createdAt);
  for (const straggler of stragglers) {
    chains.push([straggler]);
  }

  return chains;
}

/**
 * Groups a flat file list by deliverable kind, each group ordered
 * newest-first via orderVersionsNewestFirst. Always returns all three kinds
 * (possibly empty) so the detail view can render three groups unconditionally.
 */
export function groupByKindNewestFirst(files: DeliverableFile[]): Record<DeliverableKind, DeliverableFile[]> {
  const result = {} as Record<DeliverableKind, DeliverableFile[]>;
  for (const kind of DELIVERABLE_KINDS) {
    result[kind] = orderVersionsNewestFirst(files.filter((f) => f.kind === kind));
  }
  return result;
}

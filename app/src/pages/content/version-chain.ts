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
  const byId = new Map(files.map((f) => [f.id, f]));
  const referencedAsPrevious = new Set(files.map((f) => f.previousFileId).filter((id): id is string => id !== null));

  const heads = files
    .filter((f) => !referencedAsPrevious.has(f.id))
    .sort((a, b) => b.createdAt - a.createdAt);

  const ordered: DeliverableFile[] = [];
  const visited = new Set<string>();

  for (const head of heads) {
    let current: DeliverableFile | undefined = head;
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      ordered.push(current);
      current = current.previousFileId ? byId.get(current.previousFileId) : undefined;
    }
  }

  // Any files not reachable from a head (broken chain data) still get shown,
  // newest first, rather than silently dropped.
  const stragglers = files.filter((f) => !visited.has(f.id)).sort((a, b) => b.createdAt - a.createdAt);

  return [...ordered, ...stragglers];
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

// Files repo — deliverable version-chain grouping. Split out of
// files-library.ts (contention decomposition) — files-library.ts
// re-exports everything below for existing callers.
//
// DEC-344: findRoot/loadDeliverableChains are bounded by whatever ids the
// caller already loaded (never a whole-event scan on their own).
import { inArray } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { chunkIds } from "../../lib/chunk";

export interface DeliverableFileRow {
  id: string;
  submissionId: string;
  kind: string;
  filename: string;
  previousFileId: string | null;
  createdAt: Date;
  sizeBytes: number;
  uploadedByContactId: string | null;
  // DEC-818/DEC-902: this file's own stored version number (identity, not
  // chain position) — the library's VERSION column reads this, never
  // versionCount (a chain-length marker).
  versionNo: number | null;
}

/** Follows previous_file_id links to find the oldest ancestor ('root') of
 * `fileId` within `byId` — used to group a submission's files into version
 * chains. Bounded by the number of files loaded into `byId` (never the
 * whole event, per DEC-344), so a plain loop rather than a recursive CTE.
 * Exported so other page-scoped hydration passes (e.g. the submissions list's
 * latestFile field) reuse this chain-grouping logic rather than re-deriving
 * it (DEC-686/DEC-344). */
export function findRoot(fileId: string, byId: Map<string, DeliverableFileRow>): string {
  let current = byId.get(fileId);
  if (!current) throw new Error(`findRoot: file ${fileId} not in the loaded set`);
  const visited = new Set<string>([fileId]);
  while (current.previousFileId) {
    if (visited.has(current.previousFileId)) {
      throw new Error(`findRoot: previous_file_id cycle detected at ${current.previousFileId}`);
    }
    const parent = byId.get(current.previousFileId);
    if (!parent) break; // parent outside the loaded set — treat current as root
    visited.add(parent.id);
    current = parent;
  }
  return current.id;
}

/** Loads every file row for `submissionIds` (chunked, never the whole
 * event — DEC-344) and groups them into version chains keyed by root id
 * via findRoot. Shared by the page hydration and the totalSizeBytes
 * aggregate below so both walk chains the same way. */
export async function loadDeliverableChains(db: Db, submissionIds: string[]): Promise<Map<string, DeliverableFileRow[]>> {
  const fileRows: DeliverableFileRow[] = [];
  for (const batch of chunkIds(submissionIds)) {
    const batchRows = await db
      .select({
        id: schema.file.id,
        submissionId: schema.file.submissionId,
        kind: schema.file.kind,
        filename: schema.file.filename,
        previousFileId: schema.file.previousFileId,
        createdAt: schema.file.createdAt,
        sizeBytes: schema.file.sizeBytes,
        uploadedByContactId: schema.file.uploadedByContactId,
        versionNo: schema.file.versionNo,
      })
      .from(schema.file)
      .where(inArray(schema.file.submissionId, batch));
    for (const r of batchRows) {
      if (r.submissionId) fileRows.push({ ...r, submissionId: r.submissionId });
    }
  }
  const byId = new Map(fileRows.map((f) => [f.id, f]));
  const chains = new Map<string, DeliverableFileRow[]>();
  for (const f of fileRows) {
    const root = findRoot(f.id, byId);
    const arr = chains.get(root) ?? [];
    arr.push(f);
    chains.set(root, arr);
  }
  return chains;
}

export function latestOf(chain: DeliverableFileRow[]): DeliverableFileRow {
  let latest = chain[0]!;
  for (const f of chain) {
    if (f.createdAt.getTime() > latest.createdAt.getTime()) latest = f;
  }
  return latest;
}

// Files repo — version-chain lookups (J8, DEC-020 contract). Split out of
// files-versions.ts (contention decomposition) — no behavior change,
// files-versions.ts re-exports everything below for existing callers.

import { eq, inArray } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { chunkIds } from "../../lib/chunk";
import { DEC_244 } from "../../decisions";

void DEC_244;

/** Loads the submission id + kind of the file `replacesFileId` points at, for
 * the DEC-020 version-chain rule — null if it doesn't exist. */
export async function getReplacesTarget(
  db: Db,
  replacesFileId: string,
): Promise<{ submissionId: string | null; kind: string } | null> {
  const rows = await db
    .select({ submissionId: schema.file.submissionId, kind: schema.file.kind })
    .from(schema.file)
    .where(eq(schema.file.id, replacesFileId))
    .limit(1);
  return rows[0] ?? null;
}

/** DEC-818: `fileId`'s own stored version number — a version number is an
 * identity, not a position among the survivors, so this reads the column
 * set at insert time (see insertFile in files-versions-write.ts) rather than
 * re-deriving it from chain position. Throws (data corruption, never a
 * normal state) when the row is missing or its version_no was never stored —
 * a chain-position fallback would silently renumber a deleted version's
 * later siblings, which is exactly the bug DEC-818 closes. */
export async function getFileVersionNumber(db: Db, fileId: string): Promise<number> {
  const rows = await db
    .select({ versionNo: schema.file.versionNo })
    .from(schema.file)
    .where(eq(schema.file.id, fileId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error(`getFileVersionNumber: file ${fileId} not found — data corruption`);
  if (row.versionNo === null || row.versionNo === undefined) {
    throw new Error(`getFileVersionNumber: file ${fileId} has no stored version_no — data corruption`);
  }
  return row.versionNo;
}

export interface TaskFileChainLatest {
  id: string;
  filename: string;
  contentType: string;
  r2Key: string;
  createdAt: number;
}

/** DEC-244: given a task_assignment's linked completion file id, walks
 * FORWARD along previous_file_id (i.e. finds the file whose
 * previous_file_id points at the current one, repeatedly) to the newest
 * file in the chain. Task-assignment uploads always chain forward from the
 * assignment's stored file id (DEC-240), and an organizer may separately
 * replace the same underlying deliverable via
 * POST /api/v1/submissions/:id/files (when the file is linked to a
 * submission) without ever rewriting task_assignment.file_id — so the
 * assignment's stored id can lag behind the true latest version. This is
 * the sole resolution path for both the portal download route and the
 * portal comment-thread anchor (DEC-244: "do NOT reuse the organizer
 * /files route"). Bounded by chain length; throws on a previous_file_id
 * cycle or a missing row (data corruption, never a normal state). */
export async function resolveTaskFileChainLatest(db: Db, fileId: string): Promise<TaskFileChainLatest> {
  let current = fileId;
  const visited = new Set<string>([current]);
  for (;;) {
    const nextRows = await db
      .select({ id: schema.file.id })
      .from(schema.file)
      .where(eq(schema.file.previousFileId, current))
      .limit(1);
    const next = nextRows[0];
    if (!next) break;
    if (visited.has(next.id)) {
      throw new Error(`resolveTaskFileChainLatest: previous_file_id cycle detected at ${next.id}`);
    }
    visited.add(next.id);
    current = next.id;
  }

  const rows = await db
    .select({
      id: schema.file.id,
      filename: schema.file.filename,
      contentType: schema.file.contentType,
      r2Key: schema.file.r2Key,
      createdAt: schema.file.createdAt,
    })
    .from(schema.file)
    .where(eq(schema.file.id, current))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error(`resolveTaskFileChainLatest: file ${current} not found — data corruption`);
  return { id: row.id, filename: row.filename, contentType: row.contentType, r2Key: row.r2Key, createdAt: row.createdAt.getTime() };
}

/** DEC-530 (wave 48 amendment): batched form of resolveTaskFileChainLatest —
 * resolves the chain-latest file for EVERY id in `fileIds` with a query
 * count proportional to chain DEPTH, not chain COUNT. Walks the whole
 * frontier (every owner's current chain position that hasn't yet
 * terminated) forward one hop per round trip: `where previous_file_id IN
 * (frontier)`, chunked for D1's bound-parameter ceiling. Each owner keeps
 * its own visited set (same cycle guard as the singular walk, now per
 * chain rather than shared) and its own throw message naming the id where
 * the cycle was found. Once every owner has terminated, one batched fetch
 * resolves the terminal rows. Returned map is keyed by the INPUT fileId
 * (not the resolved latest id), one entry per unique input id — mirrors
 * resolveTaskFileChainLatest's return shape exactly, just plural. */
export async function resolveTaskFileChainLatestMany(
  db: Db,
  fileIds: string[],
): Promise<Map<string, TaskFileChainLatest>> {
  const out = new Map<string, TaskFileChainLatest>();
  const uniqueIds = [...new Set(fileIds)];
  if (uniqueIds.length === 0) return out;

  const current = new Map<string, string>(uniqueIds.map((id) => [id, id]));
  const visited = new Map<string, Set<string>>(uniqueIds.map((id) => [id, new Set([id])]));
  let active = new Set<string>(uniqueIds);

  while (active.size > 0) {
    const frontierIds = [...new Set([...active].map((owner) => current.get(owner) as string))];
    const nextByPrev = new Map<string, string>();
    for (const batch of chunkIds(frontierIds)) {
      if (batch.length === 0) continue;
      const rows = await db
        .select({ id: schema.file.id, previousFileId: schema.file.previousFileId })
        .from(schema.file)
        .where(inArray(schema.file.previousFileId, batch));
      for (const row of rows) {
        if (row.previousFileId) nextByPrev.set(row.previousFileId, row.id);
      }
    }

    const stillActive = new Set<string>();
    for (const owner of active) {
      const pos = current.get(owner) as string;
      const next = nextByPrev.get(pos);
      if (!next) continue; // terminated: pos is the chain latest
      const ownerVisited = visited.get(owner) as Set<string>;
      if (ownerVisited.has(next)) {
        throw new Error(`resolveTaskFileChainLatestMany: previous_file_id cycle detected at ${next}`);
      }
      ownerVisited.add(next);
      current.set(owner, next);
      stillActive.add(owner);
    }
    active = stillActive;
  }

  const finalIds = [...new Set([...current.values()])];
  const byId = new Map<
    string,
    { id: string; filename: string; contentType: string; r2Key: string; createdAt: Date }
  >();
  for (const batch of chunkIds(finalIds)) {
    if (batch.length === 0) continue;
    const rows = await db
      .select({
        id: schema.file.id,
        filename: schema.file.filename,
        contentType: schema.file.contentType,
        r2Key: schema.file.r2Key,
        createdAt: schema.file.createdAt,
      })
      .from(schema.file)
      .where(inArray(schema.file.id, batch));
    for (const row of rows) byId.set(row.id, row);
  }

  for (const [owner, pos] of current) {
    const row = byId.get(pos);
    if (!row) throw new Error(`resolveTaskFileChainLatestMany: file ${pos} not found — data corruption`);
    out.set(owner, {
      id: row.id,
      filename: row.filename,
      contentType: row.contentType,
      r2Key: row.r2Key,
      createdAt: row.createdAt.getTime(),
    });
  }
  return out;
}

/** DEC-573: the full version chain for `fileId`, oldest-first — walks BACK
 * via previous_file_id to the chain root, then FORWARD from the root (the
 * row whose previous_file_id points at the current one, repeated) to the
 * newest link. A comment thread belongs to this whole chain, not to one file
 * row, so callers that need "every comment on this deliverable" must resolve
 * this first. Guards cycles with a visited set on both walks and throws on a
 * missing row mid-chain (data corruption, never a normal state) — mirrors
 * resolveTaskFileChainLatest's forward walk exactly. */
export async function listFileChainIds(db: Db, fileId: string): Promise<string[]> {
  // Walk back to the root.
  let root = fileId;
  const backVisited = new Set<string>([root]);
  for (;;) {
    const rows = await db
      .select({ previousFileId: schema.file.previousFileId })
      .from(schema.file)
      .where(eq(schema.file.id, root))
      .limit(1);
    const row = rows[0];
    if (!row) throw new Error(`listFileChainIds: file ${root} not found mid-chain — data corruption`);
    if (!row.previousFileId) break;
    if (backVisited.has(row.previousFileId)) {
      throw new Error(`listFileChainIds: previous_file_id cycle detected at ${row.previousFileId}`);
    }
    backVisited.add(row.previousFileId);
    root = row.previousFileId;
  }

  // Walk forward from the root, collecting ids oldest-first.
  const ids = [root];
  const forwardVisited = new Set<string>([root]);
  let current = root;
  for (;;) {
    const nextRows = await db
      .select({ id: schema.file.id })
      .from(schema.file)
      .where(eq(schema.file.previousFileId, current))
      .limit(1);
    const next = nextRows[0];
    if (!next) break;
    if (forwardVisited.has(next.id)) {
      throw new Error(`listFileChainIds: previous_file_id cycle detected at ${next.id}`);
    }
    forwardVisited.add(next.id);
    ids.push(next.id);
    current = next.id;
  }
  return ids;
}

export interface FileChainVersionRow {
  id: string;
  filename: string;
  contentType: string;
  r2Key: string;
  createdAt: number;
  /** DEC-927: the row's own stored version_no (DEC-818 identity), fetched in
   * the same batch query as the rest of this row — callers that need "which
   * version number is this" must not issue a second per-row query for it. */
  versionNo: number;
}

/** DEC-605: the full version chain for `fileId`, oldest-first, with the
 * fields a speaker-side version-history view needs to render a row and
 * stream a download for each one (portal GET .../file/:fileId). Thin
 * wrapper over listFileChainIds — a batch fetch keyed by the ids it
 * returns, so this stays one extra query, not N. Throws (data corruption)
 * if an id it just resolved is missing from the batch fetch, or if a row's
 * version_no was never stored (DEC-927 — same corruption case
 * getFileVersionNumber guards). */
export async function listFileChainVersions(db: Db, fileId: string): Promise<FileChainVersionRow[]> {
  const ids = await listFileChainIds(db, fileId);
  const rows = await db
    .select({
      id: schema.file.id,
      filename: schema.file.filename,
      contentType: schema.file.contentType,
      r2Key: schema.file.r2Key,
      createdAt: schema.file.createdAt,
      versionNo: schema.file.versionNo,
    })
    .from(schema.file)
    .where(inArray(schema.file.id, ids));
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id) => {
    const row = byId.get(id);
    if (!row) {
      throw new Error(`listFileChainVersions: file ${id} resolved by listFileChainIds but missing from batch fetch — data corruption`);
    }
    if (row.versionNo === null || row.versionNo === undefined) {
      throw new Error(`listFileChainVersions: file ${id} has no stored version_no — data corruption`);
    }
    return {
      id: row.id,
      filename: row.filename,
      contentType: row.contentType,
      r2Key: row.r2Key,
      createdAt: row.createdAt.getTime(),
      versionNo: row.versionNo,
    };
  });
}

/** DEC-530 (wave 48 amendment): batched form of listFileChainVersions —
 * resolves the full oldest-first version chain for EVERY id in `fileIds`
 * with a query count proportional to chain DEPTH, not chain COUNT. Two
 * frontier walks, each one chunked query per depth over the WHOLE current
 * frontier: first BACKWARD (`where id IN (frontier)`, reading each owner's
 * own previous_file_id column) to find every owner's chain root, then
 * FORWARD from the root (`where previous_file_id IN (frontier)`) collecting
 * ids oldest-first — same two-phase walk as listFileChainIds, just batched
 * across owners. A single batched fetch over the union of every resolved id
 * then assembles the rows. Same cycle guards and same missing-row/missing-
 * version_no throws as the singular functions, per owner. Returned map is
 * keyed by the INPUT fileId, one entry per unique input id. */
export async function listFileChainVersionsMany(
  db: Db,
  fileIds: string[],
): Promise<Map<string, FileChainVersionRow[]>> {
  const out = new Map<string, FileChainVersionRow[]>();
  const uniqueIds = [...new Set(fileIds)];
  if (uniqueIds.length === 0) return out;

  // --- Phase 1: walk backward to each owner's chain root. ---
  const backCurrent = new Map<string, string>(uniqueIds.map((id) => [id, id]));
  const backVisited = new Map<string, Set<string>>(uniqueIds.map((id) => [id, new Set([id])]));
  let backActive = new Set<string>(uniqueIds);

  while (backActive.size > 0) {
    const frontierIds = [...new Set([...backActive].map((owner) => backCurrent.get(owner) as string))];
    const prevById = new Map<string, string | null>();
    for (const batch of chunkIds(frontierIds)) {
      if (batch.length === 0) continue;
      const rows = await db
        .select({ id: schema.file.id, previousFileId: schema.file.previousFileId })
        .from(schema.file)
        .where(inArray(schema.file.id, batch));
      for (const row of rows) prevById.set(row.id, row.previousFileId);
    }

    const stillActive = new Set<string>();
    for (const owner of backActive) {
      const pos = backCurrent.get(owner) as string;
      if (!prevById.has(pos)) {
        throw new Error(`listFileChainVersionsMany: file ${pos} not found mid-chain — data corruption`);
      }
      const prev = prevById.get(pos) ?? null;
      if (!prev) continue; // pos is the chain root
      const ownerVisited = backVisited.get(owner) as Set<string>;
      if (ownerVisited.has(prev)) {
        throw new Error(`listFileChainVersionsMany: previous_file_id cycle detected at ${prev}`);
      }
      ownerVisited.add(prev);
      backCurrent.set(owner, prev);
      stillActive.add(owner);
    }
    backActive = stillActive;
  }
  const rootByOwner = backCurrent; // owner -> chain root id

  // --- Phase 2: walk forward from each owner's root, collecting ids. ---
  const idsByOwner = new Map<string, string[]>(uniqueIds.map((id) => [id, [rootByOwner.get(id) as string]]));
  const fwdCurrent = new Map<string, string>(rootByOwner);
  const fwdVisited = new Map<string, Set<string>>(
    uniqueIds.map((id) => [id, new Set([rootByOwner.get(id) as string])]),
  );
  let fwdActive = new Set<string>(uniqueIds);

  while (fwdActive.size > 0) {
    const frontierIds = [...new Set([...fwdActive].map((owner) => fwdCurrent.get(owner) as string))];
    const nextByPrev = new Map<string, string>();
    for (const batch of chunkIds(frontierIds)) {
      if (batch.length === 0) continue;
      const rows = await db
        .select({ id: schema.file.id, previousFileId: schema.file.previousFileId })
        .from(schema.file)
        .where(inArray(schema.file.previousFileId, batch));
      for (const row of rows) {
        if (row.previousFileId) nextByPrev.set(row.previousFileId, row.id);
      }
    }

    const stillActive = new Set<string>();
    for (const owner of fwdActive) {
      const pos = fwdCurrent.get(owner) as string;
      const next = nextByPrev.get(pos);
      if (!next) continue;
      const ownerVisited = fwdVisited.get(owner) as Set<string>;
      if (ownerVisited.has(next)) {
        throw new Error(`listFileChainVersionsMany: previous_file_id cycle detected at ${next}`);
      }
      ownerVisited.add(next);
      (idsByOwner.get(owner) as string[]).push(next);
      fwdCurrent.set(owner, next);
      stillActive.add(owner);
    }
    fwdActive = stillActive;
  }

  // --- Phase 3: one batched fetch over the union of every resolved id. ---
  const allIds = [...new Set([...idsByOwner.values()].flat())];
  const byId = new Map<
    string,
    { id: string; filename: string; contentType: string; r2Key: string; createdAt: Date; versionNo: number | null }
  >();
  for (const batch of chunkIds(allIds)) {
    if (batch.length === 0) continue;
    const rows = await db
      .select({
        id: schema.file.id,
        filename: schema.file.filename,
        contentType: schema.file.contentType,
        r2Key: schema.file.r2Key,
        createdAt: schema.file.createdAt,
        versionNo: schema.file.versionNo,
      })
      .from(schema.file)
      .where(inArray(schema.file.id, batch));
    for (const row of rows) byId.set(row.id, row);
  }

  for (const owner of uniqueIds) {
    const ids = idsByOwner.get(owner) as string[];
    out.set(
      owner,
      ids.map((id) => {
        const row = byId.get(id);
        if (!row) {
          throw new Error(
            `listFileChainVersionsMany: file ${id} resolved by the frontier walk but missing from batch fetch — data corruption`,
          );
        }
        if (row.versionNo === null || row.versionNo === undefined) {
          throw new Error(`listFileChainVersionsMany: file ${id} has no stored version_no — data corruption`);
        }
        return {
          id: row.id,
          filename: row.filename,
          contentType: row.contentType,
          r2Key: row.r2Key,
          createdAt: row.createdAt.getTime(),
          versionNo: row.versionNo,
        };
      }),
    );
  }
  return out;
}

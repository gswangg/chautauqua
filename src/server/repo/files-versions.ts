// Files repo — version-chain lookups + writes + per-submission reads (J8,
// DEC-020 contract). Split out of files.ts (contention decomposition) — no
// behavior change, files.ts re-exports everything below for existing callers.

import { asc, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId } from "../../domain/ids";
import type { FileKind } from "../../domain/files";
import { chunkIds } from "../../lib/chunk";
import { DEC_244, DEC_713, DEC_818, DEC_965 } from "../../decisions";

void DEC_244;
void DEC_713;
void DEC_818;
void DEC_965;

// ---------------------------------------------------------------------------
// Version-chain lookups
// ---------------------------------------------------------------------------

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
 * set at insert time (see insertFile below) rather than re-deriving it from
 * chain position. Throws (data corruption, never a normal state) when the
 * row is missing or its version_no was never stored — a chain-position
 * fallback would silently renumber a deleted version's later siblings,
 * which is exactly the bug DEC-818 closes. */
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

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export interface InsertFileInput {
  // nullable: resource files (task_assignment handouts, headshots, standalone
  // resources) aren't attached to a submission — matches the schema column.
  submissionId: string | null;
  kind: FileKind;
  filename: string;
  r2Key: string;
  sizeBytes: number;
  contentType: string;
  previousFileId: string | null;
  uploadedByContactId: string | null;
  // DEC-248 amendment (wave 10): set when this file is the answer to a
  // kind='form' task field, so getTaskFileScope can resolve the population.
  // Optional — every existing caller omits it and gets today's behaviour.
  taskAssignmentId?: string | null;
}

/** DEC-818: assigns the new row's own version_no — 1 + the predecessor's
 * stored version_no when chaining onto an existing file, else 1 for a new
 * chain. `previousFileId` always names the current head of its chain (the
 * DEC-020 version-chain contract this repo already enforces elsewhere), so
 * the predecessor's own version_no IS the chain max — no extra chain walk
 * needed. Throws if the predecessor has no stored version_no (data
 * corruption: every row past migration 0025 has one). */
export async function insertFile(db: Db, input: InsertFileInput): Promise<string> {
  const id = newId();
  const now = new Date();

  let versionNo = 1;
  if (input.previousFileId) {
    const predRows = await db
      .select({ versionNo: schema.file.versionNo })
      .from(schema.file)
      .where(eq(schema.file.id, input.previousFileId))
      .limit(1);
    const pred = predRows[0];
    if (!pred || pred.versionNo === null || pred.versionNo === undefined) {
      throw new Error(`insertFile: predecessor ${input.previousFileId} has no stored version_no — data corruption`);
    }
    versionNo = pred.versionNo + 1;
  }

  await db.insert(schema.file).values({
    id,
    submissionId: input.submissionId,
    kind: input.kind,
    filename: input.filename,
    r2Key: input.r2Key,
    sizeBytes: input.sizeBytes,
    contentType: input.contentType,
    previousFileId: input.previousFileId,
    versionNo,
    uploadedByContactId: input.uploadedByContactId,
    taskAssignmentId: input.taskAssignmentId ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

// ---------------------------------------------------------------------------
// DEC-601: a file version's uploader name, resolved server-side
// ---------------------------------------------------------------------------

/** ONE batched contact lookup for `contactIds` (deduped, chunked for D1's
 * bound-parameter ceiling) -- callers pass only the ids present on the page
 * being returned, never the whole table. A contact id with no matching row
 * is simply absent from the returned map (deleted contact); callers treat a
 * missing map entry the same as a null uploadedByContactId. */
export async function batchContactNames(db: Db, contactIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(contactIds)];
  const out = new Map<string, string>();
  for (const batch of chunkIds(uniqueIds)) {
    if (batch.length === 0) continue;
    const rows = await db
      .select({ id: schema.contact.id, firstName: schema.contact.firstName, lastName: schema.contact.lastName })
      .from(schema.contact)
      .where(inArray(schema.contact.id, batch));
    for (const c of rows) out.set(c.id, `${c.firstName} ${c.lastName}`.trim());
  }
  return out;
}

// ---------------------------------------------------------------------------
// Reads: deliverables grouped by kind, versions newest-first
// ---------------------------------------------------------------------------

export interface FileVersion {
  id: string;
  filename: string;
  sizeBytes: number;
  contentType: string;
  previousFileId: string | null;
  uploadedByContactId: string | null;
  createdAt: number;
  /** DEC-965: the row's own stored version_no (DEC-818 identity) — carried
   * end-to-end instead of re-derived from chain position. */
  versionNo: number;
}

export type FilesByKind = Record<string, FileVersion[]>;

/** Every file on the submission, grouped by kind, newest-first within each
 * kind's version chain. */
export async function listSubmissionFiles(db: Db, submissionId: string): Promise<FilesByKind> {
  const rows = await db
    .select({
      id: schema.file.id,
      kind: schema.file.kind,
      filename: schema.file.filename,
      sizeBytes: schema.file.sizeBytes,
      contentType: schema.file.contentType,
      previousFileId: schema.file.previousFileId,
      uploadedByContactId: schema.file.uploadedByContactId,
      createdAt: schema.file.createdAt,
      versionNo: schema.file.versionNo,
    })
    .from(schema.file)
    .where(eq(schema.file.submissionId, submissionId))
    .orderBy(desc(schema.file.createdAt), asc(schema.file.id));

  const grouped: FilesByKind = {};
  for (const row of rows) {
    if (row.versionNo === null || row.versionNo === undefined) {
      throw new Error(`listSubmissionFiles: file ${row.id} has no stored version_no -- data corruption`);
    }
    const version: FileVersion = {
      id: row.id,
      filename: row.filename,
      sizeBytes: row.sizeBytes,
      contentType: row.contentType,
      previousFileId: row.previousFileId,
      uploadedByContactId: row.uploadedByContactId,
      createdAt: row.createdAt.getTime(),
      versionNo: row.versionNo,
    };
    (grouped[row.kind] ??= []).push(version);
  }
  return grouped;
}

// ---------------------------------------------------------------------------
// DEC-713: deleting a version — authz scope + the chain-relink/re-home write
// ---------------------------------------------------------------------------

export interface FileDeleteScope {
  id: string;
  submissionId: string | null;
  eventId: string | null;
  orgId: string | null;
  filename: string;
  r2Key: string;
  previousFileId: string | null;
  uploadedByContactId: string | null;
  contentStatus: string | null;
  /** submission status — feeds canEditSubmission (DEC-041 edit-lock). */
  status: string | null;
  /** DAY LABEL close date in epoch ms, or null when the submission has no
   * form — mirrors SubmissionScope.formCloseDate. */
  formCloseDate: number | null;
  /** owning event's IANA timezone — isFormClosed expands closeDate in this zone. */
  timezone: string | null;
  /** true when no other file's previous_file_id points at this one — i.e.
   * this is the newest link in its own version chain (DEC-713: a speaker may
   * only delete the LATEST version they uploaded). */
  isLatestInChain: boolean;
}

/** Loads everything the DEC-713 delete route needs to authz + act on a file
 * version: submission/org/contentStatus (for the speaker "own latest,
 * pending" rule), and whether this file is the chain head (no successor). */
export async function getFileDeleteScope(db: Db, fileId: string): Promise<FileDeleteScope | null> {
  const fileRows = await db
    .select({
      id: schema.file.id,
      submissionId: schema.file.submissionId,
      filename: schema.file.filename,
      r2Key: schema.file.r2Key,
      previousFileId: schema.file.previousFileId,
      uploadedByContactId: schema.file.uploadedByContactId,
    })
    .from(schema.file)
    .where(eq(schema.file.id, fileId))
    .limit(1);
  const fileRow = fileRows[0];
  if (!fileRow) return null;

  let orgId: string | null = null;
  let eventId: string | null = null;
  let contentStatus: string | null = null;
  let status: string | null = null;
  let formCloseDate: number | null = null;
  let timezone: string | null = null;
  if (fileRow.submissionId) {
    const subRows = await db
      .select({
        eventId: schema.submission.eventId,
        orgId: schema.event.orgId,
        contentStatus: schema.submission.contentStatus,
        status: schema.submission.status,
        formCloseDate: schema.form.closeDate,
        timezone: schema.event.timezone,
      })
      .from(schema.submission)
      .innerJoin(schema.event, eq(schema.submission.eventId, schema.event.id))
      .leftJoin(schema.form, eq(schema.submission.formId, schema.form.id))
      .where(eq(schema.submission.id, fileRow.submissionId))
      .limit(1);
    const sub = subRows[0];
    if (sub) {
      orgId = sub.orgId;
      eventId = sub.eventId;
      contentStatus = sub.contentStatus;
      status = sub.status;
      formCloseDate = sub.formCloseDate ? sub.formCloseDate.getTime() : null;
      timezone = sub.timezone;
    }
  }

  const successorRows = await db
    .select({ id: schema.file.id })
    .from(schema.file)
    .where(eq(schema.file.previousFileId, fileId))
    .limit(1);

  return {
    id: fileRow.id,
    submissionId: fileRow.submissionId,
    eventId,
    orgId,
    filename: fileRow.filename,
    r2Key: fileRow.r2Key,
    previousFileId: fileRow.previousFileId,
    uploadedByContactId: fileRow.uploadedByContactId,
    contentStatus,
    status,
    formCloseDate,
    timezone,
    isLatestInChain: successorRows.length === 0,
  };
}

export interface DeleteFileVersionInput {
  fileId: string;
  deletedByUserId: string;
  deletedByContactId: string | null;
}

/** DEC-713 write: repoints the chain across the deleted row's gap in ONE
 * statement (a middle deletion must never fork the chain, DEC-244/573), then
 * re-homes the deleted row's comment thread onto the surviving neighbour —
 * the successor that takes over the vacated slot if one exists, else the
 * predecessor, else (a single-version chain) the comments are removed with
 * the row. Appends a system note ("Removed version N - <filename>") to the
 * surviving thread.
 *
 * DEC-926: also re-homes (never deletes) any task_assignment row pointing at
 * the deleted file id, set-based on file_id — when a surviving link exists
 * (successor or predecessor) the assignment's file_id follows it to that
 * surviving id; when this was the sole version in its chain, the assignment
 * is reopened instead (status back to 'pending', completed_at/completed_by/
 * file_id cleared) rather than left pointing at a row that no longer exists.
 * A task_assignment row is never deleted here — completion state must
 * survive its linked file's deletion.
 *
 * DEC-713 ordering (amended wave 50): the caller (the route) commits THIS
 * row-delete FIRST and only deletes the R2 object afterwards, logging and
 * swallowing a store.delete failure rather than rethrowing it — this
 * function never touches R2, so a throw here can't orphan an object, only
 * leave the row (and its bytes) still present. A committed row-delete must
 * never be reported as a failure just because the object cleanup failed. */
export async function deleteFileVersion(db: Db, input: DeleteFileVersionInput): Promise<void> {
  const { fileId } = input;
  const rows = await db
    .select({ id: schema.file.id, previousFileId: schema.file.previousFileId, filename: schema.file.filename })
    .from(schema.file)
    .where(eq(schema.file.id, fileId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error(`deleteFileVersion: file ${fileId} not found`);

  // DEC-818: the deleted row's OWN stored version number — the repoint
  // below is a pure re-link (nothing else ever writes version_no), so
  // deleting a middle version never renumbers the survivors, and this note
  // stays correct even after later versions are deleted in turn.
  const versionNumber = await getFileVersionNumber(db, fileId);

  const successorRows = await db
    .select({ id: schema.file.id })
    .from(schema.file)
    .where(eq(schema.file.previousFileId, fileId))
    .limit(1);
  const successor = successorRows[0] ?? null;

  let survivingId: string | null = null;
  if (successor) {
    survivingId = successor.id;
    // DEC-244/573: set-based repoint — every row chained off the deleted
    // link (in a linear chain, at most one) moves in ONE statement, so a
    // middle deletion can't fork the chain.
    await db.update(schema.file).set({ previousFileId: row.previousFileId }).where(eq(schema.file.previousFileId, fileId));
  } else if (row.previousFileId) {
    survivingId = row.previousFileId;
  }

  if (survivingId) {
    await db.update(schema.fileComment).set({ fileId: survivingId }).where(eq(schema.fileComment.fileId, fileId));
    const now = new Date();
    await db.insert(schema.fileComment).values({
      id: newId(),
      fileId: survivingId,
      authorUserId: input.deletedByUserId,
      authorContactId: input.deletedByContactId,
      body: `Removed version ${versionNumber} - ${row.filename}`,
      createdAt: now,
      updatedAt: now,
    });
    // DEC-926: any task_assignment linked to the deleted file follows the
    // chain to the surviving link — set-based, never a row delete.
    await db
      .update(schema.taskAssignment)
      .set({ fileId: survivingId, updatedAt: now })
      .where(eq(schema.taskAssignment.fileId, fileId));
  } else {
    // Sole version in its chain — its comments go with it.
    await db.delete(schema.fileComment).where(eq(schema.fileComment.fileId, fileId));
    // DEC-926: no surviving link to repoint to — reopen the assignment
    // instead of leaving it pointed at a deleted row.
    const now = new Date();
    await db
      .update(schema.taskAssignment)
      .set({ status: "pending", completedAt: null, completedBy: null, fileId: null, updatedAt: now })
      .where(eq(schema.taskAssignment.fileId, fileId));
  }

  await db.delete(schema.file).where(eq(schema.file.id, fileId));
}

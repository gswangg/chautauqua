// Files repo — version-chain lookups + writes + per-submission reads (J8,
// DEC-020 contract). Split out of files.ts (contention decomposition) — no
// behavior change, files.ts re-exports everything below for existing callers.

import { asc, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId } from "../../domain/ids";
import type { FileKind } from "../../domain/files";
import { chunkIds } from "../../lib/chunk";

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

/** DEC-242: 1-indexed version number for `fileId`, counting `fileId` itself
 * plus every ancestor reachable by walking previous_file_id — matches the
 * VersionList frontend's `versions.length - idx` numbering (oldest = v1,
 * current/latest = v<chain length>) since a task_assignment's linked file is
 * always the newest link in its chain. */
export async function getFileVersionNumber(db: Db, fileId: string): Promise<number> {
  let current: string | null = fileId;
  let version = 0;
  while (current) {
    version += 1;
    const rows: { previousFileId: string | null }[] = await db
      .select({ previousFileId: schema.file.previousFileId })
      .from(schema.file)
      .where(eq(schema.file.id, current))
      .limit(1);
    const row: { previousFileId: string | null } | undefined = rows[0];
    if (!row) throw new Error(`getFileVersionNumber: file ${current} not found mid-chain — data corruption`);
    current = row.previousFileId;
  }
  return version;
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
}

export async function insertFile(db: Db, input: InsertFileInput): Promise<string> {
  const id = newId();
  const now = new Date();
  await db.insert(schema.file).values({
    id,
    submissionId: input.submissionId,
    kind: input.kind,
    filename: input.filename,
    r2Key: input.r2Key,
    sizeBytes: input.sizeBytes,
    contentType: input.contentType,
    previousFileId: input.previousFileId,
    uploadedByContactId: input.uploadedByContactId,
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
    })
    .from(schema.file)
    .where(eq(schema.file.submissionId, submissionId))
    .orderBy(desc(schema.file.createdAt), asc(schema.file.id));

  const grouped: FilesByKind = {};
  for (const row of rows) {
    const version: FileVersion = {
      id: row.id,
      filename: row.filename,
      sizeBytes: row.sizeBytes,
      contentType: row.contentType,
      previousFileId: row.previousFileId,
      uploadedByContactId: row.uploadedByContactId,
      createdAt: row.createdAt.getTime(),
    };
    (grouped[row.kind] ??= []).push(version);
  }
  return grouped;
}

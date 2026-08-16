// Files repo — new-version writes (DEC-818/DEC-020 version-chain contract).
// Split out of files-versions.ts (contention decomposition) — no behavior
// change, files-versions.ts re-exports everything below for existing
// callers.

import { eq } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId } from "../../domain/ids";
import type { FileKind } from "../../domain/files";
import { DEC_818 } from "../../decisions";
import { ApiError } from "../http";
import { isUniqueViolation } from "./constraints";

void DEC_818;

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

  try {
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
  } catch (err) {
    // DEC-818 amendment: file_previous_file_id_unique (migrations/0043)
    // encodes "at most one row may name a given predecessor" -- a
    // concurrent re-upload racing this insert onto the same chain head
    // loses here, loudly and retryably, rather than minting a second row
    // at the same version_no.
    if (isUniqueViolation(err, "file.previous_file_id")) {
      throw new ApiError("conflict", "This file was already replaced by a newer version. Reload and try again.");
    }
    throw err;
  }
  return id;
}

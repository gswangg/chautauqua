// Files repo — file comment threads (J8, DEC-020 contract). Split out of
// files.ts (contention decomposition) — no behavior change, files.ts
// re-exports everything below for existing callers.
//
// DEC-573: a comment thread belongs to the whole version CHAIN, not to one
// file row — a re-upload (which creates a new file row chained by
// previous_file_id, DEC-244) must not orphan comments left on an earlier
// version. listFileComments therefore accepts any file id in the chain,
// resolves the whole chain via listFileChainIds, and reads comments across
// every link.

import { asc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId } from "../../domain/ids";
import { chunkIds, ID_CHUNK_SIZE } from "../../lib/chunk";
import { listFileChainIds } from "./files-versions";
import { DEC_573 } from "../../decisions";

void DEC_573;

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export interface FileCommentRow {
  id: string;
  fileId: string;
  versionNumber: number;
  body: string;
  authorName: string;
  authorRole: string;
  createdAt: number;
}

export interface FileCommentPage {
  items: FileCommentRow[];
  total: number;
  page: number;
  perPage: number;
}

/** DEC-573: reads every comment on the deliverable's version chain, oldest
 * first (createdAt asc, then id asc as a deterministic tiebreak) — `fileId`
 * may be any link in the chain, not just the latest. `versionNumber` reuses
 * listFileChainIds' oldest-first ordering (index 0 = v1), matching
 * getFileVersionNumber's numbering. `page` is the product's ONE list shape:
 * absent means today's unbounded behavior (for internal callers that render
 * a full thread, e.g. the portal tasks list); the HTTP route always pages.
 * `total` is the true chain-wide count, not `items.length`, so a caller can
 * tell when a page has truncated the thread. */
export async function listFileComments(
  db: Db,
  fileId: string,
  page?: { limit: number; offset: number },
): Promise<FileCommentPage> {
  const chainIds = await listFileChainIds(db, fileId);
  const versionByFileId = new Map(chainIds.map((id, idx) => [id, idx + 1]));

  let total = 0;
  for (const batch of chunkIds(chainIds)) {
    const countRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.fileComment)
      .where(inArray(schema.fileComment.fileId, batch));
    total += Number(countRows[0]?.count ?? 0);
  }

  type RawCommentRow = {
    id: string;
    fileId: string;
    body: string;
    createdAt: Date;
    authorUserId: string | null;
  };

  let pageRows: RawCommentRow[];
  if (page) {
    // DEC-686: a paged read touches only the page — a chain long enough to
    // outgrow ID_CHUNK_SIZE can't be paged within a single inArray chunk
    // (SQL LIMIT/OFFSET over one chunk would silently miss rows in later
    // chunks), so that's a bug to surface loudly, not a case to support.
    if (chainIds.length > ID_CHUNK_SIZE) {
      throw new Error(
        `listFileComments: version chain of ${chainIds.length} files exceeds ID_CHUNK_SIZE (${ID_CHUNK_SIZE}) — cannot page`,
      );
    }
    pageRows = await db
      .select({
        id: schema.fileComment.id,
        fileId: schema.fileComment.fileId,
        body: schema.fileComment.body,
        createdAt: schema.fileComment.createdAt,
        authorUserId: schema.fileComment.authorUserId,
      })
      .from(schema.fileComment)
      .where(inArray(schema.fileComment.fileId, chainIds))
      .orderBy(asc(schema.fileComment.createdAt), asc(schema.fileComment.id))
      .limit(page.limit)
      .offset(page.offset);
  } else {
    // No page requested (e.g. the portal tasks list rendering a full
    // thread) — today's unbounded behavior, still chunked for D1's bound-
    // parameter ceiling.
    const allRows: RawCommentRow[] = [];
    for (const batch of chunkIds(chainIds)) {
      const rows = await db
        .select({
          id: schema.fileComment.id,
          fileId: schema.fileComment.fileId,
          body: schema.fileComment.body,
          createdAt: schema.fileComment.createdAt,
          authorUserId: schema.fileComment.authorUserId,
        })
        .from(schema.fileComment)
        .where(inArray(schema.fileComment.fileId, batch))
        .orderBy(asc(schema.fileComment.createdAt), asc(schema.fileComment.id));
      allRows.push(...rows);
    }
    allRows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
    pageRows = allRows;
  }

  const userIds = [...new Set(pageRows.map((r) => r.authorUserId).filter((x): x is string => !!x))];
  const userMap = new Map<string, { email: string; role: string; contactId: string | null }>();
  if (userIds.length > 0) {
    for (const batch of chunkIds(userIds)) {
      const userRows = await db
        .select({ id: schema.user.id, email: schema.user.email, role: schema.user.role, contactId: schema.user.contactId })
        .from(schema.user)
        .where(inArray(schema.user.id, batch));
      for (const u of userRows) userMap.set(u.id, { email: u.email, role: u.role, contactId: u.contactId });
    }
  }

  const contactIds = [...new Set([...userMap.values()].map((u) => u.contactId).filter((x): x is string => !!x))];
  const contactMap = new Map<string, string>();
  if (contactIds.length > 0) {
    for (const batch of chunkIds(contactIds)) {
      const contactRows = await db
        .select({ id: schema.contact.id, firstName: schema.contact.firstName, lastName: schema.contact.lastName })
        .from(schema.contact)
        .where(inArray(schema.contact.id, batch));
      for (const c of contactRows) contactMap.set(c.id, `${c.firstName} ${c.lastName}`.trim());
    }
  }

  const items: FileCommentRow[] = pageRows.map((row) => {
    const user = row.authorUserId ? userMap.get(row.authorUserId) : undefined;
    const authorName = user ? (user.contactId && contactMap.get(user.contactId)) || user.email : "Unknown";
    const versionNumber = versionByFileId.get(row.fileId);
    if (versionNumber === undefined) {
      throw new Error(`listFileComments: comment ${row.id} references file ${row.fileId} outside its own chain`);
    }
    return {
      id: row.id,
      fileId: row.fileId,
      versionNumber,
      body: row.body,
      authorName,
      authorRole: user?.role ?? "unknown",
      createdAt: row.createdAt.getTime(),
    };
  });

  return {
    items,
    total,
    page: page ? Math.floor(page.offset / page.limit) + 1 : 1,
    perPage: page ? page.limit : total || 1,
  };
}

export async function insertFileComment(
  db: Db,
  input: { fileId: string; body: string; authorUserId: string; authorContactId: string | null },
): Promise<string> {
  const id = newId();
  const now = new Date();
  await db.insert(schema.fileComment).values({
    id,
    fileId: input.fileId,
    authorUserId: input.authorUserId,
    authorContactId: input.authorContactId,
    body: input.body,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

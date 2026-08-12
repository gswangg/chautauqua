// Files repo — file comment threads (J8, DEC-020 contract). Split out of
// files.ts (contention decomposition) — no behavior change, files.ts
// re-exports everything below for existing callers.

import { asc, eq, inArray } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId } from "../../domain/ids";
import { chunkIds } from "../../lib/chunk";

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export interface FileCommentRow {
  id: string;
  body: string;
  authorName: string;
  authorRole: string;
  createdAt: number;
}

export async function listFileComments(db: Db, fileId: string): Promise<FileCommentRow[]> {
  const rows = await db
    .select({
      id: schema.fileComment.id,
      body: schema.fileComment.body,
      createdAt: schema.fileComment.createdAt,
      authorUserId: schema.fileComment.authorUserId,
    })
    .from(schema.fileComment)
    .where(eq(schema.fileComment.fileId, fileId))
    .orderBy(schema.fileComment.createdAt, asc(schema.fileComment.id));

  const userIds = [...new Set(rows.map((r) => r.authorUserId).filter((x): x is string => !!x))];
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

  return rows.map((row) => {
    const user = row.authorUserId ? userMap.get(row.authorUserId) : undefined;
    const authorName = user ? (user.contactId && contactMap.get(user.contactId)) || user.email : "Unknown";
    return {
      id: row.id,
      body: row.body,
      authorName,
      authorRole: user?.role ?? "unknown",
      createdAt: row.createdAt.getTime(),
    };
  });
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

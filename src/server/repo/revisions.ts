// Session content version history (CNT-11, DEC-158). Callers append a row
// only when title/description actually changed — this module does not
// itself dedupe against the prior row, that's the caller's job (both write
// paths already hold the pre-edit values before calling
// updateSubmissionFields/saveSubmissionEdits).

import { and, asc, desc, eq, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { Db } from "../context";
import { newId } from "../../domain/ids";

export interface AppendRevisionInput {
  submissionId: string;
  editorUserId?: string | null;
  editorName: string;
  title: string;
  description: string | null;
}

export interface RevisionSummary {
  id: string;
  editorName: string;
  title: string;
  description: string | null;
  createdAt: number;
}

/** Snapshots the POST-edit state of a submission's title/description. */
export async function appendSubmissionRevision(db: Db, input: AppendRevisionInput): Promise<string> {
  const id = newId();
  await db.insert(schema.submissionRevision).values({
    id,
    submissionId: input.submissionId,
    editorUserId: input.editorUserId ?? null,
    editorName: input.editorName,
    title: input.title,
    description: input.description,
    createdAt: new Date(),
  });
  return id;
}

/** Newest-first history for a submission. `page` (DEC-461) is optional —
 * absent preserves today's unbounded behavior for internal callers; the
 * route layer (src/routes/api/submissions.ts) always supplies it. */
export async function listRevisions(
  db: Db,
  submissionId: string,
  page?: { limit: number; offset: number },
): Promise<RevisionSummary[]> {
  let query = db
    .select({
      id: schema.submissionRevision.id,
      editorName: schema.submissionRevision.editorName,
      title: schema.submissionRevision.title,
      description: schema.submissionRevision.description,
      createdAt: schema.submissionRevision.createdAt,
    })
    .from(schema.submissionRevision)
    .where(eq(schema.submissionRevision.submissionId, submissionId))
    .orderBy(desc(schema.submissionRevision.createdAt), asc(schema.submissionRevision.id))
    .$dynamic();

  if (page) {
    query = query.limit(page.limit).offset(page.offset);
  }

  const rows = await query;

  return rows.map((r) => ({
    id: r.id,
    editorName: r.editorName,
    title: r.title,
    description: r.description,
    createdAt: r.createdAt.getTime(),
  }));
}

/** Sibling of listRevisions (DEC-461): the true total row count, independent
 * of any page bound. */
export async function countRevisions(db: Db, submissionId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.submissionRevision)
    .where(eq(schema.submissionRevision.submissionId, submissionId));
  return Number(rows[0]?.count ?? 0);
}

/** A single revision, scoped to its submission (returns null if the
 * revisionId doesn't belong to submissionId — no IDOR). */
export async function getRevision(
  db: Db,
  submissionId: string,
  revisionId: string,
): Promise<RevisionSummary | null> {
  const rows = await db
    .select({
      id: schema.submissionRevision.id,
      editorName: schema.submissionRevision.editorName,
      title: schema.submissionRevision.title,
      description: schema.submissionRevision.description,
      createdAt: schema.submissionRevision.createdAt,
    })
    .from(schema.submissionRevision)
    .where(and(eq(schema.submissionRevision.id, revisionId), eq(schema.submissionRevision.submissionId, submissionId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, editorName: row.editorName, title: row.title, description: row.description, createdAt: row.createdAt.getTime() };
}

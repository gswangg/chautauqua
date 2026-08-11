// Files repo — central files library (DEC-159/160/344), event-scoped
// deliverable version chains. Split out of files.ts (contention
// decomposition) — files.ts re-exports everything below for existing
// callers.
//
// DEC-344: this module is server-paginated/server-filtered — one paginated
// statement over chain ROOTS (previous_file_id is null) per the DEC-333/335
// scale rule, never a whole-event scan. resolveLatestVersions likewise never
// scans the event's submissions; it only ever loads the requested files'
// own submissions/version chains.

import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { formatRef } from "../../domain/ids";
import { chunkIds } from "../../lib/chunk";
import { likeContains } from "./submissions/query";
import { ApiError } from "../http";

export interface EventFilesScope {
  orgId: string;
  slug: string;
}

/** Org + slug for the GET/POST /events/:eventId/files* endpoints — slug
 * feeds the ZIP download's Content-Disposition filename. */
export async function getEventFilesScope(db: Db, eventId: string): Promise<EventFilesScope | null> {
  const rows = await db
    .select({ orgId: schema.event.orgId, slug: schema.event.slug })
    .from(schema.event)
    .where(eq(schema.event.id, eventId))
    .limit(1);
  return rows[0] ?? null;
}

export interface EventDeliverableChain {
  rootFileId: string;
  latestFileId: string;
  filename: string;
  kind: string;
  submissionId: string;
  submissionRef: string;
  submissionTitle: string;
  speakerName: string;
  uploadedAt: number;
  versionCount: number;
}

export interface EventFilesQuery {
  page: number;
  perPage: number;
  kinds: string[];
  q: string | null;
}

export interface EventDeliverableChainPage {
  items: EventDeliverableChain[];
  total: number;
  page: number;
  perPage: number;
}

interface DeliverableFileRow {
  id: string;
  submissionId: string;
  kind: string;
  filename: string;
  previousFileId: string | null;
  createdAt: Date;
}

/** Follows previous_file_id links to find the oldest ancestor ('root') of
 * `fileId` within `byId` — used to group a submission's files into version
 * chains. Bounded by the number of files loaded into `byId` (never the
 * whole event, per DEC-344), so a plain loop rather than a recursive CTE. */
function findRoot(fileId: string, byId: Map<string, DeliverableFileRow>): string {
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

/** DEC-344: one paginated statement over chain roots (file.previous_file_id
 * is null) inner-joined to submission, kinds/q pushed into the WHERE as
 * inArray / AND-across-tokens x OR-across-columns correlated conditions —
 * never a whole-event scan. Per-page hydration (versions/lead speaker) is
 * bounded to the page's submission ids. */
export async function listEventDeliverableFiles(
  db: Db,
  eventId: string,
  params: EventFilesQuery,
): Promise<EventDeliverableChainPage> {
  const eventRows = await db
    .select({ recordPrefix: schema.event.recordPrefix })
    .from(schema.event)
    .where(eq(schema.event.id, eventId))
    .limit(1);
  const recordPrefix = eventRows[0]?.recordPrefix ?? "SES";

  const conditions = [isNull(schema.file.previousFileId), eq(schema.submission.eventId, eventId)];

  if (params.kinds.length > 0) {
    conditions.push(inArray(schema.file.kind, params.kinds));
  }

  if (params.q) {
    const tokens = params.q.split(/\s+/).filter((t) => t.length > 0);
    const tokenConditions = tokens.map((token) => {
      const like = likeContains(token);
      return or(
        sql`lower(${schema.file.filename}) like ${like} escape '\\'`,
        sql`lower(${schema.submission.title}) like ${like} escape '\\'`,
        sql`exists (select 1 from ${schema.participant} inner join ${schema.contact} on ${schema.contact.id} = ${schema.participant.contactId} where ${schema.participant.submissionId} = ${schema.submission.id} and lower(${schema.contact.firstName} || ' ' || ${schema.contact.lastName}) like ${like} escape '\\')`,
      )!;
    });
    if (tokenConditions.length > 0) {
      conditions.push(and(...tokenConditions)!);
    }
  }

  const whereExpr = and(...conditions);
  const offset = (params.page - 1) * params.perPage;

  const totalRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.file)
    .innerJoin(schema.submission, eq(schema.submission.id, schema.file.submissionId))
    .where(whereExpr);
  const total = Number(totalRows[0]?.count ?? 0);

  const rows = await db
    .select({
      id: schema.file.id,
      submissionId: schema.file.submissionId,
      kind: schema.file.kind,
      filename: schema.file.filename,
      createdAt: schema.file.createdAt,
      submissionSeq: schema.submission.seq,
      submissionTitle: schema.submission.title,
    })
    .from(schema.file)
    .innerJoin(schema.submission, eq(schema.submission.id, schema.file.submissionId))
    .where(whereExpr)
    .orderBy(sql`${schema.file.createdAt} desc, ${schema.file.id} asc`)
    .limit(params.perPage)
    .offset(offset);

  if (rows.length === 0) return { items: [], total, page: params.page, perPage: params.perPage };

  const submissionIds = [...new Set(rows.map((r) => r.submissionId).filter((id): id is string => !!id))];

  // Hydrate version chains ONLY for the page's submissions (DEC-344) — load
  // every file row on those submissions (not the whole event) to walk
  // findRoot -> group -> latest/versionCount.
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

  // Lead speaker: ONE query over the page's submission ids, min participant
  // order among role='speaker' rows — single pass, no per-row .find (DEC-344
  // deletes the old O(n^2) loop).
  const leadBySubmission = new Map<string, { order: number; name: string }>();
  for (const batch of chunkIds(submissionIds)) {
    const batchRows = await db
      .select({
        submissionId: schema.participant.submissionId,
        order: schema.participant.order,
        firstName: schema.contact.firstName,
        lastName: schema.contact.lastName,
      })
      .from(schema.participant)
      .innerJoin(schema.contact, eq(schema.contact.id, schema.participant.contactId))
      .where(and(inArray(schema.participant.submissionId, batch), eq(schema.participant.role, "speaker")));
    for (const p of batchRows) {
      if (!p.submissionId) continue;
      const existing = leadBySubmission.get(p.submissionId);
      if (!existing || p.order < existing.order) {
        leadBySubmission.set(p.submissionId, { order: p.order, name: `${p.firstName} ${p.lastName}`.trim() });
      }
    }
  }

  const items: EventDeliverableChain[] = rows.map((row) => {
    const chain = chains.get(row.id);
    if (!chain || chain.length === 0) {
      // Fail loudly (DEC-344): the root row selected by the page query must
      // resolve in the hydration pass — a miss here means the two queries
      // disagree, which should never happen.
      throw new Error(`listEventDeliverableFiles: chain root ${row.id} not resolved in per-page hydration`);
    }
    let latest = chain[0]!;
    for (const f of chain) {
      if (f.createdAt.getTime() > latest.createdAt.getTime()) latest = f;
    }
    const lead = row.submissionId ? leadBySubmission.get(row.submissionId) : undefined;
    return {
      rootFileId: row.id,
      latestFileId: latest.id,
      filename: latest.filename,
      kind: latest.kind,
      submissionId: row.submissionId ?? "",
      submissionRef: formatRef(recordPrefix, row.submissionSeq),
      submissionTitle: row.submissionTitle,
      speakerName: lead?.name ?? "",
      uploadedAt: latest.createdAt.getTime(),
      versionCount: chain.length,
    };
  });

  return { items, total, page: params.page, perPage: params.perPage };
}

/** DEC-160/344: resolves each requested file id to its version chain's
 * latest file row (id/filename/contentType/r2Key/submissionTitle), scoped
 * to `eventId` — throws if any requested id doesn't resolve to a
 * deliverable of that event's submissions (no silent skips, per DEC-160's
 * "whole request 404s" rule). Never calls listEventDeliverableFiles and
 * never loads the event's submissions — only the requested files' own
 * submissions/version chains (DEC-344 bounded-cost rule). */
export async function resolveLatestVersions(
  db: Db,
  eventId: string,
  fileIds: string[],
): Promise<Map<string, { id: string; filename: string; contentType: string; r2Key: string; submissionTitle: string }>> {
  interface RequestedFileRow extends DeliverableFileRow {
    contentType: string;
    r2Key: string;
  }

  const requestedFileRows: RequestedFileRow[] = [];
  for (const batch of chunkIds(fileIds)) {
    const rows = await db
      .select({
        id: schema.file.id,
        submissionId: schema.file.submissionId,
        kind: schema.file.kind,
        filename: schema.file.filename,
        previousFileId: schema.file.previousFileId,
        createdAt: schema.file.createdAt,
        contentType: schema.file.contentType,
        r2Key: schema.file.r2Key,
      })
      .from(schema.file)
      .where(inArray(schema.file.id, batch));
    for (const r of rows) {
      if (r.submissionId) requestedFileRows.push({ ...r, submissionId: r.submissionId });
    }
  }
  const requestedById = new Map(requestedFileRows.map((f) => [f.id, f]));
  for (const id of fileIds) {
    if (!requestedById.has(id)) throw new ApiError("not_found", `File ${id} is not a deliverable of this event`);
  }

  const submissionIds = [...new Set(requestedFileRows.map((f) => f.submissionId))];
  const submissionRows: { id: string; eventId: string; seq: number; title: string }[] = [];
  for (const batch of chunkIds(submissionIds)) {
    const rows = await db
      .select({
        id: schema.submission.id,
        eventId: schema.submission.eventId,
        seq: schema.submission.seq,
        title: schema.submission.title,
      })
      .from(schema.submission)
      .where(inArray(schema.submission.id, batch));
    submissionRows.push(...rows);
  }
  const submissionById = new Map(submissionRows.map((s) => [s.id, s]));

  // Every requested file's submission must belong to eventId — no silent
  // skips (DEC-160), and a file from another event 404s the whole request.
  for (const f of requestedFileRows) {
    const sub = submissionById.get(f.submissionId);
    if (!sub || sub.eventId !== eventId) {
      throw new ApiError("not_found", `File ${f.id} is not a deliverable of this event`);
    }
  }

  // Load the full version chains (incl. contentType/r2Key) of just those
  // submissions (bounded, DEC-344 — never the whole event) to walk
  // findRoot -> latest.
  const chainFileRows: RequestedFileRow[] = [];
  for (const batch of chunkIds(submissionIds)) {
    const rows = await db
      .select({
        id: schema.file.id,
        submissionId: schema.file.submissionId,
        kind: schema.file.kind,
        filename: schema.file.filename,
        previousFileId: schema.file.previousFileId,
        createdAt: schema.file.createdAt,
        contentType: schema.file.contentType,
        r2Key: schema.file.r2Key,
      })
      .from(schema.file)
      .where(inArray(schema.file.submissionId, batch));
    for (const r of rows) {
      if (r.submissionId) chainFileRows.push({ ...r, submissionId: r.submissionId });
    }
  }
  const byId = new Map(chainFileRows.map((f) => [f.id, f]));

  const chainsByRoot = new Map<string, RequestedFileRow[]>();
  for (const f of chainFileRows) {
    const root = findRoot(f.id, byId);
    const arr = chainsByRoot.get(root) ?? [];
    arr.push(f);
    chainsByRoot.set(root, arr);
  }

  const out = new Map<string, { id: string; filename: string; contentType: string; r2Key: string; submissionTitle: string }>();
  for (const requestedId of fileIds) {
    const root = findRoot(requestedId, byId);
    const chain = chainsByRoot.get(root);
    if (!chain || chain.length === 0) {
      throw new Error(`resolveLatestVersions: chain root ${root} not resolved for requested file ${requestedId}`);
    }
    let latest = chain[0]!;
    for (const f of chain) {
      if (f.createdAt.getTime() > latest.createdAt.getTime()) latest = f;
    }
    const sub = submissionById.get(latest.submissionId);
    if (!sub) throw new Error(`resolveLatestVersions: submission ${latest.submissionId} not loaded`);
    out.set(requestedId, {
      id: latest.id,
      filename: latest.filename,
      contentType: latest.contentType,
      r2Key: latest.r2Key,
      submissionTitle: sub.title,
    });
  }
  return out;
}

// Files repo — resolving requested file ids to their version chain's
// latest file (ZIP/single-download path). Split out of files-library.ts
// (contention decomposition) — files-library.ts re-exports everything
// below for existing callers.
import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { chunkIds } from "../../lib/chunk";
import { ApiError } from "../http";
import { acceptedSpeakerConditions } from "./tasks/crud";
import { findRoot, type DeliverableFileRow } from "./files-library-chains";
import { HEADSHOT_JOIN } from "./files-library-query";

/** Resolves headshot file ids to their own row (a headshot is always its
 * own single-version chain — setContactHeadshot never sets
 * previousFileId), scoped to accepted speakers of `eventId` via the same
 * acceptedSpeakerConditions the library listing composes, and to the
 * REVERSE contact.headshot_url match (so a superseded upload 404s even
 * though its file row/R2 object still exist — mirrors profile.ts's
 * getHeadshotServeScope). Throws (no silent skip) on any id not found in
 * that scope. */
async function resolveHeadshotVersions(
  db: Db,
  eventId: string,
  fileIds: string[],
): Promise<Map<string, { id: string; filename: string; contentType: string; r2Key: string; submissionTitle: string; sizeBytes: number }>> {
  const out = new Map<string, { id: string; filename: string; contentType: string; r2Key: string; submissionTitle: string; sizeBytes: number }>();
  if (fileIds.length === 0) return out;

  for (const batch of chunkIds(fileIds)) {
    const rows = await db
      .selectDistinct({
        id: schema.file.id,
        filename: schema.file.filename,
        contentType: schema.file.contentType,
        r2Key: schema.file.r2Key,
        sizeBytes: schema.file.sizeBytes,
        firstName: schema.contact.firstName,
        lastName: schema.contact.lastName,
      })
      .from(schema.participant)
      .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
      .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
      .innerJoin(schema.file, HEADSHOT_JOIN)
      .where(and(acceptedSpeakerConditions(eventId), inArray(schema.file.id, batch)));
    for (const r of rows) {
      out.set(r.id, {
        id: r.id,
        filename: r.filename,
        contentType: r.contentType,
        r2Key: r.r2Key,
        submissionTitle: `${r.firstName} ${r.lastName}`.trim(),
        sizeBytes: r.sizeBytes,
      });
    }
  }
  for (const id of fileIds) {
    if (!out.has(id)) throw new ApiError("not_found", `File ${id} is not a deliverable of this event`);
  }
  return out;
}

/** DEC-160/344/773: resolves each requested file id to its version chain's
 * latest file row (id/filename/contentType/r2Key/submissionTitle) —
 * deliverables resolve through their submission's chain, headshots through
 * resolveHeadshotVersions — throws if any requested id doesn't resolve
 * within `eventId`'s scope (no silent skips, per DEC-160's "whole request
 * 404s" rule). Never calls listEventDeliverableFiles and never loads the
 * event's submissions — only the requested files' own submissions/version
 * chains (DEC-344 bounded-cost rule). */
export async function resolveLatestVersions(
  db: Db,
  eventId: string,
  fileIds: string[],
): Promise<Map<string, { id: string; filename: string; contentType: string; r2Key: string; submissionTitle: string; sizeBytes: number }>> {
  if (fileIds.length === 0) return new Map();

  interface RequestedFileRow extends DeliverableFileRow {
    contentType: string;
    r2Key: string;
    sizeBytes: number;
  }

  const requestedFileRows: RequestedFileRow[] = [];
  const headshotIds: string[] = [];
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
        sizeBytes: schema.file.sizeBytes,
        uploadedByContactId: schema.file.uploadedByContactId,
        versionNo: schema.file.versionNo,
      })
      .from(schema.file)
      .where(inArray(schema.file.id, batch));
    for (const r of rows) {
      if (r.submissionId) {
        requestedFileRows.push({ ...r, submissionId: r.submissionId });
      } else {
        // DEC-773: submissionId null means either a headshot or a resource/
        // task upload — resolveHeadshotVersions itself scopes to kind
        // 'headshot' + an accepted-speaker contact, so a non-headshot
        // submissionId-null file simply won't resolve there and 404s below.
        headshotIds.push(r.id);
      }
    }
  }
  const deliverableIds = requestedFileRows.map((f) => f.id);
  const missingIds = fileIds.filter((id) => !deliverableIds.includes(id) && !headshotIds.includes(id));
  if (missingIds.length > 0) {
    throw new ApiError("not_found", `File ${missingIds[0]} is not a deliverable of this event`);
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
        sizeBytes: schema.file.sizeBytes,
        uploadedByContactId: schema.file.uploadedByContactId,
        versionNo: schema.file.versionNo,
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

  const out = new Map<string, { id: string; filename: string; contentType: string; r2Key: string; submissionTitle: string; sizeBytes: number }>();
  for (const requestedId of deliverableIds) {
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
      sizeBytes: latest.sizeBytes,
    });
  }

  const headshotResolved = await resolveHeadshotVersions(db, eventId, headshotIds);
  for (const [id, value] of headshotResolved) out.set(id, value);

  return out;
}

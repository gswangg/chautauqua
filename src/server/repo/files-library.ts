// Files repo — central files library (DEC-159/160), event-scoped deliverable
// version chains. Split out of files.ts (contention decomposition) — no
// behavior change, files.ts re-exports everything below for existing callers.

import { eq, inArray } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { formatRef } from "../../domain/ids";
import { chunkIds } from "../../lib/chunk";
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
 * chains. Bounded by the number of files on the event (DEC-159), so a
 * plain loop rather than a recursive CTE. */
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

/** DEC-159: every deliverable file version chain (previous_file_id links)
 * attached to a submission in `eventId`, one row per chain, newest version's
 * metadata surfaced (filename/kind/uploadedAt) plus the chain's version
 * count and the submission's lead speaker. */
export async function listEventDeliverableFiles(db: Db, eventId: string): Promise<EventDeliverableChain[]> {
  const eventRows = await db
    .select({ recordPrefix: schema.event.recordPrefix })
    .from(schema.event)
    .where(eq(schema.event.id, eventId))
    .limit(1);
  const event = eventRows[0];
  if (!event) return [];

  const submissionRows = await db
    .select({ id: schema.submission.id, seq: schema.submission.seq, title: schema.submission.title })
    .from(schema.submission)
    .where(eq(schema.submission.eventId, eventId));
  if (submissionRows.length === 0) return [];
  const submissionById = new Map(submissionRows.map((s) => [s.id, s]));
  const submissionIds = submissionRows.map((s) => s.id);

  const fileRows: DeliverableFileRow[] = [];
  for (const batch of chunkIds(submissionIds)) {
    const rows = await db
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
    for (const r of rows) {
      if (r.submissionId) fileRows.push({ ...r, submissionId: r.submissionId });
    }
  }
  if (fileRows.length === 0) return [];

  const participantRows: { submissionId: string; contactId: string; order: number; role: string }[] = [];
  for (const batch of chunkIds(submissionIds)) {
    const rows = await db
      .select({
        submissionId: schema.participant.submissionId,
        contactId: schema.participant.contactId,
        order: schema.participant.order,
        role: schema.participant.role,
      })
      .from(schema.participant)
      .where(inArray(schema.participant.submissionId, batch));
    participantRows.push(...rows);
  }
  const leadContactBySubmission = new Map<string, string>();
  for (const p of participantRows) {
    if (p.role !== "speaker") continue;
    const existing = leadContactBySubmission.get(p.submissionId);
    if (existing === undefined) {
      leadContactBySubmission.set(p.submissionId, p.contactId);
      continue;
    }
    const existingOrder = participantRows.find((x) => x.submissionId === p.submissionId && x.contactId === existing)?.order ?? 0;
    if (p.order < existingOrder) leadContactBySubmission.set(p.submissionId, p.contactId);
  }
  const contactIds = [...new Set(leadContactBySubmission.values())];
  const contactNameById = new Map<string, string>();
  for (const batch of chunkIds(contactIds)) {
    const rows = await db
      .select({ id: schema.contact.id, firstName: schema.contact.firstName, lastName: schema.contact.lastName })
      .from(schema.contact)
      .where(inArray(schema.contact.id, batch));
    for (const c of rows) contactNameById.set(c.id, `${c.firstName} ${c.lastName}`.trim());
  }

  const byId = new Map(fileRows.map((f) => [f.id, f]));
  const chains = new Map<string, DeliverableFileRow[]>();
  for (const f of fileRows) {
    const root = findRoot(f.id, byId);
    const arr = chains.get(root) ?? [];
    arr.push(f);
    chains.set(root, arr);
  }

  const out: EventDeliverableChain[] = [];
  for (const [rootFileId, versions] of chains) {
    versions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const latest = versions[0];
    if (!latest) throw new Error(`listEventDeliverableFiles: empty chain for root ${rootFileId}`);
    const submission = submissionById.get(latest.submissionId);
    if (!submission) throw new Error(`listEventDeliverableFiles: submission ${latest.submissionId} not loaded`);
    const leadContactId = leadContactBySubmission.get(latest.submissionId);
    const speakerName = leadContactId ? (contactNameById.get(leadContactId) ?? "") : "";
    out.push({
      rootFileId,
      latestFileId: latest.id,
      filename: latest.filename,
      kind: latest.kind,
      submissionId: latest.submissionId,
      submissionRef: formatRef(event.recordPrefix, submission.seq),
      submissionTitle: submission.title,
      speakerName,
      uploadedAt: latest.createdAt.getTime(),
      versionCount: versions.length,
    });
  }
  return out;
}

/** DEC-160: resolves each requested file id to its version chain's latest
 * file row (id/filename/contentType/r2Key), scoped to `eventId` — throws if
 * any requested id doesn't resolve to a deliverable of that event's
 * submissions (no silent skips, per DEC-160's "whole request 404s" rule). */
export async function resolveLatestVersions(
  db: Db,
  eventId: string,
  fileIds: string[],
): Promise<Map<string, { id: string; filename: string; contentType: string; r2Key: string }>> {
  const chains = await listEventDeliverableFiles(db, eventId);
  const latestByAnyChainMember = new Map<string, string>(); // any file id in a chain -> latest file id

  // Re-derive chain membership so both root and non-root ids in the request
  // resolve correctly (a caller may pass an older version's id).
  const submissionRows = await db
    .select({ id: schema.submission.id })
    .from(schema.submission)
    .where(eq(schema.submission.eventId, eventId));
  const submissionIds = submissionRows.map((s) => s.id);
  const fileRows: DeliverableFileRow[] = [];
  for (const batch of chunkIds(submissionIds)) {
    const rows = await db
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
    for (const r of rows) {
      if (r.submissionId) fileRows.push({ ...r, submissionId: r.submissionId });
    }
  }
  const byId = new Map(fileRows.map((f) => [f.id, f]));
  const latestByRoot = new Map(chains.map((c) => [c.rootFileId, c.latestFileId]));
  for (const f of fileRows) {
    const root = findRoot(f.id, byId);
    const latestId = latestByRoot.get(root);
    if (latestId) latestByAnyChainMember.set(f.id, latestId);
  }

  const latestFileIds = new Set<string>();
  for (const requestedId of fileIds) {
    const latestId = latestByAnyChainMember.get(requestedId);
    if (!latestId) {
      throw new ApiError("not_found", `File ${requestedId} is not a deliverable of this event`);
    }
    latestFileIds.add(latestId);
  }

  const out = new Map<string, { id: string; filename: string; contentType: string; r2Key: string }>();
  for (const batch of chunkIds([...latestFileIds])) {
    const rows = await db
      .select({
        id: schema.file.id,
        filename: schema.file.filename,
        contentType: schema.file.contentType,
        r2Key: schema.file.r2Key,
      })
      .from(schema.file)
      .where(inArray(schema.file.id, batch));
    for (const r of rows) out.set(r.id, r);
  }

  const resolved = new Map<string, { id: string; filename: string; contentType: string; r2Key: string }>();
  for (const requestedId of fileIds) {
    const latestId = latestByAnyChainMember.get(requestedId);
    if (!latestId) throw new Error("unreachable: validated above");
    const row = out.get(latestId);
    if (!row) throw new Error(`resolveLatestVersions: latest file ${latestId} row missing`);
    resolved.set(requestedId, row);
  }
  return resolved;
}

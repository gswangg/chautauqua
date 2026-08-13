// Resources (DEC-029): resource rows grouped by every event the speaker
// participates in. Wiki content renders as escaped paragraphs; file
// resources stream via GET /portal/resources/:resourceId/download.

import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { PORTAL_VISIBLE_INVITE_STATUSES } from "../../../domain/acceptance";
import { chunkIds } from "../../../lib/chunk";

export interface PortalResource {
  id: string;
  kind: string;
  title: string;
  content: string | null;
  fileId: string | null;
}

export interface PortalResourceGroup {
  eventId: string;
  eventName: string;
  resources: PortalResource[];
}

/** Every eventId the speaker's contact participates in (any submission,
 * any status) — the scoping unit for both the resources list and the
 * resource-download authz check. */
export async function getMyEventIds(db: Db, contactId: string, orgId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ eventId: schema.event.id })
    .from(schema.participant)
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .innerJoin(schema.event, eq(schema.submission.eventId, schema.event.id))
    .where(
      and(
        eq(schema.participant.contactId, contactId),
        eq(schema.event.orgId, orgId),
        inArray(schema.participant.inviteStatus, PORTAL_VISIBLE_INVITE_STATUSES),
      ),
    );
  return rows.map((r) => r.eventId);
}

/** Pure scoping check: is `resourceEventId` among the events I participate
 * in? Never trust a :resourceId from the request without this (or the
 * equivalent query-level filter) — no IDOR across events. */
export function isParticipantInEvent(myEventIds: readonly string[], resourceEventId: string): boolean {
  return myEventIds.includes(resourceEventId);
}

export async function getMyResources(db: Db, contactId: string, orgId: string): Promise<PortalResourceGroup[]> {
  const eventIds = await getMyEventIds(db, contactId, orgId);
  if (eventIds.length === 0) return [];

  // DEC-432: scope pushed into WHERE via inArray/chunkIds rather than
  // fetching every org resource and filtering in JS.
  // DEC-962 audit: the inner batch below already carries orgId inside the
  // SAME query's WHERE (eq(schema.event.orgId, orgId)) — a foreign eventId
  // in the batch contributes no row, by construction. No change needed.
  const rows: {
    id: string;
    eventId: string;
    kind: (typeof schema.resource.$inferSelect)["kind"];
    title: string;
    content: string | null;
    fileId: string | null;
    position: number;
    eventName: string;
  }[] = [];
  for (const batch of chunkIds(eventIds)) {
    const batchRows = await db
      .select({
        id: schema.resource.id,
        eventId: schema.resource.eventId,
        kind: schema.resource.kind,
        title: schema.resource.title,
        content: schema.resource.content,
        fileId: schema.resource.fileId,
        position: schema.resource.position,
        eventName: schema.event.name,
      })
      .from(schema.resource)
      .innerJoin(schema.event, eq(schema.resource.eventId, schema.event.id))
      .where(and(eq(schema.event.orgId, orgId), inArray(schema.resource.eventId, batch)))
      .orderBy(schema.resource.position);
    rows.push(...batchRows);
  }
  // Re-sort across chunk boundaries so multi-event/multi-batch speakers see
  // the same global-by-position ordering the pre-DEC-432 single query gave.
  rows.sort((a, b) => a.position - b.position);

  const groups = new Map<string, PortalResourceGroup>();
  for (const row of rows) {
    let group = groups.get(row.eventId);
    if (!group) {
      group = { eventId: row.eventId, eventName: row.eventName, resources: [] };
      groups.set(row.eventId, group);
    }
    group.resources.push({ id: row.id, kind: row.kind, title: row.title, content: row.content, fileId: row.fileId });
  }
  return Array.from(groups.values());
}

export interface PortalResourceDownloadScope {
  r2Key: string;
  contentType: string;
  filename: string;
}

/**
 * Authz + lookup for GET /portal/resources/:resourceId/download: the
 * resource must be kind='file' with a linked file row, and the requesting
 * speaker must participate in the resource's event. Resource files have no
 * submission, so the participant-based /files authz (DEC-020) can never
 * serve them — this is the dedicated carve-out (DEC-029).
 */
export async function getResourceDownloadScope(
  db: Db,
  resourceId: string,
  contactId: string,
  orgId: string,
): Promise<PortalResourceDownloadScope | null> {
  const rows = await db
    .select({
      kind: schema.resource.kind,
      eventId: schema.resource.eventId,
      eventOrgId: schema.event.orgId,
      fileId: schema.resource.fileId,
    })
    .from(schema.resource)
    .innerJoin(schema.event, eq(schema.resource.eventId, schema.event.id))
    .where(eq(schema.resource.id, resourceId))
    .limit(1);
  const row = rows[0];
  if (!row || row.eventOrgId !== orgId || row.kind !== "file" || !row.fileId) return null;

  const eventIds = await getMyEventIds(db, contactId, orgId);
  if (!isParticipantInEvent(eventIds, row.eventId)) return null;

  const fileRows = await db
    .select({
      r2Key: schema.file.r2Key,
      contentType: schema.file.contentType,
      filename: schema.file.filename,
    })
    .from(schema.file)
    .where(eq(schema.file.id, row.fileId))
    .limit(1);
  const fileRow = fileRows[0];
  if (!fileRow) return null;
  return fileRow;
}

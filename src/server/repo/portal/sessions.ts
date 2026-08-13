// Sessions (DEC-029): the speaker's own accepted submissions, with schedule
// day/start/end + room name when placed, plus the "latest deliverable" read
// used by the portal home.

import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { formatRef } from "../../../domain/ids";
import { ACTIVE_INVITE_STATUSES } from "../../../domain/acceptance";
import { loadTrackNamesBySubmission } from "../submission-tracks";
import { chunkIds } from "../../../lib/chunk";

export interface PortalSession {
  submissionId: string;
  ref: string;
  title: string;
  day: string | null;
  startMin: number | null;
  endMin: number | null;
  roomName: string | null;
  trackName: string | null;
  acceptedAt: number | null;
  eventName: string;
  timezone: string;
}

export async function getMySessions(db: Db, contactId: string, orgId: string): Promise<PortalSession[]> {
  const rows = await db
    .select({
      submissionId: schema.submission.id,
      seq: schema.submission.seq,
      title: schema.submission.title,
      recordPrefix: schema.event.recordPrefix,
      day: schema.scheduleSlot.day,
      startMin: schema.scheduleSlot.startMin,
      endMin: schema.scheduleSlot.endMin,
      roomName: schema.room.name,
      acceptedAt: schema.submission.acceptedAt,
      eventName: schema.event.name,
      timezone: schema.event.timezone,
    })
    .from(schema.participant)
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .innerJoin(schema.event, eq(schema.submission.eventId, schema.event.id))
    // DEC-318/DEC-536: a schedule_slot dated outside the event's
    // [startDate, endDate] must never render as a placement. The range
    // predicate lives in the LEFT JOIN's ON clause (not the WHERE) so an
    // out-of-range slot nulls the placement fields instead of dropping
    // the whole session row.
    .leftJoin(
      schema.scheduleSlot,
      and(
        eq(schema.scheduleSlot.submissionId, schema.submission.id),
        gte(schema.scheduleSlot.day, schema.event.startDate),
        lte(schema.scheduleSlot.day, schema.event.endDate),
      ),
    )
    .leftJoin(schema.room, eq(schema.scheduleSlot.roomId, schema.room.id))
    .where(
      and(
        eq(schema.participant.contactId, contactId),
        eq(schema.event.orgId, orgId),
        eq(schema.submission.status, "accepted"),
        inArray(schema.participant.inviteStatus, ACTIVE_INVITE_STATUSES),
      ),
    );

  const trackNames = await loadTrackNamesBySubmission(
    db,
    rows.map((row) => row.submissionId),
  );

  return rows.map((row) => ({
    submissionId: row.submissionId,
    ref: formatRef(row.recordPrefix, row.seq),
    title: row.title,
    day: row.day,
    startMin: row.startMin,
    endMin: row.endMin,
    roomName: row.roomName,
    trackName: trackNames.get(row.submissionId)?.[0] ?? null,
    acceptedAt: row.acceptedAt ? row.acceptedAt.getTime() : null,
    eventName: row.eventName,
    timezone: row.timezone,
  }));
}

export interface PortalDeliverable {
  id: string;
  filename: string;
  sizeBytes: number;
  uploadedAt: number;
}

/** Most recently uploaded file linked to `submissionId` (any kind — this is
 * the portal home's "latest deliverable" line, not a kind-specific list).
 * Scoped to the caller's own submission — the route resolves submissionId
 * from the speaker's own PortalSession rows only, never a request param. */
export async function getLatestDeliverable(db: Db, submissionId: string): Promise<PortalDeliverable | null> {
  const rows = await db
    .select({
      id: schema.file.id,
      filename: schema.file.filename,
      sizeBytes: schema.file.sizeBytes,
      createdAt: schema.file.createdAt,
    })
    .from(schema.file)
    .where(eq(schema.file.submissionId, submissionId))
    .orderBy(desc(schema.file.createdAt))
    .limit(1);
  const row = rows[0];
  return row ? { id: row.id, filename: row.filename, sizeBytes: row.sizeBytes, uploadedAt: row.createdAt.getTime() } : null;
}

/** Batched form of getLatestDeliverable: the portal home's per-session
 * "latest deliverable" read done once per submissionId, not once PER row.
 * Chunked via chunkIds (D1 bound-parameter ceiling, DEC-078); within each
 * chunk a single query pulls every file row for the chunk's submissions and
 * the newest createdAt per submissionId wins — identical row shape/tie
 * behavior to getLatestDeliverable (ORDER BY createdAt DESC, first row per
 * submissionId kept). */
export async function listLatestDeliverables(db: Db, submissionIds: string[]): Promise<Map<string, PortalDeliverable>> {
  const out = new Map<string, PortalDeliverable>();
  if (submissionIds.length === 0) return out;
  for (const chunk of chunkIds(submissionIds)) {
    const rows = await db
      .select({
        submissionId: schema.file.submissionId,
        id: schema.file.id,
        filename: schema.file.filename,
        sizeBytes: schema.file.sizeBytes,
        createdAt: schema.file.createdAt,
      })
      .from(schema.file)
      .where(inArray(schema.file.submissionId, chunk))
      .orderBy(desc(schema.file.createdAt));
    for (const row of rows) {
      if (row.submissionId === null) continue;
      if (out.has(row.submissionId)) continue;
      out.set(row.submissionId, {
        id: row.id,
        filename: row.filename,
        sizeBytes: row.sizeBytes,
        uploadedAt: row.createdAt.getTime(),
      });
    }
  }
  return out;
}

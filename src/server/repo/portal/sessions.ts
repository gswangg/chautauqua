// Sessions (DEC-029): the speaker's own accepted submissions, with schedule
// day/start/end + room name when placed, plus the "latest deliverable" read
// used by the portal home.

import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { formatRef } from "../../../domain/ids";
import { ACTIVE_INVITE_STATUSES } from "../../../domain/acceptance";
import { loadTrackNamesBySubmission } from "../submission-tracks";
import { chunkIds } from "../../../lib/chunk";
import { DEC_962 } from "../../../decisions";

void DEC_962;

/** DEC-962: the correlated EXISTS twin of the participant/submission/event
 * ownership predicate, against `schema.file.submissionId` — asserts the
 * file's submission belongs to a participant row of `contactId` inside an
 * event of `orgId`. ANDed into the WHERE alongside the id predicate so a
 * foreign submissionId contributes no row, by construction, not by caller
 * discipline. */
function fileSubmissionOwnedByContact(contactId: string, orgId: string) {
  return sql`exists (
    select 1 from ${schema.participant}
    inner join ${schema.submission} on ${schema.submission.id} = ${schema.participant.submissionId}
    inner join ${schema.event} on ${schema.event.id} = ${schema.submission.eventId}
    where ${schema.participant.submissionId} = ${schema.file.submissionId}
      and ${schema.participant.contactId} = ${contactId}
      and ${schema.event.orgId} = ${orgId}
  )`;
}

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
 * DEC-962: ownership is enforced in the WHERE via a correlated EXISTS over
 * participant/submission/event (fileSubmissionOwnedByContact), not by
 * trusting the caller to have already scoped submissionId — a foreign
 * submissionId returns null, by construction. */
export async function getLatestDeliverable(
  db: Db,
  contactId: string,
  orgId: string,
  submissionId: string,
): Promise<PortalDeliverable | null> {
  const rows = await db
    .select({
      id: schema.file.id,
      filename: schema.file.filename,
      sizeBytes: schema.file.sizeBytes,
      createdAt: schema.file.createdAt,
    })
    .from(schema.file)
    .where(and(eq(schema.file.submissionId, submissionId), fileSubmissionOwnedByContact(contactId, orgId)))
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
 * submissionId kept). DEC-962: the same fileSubmissionOwnedByContact
 * correlated EXISTS is ANDed into the WHERE here too, so a submissionId
 * outside `contactId`'s own participant rows (or outside `orgId`) never
 * contributes a row/map entry, regardless of what the caller's id list
 * contains. */
export async function listLatestDeliverables(
  db: Db,
  contactId: string,
  orgId: string,
  submissionIds: string[],
): Promise<Map<string, PortalDeliverable>> {
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
      .where(and(inArray(schema.file.submissionId, chunk), fileSubmissionOwnedByContact(contactId, orgId)))
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

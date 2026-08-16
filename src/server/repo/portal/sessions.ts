// Sessions (DEC-029): the speaker's own accepted submissions, with schedule
// day/start/end + room name when placed, plus the "latest deliverable" read
// used by the portal home.

import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { formatRef } from "../../../domain/ids";
import { PORTAL_VISIBLE_INVITE_STATUSES } from "../../../domain/acceptance";
import { loadTrackNamesBySubmission } from "../submission-tracks";
import { chunkIds } from "../../../lib/chunk";
import { findConflicts, type PlacedSession } from "../../../domain/schedule";
import { DEC_777, DEC_962 } from "../../../decisions";

void DEC_962;
void DEC_777;

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

/** DEC-777 (wave 44 amendment): names the OTHER session a placed session
 * overlaps, for the "Overlaps <REF> · <time>" inline flag — never a bare
 * id, matching the schedule engine's own describeConflict convention. */
export interface PortalSessionOverlap {
  submissionId: string;
  ref: string;
  day: string;
  startMin: number;
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
  eventId: string;
  eventName: string;
  timezone: string;
  /** DEC-777 amendment: the speaker's own placed sessions that collide with
   * this one in time, per the SAME findConflicts predicate the organizer
   * agenda and auto-schedule pass use — never a second overlap check.
   * Advisory only: rendering this list is the only effect, it never blocks
   * anything or changes status. */
  overlaps: PortalSessionOverlap[];
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
      eventId: schema.event.id,
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
        // DEC-317 (wave-50 amendment): read = not-declined. An 'invited'
        // co-presenter must see the session they're being asked to accept,
        // matching the sibling reader portal/data.ts's use of
        // PORTAL_VISIBLE_INVITE_STATUSES. Write paths (e.g. edit-lock,
        // deliverable upload targets in portal/tasks.ts) stay on
        // ACTIVE_INVITE_STATUSES — this file's write population is
        // unaffected.
        inArray(schema.participant.inviteStatus, PORTAL_VISIBLE_INVITE_STATUSES),
      ),
    );

  const trackNames = await loadTrackNamesBySubmission(
    db,
    rows.map((row) => row.submissionId),
  );

  const sessions = rows.map((row) => ({
    submissionId: row.submissionId,
    ref: formatRef(row.recordPrefix, row.seq),
    title: row.title,
    day: row.day,
    startMin: row.startMin,
    endMin: row.endMin,
    roomName: row.roomName,
    trackName: trackNames.get(row.submissionId)?.[0] ?? null,
    acceptedAt: row.acceptedAt ? row.acceptedAt.getTime() : null,
    eventId: row.eventId,
    eventName: row.eventName,
    timezone: row.timezone,
  }));

  const overlapsBySubmissionId = findMyOverlaps(sessions, contactId);

  return sessions.map((s) => ({
    ...s,
    overlaps: overlapsBySubmissionId.get(s.submissionId) ?? [],
  }));
}

/** DEC-777 (wave 44 amendment): the speaker sees their own clash. Runs the
 * SAME findConflicts predicate the organizer agenda/conflict chips and
 * auto-schedule pass use (src/domain/schedule.ts) over just this speaker's
 * own placed sessions — every placement is tagged with `speakerContactIds:
 * [contactId]`, so any interval overlap between two of the speaker's own
 * sessions surfaces as a speaker_overlap conflict, scoped absolutely to
 * `contactId` because no other speaker's placements are ever passed in.
 * Advisory only — this never blocks, emails, or changes any status; it only
 * feeds the inline "Overlaps <REF> · <time>" flag. */
function findMyOverlaps(
  sessions: Pick<PortalSession, "submissionId" | "ref" | "day" | "startMin" | "endMin">[],
  contactId: string,
): Map<string, PortalSessionOverlap[]> {
  const placed = sessions.filter(
    (s): s is typeof s & { day: string; startMin: number; endMin: number } =>
      s.day !== null && s.startMin !== null && s.endMin !== null,
  );

  const bySubmissionId = new Map(placed.map((s) => [s.submissionId, s]));

  const placedSessions: PlacedSession[] = placed.map((s) => ({
    submissionId: s.submissionId,
    roomId: null,
    day: s.day,
    startMin: s.startMin,
    endMin: s.endMin,
    speakerContactIds: [contactId],
  }));

  const conflicts = findConflicts(placedSessions).filter((c) => c.kind === "speaker_overlap");

  const out = new Map<string, PortalSessionOverlap[]>();
  const addOverlap = (thisId: string, otherId: string) => {
    const other = bySubmissionId.get(otherId);
    if (!other) return;
    const bucket = out.get(thisId) ?? [];
    bucket.push({ submissionId: other.submissionId, ref: other.ref, day: other.day, startMin: other.startMin });
    out.set(thisId, bucket);
  };

  for (const c of conflicts) {
    const a = c.submissionIds[0];
    const b = c.submissionIds[1];
    if (a === undefined || b === undefined) {
      throw new Error("portal overlap: speaker_overlap must carry two ids");
    }
    addOverlap(a, b);
    addOverlap(b, a);
  }

  return out;
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

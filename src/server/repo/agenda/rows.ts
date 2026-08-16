// Shared row-fetching (used by GET agenda, PUT/DELETE slot refresh, and
// auto-schedule persistence). Track membership reads ONLY submission_track
// (DEC-017) — submission.track_id/additional_track_ids_json are frozen
// legacy and never touched here.

import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { formatRef } from "../../../domain/ids";
import { SCHEDULING_PARTICIPANT_STATUSES } from "../../../domain/acceptance";
import { chunkIds } from "../../../lib/chunk";
import { answerFieldRoleCondition, roleAnswerMap } from "../form-roles";
import { ApiError } from "../../http";
import { parseFormatDurationMin } from "../../../domain/schedule";
import type { AgendaSpeaker } from "./types";

export interface EventInfo {
  orgId: string;
  startDate: string;
  endDate: string;
  recordPrefix: string;
}

export async function getEventInfo(db: Db, eventId: string): Promise<EventInfo | null> {
  const rows = await db
    .select({
      orgId: schema.event.orgId,
      startDate: schema.event.startDate,
      endDate: schema.event.endDate,
      recordPrefix: schema.event.recordPrefix,
    })
    .from(schema.event)
    .where(eq(schema.event.id, eventId))
    .limit(1);
  return rows[0] ?? null;
}

/** True iff `roomId` names a room row belonging to `eventId` (DEC-073:
 * room writes/reads must be event-scoped to avoid cross-org room leaks).
 *
 * ONE OWNER (DEC-248 amendment, wave 4): this is the single declaration of
 * the room-ownership predicate under src/ — the agenda repo is the room's
 * home surface. Every other site that needs "does this room belong to this
 * event" imports it from here (or the agenda index barrel); do not add a
 * second copy. test/room-ownership-one-owner.test.ts scans for exactly one
 * exported `roomBelongsToEvent` under src/. */
export async function roomBelongsToEvent(db: Db, roomId: string, eventId: string): Promise<boolean> {
  const rows = await db
    .select({ id: schema.room.id })
    .from(schema.room)
    .where(and(eq(schema.room.id, roomId), eq(schema.room.eventId, eventId)))
    .limit(1);
  return rows.length > 0;
}

/** Returns the submission's eventId + org id, for ownership checks — null if
 * the submission doesn't exist (mirrors submissions repo helper). */
export async function getSubmissionOwnership(
  db: Db,
  submissionId: string,
): Promise<{ eventId: string; orgId: string; status: string } | null> {
  const rows = await db
    .select({ eventId: schema.submission.eventId, orgId: schema.event.orgId, status: schema.submission.status })
    .from(schema.submission)
    .innerJoin(schema.event, eq(schema.submission.eventId, schema.event.id))
    .where(eq(schema.submission.id, submissionId))
    .limit(1);
  return rows[0] ?? null;
}

/** DEC-370 wave-61: single-statement replacement for the PUT
 * .../submissions/:id/slot handler's authz + event-lookup pair
 * (getSubmissionOwnership + getEventInfo), so the route can fold its own
 * refusal reads into ONE wave with the room check instead of two sequential
 * waves. LEFT JOIN is load-bearing: a submission row with no matching event
 * row (should never happen in practice, but the join makes it possible)
 * must still return a row (with null startDate/endDate) rather than
 * collapsing into the same null this function returns for "no submission
 * row at all" — those are two different refusals ("Submission not found"
 * vs "Event not found") and must stay distinguishable. */
export async function getSlotWriteContext(
  db: Db,
  submissionId: string,
): Promise<{
  orgId: string;
  eventId: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  // recordPrefix isn't part of the caller's refusal ladder, but
  // getConflictsAndSummary's placedRows need it for formatRef — carrying it
  // here (same LEFT JOIN, one extra column) avoids a second event read the
  // route would otherwise need just for this one field.
  recordPrefix: string | null;
} | null> {
  const rows = await db
    .select({
      eventId: schema.submission.eventId,
      status: schema.submission.status,
      orgId: schema.event.orgId,
      startDate: schema.event.startDate,
      endDate: schema.event.endDate,
      recordPrefix: schema.event.recordPrefix,
    })
    .from(schema.submission)
    .leftJoin(schema.event, eq(schema.submission.eventId, schema.event.id))
    .where(eq(schema.submission.id, submissionId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    // orgId is only null in the degenerate "event row missing" case (LEFT
    // JOIN); the route's orgId-mismatch check treats null as a mismatch
    // (never equals a real auth.orgId), which reproduces the old inner-join
    // getSubmissionOwnership's "Submission not found" for that same case.
    orgId: row.orgId as string,
    eventId: row.eventId,
    status: row.status,
    startDate: row.startDate,
    endDate: row.endDate,
    recordPrefix: row.recordPrefix,
  };
}

/** DEC-370 wave-61: resolves a room's OWN eventId (no eventId argument to
 * compare against in SQL — the fake dependency roomBelongsToEvent's
 * (roomId, eventId) signature exemplified per DEC-370's finding). The
 * caller compares the returned eventId against the submission's eventId in
 * JS after both reads land in the same wave. */
export async function getRoomEventId(db: Db, roomId: string): Promise<string | null> {
  const rows = await db
    .select({ eventId: schema.room.eventId })
    .from(schema.room)
    .where(eq(schema.room.id, roomId))
    .limit(1);
  return rows[0]?.eventId ?? null;
}

export interface AcceptedSessionRow {
  submissionId: string;
  ref: string;
  title: string;
  trackIds: string[];
  speakers: AgendaSpeaker[];
  speakerContactIds: string[];
  slot: { roomId: string | null; day: string; startMin: number; endMin: number } | null;
}

// DEC-021 wave-60 amendment: hard ceiling on the accepted-session scan below
// (and on getConflictsAndSummary's/overview.ts's placed-slot scans, which
// share this constant rather than restating it) — an agenda read should
// never be scanning past this many rows; refuse rather than silently
// truncate (tasks/reminders.ts's MAX_REMINDER_SCAN pattern).
export const MAX_AGENDA_SCAN = 5000;

export async function loadAcceptedSessions(db: Db, eventId: string, recordPrefix: string): Promise<AcceptedSessionRow[]> {
  const submissionRows = await db
    .select({ id: schema.submission.id, seq: schema.submission.seq, title: schema.submission.title })
    .from(schema.submission)
    .where(and(eq(schema.submission.eventId, eventId), eq(schema.submission.status, "accepted")))
    .limit(MAX_AGENDA_SCAN + 1);

  if (submissionRows.length > MAX_AGENDA_SCAN) {
    throw new ApiError(
      "invalid",
      `This agenda read would scan more than ${MAX_AGENDA_SCAN} accepted submissions`,
    );
  }

  if (submissionRows.length === 0) return [];
  const ids = submissionRows.map((r) => r.id);

  // DEC-155 wave-34 amendment: these three chunked batch readers each
  // consume only `ids` (nothing from one another), so they issue as one
  // Promise.all wave rather than three strictly-sequential chunked loops.
  // Each chunked loop over `ids` still counts as ONE read and stays a
  // chunked loop internally.
  const [trackRows, participantRows, slotRows] = await Promise.all([
    (async () => {
      const rows: { submissionId: string; trackId: string }[] = [];
      for (const batch of chunkIds(ids)) {
        const batchRows = await db
          .select({ submissionId: schema.submissionTrack.submissionId, trackId: schema.submissionTrack.trackId })
          .from(schema.submissionTrack)
          .where(inArray(schema.submissionTrack.submissionId, batch));
        rows.push(...batchRows);
      }
      return rows;
    })(),
    (async () => {
      const rows: {
        submissionId: string;
        contactId: string;
        firstName: string;
        lastName: string;
        order: number;
      }[] = [];
      for (const batch of chunkIds(ids)) {
        const batchRows = await db
          .select({
            submissionId: schema.participant.submissionId,
            contactId: schema.participant.contactId,
            firstName: schema.contact.firstName,
            lastName: schema.contact.lastName,
            order: schema.participant.order,
          })
          .from(schema.participant)
          .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
          .where(
            and(
              inArray(schema.participant.submissionId, batch),
              // DEC-974: the admin agenda's speaker set is the NOT-DECLINED
              // participants (SCHEDULING_PARTICIPANT_STATUSES: 'none'/'invited'/
              // 'accepted'), not ACTIVE_INVITE_STATUSES — an organiser-added
              // co-presenter is minted at 'invited' and must still be visible to
              // the conflict engine and the card. This is also deliberately NOT
              // `participant.visible` — `visible` is a public-display flag
              // composed only for public surfaces (see
              // visibleParticipantConditions); a speaker hidden from the public
              // programme, or still pending their invite, is still a person who
              // cannot be double-booked, so they must still count for conflict
              // detection.
              inArray(schema.participant.inviteStatus, [...SCHEDULING_PARTICIPANT_STATUSES]),
            ),
          );
        rows.push(...batchRows);
      }
      return rows;
    })(),
    (async () => {
      const rows: {
        submissionId: string;
        roomId: string | null;
        day: string;
        startMin: number;
        endMin: number;
      }[] = [];
      for (const batch of chunkIds(ids)) {
        const batchRows = await db
          .select({
            submissionId: schema.scheduleSlot.submissionId,
            roomId: schema.scheduleSlot.roomId,
            day: schema.scheduleSlot.day,
            startMin: schema.scheduleSlot.startMin,
            endMin: schema.scheduleSlot.endMin,
          })
          .from(schema.scheduleSlot)
          .where(inArray(schema.scheduleSlot.submissionId, batch));
        rows.push(...batchRows);
      }
      return rows;
    })(),
  ]);

  const tracksBySubmission = new Map<string, string[]>();
  for (const t of trackRows) {
    const arr = tracksBySubmission.get(t.submissionId) ?? [];
    arr.push(t.trackId);
    tracksBySubmission.set(t.submissionId, arr);
  }

  const speakersBySubmission = new Map<string, { contactId: string; name: string; order: number }[]>();
  for (const p of participantRows) {
    const arr = speakersBySubmission.get(p.submissionId) ?? [];
    arr.push({ contactId: p.contactId, name: `${p.firstName} ${p.lastName}`.trim(), order: p.order });
    speakersBySubmission.set(p.submissionId, arr);
  }
  for (const arr of speakersBySubmission.values())
    arr.sort((a, b) => a.order - b.order || (a.contactId < b.contactId ? -1 : a.contactId > b.contactId ? 1 : 0));

  const slotBySubmission = new Map<string, { roomId: string | null; day: string; startMin: number; endMin: number }>();
  for (const s of slotRows) {
    slotBySubmission.set(s.submissionId, { roomId: s.roomId, day: s.day, startMin: s.startMin, endMin: s.endMin });
  }

  return submissionRows.map((r) => {
    const speakers = (speakersBySubmission.get(r.id) ?? []).map(({ contactId, name }) => ({ contactId, name }));
    return {
      submissionId: r.id,
      ref: formatRef(recordPrefix, r.seq),
      title: r.title,
      trackIds: tracksBySubmission.get(r.id) ?? [],
      speakers,
      speakerContactIds: speakers.map((s) => s.contactId),
      slot: slotBySubmission.get(r.id) ?? null,
    };
  });
}

/** DEC-772: batches ONE query over submission_answer (chunked exactly like
 * src/server/repo/public/sessions.ts's format hydration) for each id's
 * session_format-role answer, parses the "(N min)" suffix via
 * parseFormatDurationMin, and falls back to defaultDurationMin whenever the
 * session has no format answer or its label carries no parseable duration.
 * `eventId` documents the caller's scope — `submissionIds` must already be
 * scoped to that event (this table carries no event_id column of its own). */
export async function loadDurationMinBySubmission(
  db: Db,
  eventId: string,
  submissionIds: string[],
  defaultDurationMin: number,
): Promise<Map<string, number>> {
  void eventId;
  const result = new Map<string, number>();
  if (submissionIds.length === 0) return result;

  const formatRows: { submissionId: string; valueJson: string }[] = [];
  for (const batch of chunkIds(submissionIds)) {
    const batchRows = await db
      .select({
        submissionId: schema.submissionAnswer.submissionId,
        valueJson: schema.submissionAnswer.valueJson,
      })
      .from(schema.submissionAnswer)
      .where(
        and(
          inArray(schema.submissionAnswer.submissionId, batch),
          answerFieldRoleCondition("session_format"),
        ),
      );
    formatRows.push(...batchRows);
  }

  const formatBySubmission = roleAnswerMap(formatRows);

  for (const id of submissionIds) {
    const label = formatBySubmission.get(id) ?? null;
    result.set(id, parseFormatDurationMin(label) ?? defaultDurationMin);
  }
  return result;
}

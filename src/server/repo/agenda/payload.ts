// Agenda payload assembly (DEC-021 single round-trip GET), the window-
// narrowing scan (DEC-844), and the public-visibility count used by
// PATCH /events/:eventId (DEC-595). Route handlers in src/routes/agenda.ts
// call these; the pure conflict/auto-schedule engine lives in
// src/domain/schedule.ts (DEC-010).

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { formatRef } from "../../../domain/ids";
import { chunkIds } from "../../../lib/chunk";
import { visibleSessionConditions } from "../public/gates";
import { ApiError } from "../../http";
import { findConflicts, scheduleSummary, type PlacedSession, type ScheduleBlock } from "../../../domain/schedule";
import { dayOutsideEventRangeCondition, isDayWithinEventRange } from "./days";
import { eventDays } from "../../../domain/event-days";
import { buildConflictLabels, describeConflicts } from "./labels";
import { SCHEDULING_PARTICIPANT_STATUSES } from "../../../domain/acceptance";
import { listBreaksForEvent, type ScheduleBreak } from "../breaks";
import {
  MAX_AGENDA_SCAN,
  loadAcceptedSessions,
  type AcceptedSessionRow,
  type EventInfo,
} from "./rows";
import type {
  AgendaPayload,
  DescribedConflict,
  PlacedAgendaSession,
  UnscheduledAgendaSession,
} from "./types";

/** DEC-557 (wave 69 amendment): the ONE place a ScheduleBreak row becomes
 * the ScheduleBlock shape findConflicts needs. `endMin` is derived, never
 * stored twice. Exported (DEC-370 wave-71 amendment) so overview.ts's
 * conflict wave can reuse this exact conversion instead of a second copy. */
export function toScheduleBlocks(breaks: ScheduleBreak[]): ScheduleBlock[] {
  return breaks.map((b) => ({
    breakId: b.id,
    label: b.label,
    day: b.day,
    startMin: b.startMin,
    endMin: b.startMin + b.durationMin,
  }));
}

/** Builds the full GET .../agenda payload (DEC-021 single round-trip). */
export async function getAgendaPayload(db: Db, eventId: string, event: EventInfo): Promise<AgendaPayload> {
  const days = eventDays(event.startDate, event.endDate);

  // DEC-155 wave-34 amendment: roomRows, trackRows, loadAcceptedSessions and
  // the event's breaks (DEC-557 wave-69 amendment: break conflicts need the
  // same rows autoSchedule already loads) consume nothing from one another
  // (all four are scoped only by `eventId`), so they issue as one
  // Promise.all wave rather than sequential awaits.
  const [roomRows, trackRows, accepted, breaks] = await Promise.all([
    db
      .select({ id: schema.room.id, name: schema.room.name })
      .from(schema.room)
      .where(eq(schema.room.eventId, eventId))
      .orderBy(schema.room.position, asc(schema.room.id)),
    db
      .select({ id: schema.track.id, name: schema.track.name, color: schema.track.color })
      .from(schema.track)
      .where(eq(schema.track.eventId, eventId))
      .orderBy(schema.track.position),
    loadAcceptedSessions(db, eventId, event.recordPrefix),
    listBreaksForEvent(db, eventId),
  ]);
  const blocks = toScheduleBlocks(breaks);

  const placed: PlacedAgendaSession[] = [];
  const unscheduled: UnscheduledAgendaSession[] = [];
  const placedSessions: PlacedSession[] = [];

  for (const s of accepted) {
    if (s.slot && isDayWithinEventRange(s.slot.day, event.startDate, event.endDate)) {
      placed.push({
        submissionId: s.submissionId,
        ref: s.ref,
        title: s.title,
        trackIds: s.trackIds,
        speakers: s.speakers,
        roomId: s.slot.roomId,
        day: s.slot.day,
        startMin: s.slot.startMin,
        endMin: s.slot.endMin,
      });
      placedSessions.push({
        submissionId: s.submissionId,
        roomId: s.slot.roomId,
        day: s.slot.day,
        startMin: s.slot.startMin,
        endMin: s.slot.endMin,
        speakerContactIds: s.speakerContactIds,
      });
    } else {
      unscheduled.push({
        submissionId: s.submissionId,
        ref: s.ref,
        title: s.title,
        trackIds: s.trackIds,
        speakers: s.speakers,
      });
    }
  }

  const conflicts = findConflicts(placedSessions, blocks);
  const summary = scheduleSummary(placedSessions, accepted.length, conflicts);
  const labels = buildConflictLabels(roomRows, accepted);

  return {
    days,
    rooms: roomRows,
    tracks: trackRows,
    placed,
    unscheduled,
    conflicts: describeConflicts(conflicts, labels),
    unplacedReasons: [],
    summary,
  };
}

/** DEC-844: narrowing an event's window (PATCH /events/:eventId) must name
 * every placed session it unschedules. Composes the SAME day-range predicate
 * (isDayWithinEventRange) that getAgendaPayload/getConflictsAndSummary own —
 * a slot is "outside window" iff that predicate is false for the NEW dates.
 * Returns the true total count plus at most `limit` named rows (ordered by
 * submission id for determinism), so callers can report "N sessions, showing
 * the first `limit`" without a second query. */
export async function listSlotsOutsideWindow(
  db: Db,
  eventId: string,
  startDate: string,
  endDate: string,
  limit = 20,
): Promise<{ count: number; sessions: { submissionId: string; ref: string; title: string; day: string }[] }> {
  const eventRows = await db
    .select({ recordPrefix: schema.event.recordPrefix })
    .from(schema.event)
    .where(eq(schema.event.id, eventId))
    .limit(1);
  const recordPrefix = eventRows[0]?.recordPrefix;
  if (recordPrefix === undefined) return { count: 0, sessions: [] };

  const baseWhere = and(
    eq(schema.submission.eventId, eventId),
    eq(schema.submission.status, "accepted"),
    dayOutsideEventRangeCondition(startDate, endDate),
  );

  const countRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.scheduleSlot)
    .innerJoin(schema.submission, eq(schema.scheduleSlot.submissionId, schema.submission.id))
    .where(baseWhere);
  const count = Number(countRows[0]?.count ?? 0);

  const rows = await db
    .select({
      submissionId: schema.scheduleSlot.submissionId,
      day: schema.scheduleSlot.day,
      seq: schema.submission.seq,
      title: schema.submission.title,
    })
    .from(schema.scheduleSlot)
    .innerJoin(schema.submission, eq(schema.scheduleSlot.submissionId, schema.submission.id))
    .where(baseWhere)
    .orderBy(asc(schema.scheduleSlot.submissionId))
    .limit(limit);

  return {
    count,
    sessions: rows.map((r) => ({
      submissionId: r.submissionId,
      ref: formatRef(recordPrefix, r.seq),
      title: r.title,
      day: r.day,
    })),
  };
}

/** DEC-595: resolves the subset of `submissionIds` that pass the SAME public
 * visibility gate (src/server/repo/public/gates.ts's visibleSessionConditions
 * — accepted + content-approved) every other gated read uses. Placed
 * sessions are already status='accepted' (loadAcceptedSessions filters on
 * it), so in practice this narrows on content_status='approved' — but the
 * gate is imported, never re-derived, per the one-predicate rule. Returns a
 * Set so both the count (`.size`) and the held-back complement (DEC-595 wave
 * 67 amendment: publish must NAME withheld sessions) derive from the SAME
 * query — no second predicate. */
export async function publiclyVisibleIds(db: Db, eventId: string, submissionIds: string[]): Promise<Set<string>> {
  const visible = new Set<string>();
  if (submissionIds.length === 0) return visible;
  for (const batch of chunkIds(submissionIds)) {
    const rows = await db
      .select({ id: schema.submission.id })
      .from(schema.submission)
      .where(and(eq(schema.submission.eventId, eventId), inArray(schema.submission.id, batch), visibleSessionConditions()));
    for (const r of rows) visible.add(r.id);
  }
  return visible;
}

/** DEC-595: counts how many of `submissionIds` pass the public gate. Thin
 * wrapper over publiclyVisibleIds — kept for callers that only need the
 * count. */
export async function countPubliclyVisible(db: Db, eventId: string, submissionIds: string[]): Promise<number> {
  const visible = await publiclyVisibleIds(db, eventId, submissionIds);
  return visible.size;
}

/** Refreshed { conflicts, summary } only — used after PUT/DELETE slot writes,
 * which per DEC-010 are NEVER blocked by conflicts. DEC-021 wave-60
 * amendment: unlike getAgendaPayload, this NEVER calls loadAcceptedSessions
 * (which reads every accepted submission in the event just to filter down to
 * the placed handful) — it drives straight off schedule_slot innerJoin
 * submission (eventId + status='accepted'), bounded by the same
 * MAX_AGENDA_SCAN ceiling, and hydrates only THOSE submission ids' speakers.
 * Conflicts can only ever involve placed sessions, so this is a strict
 * subset of loadAcceptedSessions' rows — the returned {conflicts, summary}
 * shape/prose is unchanged. DEC-557/DEC-078: one bounded per-event
 * room-name query (rooms are ~15) so conflicts can be rendered by name
 * here too. */
export async function getConflictsAndSummary(
  db: Db,
  eventId: string,
  event: Pick<EventInfo, "startDate" | "endDate" | "recordPrefix">,
): Promise<{
  conflicts: DescribedConflict[];
  summary: { unplaced: number; conflicts: number; placed: number; total: number };
}> {
  // DEC-155 wave-34 amendment: roomRows (:283 originally) and
  // totalAcceptedRows (:289 originally) consume nothing from the slot chain
  // below (both are scoped only by `eventId`), so they join the slot read's
  // wave rather than trailing it as two more sequential awaits. DEC-557
  // (wave 69 amendment): breaks join the same wave for the same reason.
  const [slotRows, roomRows, totalAcceptedRows, breaks] = await Promise.all([
    db
      .select({
        submissionId: schema.scheduleSlot.submissionId,
        roomId: schema.scheduleSlot.roomId,
        day: schema.scheduleSlot.day,
        startMin: schema.scheduleSlot.startMin,
        endMin: schema.scheduleSlot.endMin,
        seq: schema.submission.seq,
        title: schema.submission.title,
      })
      .from(schema.scheduleSlot)
      .innerJoin(schema.submission, eq(schema.scheduleSlot.submissionId, schema.submission.id))
      .where(and(eq(schema.submission.eventId, eventId), eq(schema.submission.status, "accepted")))
      .limit(MAX_AGENDA_SCAN + 1),
    db
      .select({ id: schema.room.id, name: schema.room.name })
      .from(schema.room)
      .where(eq(schema.room.eventId, eventId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.submission)
      .where(and(eq(schema.submission.eventId, eventId), eq(schema.submission.status, "accepted"))),
    listBreaksForEvent(db, eventId),
  ]);
  const blocks = toScheduleBlocks(breaks);

  if (slotRows.length > MAX_AGENDA_SCAN) {
    throw new ApiError(
      "invalid",
      `This agenda read would scan more than ${MAX_AGENDA_SCAN} placed sessions`,
    );
  }

  const withinWindow = slotRows.filter((s) => isDayWithinEventRange(s.day, event.startDate, event.endDate));
  const placedIds = withinWindow.map((s) => s.submissionId);

  const participantRows: {
    submissionId: string;
    contactId: string;
    firstName: string;
    lastName: string;
    order: number;
  }[] = [];
  for (const batch of chunkIds(placedIds)) {
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
          // DEC-974: same not-declined participant rule as loadAcceptedSessions
          // — a speaker hidden from the public programme, or still pending
          // their invite, still can't be double-booked, so
          // SCHEDULING_PARTICIPANT_STATUSES (not ACTIVE_INVITE_STATUSES, not
          // `visible`).
          inArray(schema.participant.inviteStatus, [...SCHEDULING_PARTICIPANT_STATUSES]),
        ),
      );
    participantRows.push(...batchRows);
  }

  const speakersBySubmission = new Map<string, { contactId: string; name: string; order: number }[]>();
  for (const p of participantRows) {
    const arr = speakersBySubmission.get(p.submissionId) ?? [];
    arr.push({ contactId: p.contactId, name: `${p.firstName} ${p.lastName}`.trim(), order: p.order });
    speakersBySubmission.set(p.submissionId, arr);
  }
  for (const arr of speakersBySubmission.values())
    arr.sort((a, b) => a.order - b.order || (a.contactId < b.contactId ? -1 : a.contactId > b.contactId ? 1 : 0));

  const placedRows: AcceptedSessionRow[] = withinWindow.map((s) => ({
    submissionId: s.submissionId,
    ref: formatRef(event.recordPrefix, s.seq),
    title: s.title,
    trackIds: [],
    speakers: (speakersBySubmission.get(s.submissionId) ?? []).map(({ contactId, name }) => ({ contactId, name })),
    speakerContactIds: (speakersBySubmission.get(s.submissionId) ?? []).map((p) => p.contactId),
    slot: { roomId: s.roomId, day: s.day, startMin: s.startMin, endMin: s.endMin },
  }));

  const placedSessions: PlacedSession[] = placedRows.map((s) => ({
    submissionId: s.submissionId,
    roomId: s.slot!.roomId,
    day: s.slot!.day,
    startMin: s.slot!.startMin,
    endMin: s.slot!.endMin,
    speakerContactIds: s.speakerContactIds,
  }));
  const conflicts = findConflicts(placedSessions, blocks);

  const labels = buildConflictLabels(roomRows, placedRows);
  const totalAccepted = Number(totalAcceptedRows[0]?.count ?? 0);

  return {
    conflicts: describeConflicts(conflicts, labels),
    summary: scheduleSummary(placedSessions, totalAccepted, conflicts),
  };
}

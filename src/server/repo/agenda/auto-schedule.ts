// Auto-schedule (DEC-010 greedy engine, DEC-021 defaults + persistence).

import { asc, eq } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { newId } from "../../../domain/ids";
import { chunkRowsForInsert } from "../../../lib/chunk";
import { bumpIcsSequences } from "../ics-sequence";
import {
  autoSchedule,
  describeUnplaced,
  type AutoScheduleSessionInput,
  type PlacedSession,
  type UnplacedLabels,
  type UnplacedSession,
} from "../../../domain/schedule";
import { eventDays } from "../../../domain/event-days";
import { listBreaksForEvent } from "../breaks";
import { loadAcceptedSessions, loadDurationMinBySubmission, type AcceptedSessionRow, type EventInfo } from "./rows";
import { getAgendaPayload } from "./payload";
import type { AgendaPayload, DescribedUnplaced } from "./types";

export interface AutoScheduleParams {
  dayStartMin: number;
  dayEndMin: number;
  defaultDurationMin: number;
  gridMin: number;
}

// Per-request write-burst bound (DEC-492) for runAutoSchedule's persisted
// placements. J9 auto-schedule only warns on unplaced sessions, it never
// blocks — so overflow beyond this cap simply stays unplaced and is already
// surfaced via getAgendaPayload's unplaced count, never thrown.
export const MAX_AUTO_SCHEDULE_PLACEMENTS = 2000;

/** Runs autoSchedule() over unplaced accepted sessions and persists any new
 * placements (schedule_slot insert + ics_sequence bump), then returns the
 * full refreshed agenda payload. */
export async function runAutoSchedule(
  db: Db,
  eventId: string,
  event: EventInfo,
  params: AutoScheduleParams,
): Promise<AgendaPayload> {
  const days = eventDays(event.startDate, event.endDate);
  const roomRows = await db
    .select({ id: schema.room.id })
    .from(schema.room)
    .where(eq(schema.room.eventId, eventId))
    .orderBy(schema.room.position, asc(schema.room.id));
  const rooms = roomRows.map((r) => r.id);

  const accepted = await loadAcceptedSessions(db, eventId, event.recordPrefix);
  // DEC-010 amendment (wave 66): the placer must never place a session into
  // an organizer-defined break window.
  const breaks = await listBreaksForEvent(db, eventId);

  const existing: PlacedSession[] = accepted
    .filter((s): s is AcceptedSessionRow & { slot: NonNullable<AcceptedSessionRow["slot"]> } => s.slot !== null)
    .map((s) => ({
      submissionId: s.submissionId,
      roomId: s.slot.roomId,
      day: s.slot.day,
      startMin: s.slot.startMin,
      endMin: s.slot.endMin,
      speakerContactIds: s.speakerContactIds,
    }));
  const existingIds = new Set(existing.map((s) => s.submissionId));

  const unscheduledAccepted = accepted.filter((s) => s.slot === null);
  // DEC-772: a session's block length is its own format's duration, not the
  // grid's flat default — loadDurationMinBySubmission falls back to
  // params.defaultDurationMin per id whenever the format answer is missing
  // or carries no parseable "(N min)" suffix.
  const durationMinBySubmissionId = await loadDurationMinBySubmission(
    db,
    eventId,
    unscheduledAccepted.map((s) => s.submissionId),
    params.defaultDurationMin,
  );
  const sessions: AutoScheduleSessionInput[] = unscheduledAccepted.map((s) => ({
    submissionId: s.submissionId,
    durationMin: durationMinBySubmissionId.get(s.submissionId) ?? params.defaultDurationMin,
    track: s.trackIds[0] ?? null,
    speakerContactIds: s.speakerContactIds,
  }));

  const { placed: result, unplaced: unplacedFromRun } = autoSchedule({
    sessions,
    rooms,
    days,
    dayStartMin: params.dayStartMin,
    dayEndMin: params.dayEndMin,
    gridMin: params.gridMin,
    existing,
    blocked: breaks.map((b) => ({ day: b.day, startMin: b.startMin, endMin: b.startMin + b.durationMin })),
  });

  const now = new Date();
  const allNewPlacements = result.filter((placement) => !existingIds.has(placement.submissionId));
  // DEC-492 (wave 46 amendment): the write-burst bound stays, but the tail
  // past the cap is a placement autoSchedule already SUCCEEDED at computing
  // — it must be reported, not silently dropped, so it is appended below to
  // unplacedFromRun under 'write_cap_reached' rather than discarded here.
  const newPlacements = allNewPlacements.slice(0, MAX_AUTO_SCHEDULE_PLACEMENTS);
  const cappedPlacements = allNewPlacements.slice(MAX_AUTO_SCHEDULE_PLACEMENTS);

  const writtenSubmissionIds: string[] = [];
  if (newPlacements.length > 0) {
    const rows = newPlacements.map((placement) => ({
      id: newId(),
      submissionId: placement.submissionId,
      roomId: placement.roomId,
      day: placement.day,
      startMin: placement.startMin,
      endMin: placement.endMin,
      createdAt: now,
      updatedAt: now,
    }));
    for (const chunk of chunkRowsForInsert(rows)) {
      // DEC-552/DEC-492: one atomic statement per chunk -- a slot that
      // appeared for a submission between the read (autoSchedule's snapshot
      // above) and this write is left alone, never overwritten.
      const written = await db
        .insert(schema.scheduleSlot)
        .values(chunk)
        .onConflictDoNothing({ target: schema.scheduleSlot.submissionId })
        .returning({ submissionId: schema.scheduleSlot.submissionId });
      for (const w of written) writtenSubmissionIds.push(w.submissionId);
    }
    if (writtenSubmissionIds.length > 0) {
      // DEC-492: bump ONLY the ids this run actually wrote -- a SEQUENCE
      // bump naming a row this run did not write is a lie to every
      // subscribed calendar.
      await bumpIcsSequences(db, writtenSubmissionIds);
    }
  }

  const payload = await getAgendaPayload(db, eventId, event);

  // DEC-615: render this run's per-item reasons using the SAME title
  // lookup buildConflictLabels already builds — titleBySubmissionId
  // never desyncs from the conflicts renderer's.
  const placedDurationMinBySubmissionId = new Map(sessions.map((s) => [s.submissionId, s.durationMin]));
  const titleBySubmissionId = new Map(accepted.map((s) => [s.submissionId, s.title]));
  const speakerNameByContactId = new Map<string, string>();
  for (const s of accepted) {
    for (const speaker of s.speakers) speakerNameByContactId.set(speaker.contactId, speaker.name);
  }
  const unplacedLabels: UnplacedLabels = { titleBySubmissionId, speakerNameByContactId };
  // DEC-492 (wave 46 amendment): placements autoSchedule succeeded at but
  // that fell past MAX_AUTO_SCHEDULE_PLACEMENTS are reported here with their
  // real duration, never dropped without explanation.
  const cappedUnplaced: UnplacedSession[] = cappedPlacements.map((p) => ({
    submissionId: p.submissionId,
    reason: "write_cap_reached" as const,
  }));
  const unplacedReasons: DescribedUnplaced[] = [...unplacedFromRun, ...cappedUnplaced].map((u) => {
    const durationMin = placedDurationMinBySubmissionId.get(u.submissionId) ?? params.defaultDurationMin;
    const sessionForCopy = { submissionId: u.submissionId, durationMin };
    return {
      ...u,
      durationMin,
      detail: describeUnplaced(u.reason, unplacedLabels, sessionForCopy),
    };
  });

  return { ...payload, unplacedReasons };
}

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
} from "../../../domain/schedule";
import { computeDays } from "./days";
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
  const days = computeDays(event.startDate, event.endDate);
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
  const newPlacements = result
    .filter((placement) => !existingIds.has(placement.submissionId))
    .slice(0, MAX_AUTO_SCHEDULE_PLACEMENTS);

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
      await db.insert(schema.scheduleSlot).values(chunk);
    }
    await bumpIcsSequences(
      db,
      newPlacements.map((p) => p.submissionId),
    );
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
  const unplacedReasons: DescribedUnplaced[] = unplacedFromRun.map((u) => {
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

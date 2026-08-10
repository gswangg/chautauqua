// Agenda data access (J9, DEC-021 payload contract). Route handlers in
// src/routes/agenda.ts call these; the pure conflict/auto-schedule engine
// lives in src/domain/schedule.ts (DEC-010). Track membership reads ONLY
// submission_track (DEC-017) — submission.track_id/additional_track_ids_json
// are frozen legacy and never touched here.

import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { formatRef, newId } from "../../domain/ids";
import { chunkIds } from "../../lib/chunk";
import {
  autoSchedule,
  findConflicts,
  scheduleSummary,
  type AutoScheduleSessionInput,
  type Conflict,
  type PlacedSession,
} from "../../domain/schedule";

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested directly, no I/O)
// ---------------------------------------------------------------------------

/** Inclusive list of 'YYYY-MM-DD' days from event.startDate..endDate. */
export function computeDays(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error(`computeDays: invalid date range '${startDate}'..'${endDate}'`);
  }
  const days: string[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 24 * 60 * 60 * 1000) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}

export const DEFAULT_AUTO_SCHEDULE_PARAMS = {
  dayStartMin: 540,
  dayEndMin: 1080,
  defaultDurationMin: 30,
  gridMin: 15,
} as const;

// ---------------------------------------------------------------------------
// Payload shapes (DEC-021)
// ---------------------------------------------------------------------------

export interface AgendaSpeaker {
  contactId: string;
  name: string;
}

export interface AgendaSessionBase {
  submissionId: string;
  ref: string;
  title: string;
  trackIds: string[];
  speakers: AgendaSpeaker[];
}

export interface PlacedAgendaSession extends AgendaSessionBase {
  roomId: string | null;
  day: string;
  startMin: number;
  endMin: number;
}

export type UnscheduledAgendaSession = AgendaSessionBase;

export interface AgendaRoom {
  id: string;
  name: string;
}

export interface AgendaTrack {
  id: string;
  name: string;
  color: string | null;
}

export interface AgendaPayload {
  days: string[];
  rooms: AgendaRoom[];
  tracks: AgendaTrack[];
  placed: PlacedAgendaSession[];
  unscheduled: UnscheduledAgendaSession[];
  conflicts: Conflict[];
  summary: { unplaced: number; conflicts: number };
}

// ---------------------------------------------------------------------------
// Shared row-fetching (used by GET agenda, PUT/DELETE slot refresh, and
// auto-schedule persistence)
// ---------------------------------------------------------------------------

interface EventInfo {
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
 * room writes/reads must be event-scoped to avoid cross-org room leaks). */
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

interface AcceptedSessionRow {
  submissionId: string;
  ref: string;
  title: string;
  trackIds: string[];
  speakers: AgendaSpeaker[];
  speakerContactIds: string[];
  slot: { roomId: string | null; day: string; startMin: number; endMin: number } | null;
}

async function loadAcceptedSessions(db: Db, eventId: string, recordPrefix: string): Promise<AcceptedSessionRow[]> {
  const submissionRows = await db
    .select({ id: schema.submission.id, seq: schema.submission.seq, title: schema.submission.title })
    .from(schema.submission)
    .where(and(eq(schema.submission.eventId, eventId), eq(schema.submission.status, "accepted")));

  if (submissionRows.length === 0) return [];
  const ids = submissionRows.map((r) => r.id);

  const trackRows: { submissionId: string; trackId: string }[] = [];
  for (const batch of chunkIds(ids)) {
    const batchRows = await db
      .select({ submissionId: schema.submissionTrack.submissionId, trackId: schema.submissionTrack.trackId })
      .from(schema.submissionTrack)
      .where(inArray(schema.submissionTrack.submissionId, batch));
    trackRows.push(...batchRows);
  }

  const participantRows: {
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
      .where(inArray(schema.participant.submissionId, batch));
    participantRows.push(...batchRows);
  }

  const slotRows: {
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
    slotRows.push(...batchRows);
  }

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
  for (const arr of speakersBySubmission.values()) arr.sort((a, b) => a.order - b.order);

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

/** Builds the full GET .../agenda payload (DEC-021 single round-trip). */
export async function getAgendaPayload(db: Db, eventId: string, event: EventInfo): Promise<AgendaPayload> {
  const days = computeDays(event.startDate, event.endDate);

  const roomRows = await db
    .select({ id: schema.room.id, name: schema.room.name })
    .from(schema.room)
    .where(eq(schema.room.eventId, eventId))
    .orderBy(schema.room.position);

  const trackRows = await db
    .select({ id: schema.track.id, name: schema.track.name, color: schema.track.color })
    .from(schema.track)
    .where(eq(schema.track.eventId, eventId))
    .orderBy(schema.track.position);

  const accepted = await loadAcceptedSessions(db, eventId, event.recordPrefix);

  const placed: PlacedAgendaSession[] = [];
  const unscheduled: UnscheduledAgendaSession[] = [];
  const placedSessions: PlacedSession[] = [];

  for (const s of accepted) {
    if (s.slot) {
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

  const conflicts = findConflicts(placedSessions);
  const summary = scheduleSummary(placedSessions, accepted.length);

  return {
    days,
    rooms: roomRows,
    tracks: trackRows,
    placed,
    unscheduled,
    conflicts,
    summary,
  };
}

/** Refreshed { conflicts, summary } only — used after PUT/DELETE slot writes,
 * which per DEC-010 are NEVER blocked by conflicts. */
export async function getConflictsAndSummary(
  db: Db,
  eventId: string,
  recordPrefix: string,
): Promise<{ conflicts: Conflict[]; summary: { unplaced: number; conflicts: number } }> {
  const accepted = await loadAcceptedSessions(db, eventId, recordPrefix);
  const placedSessions: PlacedSession[] = accepted
    .filter((s): s is AcceptedSessionRow & { slot: NonNullable<AcceptedSessionRow["slot"]> } => s.slot !== null)
    .map((s) => ({
      submissionId: s.submissionId,
      roomId: s.slot.roomId,
      day: s.slot.day,
      startMin: s.slot.startMin,
      endMin: s.slot.endMin,
      speakerContactIds: s.speakerContactIds,
    }));
  return {
    conflicts: findConflicts(placedSessions),
    summary: scheduleSummary(placedSessions, accepted.length),
  };
}

// ---------------------------------------------------------------------------
// Slot writes (DEC-021: accepted-only, always bump ics_sequence)
// ---------------------------------------------------------------------------

export interface SlotInput {
  day: string;
  startMin: number;
  endMin: number;
  roomId?: string | null;
}

export function isValidSlotInput(body: unknown): body is SlotInput {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  const dayOk = typeof b.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.day);
  const startOk = typeof b.startMin === "number" && Number.isInteger(b.startMin) && b.startMin >= 0;
  const endOk = typeof b.endMin === "number" && Number.isInteger(b.endMin) && b.endMin > (b.startMin as number);
  const roomOk = b.roomId === undefined || b.roomId === null || typeof b.roomId === "string";
  return dayOk && startOk && endOk && roomOk;
}

/** Upserts the schedule_slot for an accepted submission and bumps
 * ics_sequence (DEC-007 caller duty). Throws (via caller's ApiError) is the
 * route's job — this function assumes the accepted-only check already ran. */
export async function upsertSlot(db: Db, submissionId: string, input: SlotInput): Promise<void> {
  const now = new Date();
  const existing = await db
    .select({ id: schema.scheduleSlot.id })
    .from(schema.scheduleSlot)
    .where(eq(schema.scheduleSlot.submissionId, submissionId))
    .limit(1);

  if (existing[0]) {
    await db
      .update(schema.scheduleSlot)
      .set({
        roomId: input.roomId ?? null,
        day: input.day,
        startMin: input.startMin,
        endMin: input.endMin,
        updatedAt: now,
      })
      .where(eq(schema.scheduleSlot.submissionId, submissionId));
  } else {
    await db.insert(schema.scheduleSlot).values({
      id: newId(),
      submissionId,
      roomId: input.roomId ?? null,
      day: input.day,
      startMin: input.startMin,
      endMin: input.endMin,
      createdAt: now,
      updatedAt: now,
    });
  }

  await bumpIcsSequence(db, submissionId, now);
}

export async function unscheduleSlot(db: Db, submissionId: string): Promise<void> {
  const now = new Date();
  await db.delete(schema.scheduleSlot).where(eq(schema.scheduleSlot.submissionId, submissionId));
  await bumpIcsSequence(db, submissionId, now);
}

async function bumpIcsSequence(db: Db, submissionId: string, now: Date): Promise<void> {
  const rows = await db
    .select({ icsSequence: schema.submission.icsSequence })
    .from(schema.submission)
    .where(eq(schema.submission.id, submissionId))
    .limit(1);
  const current = rows[0]?.icsSequence ?? 0;
  await db
    .update(schema.submission)
    .set({ icsSequence: current + 1, updatedAt: now })
    .where(eq(schema.submission.id, submissionId));
}

// ---------------------------------------------------------------------------
// Auto-schedule (DEC-010 greedy engine, DEC-021 defaults + persistence)
// ---------------------------------------------------------------------------

export interface AutoScheduleParams {
  dayStartMin: number;
  dayEndMin: number;
  defaultDurationMin: number;
  gridMin: number;
}

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
    .orderBy(schema.room.position);
  const rooms = roomRows.map((r) => r.id);

  const accepted = await loadAcceptedSessions(db, eventId, event.recordPrefix);

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

  const unplaced = accepted.filter((s) => s.slot === null);
  const sessions: AutoScheduleSessionInput[] = unplaced.map((s) => ({
    submissionId: s.submissionId,
    durationMin: params.defaultDurationMin,
    track: s.trackIds[0] ?? null,
    speakerContactIds: s.speakerContactIds,
  }));

  const result = autoSchedule({
    sessions,
    rooms,
    days,
    dayStartMin: params.dayStartMin,
    dayEndMin: params.dayEndMin,
    gridMin: params.gridMin,
    existing,
  });

  const now = new Date();
  for (const placement of result) {
    if (existingIds.has(placement.submissionId)) continue;
    await db.insert(schema.scheduleSlot).values({
      id: newId(),
      submissionId: placement.submissionId,
      roomId: placement.roomId,
      day: placement.day,
      startMin: placement.startMin,
      endMin: placement.endMin,
      createdAt: now,
      updatedAt: now,
    });
    await bumpIcsSequence(db, placement.submissionId, now);
  }

  return getAgendaPayload(db, eventId, event);
}

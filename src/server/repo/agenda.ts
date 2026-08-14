// Agenda data access (J9, DEC-021 payload contract). Route handlers in
// src/routes/agenda.ts call these; the pure conflict/auto-schedule engine
// lives in src/domain/schedule.ts (DEC-010). Track membership reads ONLY
// submission_track (DEC-017) — submission.track_id/additional_track_ids_json
// are frozen legacy and never touched here.

import { and, asc, eq, gt, inArray, lt, or, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { formatRef, newId } from "../../domain/ids";
import { ACTIVE_INVITE_STATUSES } from "../../domain/acceptance";
import { chunkIds } from "../../lib/chunk";
import { chunkRowsForInsert } from "../../lib/chunk";
import { bumpIcsSequences } from "./ics-sequence";
import { visibleSessionConditions } from "./public/gates";
import { SESSION_FORMAT_FIELD_ID } from "../../forms/types";
import { ApiError } from "../http";
import {
  autoSchedule,
  describeConflict,
  describeUnplaced,
  findConflicts,
  MINUTES_PER_DAY,
  parseFormatDurationMin,
  scheduleSummary,
  type AutoScheduleSessionInput,
  type Conflict,
  type ConflictLabels,
  type PlacedSession,
  type UnplacedLabels,
  type UnplacedSession,
} from "../../domain/schedule";

/** DEC-557: a Conflict plus its rendered prose, produced by describeConflict
 * — the ONE place a conflict becomes human-readable text. */
export type DescribedConflict = Conflict & { detail: string };

/** DEC-615: an UnplacedSession plus its rendered prose from describeUnplaced
 * and the duration that reason was computed against — the agenda payload's
 * one place an auto-schedule run's unplaced reasons become human-readable. */
export type DescribedUnplaced = UnplacedSession & { durationMin: number; detail: string };

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

/** True iff `day` (YYYY-MM-DD) falls within [startDate, endDate] inclusive,
 * using lexical string comparison (safe for zero-padded ISO dates). DEC-277:
 * slot writes and payload classification must agree on this boundary. */
export function isDayWithinEventRange(day: string, startDate: string, endDate: string): boolean {
  return day >= startDate && day <= endDate;
}

/** SQL twin of isDayWithinEventRange's negation: true iff schedule_slot.day
 * falls OUTSIDE [startDate, endDate] inclusive. Same lexical ISO-day
 * comparison, expressed as a WHERE condition so listSlotsOutsideWindow can
 * COUNT and LIMIT in SQL instead of scanning every row into JS (DEC-844). */
export function dayOutsideEventRangeCondition(startDate: string, endDate: string) {
  return or(lt(schema.scheduleSlot.day, startDate), gt(schema.scheduleSlot.day, endDate));
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
  conflicts: DescribedConflict[];
  /** DEC-615: per-item reasons from the most recent auto-schedule run —
   * only runAutoSchedule populates this (getAgendaPayload's plain GET has
   * never run the placer, so it has no reasons to report). summary.unplaced
   * always counts ALL unplaced accepted sessions (DEC-021), a superset of
   * this list whenever a session has never been through auto-schedule. */
  unplacedReasons: DescribedUnplaced[];
  summary: { unplaced: number; conflicts: number };
}

/** DEC-557: builds the three label maps describeConflict needs from data the
 * callers already loaded — no extra queries beyond the caller-supplied
 * roomRows. */
function buildConflictLabels(
  roomRows: { id: string; name: string }[],
  accepted: AcceptedSessionRow[],
): ConflictLabels {
  const roomNameById = new Map(roomRows.map((r) => [r.id, r.name]));
  const titleBySubmissionId = new Map(accepted.map((s) => [s.submissionId, s.title]));
  const speakerNameByContactId = new Map<string, string>();
  for (const s of accepted) {
    for (const speaker of s.speakers) {
      speakerNameByContactId.set(speaker.contactId, speaker.name);
    }
  }
  return { roomNameById, titleBySubmissionId, speakerNameByContactId };
}

function describeConflicts(
  conflicts: Conflict[],
  labels: ConflictLabels,
): DescribedConflict[] {
  return conflicts.map((c) => ({ ...c, detail: describeConflict(c, labels) }));
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

// DEC-021 wave-60 amendment: hard ceiling on the accepted-session scan below
// (and on getConflictsAndSummary's/overview.ts's placed-slot scans, which
// share this constant rather than restating it) — an agenda read should
// never be scanning past this many rows; refuse rather than silently
// truncate (tasks/reminders.ts's MAX_REMINDER_SCAN pattern).
export const MAX_AGENDA_SCAN = 5000;

async function loadAcceptedSessions(db: Db, eventId: string, recordPrefix: string): Promise<AcceptedSessionRow[]> {
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
      .where(
        and(
          inArray(schema.participant.submissionId, batch),
          // DEC-974: the admin agenda's speaker set is the ACTIVE participants
          // (not-declined). This is deliberately NOT `participant.visible` —
          // `visible` is a public-display flag composed only for public
          // surfaces (see visibleParticipantConditions); a speaker hidden
          // from the public programme is still a person who cannot be
          // double-booked, so they must still count for conflict detection.
          inArray(schema.participant.inviteStatus, [...ACTIVE_INVITE_STATUSES]),
        ),
      );
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
 * SESSION_FORMAT_FIELD_ID answer, parses the "(N min)" suffix via
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
          eq(schema.submissionAnswer.formFieldId, SESSION_FORMAT_FIELD_ID),
        ),
      );
    formatRows.push(...batchRows);
  }

  const formatBySubmission = new Map<string, string | null>();
  for (const r of formatRows) {
    const parsed: unknown = JSON.parse(r.valueJson);
    formatBySubmission.set(r.submissionId, typeof parsed === "string" && parsed.length > 0 ? parsed : null);
  }

  for (const id of submissionIds) {
    const label = formatBySubmission.get(id) ?? null;
    result.set(id, parseFormatDurationMin(label) ?? defaultDurationMin);
  }
  return result;
}

/** Builds the full GET .../agenda payload (DEC-021 single round-trip). */
export async function getAgendaPayload(db: Db, eventId: string, event: EventInfo): Promise<AgendaPayload> {
  const days = computeDays(event.startDate, event.endDate);

  const roomRows = await db
    .select({ id: schema.room.id, name: schema.room.name })
    .from(schema.room)
    .where(eq(schema.room.eventId, eventId))
    .orderBy(schema.room.position, asc(schema.room.id));

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

  const conflicts = findConflicts(placedSessions);
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

/** DEC-595: counts how many of `submissionIds` pass the SAME public
 * visibility gate (src/server/repo/public/gates.ts's visibleSessionConditions
 * — accepted + content-approved) every other gated read uses. Placed
 * sessions are already status='accepted' (loadAcceptedSessions filters on
 * it), so in practice this narrows on content_status='approved' — but the
 * gate is imported, never re-derived, per the one-predicate rule. */
export async function countPubliclyVisible(db: Db, eventId: string, submissionIds: string[]): Promise<number> {
  if (submissionIds.length === 0) return 0;
  let total = 0;
  for (const batch of chunkIds(submissionIds)) {
    const rows = await db
      .select({ id: schema.submission.id })
      .from(schema.submission)
      .where(and(eq(schema.submission.eventId, eventId), inArray(schema.submission.id, batch), visibleSessionConditions()));
    total += rows.length;
  }
  return total;
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
): Promise<{ conflicts: DescribedConflict[]; summary: { unplaced: number; conflicts: number } }> {
  const slotRows = await db
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
    .limit(MAX_AGENDA_SCAN + 1);

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
          // DEC-974: same active-participant rule as loadAcceptedSessions —
          // a speaker hidden from the public programme still can't be
          // double-booked, so ACTIVE_INVITE_STATUSES (not `visible`).
          inArray(schema.participant.inviteStatus, [...ACTIVE_INVITE_STATUSES]),
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
  const conflicts = findConflicts(placedSessions);

  const roomRows = await db
    .select({ id: schema.room.id, name: schema.room.name })
    .from(schema.room)
    .where(eq(schema.room.eventId, eventId));
  const labels = buildConflictLabels(roomRows, placedRows);

  const totalAcceptedRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.submission)
    .where(and(eq(schema.submission.eventId, eventId), eq(schema.submission.status, "accepted")));
  const totalAccepted = Number(totalAcceptedRows[0]?.count ?? 0);

  return {
    conflicts: describeConflicts(conflicts, labels),
    summary: scheduleSummary(placedSessions, totalAccepted, conflicts),
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
  const startOk =
    typeof b.startMin === "number" &&
    Number.isInteger(b.startMin) &&
    b.startMin >= 0 &&
    b.startMin <= MINUTES_PER_DAY - 1;
  const endOk =
    typeof b.endMin === "number" &&
    Number.isInteger(b.endMin) &&
    b.endMin > (b.startMin as number) &&
    b.endMin <= MINUTES_PER_DAY;
  const roomOk = b.roomId === undefined || b.roomId === null || typeof b.roomId === "string";
  return dayOk && startOk && endOk && roomOk;
}

/** Upserts the schedule_slot for an accepted submission and bumps
 * ics_sequence (DEC-007 caller duty). Throws (via caller's ApiError) is the
 * route's job — this function assumes the accepted-only check already ran. */
export async function upsertSlot(db: Db, submissionId: string, input: SlotInput): Promise<void> {
  const now = new Date();
  // DEC-552: one atomic statement -- no read-then-write over the
  // schedule_slot_submission_id_idx uniqueIndex.
  await db
    .insert(schema.scheduleSlot)
    .values({
      id: newId(),
      submissionId,
      roomId: input.roomId ?? null,
      day: input.day,
      startMin: input.startMin,
      endMin: input.endMin,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.scheduleSlot.submissionId,
      set: {
        roomId: input.roomId ?? null,
        day: input.day,
        startMin: input.startMin,
        endMin: input.endMin,
        updatedAt: now,
      },
    });

  await bumpIcsSequences(db, [submissionId]);
}

export async function unscheduleSlot(db: Db, submissionId: string): Promise<void> {
  await db.delete(schema.scheduleSlot).where(eq(schema.scheduleSlot.submissionId, submissionId));
  await bumpIcsSequences(db, [submissionId]);
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

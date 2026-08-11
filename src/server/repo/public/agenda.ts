// Public/embed repo layer (J10, DEC-022, DEC-078, DEC-310): agenda /
// schedule surfaces.

import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { chunkIds } from "../../../lib/chunk";
import { visibleSessionConditions, slotWithinEventRange } from "./gates";
import type { PublicEvent, PublicTrack } from "./event";
import { hydrateSessions, type PublicSpeaker } from "./sessions";

export interface PublicAgendaItem {
  submissionId: string;
  ref: string;
  title: string;
  description: string | null;
  day: string;
  startMin: number;
  endMin: number;
  roomId: string | null;
  roomName: string | null;
  icsSequence: number;
  tracks: PublicTrack[];
  speakers: PublicSpeaker[];
}

/** Agenda/schedule surface (DEC-022): visibility-gated scheduled sessions,
 * grouped by day by the caller. Rooms come along for the per-day time grid. */
export async function getPublicAgenda(db: Db, event: PublicEvent): Promise<PublicAgendaItem[]> {
  const rows = await db
    .selectDistinct({
      submissionId: schema.scheduleSlot.submissionId,
      day: schema.scheduleSlot.day,
      startMin: schema.scheduleSlot.startMin,
      endMin: schema.scheduleSlot.endMin,
      roomId: schema.scheduleSlot.roomId,
    })
    .from(schema.scheduleSlot)
    .innerJoin(schema.submission, eq(schema.scheduleSlot.submissionId, schema.submission.id))
    .where(and(eq(schema.submission.eventId, event.id), visibleSessionConditions(), slotWithinEventRange(event)))
    .orderBy(asc(schema.scheduleSlot.day), asc(schema.scheduleSlot.startMin));

  if (rows.length === 0) return [];

  // roomIds is bounded by the event's physical room count (~15) — a
  // DEC-078 bounded-list exemption, so this inArray stays unchunked.
  const roomIds = [...new Set(rows.map((r) => r.roomId).filter((id): id is string => id !== null))];
  const roomRows =
    roomIds.length === 0
      ? []
      : await db
          .select({ id: schema.room.id, name: schema.room.name })
          .from(schema.room)
          .where(and(inArray(schema.room.id, roomIds), eq(schema.room.eventId, event.id)));
  const roomNameById = new Map(roomRows.map((r) => [r.id, r.name]));

  const ids = rows.map((r) => r.submissionId);
  const sessions = await hydrateSessions(db, ids, event);
  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  return rows
    .map((row) => {
      const session = sessionById.get(row.submissionId);
      if (!session) return null;
      const item: PublicAgendaItem = {
        submissionId: row.submissionId,
        ref: session.ref,
        title: session.title,
        description: session.description,
        day: row.day,
        startMin: row.startMin,
        endMin: row.endMin,
        roomId: row.roomId,
        roomName: row.roomId ? roomNameById.get(row.roomId) ?? null : null,
        icsSequence: session.icsSequence,
        tracks: session.tracks,
        speakers: session.speakers,
      };
      return item;
    })
    .filter((item): item is PublicAgendaItem => item !== null);
}

/** Id-scoped agenda lookup (DEC-078, DEC-310): mirrors getPublicAgenda's
 * column set, join, visibility gate, room lookup and hydration exactly, but
 * scopes the scheduleSlot scan to the requested submission ids (chunked per
 * DEC-078) instead of hydrating the whole published agenda. Used by
 * schedule.ics so an itinerary export for a handful of ids doesn't pay for a
 * full-event scan. */
export async function getPublicAgendaByIds(
  db: Db,
  event: PublicEvent,
  ids: string[],
): Promise<PublicAgendaItem[]> {
  if (ids.length === 0) return [];

  const rows: {
    submissionId: string;
    day: string;
    startMin: number;
    endMin: number;
    roomId: string | null;
  }[] = [];
  for (const batch of chunkIds(ids)) {
    const batchRows = await db
      .selectDistinct({
        submissionId: schema.scheduleSlot.submissionId,
        day: schema.scheduleSlot.day,
        startMin: schema.scheduleSlot.startMin,
        endMin: schema.scheduleSlot.endMin,
        roomId: schema.scheduleSlot.roomId,
      })
      .from(schema.scheduleSlot)
      .innerJoin(schema.submission, eq(schema.scheduleSlot.submissionId, schema.submission.id))
      .where(
        and(
          eq(schema.submission.eventId, event.id),
          inArray(schema.scheduleSlot.submissionId, batch),
          visibleSessionConditions(),
          slotWithinEventRange(event),
        ),
      );
    rows.push(...batchRows);
  }
  rows.sort((a, b) => (a.day === b.day ? a.startMin - b.startMin : a.day < b.day ? -1 : 1));

  if (rows.length === 0) return [];

  // roomIds is bounded by the event's physical room count (~15) — a
  // DEC-078 bounded-list exemption, so this inArray stays unchunked.
  const roomIds = [...new Set(rows.map((r) => r.roomId).filter((id): id is string => id !== null))];
  const roomRows =
    roomIds.length === 0
      ? []
      : await db
          .select({ id: schema.room.id, name: schema.room.name })
          .from(schema.room)
          .where(and(inArray(schema.room.id, roomIds), eq(schema.room.eventId, event.id)));
  const roomNameById = new Map(roomRows.map((r) => [r.id, r.name]));

  const sessionIds = rows.map((r) => r.submissionId);
  const sessions = await hydrateSessions(db, sessionIds, event);
  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  return rows
    .map((row) => {
      const session = sessionById.get(row.submissionId);
      if (!session) return null;
      const item: PublicAgendaItem = {
        submissionId: row.submissionId,
        ref: session.ref,
        title: session.title,
        description: session.description,
        day: row.day,
        startMin: row.startMin,
        endMin: row.endMin,
        roomId: row.roomId,
        roomName: row.roomId ? roomNameById.get(row.roomId) ?? null : null,
        icsSequence: session.icsSequence,
        tracks: session.tracks,
        speakers: session.speakers,
      };
      return item;
    })
    .filter((item): item is PublicAgendaItem => item !== null);
}

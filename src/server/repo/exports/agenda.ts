// agenda export (J12, DEC-027).

import { eq, inArray } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { formatRef } from "../../../domain/ids";
import { chunkIds } from "../../../lib/chunk";
import { type ExportTable, buildTable, minutesToClock } from "./table";
import { getRecordPrefix } from "./common";

export const AGENDA_HEADER = ["day", "start", "end", "room", "ref", "title", "speakers", "tracks"] as const;

export interface AgendaExportInput {
  day: string;
  startMin: number;
  endMin: number;
  room: string | null;
  ref: string;
  title: string;
  speakers: string[];
  tracks: string[];
}

/** Sorts by day then start time, then shapes into the fixed CSV/JSON columns. */
export function shapeAgendaExport(inputs: AgendaExportInput[]): ExportTable {
  const sorted = [...inputs].sort((a, b) => (a.day === b.day ? a.startMin - b.startMin : a.day < b.day ? -1 : 1));
  const rows = sorted.map((s) => [
    s.day,
    minutesToClock(s.startMin),
    minutesToClock(s.endMin),
    s.room ?? "",
    s.ref,
    s.title,
    s.speakers.join("; "),
    s.tracks.join("; "),
  ]);
  return buildTable([...AGENDA_HEADER], rows);
}

export async function exportAgenda(db: Db, eventId: string): Promise<ExportTable> {
  const recordPrefix = await getRecordPrefix(db, eventId);

  const slotRows = await db
    .select({
      submissionId: schema.scheduleSlot.submissionId,
      day: schema.scheduleSlot.day,
      startMin: schema.scheduleSlot.startMin,
      endMin: schema.scheduleSlot.endMin,
      roomName: schema.room.name,
      seq: schema.submission.seq,
      title: schema.submission.title,
    })
    .from(schema.scheduleSlot)
    .innerJoin(schema.submission, eq(schema.scheduleSlot.submissionId, schema.submission.id))
    .leftJoin(schema.room, eq(schema.scheduleSlot.roomId, schema.room.id))
    .where(eq(schema.submission.eventId, eventId));

  if (slotRows.length === 0) return shapeAgendaExport([]);
  const ids = slotRows.map((r) => r.submissionId);

  const trackJoinRows: { submissionId: string; trackName: string }[] = [];
  for (const batch of chunkIds(ids)) {
    const batchRows = await db
      .select({ submissionId: schema.submissionTrack.submissionId, trackName: schema.track.name })
      .from(schema.submissionTrack)
      .innerJoin(schema.track, eq(schema.submissionTrack.trackId, schema.track.id))
      .where(inArray(schema.submissionTrack.submissionId, batch));
    trackJoinRows.push(...batchRows);
  }

  const participantRows: { submissionId: string; order: number; firstName: string; lastName: string }[] = [];
  for (const batch of chunkIds(ids)) {
    const batchRows = await db
      .select({
        submissionId: schema.participant.submissionId,
        order: schema.participant.order,
        firstName: schema.contact.firstName,
        lastName: schema.contact.lastName,
      })
      .from(schema.participant)
      .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
      .where(inArray(schema.participant.submissionId, batch));
    participantRows.push(...batchRows);
  }

  const tracksBySubmission = new Map<string, Set<string>>();
  for (const t of trackJoinRows) {
    const set = tracksBySubmission.get(t.submissionId) ?? new Set<string>();
    set.add(t.trackName);
    tracksBySubmission.set(t.submissionId, set);
  }

  const speakersBySubmission = new Map<string, { name: string; order: number }[]>();
  for (const p of participantRows) {
    const arr = speakersBySubmission.get(p.submissionId) ?? [];
    arr.push({ name: `${p.firstName} ${p.lastName}`.trim(), order: p.order });
    speakersBySubmission.set(p.submissionId, arr);
  }
  for (const arr of speakersBySubmission.values()) arr.sort((a, b) => a.order - b.order);

  const inputs: AgendaExportInput[] = slotRows.map((s) => ({
    day: s.day,
    startMin: s.startMin,
    endMin: s.endMin,
    room: s.roomName ?? null,
    ref: formatRef(recordPrefix, s.seq),
    title: s.title,
    speakers: (speakersBySubmission.get(s.submissionId) ?? []).map((sp) => sp.name),
    tracks: [...(tracksBySubmission.get(s.submissionId) ?? [])],
  }));

  return shapeAgendaExport(inputs);
}

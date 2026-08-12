// agenda export (J12, DEC-027).

import { asc, eq, inArray } from "drizzle-orm";
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
  /** submission.seq: DEC-560's tiebreak, not rendered — the total order is
   * (day, startMin, room name, submission seq). */
  seq: number;
}

// DEC-560: total order (day, startMin, room name, submission seq) — matches
// the SQL ORDER BY in exportAgenda so the pure shaper and the query agree.
function compareAgendaRows(a: AgendaExportInput, b: AgendaExportInput): number {
  if (a.day !== b.day) return a.day < b.day ? -1 : 1;
  if (a.startMin !== b.startMin) return a.startMin - b.startMin;
  const aRoom = a.room ?? "";
  const bRoom = b.room ?? "";
  if (aRoom !== bRoom) return aRoom < bRoom ? -1 : 1;
  return a.seq - b.seq;
}

/** Sorts by (day, startMin, room, submission seq), then shapes into the
 * fixed CSV/JSON columns. */
export function shapeAgendaExport(inputs: AgendaExportInput[]): ExportTable {
  const sorted = [...inputs].sort(compareAgendaRows);
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
    .where(eq(schema.submission.eventId, eventId))
    .orderBy(
      asc(schema.scheduleSlot.day),
      asc(schema.scheduleSlot.startMin),
      asc(schema.room.name),
      asc(schema.submission.seq),
    );

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

  const participantRows: { submissionId: string; order: number; contactId: string; firstName: string; lastName: string }[] = [];
  for (const batch of chunkIds(ids)) {
    const batchRows = await db
      .select({
        submissionId: schema.participant.submissionId,
        order: schema.participant.order,
        contactId: schema.contact.id,
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

  const speakersBySubmission = new Map<string, { name: string; order: number; contactId: string }[]>();
  for (const p of participantRows) {
    const arr = speakersBySubmission.get(p.submissionId) ?? [];
    arr.push({ name: `${p.firstName} ${p.lastName}`.trim(), order: p.order, contactId: p.contactId });
    speakersBySubmission.set(p.submissionId, arr);
  }
  for (const arr of speakersBySubmission.values()) {
    arr.sort((a, b) => a.order - b.order || (a.contactId < b.contactId ? -1 : a.contactId > b.contactId ? 1 : 0));
  }

  const inputs: AgendaExportInput[] = slotRows.map((s) => ({
    day: s.day,
    startMin: s.startMin,
    endMin: s.endMin,
    room: s.roomName ?? null,
    ref: formatRef(recordPrefix, s.seq),
    title: s.title,
    speakers: (speakersBySubmission.get(s.submissionId) ?? []).map((sp) => sp.name),
    tracks: [...(tracksBySubmission.get(s.submissionId) ?? [])].sort((a, b) => a.localeCompare(b)),
    seq: s.seq,
  }));

  return shapeAgendaExport(inputs);
}

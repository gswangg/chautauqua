// show-flow (DEC-055) — GET /api/v1/events/:eventId/exports/showflow.csv.
// Separate surface from the DEC-027 export kinds (own route, own fixed
// columns): accepted submissions only, scheduled rows ordered by
// day/start/room, unscheduled accepted rows last with empty schedule
// columns (never dropped).

import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { formatRef } from "../../../domain/ids";
import { chunkIds } from "../../../lib/chunk";
import { DEC_055 } from "../../../decisions";
import { type ExportTable, buildTable, minutesToClock } from "./table";
import { getRecordPrefix } from "./common";

void DEC_055;

export const SHOWFLOW_HEADER = [
  "ref",
  "title",
  "description",
  "day",
  "start",
  "end",
  "room",
  "tracks",
  "speakers",
  "deck_file",
  "deck_url",
] as const;

export interface ShowflowExportInput {
  ref: string;
  title: string;
  description: string;
  /** null when the submission has no schedule slot — sorts last. */
  day: string | null;
  startMin: number | null;
  endMin: number | null;
  room: string | null;
  tracks: string[];
  speakers: string[];
  deckFile: string;
  deckUrl: string;
}

/** Sorts scheduled rows by day, start, room; unscheduled rows (day === null)
 * are appended last, in the input's given order. Never drops a row. */
export function shapeShowflowExport(inputs: ShowflowExportInput[]): ExportTable {
  const scheduled = inputs
    .filter((i) => i.day !== null)
    .sort((a, b) => {
      if (a.day !== b.day) return a.day! < b.day! ? -1 : 1;
      if (a.startMin !== b.startMin) return (a.startMin ?? 0) - (b.startMin ?? 0);
      const ra = a.room ?? "";
      const rb = b.room ?? "";
      return ra === rb ? 0 : ra < rb ? -1 : 1;
    });
  const unscheduled = inputs.filter((i) => i.day === null);

  const rows = [...scheduled, ...unscheduled].map((s) => [
    s.ref,
    s.title,
    s.description,
    s.day ?? "",
    s.startMin !== null ? minutesToClock(s.startMin) : "",
    s.endMin !== null ? minutesToClock(s.endMin) : "",
    s.room ?? "",
    s.tracks.join("; "),
    s.speakers.join("; "),
    s.deckFile,
    s.deckUrl,
  ]);

  return buildTable([...SHOWFLOW_HEADER], rows);
}

/** Given every file row of kind 'presentation' for a set of submissions,
 * returns the latest version's { fileId, filename, versionNumber } per
 * submission — mirrors app/src/pages/content/version-chain.ts's
 * newest-first + `v${count}` numbering convention (DEC-020), without
 * reimplementing the chain walk: presentation files for a submission form
 * one chain in practice, so newest createdAt is the head and the group's
 * size is its version number. */
function latestDeckBySubmission(
  files: { submissionId: string | null; id: string; filename: string; createdAt: Date }[],
): Map<string, { fileId: string; filename: string; versionNumber: number }> {
  const bySubmission = new Map<string, { id: string; filename: string; createdAt: Date }[]>();
  for (const f of files) {
    if (!f.submissionId) continue;
    const arr = bySubmission.get(f.submissionId) ?? [];
    arr.push({ id: f.id, filename: f.filename, createdAt: f.createdAt });
    bySubmission.set(f.submissionId, arr);
  }
  const result = new Map<string, { fileId: string; filename: string; versionNumber: number }>();
  for (const [submissionId, arr] of bySubmission) {
    arr.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const latest = arr[0]!;
    result.set(submissionId, { fileId: latest.id, filename: latest.filename, versionNumber: arr.length });
  }
  return result;
}

export async function buildShowflowExport(db: Db, eventId: string): Promise<ExportTable> {
  const recordPrefix = await getRecordPrefix(db, eventId);

  const submissions = await db
    .select({
      id: schema.submission.id,
      seq: schema.submission.seq,
      title: schema.submission.title,
      description: schema.submission.description,
    })
    .from(schema.submission)
    .where(and(eq(schema.submission.eventId, eventId), eq(schema.submission.status, "accepted")));

  if (submissions.length === 0) return shapeShowflowExport([]);
  const ids = submissions.map((s) => s.id);

  const slotRows: {
    submissionId: string;
    day: string;
    startMin: number;
    endMin: number;
    roomName: string | null;
  }[] = [];
  for (const batch of chunkIds(ids)) {
    const batchRows = await db
      .select({
        submissionId: schema.scheduleSlot.submissionId,
        day: schema.scheduleSlot.day,
        startMin: schema.scheduleSlot.startMin,
        endMin: schema.scheduleSlot.endMin,
        roomName: schema.room.name,
      })
      .from(schema.scheduleSlot)
      .leftJoin(schema.room, eq(schema.scheduleSlot.roomId, schema.room.id))
      .where(inArray(schema.scheduleSlot.submissionId, batch));
    slotRows.push(...batchRows);
  }

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

  const presentationFiles: { submissionId: string | null; id: string; filename: string; createdAt: Date }[] = [];
  for (const batch of chunkIds(ids)) {
    const batchRows = await db
      .select({
        submissionId: schema.file.submissionId,
        id: schema.file.id,
        filename: schema.file.filename,
        createdAt: schema.file.createdAt,
      })
      .from(schema.file)
      .where(and(inArray(schema.file.submissionId, batch), eq(schema.file.kind, "presentation")));
    presentationFiles.push(...batchRows);
  }

  const slotBySubmission = new Map<string, { day: string; startMin: number; endMin: number; roomName: string | null }>();
  for (const r of slotRows) {
    // A submission should have at most one schedule slot; first wins if data is malformed.
    if (!slotBySubmission.has(r.submissionId)) {
      slotBySubmission.set(r.submissionId, { day: r.day, startMin: r.startMin, endMin: r.endMin, roomName: r.roomName });
    }
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

  const deckBySubmission = latestDeckBySubmission(presentationFiles);

  const inputs: ShowflowExportInput[] = submissions.map((s) => {
    const slot = slotBySubmission.get(s.id);
    const deck = deckBySubmission.get(s.id);
    return {
      ref: formatRef(recordPrefix, s.seq),
      title: s.title,
      description: s.description ?? "",
      day: slot?.day ?? null,
      startMin: slot?.startMin ?? null,
      endMin: slot?.endMin ?? null,
      room: slot?.roomName ?? null,
      tracks: [...(tracksBySubmission.get(s.id) ?? [])],
      speakers: (speakersBySubmission.get(s.id) ?? []).map((sp) => sp.name),
      deckFile: deck ? `${deck.filename} (v${deck.versionNumber})` : "",
      deckUrl: deck ? `/files/${deck.fileId}` : "",
    };
  });

  return shapeShowflowExport(inputs);
}

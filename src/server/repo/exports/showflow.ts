// show-flow (DEC-055) — GET /api/v1/events/:eventId/exports/showflow.csv.
// Separate surface from the DEC-027 export kinds (own route, own fixed
// columns): accepted submissions only, scheduled rows ordered by
// day/start/room, unscheduled accepted rows last with empty schedule
// columns (never dropped).

import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { formatRef } from "../../../domain/ids";
import { chunkIds } from "../../../lib/chunk";
import { DEC_055, DEC_022 } from "../../../decisions";
import { type ExportTable, EXPORT_MAX_ROWS, buildTable } from "./table";
import { clockHHMM } from "../../../domain/clock";
import { getRecordPrefix } from "./common";
import { listBreaksForEvent } from "../breaks";

void DEC_055;
void DEC_022;

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
  "kind",
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
  /** submission.seq: DEC-560's tiebreak for both scheduled (room ties) and
   * unscheduled rows — not rendered. Ignored for kind === 'break' rows,
   * which always carry a day and so never reach the unscheduled tail. */
  seq: number;
  /** DEC-022 amendment (wave 66): a schedule_break row rendered inline with
   * sessions on the show-flow, so a producer sees "Lunch" sitting exactly
   * between the two talks it separates instead of reading a gap as missing
   * data. Defaults to 'session' for every pre-existing caller of this pure
   * shaping function. A 'break' row always has ref/tracks/speakers/deck
   * columns empty — it is not a submission (src/server/repo/breaks.ts's
   * header) — and is distinguished at a glance via this explicit column
   * rather than by the empty ref alone. */
  kind?: "session" | "break";
}

/** Sorts scheduled rows (sessions and breaks alike) by day, start, room,
 * seq; unscheduled session rows (day === null) are appended last, ordered by
 * submission seq. Breaks always carry a day, so they interleave with
 * scheduled sessions and never land in the unscheduled tail. Never drops a
 * row. */
export function shapeShowflowExport(inputs: ShowflowExportInput[]): ExportTable {
  const scheduled = inputs
    .filter((i) => i.day !== null)
    .sort((a, b) => {
      if (a.day !== b.day) return a.day! < b.day! ? -1 : 1;
      if (a.startMin !== b.startMin) return (a.startMin ?? 0) - (b.startMin ?? 0);
      const ra = a.room ?? "";
      const rb = b.room ?? "";
      if (ra !== rb) return ra < rb ? -1 : 1;
      return a.seq - b.seq;
    });
  const unscheduled = inputs.filter((i) => i.day === null).sort((a, b) => a.seq - b.seq);

  const rows = [...scheduled, ...unscheduled].map((s) => [
    s.ref,
    s.title,
    s.description,
    s.day ?? "",
    s.startMin !== null ? clockHHMM(s.startMin) : "",
    s.endMin !== null ? clockHHMM(s.endMin) : "",
    s.room ?? "",
    s.tracks.join("; "),
    s.speakers.join("; "),
    s.deckFile,
    s.deckUrl,
    s.kind ?? "session",
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
    // DEC-560: createdAt tiebroken by file id so "latest" is deterministic
    // even when two versions share a timestamp.
    arr.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
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
    .where(and(eq(schema.submission.eventId, eventId), eq(schema.submission.status, "accepted")))
    .orderBy(asc(schema.submission.seq))
    .limit(EXPORT_MAX_ROWS + 1);

  // DEC-027 amendment (wave 50): bound on the query — cap+1 accepted
  // submissions proves overflow before the per-submission join fetches
  // below (slots/tracks/participants/deck files).
  if (submissions.length > EXPORT_MAX_ROWS) {
    return buildTable([...SHOWFLOW_HEADER], [], true);
  }

  // DEC-022 amendment (wave 66): load through the existing repo function —
  // it is already bounded-scan + loud-refusal (MAX_BREAKS_PER_EVENT), so no
  // second query/cap is needed here. Breaks are event-wide (not per-
  // submission), so they are loaded once regardless of how many submissions
  // exist and interleaved into the same sorted output below. Loaded after
  // the submissions overflow check so a breaks query never masks a
  // submissions-side truncation (and vice versa).
  const breaks = await listBreaksForEvent(db, eventId);
  const breakInputs: ShowflowExportInput[] = breaks.map((b) => ({
    ref: "",
    title: b.label,
    description: "",
    day: b.day,
    startMin: b.startMin,
    endMin: b.startMin + b.durationMin,
    room: b.location,
    tracks: [],
    speakers: [],
    deckFile: "",
    deckUrl: "",
    seq: -1,
    kind: "break",
  }));

  if (submissions.length === 0) return shapeShowflowExport(breakInputs);
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

  const speakersBySubmission = new Map<string, { name: string; order: number; contactId: string }[]>();
  for (const p of participantRows) {
    const arr = speakersBySubmission.get(p.submissionId) ?? [];
    arr.push({ name: `${p.firstName} ${p.lastName}`.trim(), order: p.order, contactId: p.contactId });
    speakersBySubmission.set(p.submissionId, arr);
  }
  for (const arr of speakersBySubmission.values()) {
    arr.sort((a, b) => a.order - b.order || (a.contactId < b.contactId ? -1 : a.contactId > b.contactId ? 1 : 0));
  }

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
      tracks: [...(tracksBySubmission.get(s.id) ?? [])].sort((a, b) => a.localeCompare(b)),
      speakers: (speakersBySubmission.get(s.id) ?? []).map((sp) => sp.name),
      deckFile: deck ? `${deck.filename} (v${deck.versionNumber})` : "",
      deckUrl: deck ? `/files/${deck.fileId}` : "",
      seq: s.seq,
    };
  });

  return shapeShowflowExport([...inputs, ...breakInputs]);
}

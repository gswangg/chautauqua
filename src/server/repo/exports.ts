// Export data access for GET /api/v1/events/:eventId/export/:kind (J12,
// DEC-027). Each kind returns a fixed header row + string cell rows so the
// route handler can feed them straight into src/lib/csv.ts's toCsv, or
// return the equivalent records array for format=json. Track membership
// reads ONLY submission_track (DEC-017) — submission.trackId/
// additionalTrackIdsJson are frozen legacy and never read here.

import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { formatRef } from "../../domain/ids";
import { chunkIds } from "../../lib/chunk";
// DEC-027: fixed export columns per kind; DEC-017: track membership reads
// ONLY submission_track (never the frozen legacy submission.trackId).
// DEC-055: show-flow export columns/ordering.
import { DEC_017, DEC_027, DEC_055, DEC_258 } from "../../decisions";

void DEC_017;
void DEC_027;
void DEC_055;
// exportSpeakers below reads participant.title_at_time/org_at_time (DEC-258
// frozen snapshot), never the live contact.
void DEC_258;

export const EXPORT_KINDS = ["submissions", "speakers", "evaluations", "agenda", "email-log"] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

export function isExportKind(value: unknown): value is ExportKind {
  return typeof value === "string" && (EXPORT_KINDS as readonly string[]).includes(value);
}

export interface ExportTable {
  header: string[];
  rows: string[][];
  /** Same records as an array of objects keyed by header, for format=json. */
  records: Record<string, string>[];
}

function buildTable(header: string[], rows: string[][]): ExportTable {
  const records = rows.map((row) => {
    const rec: Record<string, string> = {};
    header.forEach((h, i) => {
      rec[h] = row[i] ?? "";
    });
    return rec;
  });
  return { header, rows, records };
}

export function minutesToClock(min: number): string {
  const h = Math.floor(min / 60)
    .toString()
    .padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

// ---------------------------------------------------------------------------
// Pure row-shaping (DB-free, unit-tested directly per DEC-027's "CSV column
// snapshot" test requirement) — mirrors agenda.ts's computeDays pattern of
// extracting the pure core from its DB-fetching wrapper.
// ---------------------------------------------------------------------------

export const SUBMISSIONS_HEADER = [
  "ref",
  "title",
  "status",
  "contentStatus",
  "tracks",
  "speakers",
  "speakerEmails",
  "createdAt",
] as const;

export interface SubmissionExportInput {
  ref: string;
  title: string;
  status: string;
  contentStatus: string;
  tracks: string[];
  speakers: string[];
  speakerEmails: string[];
  createdAt: string;
}

export function shapeSubmissionsExport(inputs: SubmissionExportInput[]): ExportTable {
  const rows = inputs.map((s) => [
    s.ref,
    s.title,
    s.status,
    s.contentStatus,
    s.tracks.join("; "),
    s.speakers.join("; "),
    s.speakerEmails.join("; "),
    s.createdAt,
  ]);
  return buildTable([...SUBMISSIONS_HEADER], rows);
}

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

async function getRecordPrefix(db: Db, eventId: string): Promise<string> {
  const rows = await db
    .select({ recordPrefix: schema.event.recordPrefix })
    .from(schema.event)
    .where(eq(schema.event.id, eventId))
    .limit(1);
  return rows[0]?.recordPrefix ?? "SES";
}

// ---------------------------------------------------------------------------
// submissions
// ---------------------------------------------------------------------------

async function exportSubmissions(db: Db, eventId: string): Promise<ExportTable> {
  const recordPrefix = await getRecordPrefix(db, eventId);

  const submissions = await db
    .select({
      id: schema.submission.id,
      seq: schema.submission.seq,
      title: schema.submission.title,
      status: schema.submission.status,
      contentStatus: schema.submission.contentStatus,
      trackId: schema.submission.trackId,
      createdAt: schema.submission.createdAt,
    })
    .from(schema.submission)
    .where(eq(schema.submission.eventId, eventId));

  if (submissions.length === 0) return shapeSubmissionsExport([]);
  const ids = submissions.map((s) => s.id);

  const trackJoinRows: { submissionId: string; trackName: string }[] = [];
  for (const batch of chunkIds(ids)) {
    const batchRows = await db
      .select({ submissionId: schema.submissionTrack.submissionId, trackName: schema.track.name })
      .from(schema.submissionTrack)
      .innerJoin(schema.track, eq(schema.submissionTrack.trackId, schema.track.id))
      .where(inArray(schema.submissionTrack.submissionId, batch));
    trackJoinRows.push(...batchRows);
  }

  const participantRows: {
    submissionId: string;
    order: number;
    firstName: string;
    lastName: string;
    email: string;
  }[] = [];
  for (const batch of chunkIds(ids)) {
    const batchRows = await db
      .select({
        submissionId: schema.participant.submissionId,
        order: schema.participant.order,
        firstName: schema.contact.firstName,
        lastName: schema.contact.lastName,
        email: schema.contact.email,
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

  const speakersBySubmission = new Map<string, { name: string; email: string; order: number }[]>();
  for (const p of participantRows) {
    const arr = speakersBySubmission.get(p.submissionId) ?? [];
    arr.push({ name: `${p.firstName} ${p.lastName}`.trim(), email: p.email, order: p.order });
    speakersBySubmission.set(p.submissionId, arr);
  }
  for (const arr of speakersBySubmission.values()) arr.sort((a, b) => a.order - b.order);

  const inputs: SubmissionExportInput[] = submissions.map((s) => {
    const speakers = speakersBySubmission.get(s.id) ?? [];
    return {
      ref: formatRef(recordPrefix, s.seq),
      title: s.title,
      status: s.status,
      contentStatus: s.contentStatus,
      tracks: [...(tracksBySubmission.get(s.id) ?? [])],
      speakers: speakers.map((sp) => sp.name),
      speakerEmails: speakers.map((sp) => sp.email),
      createdAt: s.createdAt.toISOString(),
    };
  });

  return shapeSubmissionsExport(inputs);
}

// ---------------------------------------------------------------------------
// speakers
// ---------------------------------------------------------------------------

async function exportSpeakers(db: Db, eventId: string): Promise<ExportTable> {
  const recordPrefix = await getRecordPrefix(db, eventId);
  const header = ["firstName", "lastName", "email", "company", "title", "acceptedSessions", "visible"];

  const rows = await db
    .select({
      contactId: schema.contact.id,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      email: schema.contact.email,
      company: schema.participant.orgAtTime,
      title: schema.participant.titleAtTime,
      visible: schema.participant.visible,
      status: schema.submission.status,
      seq: schema.submission.seq,
    })
    .from(schema.participant)
    .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .where(eq(schema.submission.eventId, eventId));

  interface Agg {
    firstName: string;
    lastName: string;
    email: string;
    company: string | null;
    title: string | null;
    acceptedRefs: string[];
    visible: boolean;
  }
  const byContact = new Map<string, Agg>();
  for (const r of rows) {
    const existing = byContact.get(r.contactId);
    const agg: Agg = existing ?? {
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      company: r.company,
      title: r.title,
      acceptedRefs: [],
      visible: false,
    };
    if (r.status === "accepted") agg.acceptedRefs.push(formatRef(recordPrefix, r.seq));
    if (r.visible) agg.visible = true;
    byContact.set(r.contactId, agg);
  }

  const outRows = [...byContact.values()].map((a) => [
    a.firstName,
    a.lastName,
    a.email,
    a.company ?? "",
    a.title ?? "",
    a.acceptedRefs.join("; "),
    a.visible ? "true" : "false",
  ]);

  return buildTable(header, outRows);
}

// ---------------------------------------------------------------------------
// evaluations
// ---------------------------------------------------------------------------

async function exportEvaluations(db: Db, eventId: string): Promise<ExportTable> {
  const recordPrefix = await getRecordPrefix(db, eventId);
  const header = ["planName", "ref", "title", "reviewerEmail", "round", "scoresJson", "comment", "submittedAt"];

  const rows = await db
    .select({
      planName: schema.evaluationPlan.name,
      seq: schema.submission.seq,
      title: schema.submission.title,
      reviewerEmail: schema.user.email,
      round: schema.evaluation.round,
      scoresJson: schema.evaluation.scoresJson,
      comment: schema.evaluation.comment,
      submittedAt: schema.evaluation.submittedAt,
    })
    .from(schema.evaluation)
    .innerJoin(schema.evaluationPlan, eq(schema.evaluation.planId, schema.evaluationPlan.id))
    .innerJoin(schema.submission, eq(schema.evaluation.submissionId, schema.submission.id))
    .innerJoin(schema.user, eq(schema.evaluation.reviewerId, schema.user.id))
    .where(eq(schema.evaluationPlan.eventId, eventId));

  const outRows = rows.map((r) => [
    r.planName,
    formatRef(recordPrefix, r.seq),
    r.title,
    r.reviewerEmail,
    String(r.round),
    r.scoresJson,
    r.comment ?? "",
    r.submittedAt ? r.submittedAt.toISOString() : "",
  ]);

  return buildTable(header, outRows);
}

// ---------------------------------------------------------------------------
// agenda
// ---------------------------------------------------------------------------

async function exportAgenda(db: Db, eventId: string): Promise<ExportTable> {
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

// ---------------------------------------------------------------------------
// email-log
// ---------------------------------------------------------------------------

async function exportEmailLog(db: Db, eventId: string): Promise<ExportTable> {
  const header = ["sentAt", "toEmail", "subject", "status", "templateId"];

  const rows = await db
    .select({
      sentAt: schema.emailLog.sentAt,
      toEmail: schema.emailLog.toEmail,
      subject: schema.emailLog.subject,
      status: schema.emailLog.status,
      templateId: schema.emailLog.templateId,
    })
    .from(schema.emailLog)
    .where(eq(schema.emailLog.eventId, eventId));

  const outRows = rows.map((r) => [r.sentAt.toISOString(), r.toEmail, r.subject, r.status, r.templateId ?? ""]);

  return buildTable(header, outRows);
}

// ---------------------------------------------------------------------------
// show-flow (DEC-055) — GET /api/v1/events/:eventId/exports/showflow.csv.
// Separate surface from the DEC-027 export kinds above (own route, own
// fixed columns): accepted submissions only, scheduled rows ordered by
// day/start/room, unscheduled accepted rows last with empty schedule
// columns (never dropped).
// ---------------------------------------------------------------------------

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

export async function buildExport(db: Db, eventId: string, kind: ExportKind): Promise<ExportTable> {
  switch (kind) {
    case "submissions":
      return exportSubmissions(db, eventId);
    case "speakers":
      return exportSpeakers(db, eventId);
    case "evaluations":
      return exportEvaluations(db, eventId);
    case "agenda":
      return exportAgenda(db, eventId);
    case "email-log":
      return exportEmailLog(db, eventId);
  }
}

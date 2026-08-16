// Submissions repo: detail + ownership lookups. Split out of
// repo/submissions.ts (contention decomposition, no behavior change). See
// repo/submissions.ts for the module-level contract notes.

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { formatRef } from "../../../domain/ids";
import { eventYear } from "../../../lib/event-time";
// DEC-881: the detail read's `reuploaded` flag composes the SAME predicate
// the worklist row/header use (reUploadedSql, submissions/list.ts) — never a
// second derivation that could disagree on which submissions are re-uploaded.
// DEC-780: SubmissionDetailSlot is defined canonically in list.ts (the LIST
// payload's `slot` field reuses this exact shape) and re-exported here.
import { reUploadedSql, type SubmissionDetailSlot } from "./list";

export interface SubmissionDetailParticipant {
  id: string;
  contactId: string;
  name: string;
  email: string;
  title: string | null;
  company: string | null;
  role: string;
  order: number;
  visible: boolean;
  inviteStatus: string;
  // DEC-900: the speaker rail's history line ("N submissions this year ·
  // spoke in YYYY"). submissionsThisYear always includes this submission
  // itself so it is always >= 1 -- non-optional. lastSpokeYear is absent
  // (not null, not 0) when the contact has no PRIOR accepted-and-scheduled
  // submission, matching reviewer.ts's myEvaluation/myRecusal "absent means
  // none" convention.
  submissionsThisYear: number;
  lastSpokeYear?: number;
}

export type { SubmissionDetailSlot };

export interface SubmissionDetail {
  id: string;
  eventId: string;
  ref: string;
  title: string;
  description: string | null;
  status: string;
  contentStatus: string;
  trackIds: string[];
  formId: string | null;
  // DEC-851 wave-5 amendment: acceptedAt/icsSequence were deleted from this
  // admin detail wire shape -- SubmissionDetailPage.tsx:957-960 already
  // documents why the rail reads `updatedAt` for the decided-date label
  // instead (acceptedAt only ever fires on the FIRST accept transition, so
  // it goes stale on a later re-decide, while updatedAt is bumped on every
  // status write); icsSequence is a comms-send concern (RenderedRecipientIcs
  // .sequence, DEC-051) with no admin-detail surface naming it.
  createdAt: number;
  updatedAt: number;
  participants: SubmissionDetailParticipant[];
  answers: Record<string, unknown>;
  // DEC-920: a 'file'-kind CFP answer stores an opaque file id (DEC-040) in
  // `answers` — this carries the real attachment rows (submission_id's
  // 'attachment'-kind file rows) so the organiser detail can render a
  // filename/link instead of the raw id. Populated by ONE additional query
  // alongside answerRows, never a per-answer fetch.
  answerFiles: { id: string; filename: string; sizeBytes: number }[];
  // DEC-780: the organiser's submission detail carries where/when the
  // session is placed on the agenda — null when it hasn't been scheduled
  // yet (schedule_slot has at most one row per submission, DEC-010's
  // nullable roomId meaning "TBD is a real value").
  slot: SubmissionDetailSlot | null;
  // DEC-881: same predicate the worklist row/header read (reUploadedSql) —
  // the detail band's status can never disagree with the row that opened it.
  reuploaded: boolean;
}

/** Returns the submission's eventId + org id, for ownership checks — null if
 * the submission doesn't exist. */
export async function getSubmissionOwnership(
  db: Db,
  submissionId: string,
): Promise<{ eventId: string; orgId: string } | null> {
  const rows = await db
    .select({ eventId: schema.submission.eventId, orgId: schema.event.orgId })
    .from(schema.submission)
    .innerJoin(schema.event, eq(schema.submission.eventId, schema.event.id))
    .where(eq(schema.submission.id, submissionId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getEventOrgId(db: Db, eventId: string): Promise<string | null> {
  const rows = await db
    .select({ orgId: schema.event.orgId })
    .from(schema.event)
    .where(eq(schema.event.id, eventId))
    .limit(1);
  return rows[0]?.orgId ?? null;
}

/** Lightweight pre/post-edit snapshot for revision diffing (DEC-158,
 * task w3-b) — avoids the full participants/answers join getSubmissionDetail
 * does. */
export async function getSubmissionContent(
  db: Db,
  submissionId: string,
): Promise<{ title: string; description: string | null; createdAt: Date } | null> {
  const rows = await db
    .select({
      title: schema.submission.title,
      description: schema.submission.description,
      createdAt: schema.submission.createdAt,
    })
    .from(schema.submission)
    .where(eq(schema.submission.id, submissionId))
    .limit(1);
  return rows[0] ?? null;
}

/** The authenticated user's email, used as the editor-name snapshot on
 * organizer-authored submission_revision rows (DEC-158) — the `user` table
 * has no display-name column, so email is the best identifying attribute
 * available. */
export async function getUserEmail(db: Db, userId: string): Promise<string | null> {
  const rows = await db
    .select({ email: schema.user.email })
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);
  return rows[0]?.email ?? null;
}

export async function getSubmissionDetail(db: Db, submissionId: string): Promise<SubmissionDetail | null> {
  const rows = await db
    .select({
      id: schema.submission.id,
      eventId: schema.submission.eventId,
      formId: schema.submission.formId,
      seq: schema.submission.seq,
      title: schema.submission.title,
      description: schema.submission.description,
      status: schema.submission.status,
      contentStatus: schema.submission.contentStatus,
      createdAt: schema.submission.createdAt,
      updatedAt: schema.submission.updatedAt,
      recordPrefix: schema.event.recordPrefix,
      orgId: schema.event.orgId,
      startDate: schema.event.startDate,
      slotDay: schema.scheduleSlot.day,
      slotStartMin: schema.scheduleSlot.startMin,
      slotEndMin: schema.scheduleSlot.endMin,
      slotRoomName: schema.room.name,
      reuploaded: sql<number>`${reUploadedSql()}`,
    })
    .from(schema.submission)
    .innerJoin(schema.event, eq(schema.submission.eventId, schema.event.id))
    .leftJoin(schema.scheduleSlot, eq(schema.scheduleSlot.submissionId, schema.submission.id))
    .leftJoin(schema.room, eq(schema.room.id, schema.scheduleSlot.roomId))
    .where(eq(schema.submission.id, submissionId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const participantRows = await db
    .select({
      id: schema.participant.id,
      contactId: schema.participant.contactId,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      email: schema.contact.email,
      title: schema.contact.title,
      company: schema.contact.company,
      role: schema.participant.role,
      order: schema.participant.order,
      visible: schema.participant.visible,
      inviteStatus: schema.participant.inviteStatus,
    })
    .from(schema.participant)
    .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
    .where(eq(schema.participant.submissionId, submissionId))
    .orderBy(asc(schema.participant.order), asc(schema.contact.id));

  // DEC-900: speaker rail history line ("N submissions this year · spoke in
  // YYYY") — ONE batched query keyed on the detail's participant contact
  // ids, never a per-speaker fetch (the N-scan rule). Scoped to the SAME ORG
  // as this submission's event via event.orgId.
  const contactIds = [...new Set(participantRows.map((p) => p.contactId))];
  const historyRows =
    contactIds.length > 0
      ? await db
          .select({
            contactId: schema.participant.contactId,
            submissionId: schema.submission.id,
            startDate: schema.event.startDate,
            status: schema.submission.status,
            scheduled: sql<number>`case when ${schema.scheduleSlot.id} is not null then 1 else 0 end`,
          })
          .from(schema.participant)
          .innerJoin(schema.submission, eq(schema.submission.id, schema.participant.submissionId))
          .innerJoin(schema.event, eq(schema.event.id, schema.submission.eventId))
          .leftJoin(schema.scheduleSlot, eq(schema.scheduleSlot.submissionId, schema.submission.id))
          .where(and(inArray(schema.participant.contactId, contactIds), eq(schema.event.orgId, row.orgId)))
      : [];

  const historyByContact = new Map<string, typeof historyRows>();
  for (const h of historyRows) {
    const list = historyByContact.get(h.contactId) ?? [];
    list.push(h);
    historyByContact.set(h.contactId, list);
  }
  const thisSubmissionYear = eventYear(row.startDate);

  const trackRows = await db
    .select({ trackId: schema.submissionTrack.trackId })
    .from(schema.submissionTrack)
    .where(eq(schema.submissionTrack.submissionId, submissionId));

  const answerRows = await db
    .select({ formFieldId: schema.submissionAnswer.formFieldId, valueJson: schema.submissionAnswer.valueJson })
    .from(schema.submissionAnswer)
    .where(eq(schema.submissionAnswer.submissionId, submissionId));

  const answers: Record<string, unknown> = {};
  for (const a of answerRows) answers[a.formFieldId] = JSON.parse(a.valueJson);

  // DEC-920: the real attachment rows for a 'file'-kind answer — ONE query,
  // never a per-answer fetch (the N-scan rule).
  const answerFileRows = await db
    .select({ id: schema.file.id, filename: schema.file.filename, sizeBytes: schema.file.sizeBytes })
    .from(schema.file)
    .where(and(eq(schema.file.submissionId, submissionId), eq(schema.file.kind, "attachment")));

  const trackIds = [...new Set(trackRows.map((t) => t.trackId))];

  return {
    id: row.id,
    eventId: row.eventId,
    ref: formatRef(row.recordPrefix, row.seq),
    title: row.title,
    description: row.description,
    status: row.status,
    contentStatus: row.contentStatus,
    trackIds,
    formId: row.formId,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
    participants: participantRows.map((p) => {
      const rowsForContact = historyByContact.get(p.contactId) ?? [];
      const seenSubmissions = new Set<string>();
      let submissionsThisYear = 0;
      let lastSpokeYear: number | undefined;
      for (const h of rowsForContact) {
        if (seenSubmissions.has(h.submissionId)) continue;
        seenSubmissions.add(h.submissionId);
        const y = eventYear(h.startDate);
        if (y === thisSubmissionYear) submissionsThisYear++;
        if (y < thisSubmissionYear && h.status === "accepted" && Number(h.scheduled) === 1) {
          if (lastSpokeYear === undefined || y > lastSpokeYear) lastSpokeYear = y;
        }
      }
      return {
        id: p.id,
        contactId: p.contactId,
        name: `${p.firstName} ${p.lastName}`.trim(),
        email: p.email,
        title: p.title,
        company: p.company,
        role: p.role,
        order: p.order,
        visible: p.visible,
        inviteStatus: p.inviteStatus,
        submissionsThisYear,
        ...(lastSpokeYear !== undefined ? { lastSpokeYear } : {}),
      };
    }),
    answers,
    answerFiles: answerFileRows,
    slot:
      row.slotDay !== null && row.slotStartMin !== null && row.slotEndMin !== null
        ? { day: row.slotDay, startMin: row.slotStartMin, endMin: row.slotEndMin, roomName: row.slotRoomName ?? null }
        : null,
    reuploaded: Number(row.reuploaded) === 1,
  };
}

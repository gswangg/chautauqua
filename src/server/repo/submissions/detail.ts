// Submissions repo: detail + ownership lookups. Split out of
// repo/submissions.ts (contention decomposition, no behavior change). See
// repo/submissions.ts for the module-level contract notes.

import { asc, eq } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { formatRef } from "../../../domain/ids";

export interface SubmissionDetailParticipant {
  id: string;
  contactId: string;
  name: string;
  email: string;
  role: string;
  order: number;
  visible: boolean;
  inviteStatus: string;
}

export interface SubmissionDetail {
  id: string;
  eventId: string;
  ref: string;
  title: string;
  description: string | null;
  status: string;
  contentStatus: string;
  trackId: string | null;
  trackIds: string[];
  formId: string | null;
  acceptedAt: number | null;
  icsSequence: number;
  createdAt: number;
  updatedAt: number;
  participants: SubmissionDetailParticipant[];
  answers: Record<string, unknown>;
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
): Promise<{ title: string; description: string | null } | null> {
  const rows = await db
    .select({ title: schema.submission.title, description: schema.submission.description })
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
      trackId: schema.submission.trackId,
      status: schema.submission.status,
      contentStatus: schema.submission.contentStatus,
      acceptedAt: schema.submission.acceptedAt,
      icsSequence: schema.submission.icsSequence,
      createdAt: schema.submission.createdAt,
      updatedAt: schema.submission.updatedAt,
      recordPrefix: schema.event.recordPrefix,
    })
    .from(schema.submission)
    .innerJoin(schema.event, eq(schema.submission.eventId, schema.event.id))
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
      role: schema.participant.role,
      order: schema.participant.order,
      visible: schema.participant.visible,
      inviteStatus: schema.participant.inviteStatus,
    })
    .from(schema.participant)
    .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
    .where(eq(schema.participant.submissionId, submissionId))
    .orderBy(asc(schema.participant.order), asc(schema.contact.id));

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

  const joinedTracks = trackRows.map((t) => t.trackId);
  const trackIds = row.trackId ? [...new Set([row.trackId, ...joinedTracks])] : [...new Set(joinedTracks)];

  return {
    id: row.id,
    eventId: row.eventId,
    ref: formatRef(row.recordPrefix, row.seq),
    title: row.title,
    description: row.description,
    status: row.status,
    contentStatus: row.contentStatus,
    trackId: row.trackId,
    trackIds,
    formId: row.formId,
    acceptedAt: row.acceptedAt ? row.acceptedAt.getTime() : null,
    icsSequence: row.icsSequence,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
    participants: participantRows.map((p) => ({
      id: p.id,
      contactId: p.contactId,
      name: `${p.firstName} ${p.lastName}`.trim(),
      email: p.email,
      role: p.role,
      order: p.order,
      visible: p.visible,
      inviteStatus: p.inviteStatus,
    })),
    answers,
  };
}

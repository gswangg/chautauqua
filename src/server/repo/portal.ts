// Speaker portal repo functions, per DEC-005 (/portal SSR) + DEC-012 (repo
// layer is the only place that touches drizzle row types) + DEC-016 (locked
// fields live on submission/contact columns, not submission_answer).
//
// Scoping is absolute: every query below filters by the speaker's own
// contact_id (never trusts a submission/contact id from the request without
// verifying ownership first) — see assertSpeakerContactId and
// isOwnedByContact.

import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { formatRef } from "../../domain/ids";
import type { SubmissionStatus } from "../../domain/status";

// ---------------------------------------------------------------------------
// Pure helpers (no db/IO) — unit-tested directly against tiny fakes/values.
// ---------------------------------------------------------------------------

/** Speaker-facing status label: internal queue states never leak (per the
 * field guide invariant) — pending/accept_queue/decline_queue all collapse
 * to 'Under review'. */
export type SpeakerStatusLabel = "Under review" | "Accepted" | "Not accepted";

export function speakerStatusLabel(status: SubmissionStatus): SpeakerStatusLabel {
  switch (status) {
    case "pending":
    case "accept_queue":
    case "decline_queue":
      return "Under review";
    case "accepted":
      return "Accepted";
    case "declined":
      return "Not accepted";
    default: {
      const exhaustive: never = status;
      throw new Error(`Unknown submission status '${exhaustive}'`);
    }
  }
}

/** Fail-loud guard: speaker-role sessions must always carry a contact_id
 * (DEC-004: speaker users link via user.contact_id). A speaker auth without
 * one is data corruption, not a recoverable condition. */
export function assertSpeakerContactId(auth: { role: string; contactId?: string } | undefined): string {
  if (!auth || auth.role !== "speaker") {
    throw new Error("assertSpeakerContactId called without a speaker auth session");
  }
  if (!auth.contactId) {
    throw new Error("Speaker auth session is missing contact_id — invariant violated");
  }
  return auth.contactId;
}

/** Pure ownership check: is `contactId` among the submission's participants?
 * Never trust a submission id from the request without running this (or the
 * equivalent query-level filter) first — no IDOR. */
export function isOwnedByContact(participantContactIds: readonly string[], contactId: string): boolean {
  return participantContactIds.includes(contactId);
}

// ---------------------------------------------------------------------------
// Query-backed reads
// ---------------------------------------------------------------------------

export interface PortalSubmissionSummary {
  id: string;
  ref: string;
  title: string;
  status: SubmissionStatus;
  statusLabel: SpeakerStatusLabel;
  submittedAt: number;
}

export interface PortalTask {
  id: string;
  title: string;
  dueDate: number | null;
  required: boolean;
  status: string;
}

export interface PortalBranding {
  eventId: string | null;
  eventName: string;
  welcomeMessage: string | null;
  accentColor: string | null;
  logoUrl: string | null;
  showResources: boolean;
}

export interface PortalData {
  branding: PortalBranding;
  submissions: PortalSubmissionSummary[];
  tasks: PortalTask[];
}

const DEFAULT_BRANDING: PortalBranding = {
  eventId: null,
  eventName: "Speaker Portal",
  welcomeMessage: null,
  accentColor: null,
  logoUrl: null,
  showResources: true,
};

/**
 * Loads everything the /portal shell renders for one speaker contact.
 * Every query below is filtered by contactId — the caller must have already
 * resolved it via assertSpeakerContactId (or an equivalent verified source),
 * never from an unverified request param.
 */
export async function getPortalData(db: Db, contactId: string, orgId: string): Promise<PortalData> {
  const submissionRows = await db
    .select({
      id: schema.submission.id,
      seq: schema.submission.seq,
      title: schema.submission.title,
      status: schema.submission.status,
      createdAt: schema.submission.createdAt,
      eventId: schema.event.id,
      eventName: schema.event.name,
      recordPrefix: schema.event.recordPrefix,
    })
    .from(schema.participant)
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .innerJoin(schema.event, eq(schema.submission.eventId, schema.event.id))
    .where(and(eq(schema.participant.contactId, contactId), eq(schema.event.orgId, orgId)))
    .orderBy(desc(schema.submission.createdAt));

  const submissions: PortalSubmissionSummary[] = submissionRows.map((row) => {
    const status = row.status as SubmissionStatus;
    return {
      id: row.id,
      ref: formatRef(row.recordPrefix, row.seq),
      title: row.title,
      status,
      statusLabel: speakerStatusLabel(status),
      submittedAt: row.createdAt.getTime(),
    };
  });

  const taskRows = await db
    .select({
      id: schema.taskAssignment.id,
      status: schema.taskAssignment.status,
      title: schema.task.title,
      dueDate: schema.task.dueDate,
      required: schema.task.required,
      eventOrgId: schema.event.orgId,
    })
    .from(schema.taskAssignment)
    .innerJoin(schema.task, eq(schema.taskAssignment.taskId, schema.task.id))
    .innerJoin(schema.event, eq(schema.task.eventId, schema.event.id))
    .where(and(eq(schema.taskAssignment.contactId, contactId), eq(schema.event.orgId, orgId)));

  const tasks: PortalTask[] = taskRows.map((row) => ({
    id: row.id,
    title: row.title,
    dueDate: row.dueDate ? row.dueDate.getTime() : null,
    required: row.required,
    status: row.status,
  }));

  // Branding: portal_settings for the event of the speaker's most recent
  // submission when present; else event-name-only default; else the
  // generic fallback (no event context at all).
  let branding: PortalBranding = DEFAULT_BRANDING;
  const mostRecentEventId = submissionRows[0]?.eventId ?? null;
  if (mostRecentEventId) {
    const eventName = submissionRows[0]!.eventName;
    const settingsRows = await db
      .select()
      .from(schema.portalSettings)
      .where(eq(schema.portalSettings.eventId, mostRecentEventId))
      .limit(1);
    const settings = settingsRows[0];
    branding = settings
      ? {
          eventId: mostRecentEventId,
          eventName,
          welcomeMessage: settings.welcomeMessage,
          accentColor: settings.accentColor,
          logoUrl: settings.logoUrl,
          showResources: settings.showResources,
        }
      : { ...DEFAULT_BRANDING, eventId: mostRecentEventId, eventName };
  }

  return { branding, submissions, tasks };
}

export interface PortalSubmissionAnswer {
  fieldId: string;
  label: string;
  value: unknown;
}

export interface PortalSubmissionDetail {
  id: string;
  ref: string;
  title: string;
  description: string | null;
  status: SubmissionStatus;
  statusLabel: SpeakerStatusLabel;
  submittedAt: number;
  answers: PortalSubmissionAnswer[];
}

/**
 * Read-only detail for exactly one of the speaker's own submissions.
 * Returns null when the submission doesn't exist OR exists but the speaker
 * is not among its participants — both render as a 404 to the caller so we
 * never leak existence of other speakers' submissions (no IDOR).
 */
export async function getPortalSubmissionDetail(
  db: Db,
  submissionId: string,
  contactId: string,
  orgId: string,
): Promise<PortalSubmissionDetail | null> {
  const rows = await db
    .select({
      id: schema.submission.id,
      seq: schema.submission.seq,
      title: schema.submission.title,
      description: schema.submission.description,
      status: schema.submission.status,
      createdAt: schema.submission.createdAt,
      recordPrefix: schema.event.recordPrefix,
      eventOrgId: schema.event.orgId,
    })
    .from(schema.submission)
    .innerJoin(schema.event, eq(schema.submission.eventId, schema.event.id))
    .where(eq(schema.submission.id, submissionId))
    .limit(1);
  const row = rows[0];
  if (!row || row.eventOrgId !== orgId) return null;

  const participantRows = await db
    .select({ contactId: schema.participant.contactId })
    .from(schema.participant)
    .where(eq(schema.participant.submissionId, submissionId));
  const participantContactIds = participantRows.map((p) => p.contactId);
  if (!isOwnedByContact(participantContactIds, contactId)) return null;

  const answerRows = await db
    .select({
      fieldId: schema.submissionAnswer.formFieldId,
      label: schema.formField.label,
      valueJson: schema.submissionAnswer.valueJson,
    })
    .from(schema.submissionAnswer)
    .innerJoin(schema.formField, eq(schema.submissionAnswer.formFieldId, schema.formField.id))
    .where(eq(schema.submissionAnswer.submissionId, submissionId));

  const answers: PortalSubmissionAnswer[] = answerRows.map((a) => ({
    fieldId: a.fieldId,
    label: a.label,
    value: JSON.parse(a.valueJson),
  }));

  const status = row.status as SubmissionStatus;
  return {
    id: row.id,
    ref: formatRef(row.recordPrefix, row.seq),
    title: row.title,
    description: row.description,
    status,
    statusLabel: speakerStatusLabel(status),
    submittedAt: row.createdAt.getTime(),
    answers,
  };
}

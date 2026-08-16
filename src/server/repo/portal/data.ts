// Portal shell + submission-detail reads (DEC-005/DEC-012/DEC-016). Split
// out of the former monolithic portal.ts — see ./shared.ts for the pure
// ownership/status helpers this module relies on.

import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { formatRef } from "../../../domain/ids";
import type { SubmissionStatus } from "../../../domain/status";
import { PORTAL_VISIBLE_INVITE_STATUSES } from "../../../domain/acceptance";
import { answerFieldRoleCondition } from "../form-roles";
import { isOwnedByContact, speakerStatusLabel, type SpeakerStatusLabel } from "./shared";
import { loadTrackNamesBySubmission } from "../submission-tracks";
import { safeImageSrc } from "../../../domain/brand-url";
import { DEC_322 } from "../../../decisions";

void DEC_322;

export interface PortalSubmissionSummary {
  id: string;
  ref: string;
  title: string;
  status: SubmissionStatus;
  statusLabel: SpeakerStatusLabel;
  submittedAt: number;
  timezone: string;
}

export interface PortalTask {
  id: string;
  title: string;
  dueDate: number | null;
  required: boolean;
  status: string;
  timezone: string;
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
  contactName: string;
  contactCompany: string | null;
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
  // WAVE 1 (DEC-370 wave-62 amendment): contactRows, submissionRows and
  // taskRows are mutually independent — only the branding read below
  // depends on submissionRows[0].eventId, so it stays its own wave.
  const [contactRows, submissionRows, taskRows] = await Promise.all([
    db
      .select({
        firstName: schema.contact.firstName,
        lastName: schema.contact.lastName,
        company: schema.contact.company,
      })
      .from(schema.contact)
      .where(eq(schema.contact.id, contactId))
      .limit(1),
    db
      .select({
        id: schema.submission.id,
        seq: schema.submission.seq,
        title: schema.submission.title,
        status: schema.submission.status,
        createdAt: schema.submission.createdAt,
        eventId: schema.event.id,
        eventName: schema.event.name,
        recordPrefix: schema.event.recordPrefix,
        timezone: schema.event.timezone,
      })
      .from(schema.participant)
      .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
      .innerJoin(schema.event, eq(schema.submission.eventId, schema.event.id))
      .where(
        and(
          eq(schema.participant.contactId, contactId),
          eq(schema.event.orgId, orgId),
          inArray(schema.participant.inviteStatus, PORTAL_VISIBLE_INVITE_STATUSES),
        ),
      )
      .orderBy(desc(schema.submission.createdAt)),
    db
      .select({
        id: schema.taskAssignment.id,
        status: schema.taskAssignment.status,
        title: schema.task.title,
        dueDate: schema.task.dueDate,
        required: schema.task.required,
        eventOrgId: schema.event.orgId,
        timezone: schema.event.timezone,
      })
      .from(schema.taskAssignment)
      .innerJoin(schema.task, eq(schema.taskAssignment.taskId, schema.task.id))
      .innerJoin(schema.event, eq(schema.task.eventId, schema.event.id))
      .where(and(eq(schema.taskAssignment.contactId, contactId), eq(schema.event.orgId, orgId))),
  ]);
  const contactRow = contactRows[0];
  const contactName = contactRow ? `${contactRow.firstName} ${contactRow.lastName}`.trim() : "";
  const contactCompany = contactRow?.company ?? null;

  const submissions: PortalSubmissionSummary[] = submissionRows.map((row) => {
    const status = row.status as SubmissionStatus;
    return {
      id: row.id,
      ref: formatRef(row.recordPrefix, row.seq),
      title: row.title,
      status,
      statusLabel: speakerStatusLabel(status),
      submittedAt: row.createdAt.getTime(),
      timezone: row.timezone,
    };
  });

  const tasks: PortalTask[] = taskRows.map((row) => ({
    id: row.id,
    title: row.title,
    dueDate: row.dueDate ? row.dueDate.getTime() : null,
    required: row.required,
    status: row.status,
    timezone: row.timezone,
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
          // DEC-322 wave-30 amendment: sanitize at the read so a legacy
          // stored value (written before this gate existed) can never
          // reach an <img src>.
          logoUrl: safeImageSrc(settings.logoUrl),
          showResources: settings.showResources,
        }
      : { ...DEFAULT_BRANDING, eventId: mostRecentEventId, eventName };
  }

  return { branding, submissions, tasks, contactName, contactCompany };
}

export interface PortalSubmissionAnswer {
  fieldId: string;
  label: string;
  value: unknown;
}

export interface PortalSubmissionDetail {
  id: string;
  eventId: string;
  ref: string;
  title: string;
  description: string | null;
  status: SubmissionStatus;
  statusLabel: SpeakerStatusLabel;
  submittedAt: number;
  timezone: string;
  answers: PortalSubmissionAnswer[];
  // w1-c (DEC-729 detail rebuild): REF · format · track line + placement.
  trackName: string | null;
  format: string | null;
  day: string | null;
  startMin: number | null;
  endMin: number | null;
  roomName: string | null;
}

/** DEC-962 (wave 47 amendment): the correlated EXISTS proving `contactId`
 * is a PORTAL_VISIBLE_INVITE_STATUSES participant of `schema.submission.id`
 * — ANDed into getPortalSubmissionDetail's WHERE alongside the id/orgId
 * predicates, so a foreign submissionId (or a submission this contact isn't
 * a visible participant of) contributes no row, by construction, not by
 * the JS check below. */
function submissionOwnedByContact(contactId: string) {
  return sql`exists (
    select 1 from ${schema.participant}
    where ${schema.participant.submissionId} = ${schema.submission.id}
      and ${schema.participant.contactId} = ${contactId}
      and ${inArray(schema.participant.inviteStatus, [...PORTAL_VISIBLE_INVITE_STATUSES])}
  )`;
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
      eventId: schema.event.id,
      eventOrgId: schema.event.orgId,
      timezone: schema.event.timezone,
      // DEC-318/DEC-536: same out-of-range-slot-nulls-placement rule as
      // getMySessions — the range predicate lives in the LEFT JOIN's ON
      // clause, not the WHERE, so an out-of-range slot never drops the row.
      day: schema.scheduleSlot.day,
      startMin: schema.scheduleSlot.startMin,
      endMin: schema.scheduleSlot.endMin,
      roomName: schema.room.name,
    })
    .from(schema.submission)
    .innerJoin(schema.event, eq(schema.submission.eventId, schema.event.id))
    .leftJoin(
      schema.scheduleSlot,
      and(
        eq(schema.scheduleSlot.submissionId, schema.submission.id),
        gte(schema.scheduleSlot.day, schema.event.startDate),
        lte(schema.scheduleSlot.day, schema.event.endDate),
      ),
    )
    .leftJoin(schema.room, eq(schema.scheduleSlot.roomId, schema.room.id))
    .where(
      and(
        eq(schema.submission.id, submissionId),
        eq(schema.event.orgId, orgId),
        submissionOwnedByContact(contactId),
      ),
    )
    .limit(1);
  const row = rows[0];
  // DEC-962 (wave 47 amendment): the WHERE above already ANDs eventOrgId =
  // orgId and submissionOwnedByContact(contactId) — this recheck can never
  // fire (a foreign row is never fetched to check). Kept as a fail-loud
  // invariant, same DEC-026 wave-43 pattern as mergeOnePair.
  if (!row || row.eventOrgId !== orgId) return null;

  // WAVE 2 (DEC-370 wave-62 amendment): the scope row above is the only
  // gate (its WHERE proves ownership and returns null on miss) — these four
  // reads are all keyed by submissionId alone, so they run concurrently.
  // Array order matches the prior sequential order.
  const [formatRows, participantRows, answerRows, trackNames] = await Promise.all([
    db
      .select({ valueJson: schema.submissionAnswer.valueJson })
      .from(schema.submissionAnswer)
      .where(
        and(
          eq(schema.submissionAnswer.submissionId, submissionId),
          answerFieldRoleCondition("session_format"),
        ),
      )
      .limit(1),
    db
      .select({ contactId: schema.participant.contactId, inviteStatus: schema.participant.inviteStatus })
      .from(schema.participant)
      .where(
        and(
          eq(schema.participant.submissionId, submissionId),
          inArray(schema.participant.inviteStatus, PORTAL_VISIBLE_INVITE_STATUSES),
        ),
      ),
    db
      .select({
        fieldId: schema.submissionAnswer.formFieldId,
        label: schema.formField.label,
        valueJson: schema.submissionAnswer.valueJson,
      })
      .from(schema.submissionAnswer)
      .innerJoin(schema.formField, eq(schema.submissionAnswer.formFieldId, schema.formField.id))
      .where(eq(schema.submissionAnswer.submissionId, submissionId))
      .orderBy(asc(schema.formField.position), asc(schema.formField.id)),
    loadTrackNamesBySubmission(db, [submissionId]),
  ]);

  const formatParsed: unknown = formatRows[0] ? JSON.parse(formatRows[0].valueJson) : null;
  const format = typeof formatParsed === "string" && formatParsed.length > 0 ? formatParsed : null;

  const participantContactIds = participantRows.map((p) => p.contactId);
  // DEC-962 (wave 47 amendment; DEC-370 wave-62 amendment): submissionOwnedByContact
  // in the main query's WHERE above already proved contactId is a
  // PORTAL_VISIBLE_INVITE_STATUSES participant of this submission — this
  // recheck can never fire. Kept as a fail-loud invariant (same null
  // return), evaluated in source order after wave 2 resolves, same
  // DEC-026 wave-43 pattern as mergeOnePair.
  if (!isOwnedByContact(participantContactIds, contactId)) return null;

  const answers: PortalSubmissionAnswer[] = answerRows.map((a) => ({
    fieldId: a.fieldId,
    label: a.label,
    value: JSON.parse(a.valueJson),
  }));

  const trackName = trackNames.get(submissionId)?.[0] ?? null;

  const status = row.status as SubmissionStatus;
  return {
    id: row.id,
    eventId: row.eventId,
    ref: formatRef(row.recordPrefix, row.seq),
    title: row.title,
    description: row.description,
    status,
    statusLabel: speakerStatusLabel(status),
    submittedAt: row.createdAt.getTime(),
    timezone: row.timezone,
    answers,
    trackName,
    format,
    day: row.day,
    startMin: row.startMin,
    endMin: row.endMin,
    roomName: row.roomName,
  };
}

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

// ---------------------------------------------------------------------------
// J7 portal depth (DEC-029/DEC-028): tasks (all three kinds), invitations,
// scheduled sessions, resources. Every query below filters by the speaker's
// own contact_id and/or the events they participate in — no IDOR.
// ---------------------------------------------------------------------------

// 'general' | 'file_request' | 'form' — DEC-003 task.kind literal.
export type PortalTaskKind = "general" | "file_request" | "form";

export interface PortalTaskAssignment {
  id: string;
  taskId: string;
  kind: PortalTaskKind;
  title: string;
  description: string | null;
  dueDate: number | null;
  required: boolean;
  status: string;
  formId: string | null;
  fileId: string | null;
  responseJson: string | null;
}

/** Lists every task_assignment belonging to `contactId`, joined through task
 * -> event and scoped to the caller's org. */
export async function getMyTaskAssignments(db: Db, contactId: string, orgId: string): Promise<PortalTaskAssignment[]> {
  const rows = await db
    .select({
      id: schema.taskAssignment.id,
      taskId: schema.taskAssignment.taskId,
      status: schema.taskAssignment.status,
      fileId: schema.taskAssignment.fileId,
      responseJson: schema.taskAssignment.responseJson,
      kind: schema.task.kind,
      title: schema.task.title,
      description: schema.task.description,
      dueDate: schema.task.dueDate,
      required: schema.task.required,
      formId: schema.task.formId,
      eventOrgId: schema.event.orgId,
    })
    .from(schema.taskAssignment)
    .innerJoin(schema.task, eq(schema.taskAssignment.taskId, schema.task.id))
    .innerJoin(schema.event, eq(schema.task.eventId, schema.event.id))
    .where(and(eq(schema.taskAssignment.contactId, contactId), eq(schema.event.orgId, orgId)));

  return rows.map((row) => ({
    id: row.id,
    taskId: row.taskId,
    kind: row.kind as PortalTaskKind,
    title: row.title,
    description: row.description,
    dueDate: row.dueDate ? row.dueDate.getTime() : null,
    required: row.required,
    status: row.status,
    formId: row.formId,
    fileId: row.fileId,
    responseJson: row.responseJson,
  }));
}

export interface PortalAssignmentScope {
  id: string;
  taskId: string;
  kind: PortalTaskKind;
  formId: string | null;
  contactId: string;
  orgId: string;
  status: string;
}

/** Ownership + kind lookup for a single task_assignment, used by every
 * /portal/tasks/:assignmentId/* completion route before touching the row —
 * the caller must compare `.contactId` against the authenticated speaker's
 * own contactId (never trust the :assignmentId path param alone). */
export async function getAssignmentScope(db: Db, assignmentId: string): Promise<PortalAssignmentScope | null> {
  const rows = await db
    .select({
      id: schema.taskAssignment.id,
      taskId: schema.taskAssignment.taskId,
      contactId: schema.taskAssignment.contactId,
      status: schema.taskAssignment.status,
      kind: schema.task.kind,
      formId: schema.task.formId,
      orgId: schema.event.orgId,
    })
    .from(schema.taskAssignment)
    .innerJoin(schema.task, eq(schema.taskAssignment.taskId, schema.task.id))
    .innerJoin(schema.event, eq(schema.task.eventId, schema.event.id))
    .where(eq(schema.taskAssignment.id, assignmentId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    taskId: row.taskId,
    kind: row.kind as PortalTaskKind,
    formId: row.formId,
    contactId: row.contactId,
    orgId: row.orgId,
    status: row.status,
  };
}

/** Pure ownership guard for a task_assignment: only the speaker whose own
 * contact_id matches may act on it — 403 otherwise (no IDOR across the
 * portal's task-assignment routes). */
export function assertOwnAssignment(scope: PortalAssignmentScope, contactId: string): void {
  if (scope.contactId !== contactId) {
    throw new Error("assignment does not belong to this contact");
  }
}

/** kind='form' task_assignment completion: stores the answer JSON blob.
 * Status transition to 'complete' is applied separately by
 * src/server/repo/tasks.ts's updateAssignmentStatus (DEC-023 owns assignment
 * status semantics — this module never duplicates that logic). */
export async function saveTaskFormResponse(db: Db, assignmentId: string, responseJson: string): Promise<void> {
  await db
    .update(schema.taskAssignment)
    .set({ responseJson, updatedAt: new Date() })
    .where(eq(schema.taskAssignment.id, assignmentId));
}

/** kind='file_request' task_assignment completion: links the uploaded file
 * row. Status transition to 'complete' is applied separately (see above). */
export async function saveTaskFileCompletion(db: Db, assignmentId: string, fileId: string): Promise<void> {
  await db
    .update(schema.taskAssignment)
    .set({ fileId, updatedAt: new Date() })
    .where(eq(schema.taskAssignment.id, assignmentId));
}

// ---------------------------------------------------------------------------
// Invitations (DEC-029): participant rows with invite_status='invited' for
// the speaker's own contact, across every event they're invited to.
// ---------------------------------------------------------------------------

export type InviteAction = "accept" | "decline";
export type InviteStatus = "none" | "invited" | "accepted" | "declined";

/** Pure transition rule: only a participant row currently 'invited' may be
 * responded to — accepted/declined/none rows are terminal or not-yet-invited
 * and reject the transition (no re-answering, no answering an invite that
 * doesn't exist yet). */
export function canTransitionInvite(currentStatus: string): boolean {
  return currentStatus === "invited";
}

export function nextInviteStatus(action: InviteAction): "accepted" | "declined" {
  return action === "accept" ? "accepted" : "declined";
}

export interface PortalInvitation {
  participantId: string;
  submissionId: string;
  ref: string;
  title: string;
  eventName: string;
}

export async function getMyInvitations(db: Db, contactId: string, orgId: string): Promise<PortalInvitation[]> {
  const rows = await db
    .select({
      participantId: schema.participant.id,
      submissionId: schema.submission.id,
      seq: schema.submission.seq,
      title: schema.submission.title,
      recordPrefix: schema.event.recordPrefix,
      eventName: schema.event.name,
    })
    .from(schema.participant)
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .innerJoin(schema.event, eq(schema.submission.eventId, schema.event.id))
    .where(
      and(
        eq(schema.participant.contactId, contactId),
        eq(schema.participant.inviteStatus, "invited"),
        eq(schema.event.orgId, orgId),
      ),
    );

  return rows.map((row) => ({
    participantId: row.participantId,
    submissionId: row.submissionId,
    ref: formatRef(row.recordPrefix, row.seq),
    title: row.title,
    eventName: row.eventName,
  }));
}

export interface PortalParticipantScope {
  id: string;
  contactId: string;
  inviteStatus: string;
  orgId: string;
}

/** Ownership lookup for a single participant row, scoped to the caller's
 * org — used before any /portal/invitations/:participantId write. */
export async function getParticipantScope(db: Db, participantId: string): Promise<PortalParticipantScope | null> {
  const rows = await db
    .select({
      id: schema.participant.id,
      contactId: schema.participant.contactId,
      inviteStatus: schema.participant.inviteStatus,
      orgId: schema.event.orgId,
    })
    .from(schema.participant)
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .innerJoin(schema.event, eq(schema.submission.eventId, schema.event.id))
    .where(eq(schema.participant.id, participantId))
    .limit(1);
  return rows[0] ?? null;
}

export async function setInviteStatus(db: Db, participantId: string, status: "accepted" | "declined"): Promise<void> {
  await db
    .update(schema.participant)
    .set({ inviteStatus: status, updatedAt: new Date() })
    .where(eq(schema.participant.id, participantId));
}

// ---------------------------------------------------------------------------
// Sessions (DEC-029): the speaker's own accepted submissions, with schedule
// day/start/end + room name when placed.
// ---------------------------------------------------------------------------

export interface PortalSession {
  submissionId: string;
  ref: string;
  title: string;
  day: string | null;
  startMin: number | null;
  endMin: number | null;
  roomName: string | null;
}

export async function getMySessions(db: Db, contactId: string, orgId: string): Promise<PortalSession[]> {
  const rows = await db
    .select({
      submissionId: schema.submission.id,
      seq: schema.submission.seq,
      title: schema.submission.title,
      recordPrefix: schema.event.recordPrefix,
      day: schema.scheduleSlot.day,
      startMin: schema.scheduleSlot.startMin,
      endMin: schema.scheduleSlot.endMin,
      roomName: schema.room.name,
    })
    .from(schema.participant)
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .innerJoin(schema.event, eq(schema.submission.eventId, schema.event.id))
    .leftJoin(schema.scheduleSlot, eq(schema.scheduleSlot.submissionId, schema.submission.id))
    .leftJoin(schema.room, eq(schema.scheduleSlot.roomId, schema.room.id))
    .where(
      and(
        eq(schema.participant.contactId, contactId),
        eq(schema.event.orgId, orgId),
        eq(schema.submission.status, "accepted"),
      ),
    );

  return rows.map((row) => ({
    submissionId: row.submissionId,
    ref: formatRef(row.recordPrefix, row.seq),
    title: row.title,
    day: row.day,
    startMin: row.startMin,
    endMin: row.endMin,
    roomName: row.roomName,
  }));
}

// ---------------------------------------------------------------------------
// Resources (DEC-029): resource rows grouped by every event the speaker
// participates in. Wiki content renders as escaped paragraphs; file
// resources stream via GET /portal/resources/:resourceId/download.
// ---------------------------------------------------------------------------

export interface PortalResource {
  id: string;
  kind: string;
  title: string;
  content: string | null;
  fileId: string | null;
}

export interface PortalResourceGroup {
  eventId: string;
  eventName: string;
  resources: PortalResource[];
}

/** Every eventId the speaker's contact participates in (any submission,
 * any status) — the scoping unit for both the resources list and the
 * resource-download authz check. */
export async function getMyEventIds(db: Db, contactId: string, orgId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ eventId: schema.event.id })
    .from(schema.participant)
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .innerJoin(schema.event, eq(schema.submission.eventId, schema.event.id))
    .where(and(eq(schema.participant.contactId, contactId), eq(schema.event.orgId, orgId)));
  return rows.map((r) => r.eventId);
}

/** Pure scoping check: is `resourceEventId` among the events I participate
 * in? Never trust a :resourceId from the request without this (or the
 * equivalent query-level filter) — no IDOR across events. */
export function isParticipantInEvent(myEventIds: readonly string[], resourceEventId: string): boolean {
  return myEventIds.includes(resourceEventId);
}

export async function getMyResources(db: Db, contactId: string, orgId: string): Promise<PortalResourceGroup[]> {
  const eventIds = await getMyEventIds(db, contactId, orgId);
  if (eventIds.length === 0) return [];

  const rows = await db
    .select({
      id: schema.resource.id,
      eventId: schema.resource.eventId,
      kind: schema.resource.kind,
      title: schema.resource.title,
      content: schema.resource.content,
      fileId: schema.resource.fileId,
      position: schema.resource.position,
      eventName: schema.event.name,
    })
    .from(schema.resource)
    .innerJoin(schema.event, eq(schema.resource.eventId, schema.event.id))
    .where(eq(schema.event.orgId, orgId));

  const relevant = rows.filter((r) => eventIds.includes(r.eventId));
  relevant.sort((a, b) => a.position - b.position);

  const groups = new Map<string, PortalResourceGroup>();
  for (const row of relevant) {
    let group = groups.get(row.eventId);
    if (!group) {
      group = { eventId: row.eventId, eventName: row.eventName, resources: [] };
      groups.set(row.eventId, group);
    }
    group.resources.push({ id: row.id, kind: row.kind, title: row.title, content: row.content, fileId: row.fileId });
  }
  return Array.from(groups.values());
}

export interface PortalResourceDownloadScope {
  r2Key: string;
  contentType: string;
  filename: string;
}

/**
 * Authz + lookup for GET /portal/resources/:resourceId/download: the
 * resource must be kind='file' with a linked file row, and the requesting
 * speaker must participate in the resource's event. Resource files have no
 * submission, so the participant-based /files authz (DEC-020) can never
 * serve them — this is the dedicated carve-out (DEC-029).
 */
export async function getResourceDownloadScope(
  db: Db,
  resourceId: string,
  contactId: string,
  orgId: string,
): Promise<PortalResourceDownloadScope | null> {
  const rows = await db
    .select({
      kind: schema.resource.kind,
      eventId: schema.resource.eventId,
      eventOrgId: schema.event.orgId,
      fileId: schema.resource.fileId,
    })
    .from(schema.resource)
    .innerJoin(schema.event, eq(schema.resource.eventId, schema.event.id))
    .where(eq(schema.resource.id, resourceId))
    .limit(1);
  const row = rows[0];
  if (!row || row.eventOrgId !== orgId || row.kind !== "file" || !row.fileId) return null;

  const eventIds = await getMyEventIds(db, contactId, orgId);
  if (!isParticipantInEvent(eventIds, row.eventId)) return null;

  const fileRows = await db
    .select({
      r2Key: schema.file.r2Key,
      contentType: schema.file.contentType,
      filename: schema.file.filename,
    })
    .from(schema.file)
    .where(eq(schema.file.id, row.fileId))
    .limit(1);
  const fileRow = fileRows[0];
  if (!fileRow) return null;
  return fileRow;
}

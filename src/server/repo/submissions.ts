// Submissions repo (J3 backend, DEC-016 list contract). Repo functions are
// the only code that touches drizzle row types (DEC-012): thin handlers in
// src/routes/api/submissions.ts call these, which call the pure cores in
// src/domain/{status,acceptance,ids}.ts. This module deliberately contains
// NO mail/mailer import (DEC-009 invariant #1) — verified by a source-scan
// test in test/api-submissions.test.ts.

import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { newId, formatRef } from "../../domain/ids";
import {
  SUBMISSION_STATUSES,
  changeStatus,
  type SubmissionStatus,
} from "../../domain/status";
import { planAcceptance } from "../../domain/acceptance";

// ---------------------------------------------------------------------------
// Pure param parsing (no I/O) — unit-tested directly.
// ---------------------------------------------------------------------------

export type SortOrder = "newest" | "oldest" | "title" | "ref";

export const SORT_ORDERS: readonly SortOrder[] = ["newest", "oldest", "title", "ref"];

const DEFAULT_PER_PAGE = 50;
const MAX_PER_PAGE = 200;

export interface ParsedListQuery {
  page: number;
  perPage: number;
  q: string | null;
  status: SubmissionStatus[];
  trackId: string | null;
  sort: SortOrder;
  includeAnswers: boolean;
}

/**
 * Parses GET .../submissions query params per DEC-013 (page/perPage/q) +
 * DEC-016 (status/trackId/sort/includeAnswers). Unknown status tokens are
 * dropped silently (filters degrade gracefully; they don't reject a
 * request) — validation of status literals on WRITE happens in
 * parseStatusLiteral below, which fails loudly.
 */
export function parseListQuery(raw: Record<string, string | undefined>): ParsedListQuery {
  const pageNum = Number(raw.page);
  const perPageNum = Number(raw.perPage);
  const page = Number.isInteger(pageNum) && pageNum > 0 ? pageNum : 1;
  const perPage =
    Number.isInteger(perPageNum) && perPageNum > 0
      ? Math.min(perPageNum, MAX_PER_PAGE)
      : DEFAULT_PER_PAGE;

  const q = raw.q && raw.q.trim().length > 0 ? raw.q.trim() : null;

  const status = (raw.status ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is SubmissionStatus =>
      (SUBMISSION_STATUSES as readonly string[]).includes(s),
    );

  const trackId = raw.trackId && raw.trackId.trim().length > 0 ? raw.trackId.trim() : null;

  const sort: SortOrder =
    raw.sort && (SORT_ORDERS as readonly string[]).includes(raw.sort)
      ? (raw.sort as SortOrder)
      : "newest";

  const includeAnswers = raw.includeAnswers === "1";

  return { page, perPage, q, status, trackId, sort, includeAnswers };
}

/** Validates a single status literal against the DEC-003 set. Fails loudly
 * (throws) — callers wrap this into an ApiError('invalid', ...) at the route
 * boundary since it's a write-path validation, not a filter. */
export function isValidStatusLiteral(value: unknown): value is SubmissionStatus {
  return typeof value === "string" && (SUBMISSION_STATUSES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export interface SubmissionSpeaker {
  contactId: string;
  name: string;
}

export interface SubmissionListItem {
  id: string;
  ref: string;
  title: string;
  status: string;
  contentStatus: string;
  speakers: SubmissionSpeaker[];
  trackIds: string[];
  submittedAt: number | null;
  createdAt: number;
  answers?: Record<string, unknown>;
}

export interface ListSubmissionsResult {
  items: SubmissionListItem[];
  total: number;
}

function orderByForSort(sort: SortOrder) {
  switch (sort) {
    case "oldest":
      return sql`${schema.submission.createdAt} asc`;
    case "title":
      return sql`${schema.submission.title} asc`;
    case "ref":
      return sql`${schema.submission.seq} asc`;
    case "newest":
    default:
      return sql`${schema.submission.createdAt} desc`;
  }
}

export async function listSubmissions(
  db: Db,
  eventId: string,
  params: ParsedListQuery,
): Promise<ListSubmissionsResult> {
  const eventRows = await db
    .select({ recordPrefix: schema.event.recordPrefix })
    .from(schema.event)
    .where(eq(schema.event.id, eventId))
    .limit(1);
  const recordPrefix = eventRows[0]?.recordPrefix ?? "SES";

  const conditions = [eq(schema.submission.eventId, eventId)];
  if (params.status.length > 0) {
    conditions.push(inArray(schema.submission.status, params.status));
  }

  // Candidate-id narrowing for q / trackId: a handful of aggregate queries
  // over the whole event, never per-row of the result page (no N+1).
  let allowedIds: Set<string> | null = null;

  if (params.q) {
    const like = `%${params.q.toLowerCase()}%`;
    const titleRows = await db
      .select({ id: schema.submission.id })
      .from(schema.submission)
      .where(
        and(eq(schema.submission.eventId, eventId), sql`lower(${schema.submission.title}) like ${like}`),
      );
    const nameRows = await db
      .select({ submissionId: schema.participant.submissionId })
      .from(schema.participant)
      .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
      .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
      .where(
        and(
          eq(schema.submission.eventId, eventId),
          sql`lower(${schema.contact.firstName} || ' ' || ${schema.contact.lastName}) like ${like}`,
        ),
      );
    const ids = new Set<string>();
    for (const r of titleRows) ids.add(r.id);
    for (const r of nameRows) ids.add(r.submissionId);
    allowedIds = ids;
  }

  if (params.trackId) {
    const primaryRows = await db
      .select({ id: schema.submission.id })
      .from(schema.submission)
      .where(and(eq(schema.submission.eventId, eventId), eq(schema.submission.trackId, params.trackId)));
    const joinRows = await db
      .select({ submissionId: schema.submissionTrack.submissionId })
      .from(schema.submissionTrack)
      .where(eq(schema.submissionTrack.trackId, params.trackId));
    const trackMatch = new Set<string>();
    for (const r of primaryRows) trackMatch.add(r.id);
    for (const r of joinRows) trackMatch.add(r.submissionId);
    allowedIds = allowedIds ? new Set([...allowedIds].filter((id) => trackMatch.has(id))) : trackMatch;
  }

  if (allowedIds !== null) {
    if (allowedIds.size === 0) return { items: [], total: 0 };
    conditions.push(inArray(schema.submission.id, [...allowedIds]));
  }

  const whereExpr = and(...conditions);

  const totalRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.submission)
    .where(whereExpr);
  const total = Number(totalRows[0]?.count ?? 0);

  const offset = (params.page - 1) * params.perPage;

  const rows = await db
    .select()
    .from(schema.submission)
    .where(whereExpr)
    .orderBy(orderByForSort(params.sort))
    .limit(params.perPage)
    .offset(offset);

  if (rows.length === 0) return { items: [], total };

  const ids = rows.map((r) => r.id);

  const participantRows = await db
    .select({
      submissionId: schema.participant.submissionId,
      contactId: schema.participant.contactId,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      order: schema.participant.order,
    })
    .from(schema.participant)
    .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
    .where(inArray(schema.participant.submissionId, ids));

  const trackRows = await db
    .select({ submissionId: schema.submissionTrack.submissionId, trackId: schema.submissionTrack.trackId })
    .from(schema.submissionTrack)
    .where(inArray(schema.submissionTrack.submissionId, ids));

  let answerRows: { submissionId: string; formFieldId: string; valueJson: string }[] = [];
  if (params.includeAnswers) {
    answerRows = await db
      .select({
        submissionId: schema.submissionAnswer.submissionId,
        formFieldId: schema.submissionAnswer.formFieldId,
        valueJson: schema.submissionAnswer.valueJson,
      })
      .from(schema.submissionAnswer)
      .where(inArray(schema.submissionAnswer.submissionId, ids));
  }

  const speakersBySubmission = new Map<string, { contactId: string; name: string; order: number }[]>();
  for (const p of participantRows) {
    const arr = speakersBySubmission.get(p.submissionId) ?? [];
    arr.push({ contactId: p.contactId, name: `${p.firstName} ${p.lastName}`.trim(), order: p.order });
    speakersBySubmission.set(p.submissionId, arr);
  }
  for (const arr of speakersBySubmission.values()) arr.sort((a, b) => a.order - b.order);

  const tracksBySubmission = new Map<string, string[]>();
  for (const t of trackRows) {
    const arr = tracksBySubmission.get(t.submissionId) ?? [];
    arr.push(t.trackId);
    tracksBySubmission.set(t.submissionId, arr);
  }

  const answersBySubmission = new Map<string, Record<string, unknown>>();
  for (const a of answerRows) {
    const map = answersBySubmission.get(a.submissionId) ?? {};
    map[a.formFieldId] = JSON.parse(a.valueJson);
    answersBySubmission.set(a.submissionId, map);
  }

  const items: SubmissionListItem[] = rows.map((r) => {
    const speakers = (speakersBySubmission.get(r.id) ?? []).map(({ contactId, name }) => ({
      contactId,
      name,
    }));
    const joinedTracks = tracksBySubmission.get(r.id) ?? [];
    const trackIds = r.trackId
      ? [...new Set([r.trackId, ...joinedTracks])]
      : [...new Set(joinedTracks)];
    return {
      id: r.id,
      ref: formatRef(recordPrefix, r.seq),
      title: r.title,
      status: r.status,
      contentStatus: r.contentStatus,
      speakers,
      trackIds,
      submittedAt: r.createdAt.getTime(),
      createdAt: r.createdAt.getTime(),
      ...(params.includeAnswers ? { answers: answersBySubmission.get(r.id) ?? {} } : {}),
    };
  });

  return { items, total };
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

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
    .orderBy(schema.participant.order);

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

// ---------------------------------------------------------------------------
// Create (manual session creation)
// ---------------------------------------------------------------------------

export interface CreateSubmissionInput {
  title: string;
  description?: string | null;
  contact?: { email: string; firstName: string; lastName: string } | null;
}

async function nextSeq(db: Db, eventId: string): Promise<number> {
  const rows = await db
    .select({ maxSeq: sql<number>`max(${schema.submission.seq})` })
    .from(schema.submission)
    .where(eq(schema.submission.eventId, eventId));
  const max = rows[0]?.maxSeq;
  return (max ?? 0) + 1;
}

async function findOrCreateContact(
  db: Db,
  orgId: string,
  input: { email: string; firstName: string; lastName: string },
  now: Date,
): Promise<string> {
  const email = input.email.trim().toLowerCase();
  const existing = await db
    .select({ id: schema.contact.id })
    .from(schema.contact)
    .where(and(eq(schema.contact.orgId, orgId), eq(schema.contact.email, email)))
    .limit(1);
  if (existing[0]) return existing[0].id;

  const id = newId();
  await db.insert(schema.contact).values({
    id,
    orgId,
    firstName: input.firstName,
    lastName: input.lastName,
    email,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function createSubmission(
  db: Db,
  eventId: string,
  orgId: string,
  input: CreateSubmissionInput,
): Promise<string> {
  const now = new Date();
  const seq = await nextSeq(db, eventId);
  const id = newId();

  await db.insert(schema.submission).values({
    id,
    eventId,
    formId: null,
    seq,
    title: input.title,
    description: input.description ?? null,
    status: "pending",
    contentStatus: "pending",
    createdAt: now,
    updatedAt: now,
  });

  if (input.contact) {
    const contactId = await findOrCreateContact(db, orgId, input.contact, now);
    await db.insert(schema.participant).values({
      id: newId(),
      submissionId: id,
      contactId,
      role: "speaker",
      order: 0,
      visible: true,
      inviteStatus: "none",
      createdAt: now,
      updatedAt: now,
    });
  }

  return id;
}

// ---------------------------------------------------------------------------
// Clone
// ---------------------------------------------------------------------------

export async function cloneSubmission(db: Db, submissionId: string): Promise<string> {
  const rows = await db
    .select()
    .from(schema.submission)
    .where(eq(schema.submission.id, submissionId))
    .limit(1);
  const original = rows[0];
  if (!original) throw new Error(`cloneSubmission: submission ${submissionId} not found`);

  const now = new Date();
  const seq = await nextSeq(db, original.eventId);
  const newSubmissionId = newId();

  await db.insert(schema.submission).values({
    id: newSubmissionId,
    eventId: original.eventId,
    formId: original.formId,
    seq,
    title: `${original.title} (copy)`,
    description: original.description,
    trackId: original.trackId,
    status: "pending",
    contentStatus: "pending",
    createdAt: now,
    updatedAt: now,
  });

  const trackRows = await db
    .select({ trackId: schema.submissionTrack.trackId })
    .from(schema.submissionTrack)
    .where(eq(schema.submissionTrack.submissionId, submissionId));
  for (const t of trackRows) {
    await db.insert(schema.submissionTrack).values({
      submissionId: newSubmissionId,
      trackId: t.trackId,
      createdAt: now,
    });
  }

  const answerRows = await db
    .select({ formFieldId: schema.submissionAnswer.formFieldId, valueJson: schema.submissionAnswer.valueJson })
    .from(schema.submissionAnswer)
    .where(eq(schema.submissionAnswer.submissionId, submissionId));
  for (const a of answerRows) {
    await db.insert(schema.submissionAnswer).values({
      id: newId(),
      submissionId: newSubmissionId,
      formFieldId: a.formFieldId,
      valueJson: a.valueJson,
      createdAt: now,
      updatedAt: now,
    });
  }

  return newSubmissionId;
}

// ---------------------------------------------------------------------------
// Status change (DEC-009: no email, idempotent acceptance planning)
// ---------------------------------------------------------------------------

async function getOrCreateTask(
  db: Db,
  eventId: string,
  template: { title: string; kind: "general" | "file_request" | "form"; required: boolean },
  now: Date,
): Promise<string> {
  const existing = await db
    .select({ id: schema.task.id })
    .from(schema.task)
    .where(and(eq(schema.task.eventId, eventId), eq(schema.task.title, template.title)))
    .limit(1);
  if (existing[0]) return existing[0].id;

  const id = newId();
  await db.insert(schema.task).values({
    id,
    eventId,
    kind: template.kind,
    title: template.title,
    required: template.required,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

/** Runs the DEC-009 acceptance planner for one submission's participants,
 * idempotently: only creates task_assignment rows for (contact, title)
 * pairs that don't already exist. No mailer reference — DEC-009 invariant. */
async function runAcceptancePlanning(db: Db, eventId: string, submissionId: string, now: Date): Promise<void> {
  const participantRows = await db
    .select({ contactId: schema.participant.contactId })
    .from(schema.participant)
    .where(eq(schema.participant.submissionId, submissionId));
  const participantContactIds = participantRows.map((p) => p.contactId);
  if (participantContactIds.length === 0) return;

  const existingRows = await db
    .select({ contactId: schema.taskAssignment.contactId, title: schema.task.title })
    .from(schema.taskAssignment)
    .innerJoin(schema.task, eq(schema.taskAssignment.taskId, schema.task.id))
    .where(and(eq(schema.task.eventId, eventId), inArray(schema.taskAssignment.contactId, participantContactIds)));

  const existingTaskTitlesByContact: Record<string, string[]> = {};
  for (const r of existingRows) {
    const arr = existingTaskTitlesByContact[r.contactId] ?? [];
    arr.push(r.title);
    existingTaskTitlesByContact[r.contactId] = arr;
  }

  const plan = planAcceptance({
    submissionId,
    eventId,
    participantContactIds,
    existingTaskTitlesByContact,
  });

  const taskIdByTitle = new Map<string, string>();
  for (const assignment of plan.taskAssignments) {
    let taskId = taskIdByTitle.get(assignment.taskTitle);
    if (!taskId) {
      taskId = await getOrCreateTask(
        db,
        eventId,
        { title: assignment.taskTitle, kind: assignment.taskKind, required: assignment.required },
        now,
      );
      taskIdByTitle.set(assignment.taskTitle, taskId);
    }
    await db.insert(schema.taskAssignment).values({
      id: newId(),
      taskId,
      contactId: assignment.contactId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
  }
}

export interface UpdateStatusesResult {
  updated: number;
}

/**
 * Sets `status` on every submission id in `ids` that belongs to `eventId`.
 * NEVER sends email (DEC-009 invariant #1 — no mailer import in this
 * module). On first transition into 'accepted' (accepted_at was null) runs
 * the acceptance planner exactly once, idempotently.
 */
export async function updateSubmissionStatuses(
  db: Db,
  eventId: string,
  ids: string[],
  status: SubmissionStatus,
  now: Date,
): Promise<UpdateStatusesResult> {
  if (ids.length === 0) return { updated: 0 };

  const rows = await db
    .select({
      id: schema.submission.id,
      status: schema.submission.status,
      acceptedAt: schema.submission.acceptedAt,
    })
    .from(schema.submission)
    .where(and(eq(schema.submission.eventId, eventId), inArray(schema.submission.id, ids)));

  for (const row of rows) {
    const currentStatus = isValidStatusLiteral(row.status) ? row.status : "pending";
    const result = changeStatus(
      { status: currentStatus, acceptedAt: row.acceptedAt ? row.acceptedAt.getTime() : null },
      status,
      now.getTime(),
    );
    await db
      .update(schema.submission)
      .set({
        status: result.status,
        acceptedAt: result.acceptedAt !== null ? new Date(result.acceptedAt) : null,
        updatedAt: now,
      })
      .where(eq(schema.submission.id, row.id));

    if (result.fireAcceptance) {
      await runAcceptancePlanning(db, eventId, row.id, now);
    }
  }

  return { updated: rows.length };
}

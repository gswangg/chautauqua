// Submissions repo: status change (DEC-009: no email; DEC-079: acceptance
// side effects retryable-exactly-once — planning runs BEFORE the row's
// accepted_at commit). Split out of repo/submissions.ts (contention
// decomposition, no behavior change). This module deliberately contains NO
// mail/mailer import (DEC-009 invariant #1) — verified by a source-scan
// test in test/api-submissions.test.ts.

import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { newId } from "../../../domain/ids";
import { changeStatus, type SubmissionStatus } from "../../../domain/status";
import { planAcceptance, FORM_TASK_FIELD_SPECS, isActiveParticipant, onboardingTaskDueDate } from "../../../domain/acceptance";
import { isValidStatusLiteral } from "./query";
import { chunkIds, chunkRowsForInsert } from "../../../lib/chunk";
import { ApiError } from "../../http";
import { DEC_079, DEC_111, DEC_133, DEC_520, DEC_521, DEC_556 } from "../../../decisions";

void DEC_079; // planning-before-commit acceptance ordering + chunked/batched bulk status changes below
void DEC_111; // form-task tasks get real backing forms, self-healed when formId is null
void DEC_133; // full-set id match guard below (mirrors DEC-122's requireFullMatch)
void DEC_520; // auto-created onboarding tasks get a due date derived from the event start date
void DEC_521; // task_assignment inserts are chunked, bounded by MAX_ACCEPTANCE_TASK_ASSIGNMENTS
void DEC_556; // task_assignment insert below targets the real (task_id, contact_id) unique index

/** DEC-521: a planned set of task_assignment rows above this size is refused
 * BEFORE any insert — unlike MAX_AUTO_SCHEDULE_PLACEMENTS' silent slice, a
 * dropped onboarding assignment would be invisible to its producer. */
export const MAX_ACCEPTANCE_TASK_ASSIGNMENTS = 20000;

/**
 * DEC-111: for a kind='form' template title present in FORM_TASK_FIELD_SPECS,
 * finds-or-creates an event-scoped schema.form titled exactly the task
 * title (isDefault:false, null open/close so it can never leak into public
 * CFP submit via getDefaultForm), inserting its fields on first creation.
 * Idempotent — a pre-existing form with that title is reused as-is.
 */
async function getOrCreateFormTaskForm(db: Db, eventId: string, title: string, now: Date): Promise<string> {
  const existingForm = await db
    .select({ id: schema.form.id })
    .from(schema.form)
    .where(and(eq(schema.form.eventId, eventId), eq(schema.form.title, title)))
    .limit(1);
  if (existingForm[0]) return existingForm[0].id;

  const formId = newId();
  await db.insert(schema.form).values({
    id: formId,
    eventId,
    title,
    isDefault: false,
    openDate: null,
    closeDate: null,
    createdAt: now,
    updatedAt: now,
  });

  const specs = FORM_TASK_FIELD_SPECS[title] ?? [];
  for (const [i, spec] of specs.entries()) {
    await db.insert(schema.formField).values({
      id: newId(),
      formId,
      section: spec.section,
      kind: spec.kind,
      label: spec.label,
      required: spec.required,
      position: i,
      optionsJson: spec.options ? JSON.stringify(spec.options) : null,
      createdAt: now,
      updatedAt: now,
    });
  }
  return formId;
}

async function getOrCreateTask(
  db: Db,
  eventId: string,
  template: { title: string; kind: "general" | "file_request" | "form"; required: boolean },
  now: Date,
  dueDate: number,
): Promise<string> {
  const existing = await db
    .select({ id: schema.task.id, formId: schema.task.formId })
    .from(schema.task)
    .where(and(eq(schema.task.eventId, eventId), eq(schema.task.title, template.title)))
    .limit(1);
  if (existing[0]) {
    // DEC-111 self-heal: an already-existing 'form' task with a null formId
    // (created before this backing-form logic existed) gets one now.
    // DEC-520: due dates are NOT self-healed here — an organizer who cleared
    // a due date via PATCH meant it; this branch never back-fills.
    if (template.kind === "form" && !existing[0].formId) {
      const formId = await getOrCreateFormTaskForm(db, eventId, template.title, now);
      await db.update(schema.task).set({ formId, updatedAt: now }).where(eq(schema.task.id, existing[0].id));
    }
    return existing[0].id;
  }

  const id = newId();
  const formId = template.kind === "form" ? await getOrCreateFormTaskForm(db, eventId, template.title, now) : null;
  await db.insert(schema.task).values({
    id,
    eventId,
    kind: template.kind,
    title: template.title,
    required: template.required,
    formId,
    dueDate: new Date(dueDate),
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

/**
 * DEC-355: set-based core shared by ensureOnboardingTasks (single-submission
 * callers) and the bulk-accept path in updateSubmissionStatuses. Given an
 * already-deduped, already-filtered (isActiveParticipant) list of contact
 * ids, loads their existing (contactId, task.title) pairs with ONE chunked
 * SELECT (not one per submission), plans once via the pure planAcceptance,
 * finds-or-creates each distinct planned task title exactly once, then
 * inserts one task_assignment row per planned (contact, title) pair — that
 * insert count is proportional to distinct new pairs, not to submission/id
 * count. No mailer reference — DEC-009 invariant.
 */
async function planAndPersistOnboardingTasks(
  db: Db,
  eventId: string,
  participantContactIds: string[],
  now: Date,
): Promise<void> {
  if (participantContactIds.length === 0) return;

  // DEC-520: the event's start date is selected ONCE, before the plan loop
  // — every planned task's due date derives from this single read, not a
  // per-template/per-contact re-lookup.
  const eventRows = await db
    .select({ startDate: schema.event.startDate })
    .from(schema.event)
    .where(eq(schema.event.id, eventId))
    .limit(1);
  const eventStartDate = eventRows[0]?.startDate;
  if (!eventStartDate) {
    throw new Error(`planAndPersistOnboardingTasks: no event found for eventId "${eventId}"`);
  }

  const existingTaskTitlesByContact: Record<string, string[]> = {};
  for (const contactChunk of chunkIds(participantContactIds)) {
    const existingRows = await db
      .select({ contactId: schema.taskAssignment.contactId, title: schema.task.title })
      .from(schema.taskAssignment)
      .innerJoin(schema.task, eq(schema.taskAssignment.taskId, schema.task.id))
      .where(and(eq(schema.task.eventId, eventId), inArray(schema.taskAssignment.contactId, contactChunk)));
    for (const r of existingRows) {
      const arr = existingTaskTitlesByContact[r.contactId] ?? [];
      arr.push(r.title);
      existingTaskTitlesByContact[r.contactId] = arr;
    }
  }

  const plan = planAcceptance({
    submissionId: "",
    eventId,
    participantContactIds,
    existingTaskTitlesByContact,
  });

  if (plan.taskAssignments.length > MAX_ACCEPTANCE_TASK_ASSIGNMENTS) {
    throw new ApiError(
      "invalid",
      `Planned onboarding task assignments (${plan.taskAssignments.length}) exceed the cap of ${MAX_ACCEPTANCE_TASK_ASSIGNMENTS}`,
      { taskAssignments: `${plan.taskAssignments.length} exceeds cap ${MAX_ACCEPTANCE_TASK_ASSIGNMENTS}` },
    );
  }

  const taskIdByTitle = new Map<string, string>();
  const assignmentRows: {
    id: string;
    taskId: string;
    contactId: string;
    status: "pending";
    createdAt: Date;
    updatedAt: Date;
  }[] = [];
  for (const assignment of plan.taskAssignments) {
    let taskId = taskIdByTitle.get(assignment.taskTitle);
    if (!taskId) {
      const dueDate = onboardingTaskDueDate(eventStartDate, assignment.dueDaysBeforeEventStart);
      taskId = await getOrCreateTask(
        db,
        eventId,
        { title: assignment.taskTitle, kind: assignment.taskKind, required: assignment.required },
        now,
        dueDate,
      );
      taskIdByTitle.set(assignment.taskTitle, taskId);
    }
    assignmentRows.push({
      id: newId(),
      taskId,
      contactId: assignment.contactId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
  }

  // DEC-521: chunked multi-row insert, mirroring agenda.ts's
  // scheduleSlot insert — not one statement per (contact, task) pair.
  // DEC-528: chunked by bound-parameter budget (columns-per-row derived),
  // not by row count.
  // DEC-556: (task_id, contact_id) is a real UNIQUE index — ON CONFLICT DO
  // NOTHING alongside the existence pre-read above (kept for DEC-521's
  // write-burst cap).
  for (const chunk of chunkRowsForInsert(assignmentRows)) {
    await db
      .insert(schema.taskAssignment)
      .values(chunk)
      .onConflictDoNothing({ target: [schema.taskAssignment.taskId, schema.taskAssignment.contactId] });
  }
}

/**
 * Runs the DEC-009 acceptance planner for one submission's participants,
 * idempotently: only creates task_assignment rows for (contact, title)
 * pairs that don't already exist. No mailer reference — DEC-009 invariant.
 *
 * DEC-278: `contactIds`, when non-null, restricts planning to exactly those
 * contacts (used when a participant is added to an already-accepted
 * submission — the fireAcceptance branch below never re-runs for them, so
 * callers plan the single new participant directly). When null (the
 * fireAcceptance path), this loads the submission's participant rows and
 * keeps only the DEC-274-active ones (isActiveParticipant) — an 'invited' or
 * 'declined' participant never gets tasks planned until/unless they accept.
 * Zero eligible participants is a silent no-op either way.
 */
export async function ensureOnboardingTasks(
  db: Db,
  eventId: string,
  submissionId: string,
  contactIds: string[] | null,
  now: Date,
): Promise<void> {
  let participantContactIds: string[];
  if (contactIds !== null) {
    participantContactIds = contactIds;
  } else {
    const participantRows = await db
      .select({ contactId: schema.participant.contactId, inviteStatus: schema.participant.inviteStatus })
      .from(schema.participant)
      .where(eq(schema.participant.submissionId, submissionId));
    participantContactIds = participantRows.filter((p) => isActiveParticipant(p.inviteStatus)).map((p) => p.contactId);
  }
  await planAndPersistOnboardingTasks(db, eventId, participantContactIds, now);
}

/**
 * DEC-278: fetches a single submission's current status literal, used by the
 * participant-invite route to decide whether a newly-added participant to an
 * already-'accepted' submission needs onboarding tasks planned immediately
 * (since the fireAcceptance branch of updateSubmissionStatuses only ever
 * fires once, at the original accept transition).
 */
export async function getSubmissionStatus(db: Db, submissionId: string): Promise<string | null> {
  const rows = await db
    .select({ status: schema.submission.status })
    .from(schema.submission)
    .where(eq(schema.submission.id, submissionId))
    .limit(1);
  return rows[0]?.status ?? null;
}

export interface SubmissionStatusForParticipant {
  submissionId: string;
  eventId: string;
  status: string;
}

/**
 * DEC-278: given a participant row id, resolves its parent submission's
 * (id, eventId, status). Used by the portal invitation-accept handler to
 * decide whether accepting on an already-'accepted' submission needs
 * onboarding tasks planned immediately for that one contact (mirrors the
 * organizer-side add-participant guard in routes/api/submissions.ts).
 */
export async function getSubmissionStatusForParticipant(
  db: Db,
  participantId: string,
): Promise<SubmissionStatusForParticipant | null> {
  const rows = await db
    .select({
      submissionId: schema.submission.id,
      eventId: schema.submission.eventId,
      status: schema.submission.status,
    })
    .from(schema.participant)
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .where(eq(schema.participant.id, participantId))
    .limit(1);
  return rows[0] ?? null;
}

export interface UpdateStatusesResult {
  updated: number;
}

/**
 * Sets `status` on every submission id in `ids` that belongs to `eventId`.
 * NEVER sends email (DEC-009 invariant #1 — no mailer import in this
 * module). On first transition into 'accepted' (accepted_at was null) runs
 * the acceptance planner exactly once, idempotently.
 *
 * DEC-133 (DEC-122-style full-set match): every distinct id in `ids` must
 * belong to `eventId`, checked BEFORE any mutation — if one or more ids are
 * unknown/foreign, throws ApiError('invalid', ...) naming the missing ids
 * and applies zero DB changes (no status row updated, no task_assignment
 * created). Duplicate ids within `ids` are tolerated (deduped up front) and
 * do not trigger the guard.
 *
 * DEC-079: for a firing row, planning runs BEFORE the row's UPDATE — if
 * planning throws, the row stays un-accepted so a retry re-fires (planning
 * is already idempotent on (contact, task-title) pairs), preserving
 * exactly-once semantics without D1 interactive transactions. Non-firing
 * rows are batched into one chunked UPDATE per batch (status + updatedAt
 * only — accepted_at is never touched, preserving it).
 */
export async function updateSubmissionStatuses(
  db: Db,
  eventId: string,
  ids: string[],
  status: SubmissionStatus,
  now: Date,
): Promise<UpdateStatusesResult> {
  if (ids.length === 0) return { updated: 0 };

  const rows: { id: string; status: string; acceptedAt: Date | null }[] = [];
  for (const idChunk of chunkIds(ids)) {
    const chunkRows = await db
      .select({
        id: schema.submission.id,
        status: schema.submission.status,
        acceptedAt: schema.submission.acceptedAt,
      })
      .from(schema.submission)
      .where(and(eq(schema.submission.eventId, eventId), inArray(schema.submission.id, idChunk)));
    rows.push(...chunkRows);
  }

  const requested = [...new Set(ids)];
  const foundIdSet = new Set(rows.map((r) => r.id));
  const missing = requested.filter((id) => !foundIdSet.has(id));
  if (missing.length > 0) {
    throw new ApiError("invalid", "One or more submission ids do not belong to this event", {
      ids: `unknown ids: ${missing.join(", ")}`,
    });
  }

  const nonFiringIds: string[] = [];
  const firingIds: string[] = [];

  for (const row of rows) {
    const currentStatus = isValidStatusLiteral(row.status) ? row.status : "pending";
    const result = changeStatus(
      { status: currentStatus, acceptedAt: row.acceptedAt ? row.acceptedAt.getTime() : null },
      status,
      now.getTime(),
    );

    if (result.fireAcceptance) {
      // changeStatus sets acceptedAt = now for every fireAcceptance row
      // (enteringAcceptedFirstTime branch), so the whole batch shares one
      // acceptedAt value — no per-row bookkeeping needed.
      firingIds.push(row.id);
    } else {
      nonFiringIds.push(row.id);
    }
  }

  if (firingIds.length > 0) {
    // DEC-355 set-based planning: ONE chunked participant SELECT for all
    // firing submissions, dedup contacts in memory, then plan/persist once
    // (planAndPersistOnboardingTasks) — proportional to ids/90 + distinct
    // titles, not to per-submission loops. DEC-079 ordering is preserved:
    // this all runs BEFORE any firing row's UPDATE, so a throw here leaves
    // every firing row un-accepted and a retry re-plans idempotently.
    const participantRows: { contactId: string; inviteStatus: string }[] = [];
    for (const idChunk of chunkIds(firingIds)) {
      const chunkRows = await db
        .select({ contactId: schema.participant.contactId, inviteStatus: schema.participant.inviteStatus })
        .from(schema.participant)
        .where(inArray(schema.participant.submissionId, idChunk));
      participantRows.push(...chunkRows);
    }
    const participantContactIds = [
      ...new Set(participantRows.filter((p) => isActiveParticipant(p.inviteStatus)).map((p) => p.contactId)),
    ];
    await planAndPersistOnboardingTasks(db, eventId, participantContactIds, now);

    for (const idChunk of chunkIds(firingIds)) {
      if (idChunk.length === 0) continue;
      await db
        .update(schema.submission)
        .set({ status, acceptedAt: now, updatedAt: now })
        .where(and(eq(schema.submission.eventId, eventId), inArray(schema.submission.id, idChunk)));
    }
  }

  for (const idChunk of chunkIds(nonFiringIds)) {
    if (idChunk.length === 0) continue;
    await db
      .update(schema.submission)
      .set({ status, updatedAt: now })
      .where(and(eq(schema.submission.eventId, eventId), inArray(schema.submission.id, idChunk)));
  }

  return { updated: rows.length };
}

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
import {
  planAcceptance,
  FORM_TASK_FIELD_SPECS,
  type FormTaskFieldSpec,
  isActiveParticipant,
  onboardingTaskDueDate,
} from "../../../domain/acceptance";
import { isValidStatusLiteral } from "./query";
import { chunkIds, chunkRowsForInsert } from "../../../lib/chunk";
import { ApiError } from "../../http";
import { MAX_TASK_ASSIGNMENT_WRITES, maxUnitsForTaskAssignmentWrites } from "../tasks/crud";
import { DEC_079, DEC_111, DEC_133, DEC_520, DEC_521, DEC_556, DEC_932 } from "../../../decisions";

void DEC_079; // planning-before-commit acceptance ordering + chunked/batched bulk status changes below
void DEC_111; // form-task tasks get real backing forms, self-healed when formId is null
void DEC_133; // full-set id match guard below (mirrors DEC-122's requireFullMatch)
void DEC_520; // auto-created onboarding tasks get a due date derived from the event start date
void DEC_521; // task_assignment inserts are chunked, bounded by MAX_ACCEPTANCE_TASK_ASSIGNMENTS
void DEC_556; // task_assignment insert below targets the real (task_id, contact_id) unique index
void DEC_932; // back-fill pass below: every participantContactIds member gets EVERY event task

/** DEC-078/DEC-528 amendment (wave 10): PAIR_ID_CHUNK_SIZE backs the one query
 * in this file that binds two unbounded-in-principle id lists (taskId,
 * contactId) in the same statement — half of ID_CHUNK_SIZE's 90-per-list
 * budget (45 + 45 = 90) leaves the same headroom under MAX_D1_BOUND_PARAMS
 * that ID_CHUNK_SIZE leaves for a single-list inArray. */
export const PAIR_ID_CHUNK_SIZE = 45;

function chunkBySize<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/** DEC-521: a planned set of task_assignment rows above this size is refused
 * BEFORE any insert — unlike MAX_AUTO_SCHEDULE_PLACEMENTS' silent slice, a
 * dropped onboarding assignment would be invisible to its producer. */
export const MAX_ACCEPTANCE_TASK_ASSIGNMENTS = 20000;

// Wave-39 (DEC-020 amendment): FORM_TASK_FIELD_SPECS (src/domain/acceptance.ts)
// is a plain object literal — `FORM_TASK_FIELD_SPECS[title]` for a task
// titled `constructor`/`toString` returns a function, so the `?? []`
// fallback never fires and .entries() below throws mid acceptance-write.
// Own-property lookup only, matching src/domain/files.ts's
// allowedContentType shape.
// Exported (test-only consumer: test/lookup-table-own-property.test.ts)
// so the own-property fix can be asserted directly without standing up a
// full db-backed getOrCreateFormTaskForm harness.
export function lookupFormTaskFieldSpecs(title: string): readonly FormTaskFieldSpec[] {
  return Object.prototype.hasOwnProperty.call(FORM_TASK_FIELD_SPECS, title)
    ? FORM_TASK_FIELD_SPECS[title]!
    : [];
}

/**
 * DEC-111: for a kind='form' template title present in FORM_TASK_FIELD_SPECS,
 * finds-or-creates an event-scoped schema.form titled exactly the task
 * title (isDefault:false, null open/close so it can never leak into public
 * CFP submit via getDefaultForm), inserting its fields on first creation.
 * Idempotent — a pre-existing form with that title is reused as-is.
 *
 * DEC-111 amendment (wave 55): form_event_id_title_idx (migrations/0033_
 * form_title_unique.sql) is a real UNIQUE(event_id, title) DB constraint —
 * this insert-on-conflict-do-nothing-then-select is the same find-or-create
 * shape getOrCreateTask (below) uses, so two concurrent acceptances racing
 * to mint the same template's backing form resolve to exactly one row
 * instead of two (which previously orphaned the loser's form_field rows).
 * Fields are only inserted when THIS call's own insert actually created the
 * row — a losing racer must not insert a second set of field rows onto the
 * winner's form.
 */
async function getOrCreateFormTaskForm(db: Db, eventId: string, title: string, now: Date): Promise<string> {
  const formId = newId();
  await db
    .insert(schema.form)
    .values({
      id: formId,
      eventId,
      title,
      isDefault: false,
      openDate: null,
      closeDate: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: [schema.form.eventId, schema.form.title] });

  // DEC-558 (wave 75): form_event_id_title_idx is a uniqueIndex on
  // (schema.form.eventId, schema.form.title), so this predicate already
  // narrows to at most one row.
  const winner = await db
    .select({ id: schema.form.id })
    .from(schema.form)
    .where(and(eq(schema.form.eventId, eventId), eq(schema.form.title, title)))
    .limit(1);
  const row = winner[0];
  if (!row) throw new Error(`getOrCreateFormTaskForm: no row for (eventId="${eventId}", title="${title}") after insert`);

  // The insert above used `formId` as its candidate id — if the winning row
  // carries that exact id, THIS call's own insert is the one that landed
  // (no concurrent racer beat it to the unique (eventId, title) slot), so
  // this call also owns seeding its field rows. If some other id won, a
  // racer already created the form (and, per this same invariant, already
  // seeded its fields), so this call must not insert a duplicate set.
  const createdHere = row.id === formId;
  if (createdHere) {
    const specs = lookupFormTaskFieldSpecs(title);
    for (const [i, spec] of specs.entries()) {
      await db.insert(schema.formField).values({
        id: newId(),
        formId: row.id,
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
  }
  return row.id;
}

/**
 * DEC-111 amendment (wave 48): task_event_id_title_idx (migrations/0032_
 * task_title_unique.sql) is a real UNIQUE(event_id, title) DB constraint —
 * this insert-on-conflict-do-nothing-then-select is the same find-or-create
 * shape upsertSegmentByName's precedent (migrations/0031, DEC-809) uses, so
 * two concurrent acceptances racing to mint the same template title resolve
 * to exactly one row instead of two.
 */
async function getOrCreateTask(
  db: Db,
  eventId: string,
  template: { title: string; kind: "general" | "file_request" | "form"; required: boolean },
  now: Date,
  dueDate: number,
): Promise<string> {
  const id = newId();
  const formId = template.kind === "form" ? await getOrCreateFormTaskForm(db, eventId, template.title, now) : null;
  await db
    .insert(schema.task)
    .values({
      id,
      eventId,
      kind: template.kind,
      title: template.title,
      required: template.required,
      formId,
      dueDate: new Date(dueDate),
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: [schema.task.eventId, schema.task.title] });

  // DEC-558 (wave 75): task_event_id_title_idx is a uniqueIndex on
  // (schema.task.eventId, schema.task.title), so this predicate already
  // narrows to at most one row.
  const winner = await db
    .select({ id: schema.task.id, formId: schema.task.formId })
    .from(schema.task)
    .where(and(eq(schema.task.eventId, eventId), eq(schema.task.title, template.title)))
    .limit(1);
  const row = winner[0];
  if (!row) throw new Error(`getOrCreateTask: no row for (eventId="${eventId}", title="${template.title}") after insert`);

  // DEC-111 self-heal: an already-existing 'form' task with a null formId
  // (created before this backing-form logic existed, or the loser of the
  // conflict above whose own form we just created but didn't attach) gets
  // one now. DEC-520: due dates are NOT self-healed here — an organizer who
  // cleared a due date via PATCH meant it; this branch never back-fills.
  if (template.kind === "form" && !row.formId) {
    const healedFormId = formId ?? (await getOrCreateFormTaskForm(db, eventId, template.title, now));
    await db.update(schema.task).set({ formId: healedFormId, updatedAt: now }).where(eq(schema.task.id, row.id));
    return row.id;
  }
  return row.id;
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

  // DEC-932: activation BACK-FILLS, it never snapshots. planAcceptance above
  // only plans DEFAULT_ONBOARDING_TASKS titles — a CUSTOM task the organizer
  // created (or created after a contact was already active) is never in that
  // plan, so every contact in participantContactIds must also hold an
  // assignment for EVERY row of schema.task with this eventId, not just the
  // planned default titles. Set-based: ONE select of the event's task ids,
  // ONE chunked select (by contact, DEC-078) of existing (taskId, contactId)
  // pairs restricted to those task ids and exactly these contacts, ONE
  // chunked insert (DEC-528) of the missing pairs. Never UPDATE/DELETE an
  // existing row — a completed assignment stays complete.
  const eventTaskRows = await db.select({ id: schema.task.id }).from(schema.task).where(eq(schema.task.eventId, eventId));
  const eventTaskIds = eventTaskRows.map((r) => r.id);
  if (eventTaskIds.length === 0) return;

  // DEC-078/DEC-528 amendment (wave 10, defect 1): this query binds TWO
  // unbounded-in-principle id lists in the same statement — eventTaskIds
  // (every task row for this event, no cap) alongside contactChunk. Chunking
  // only contactChunk at ID_CHUNK_SIZE (90) left eventTaskIds unchunked, so
  // an event with >=11 tasks (11 * 90 = 990... actually any eventTaskIds
  // length that pushes taskIds.length + contactChunk.length over
  // MAX_D1_BOUND_PARAMS) blew the D1 bind budget. Both dimensions are now
  // chunked at half the budget each (PAIR_ID_CHUNK_SIZE), nested, so no
  // emitted statement can bind more than 2 * PAIR_ID_CHUNK_SIZE params
  // regardless of how many tasks or contacts are involved — still set-based
  // (no query per row, no query per contact).
  const existingPairs = new Set<string>();
  for (const contactChunk of chunkBySize(participantContactIds, PAIR_ID_CHUNK_SIZE)) {
    for (const taskChunk of chunkBySize(eventTaskIds, PAIR_ID_CHUNK_SIZE)) {
      const existingRows = await db
        .select({ taskId: schema.taskAssignment.taskId, contactId: schema.taskAssignment.contactId })
        .from(schema.taskAssignment)
        .where(
          and(inArray(schema.taskAssignment.taskId, taskChunk), inArray(schema.taskAssignment.contactId, contactChunk)),
        );
      for (const r of existingRows) {
        existingPairs.add(`${r.taskId}|${r.contactId}`);
      }
    }
  }

  const missingRows: {
    id: string;
    taskId: string;
    contactId: string;
    status: "pending";
    createdAt: Date;
    updatedAt: Date;
  }[] = [];
  for (const taskId of eventTaskIds) {
    for (const contactId of participantContactIds) {
      if (existingPairs.has(`${taskId}|${contactId}`)) continue;
      missingRows.push({ id: newId(), taskId, contactId, status: "pending", createdAt: now, updatedAt: now });
    }
  }

  if (missingRows.length > MAX_TASK_ASSIGNMENT_WRITES) {
    // DEC-528 amendment (wave 10, defect 2): DEC-079 already keeps this
    // refusal pre-write (planning runs before any submission row's UPDATE,
    // so a throw here leaves every firing row un-accepted — a retry after
    // shrinking the batch re-plans idempotently). What was missing was a
    // forward path: the message must name a batch size the producer can
    // actually use, derived from the same cap this check enforces, never a
    // bare internal number. eventTaskIds.length is this event's per-contact
    // row count (one assignment per event task), so
    // maxUnitsForTaskAssignmentWrites divided by it is the largest number of
    // accepting submissions (one contact each, the common case) this event
    // can take in one batch.
    const maxSubmissionsPerBatch = maxUnitsForTaskAssignmentWrites(eventTaskIds.length);
    throw new ApiError(
      "invalid",
      `Accepting this batch would create ${missingRows.length} task assignments, over the cap of ${MAX_TASK_ASSIGNMENT_WRITES} — for this event's ${eventTaskIds.length} tasks, accept at most ${maxSubmissionsPerBatch} submissions per batch`,
      {
        contactIds: `${missingRows.length} exceeds cap ${MAX_TASK_ASSIGNMENT_WRITES}; at most ${maxSubmissionsPerBatch} submissions per batch`,
      },
    );
  }

  for (const chunk of chunkRowsForInsert(missingRows)) {
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
 *
 * DEC-009 wave-26 amendment: `changeStatus` computes `fireAcceptance`
 * (re-plan onboarding) and `setsAcceptedAt` (stamp accepted_at)
 * INDEPENDENTLY — a row already `status:'accepted'` with `accepted_at IS
 * NULL` yields `fireAcceptance=false, setsAcceptedAt=true` (repair, no
 * re-plan), while a genuine re-accept yields `fireAcceptance=true,
 * setsAcceptedAt=false` (re-plan, no re-stamp). Each row is therefore
 * routed by two independent checks into up to two of three disjoint id
 * lists — planIds, stampIds, restIds — every requested id lands in
 * exactly one stamp/no-stamp UPDATE regardless of which lists it was
 * added to.
 *
 * DEC-079 wave-26 amendment: the planning call and the two chunked UPDATE
 * phases below are NOT one transaction — D1 has no interactive
 * transaction available here and `db.batch(` is not used anywhere in
 * src/. This is deliberate: safety rests on idempotence, not atomicity.
 * Planning is idempotent on (contact, task-title) pairs and the stamp
 * write only ever sets accepted_at from null, so a retry after a partial
 * failure converges to the same terminal state rather than double-firing
 * or double-stamping.
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

  const restIds: string[] = [];
  const planIds: string[] = [];
  const stampIds: string[] = [];

  for (const row of rows) {
    const currentStatus = isValidStatusLiteral(row.status) ? row.status : "pending";
    const result = changeStatus(
      { status: currentStatus, acceptedAt: row.acceptedAt ? row.acceptedAt.getTime() : null },
      status,
      now.getTime(),
    );

    // DEC-009 wave-26 amendment: fireAcceptance (re-plan onboarding) and
    // setsAcceptedAt (stamp accepted_at) are independent flags from
    // changeStatus — check each separately rather than nesting the stamp
    // check inside the plan check, or an already-accepted row with a null
    // accepted_at (setsAcceptedAt=true, fireAcceptance=false) never gets
    // repaired.
    let routed = false;
    if (result.fireAcceptance) {
      // DEC-278 wave-58 amendment: fireAcceptance fires on EVERY entry into
      // 'accepted', not just the first — a re-accept re-plans idempotently
      // so a co-speaker added while un-accepted still gets tasks.
      planIds.push(row.id);
      routed = true;
    }
    if (result.setsAcceptedAt) {
      // changeStatus was called with now.getTime(), so a row that stamps
      // always yields result.acceptedAt === now.getTime() — the stamp UPDATE
      // below writes `now` itself rather than reconstructing a Date from a
      // loop-carried scalar (which would be last-write-wins across the batch).
      stampIds.push(row.id);
      routed = true;
    }
    if (!routed) {
      restIds.push(row.id);
    }
  }

  if (planIds.length > 0) {
    // DEC-355 set-based planning: ONE chunked participant SELECT for all
    // firing submissions, dedup contacts in memory, then plan/persist once
    // (planAndPersistOnboardingTasks) — proportional to ids/90 + distinct
    // titles, not to per-submission loops. DEC-079 ordering is preserved:
    // this all runs BEFORE any firing row's UPDATE, so a throw here leaves
    // every firing row un-accepted (or, for a re-accept, un-re-accepted) and
    // a retry re-plans idempotently.
    const participantRows: { contactId: string; inviteStatus: string }[] = [];
    for (const idChunk of chunkIds(planIds)) {
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
  }

  for (const idChunk of chunkIds(stampIds)) {
    if (idChunk.length === 0) continue;
    await db
      .update(schema.submission)
      .set({ status, acceptedAt: now, updatedAt: now })
      .where(and(eq(schema.submission.eventId, eventId), inArray(schema.submission.id, idChunk)));
  }

  // Every other id — including re-accepts (planIds not in stampIds) and
  // accepted_at-only repairs (stampIds not in planIds) — never touches
  // accepted_at via this UPDATE, preserving the original stamp (DEC-278
  // amendment) or the value just written above.
  const stampIdSet = new Set(stampIds);
  const nonStampIds = [...new Set([...planIds, ...restIds])].filter((id) => !stampIdSet.has(id));
  for (const idChunk of chunkIds(nonStampIds)) {
    if (idChunk.length === 0) continue;
    await db
      .update(schema.submission)
      .set({ status, updatedAt: now })
      .where(and(eq(schema.submission.eventId, eventId), inArray(schema.submission.id, idChunk)));
  }

  return { updated: rows.length };
}

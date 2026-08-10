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
import { planAcceptance } from "../../../domain/acceptance";
import { isValidStatusLiteral } from "./query";
import { chunkIds } from "../../../lib/chunk";
import { DEC_079 } from "../../../decisions";

void DEC_079; // planning-before-commit acceptance ordering + chunked/batched bulk status changes below

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

  const nonFiringIds: string[] = [];

  for (const row of rows) {
    const currentStatus = isValidStatusLiteral(row.status) ? row.status : "pending";
    const result = changeStatus(
      { status: currentStatus, acceptedAt: row.acceptedAt ? row.acceptedAt.getTime() : null },
      status,
      now.getTime(),
    );

    if (result.fireAcceptance) {
      // Planning first (DEC-079): a throw here leaves the row un-accepted
      // so retry re-fires; planning is idempotent so a partial prior run
      // is safe to re-execute.
      await runAcceptancePlanning(db, eventId, row.id, now);
      await db
        .update(schema.submission)
        .set({
          status: result.status,
          acceptedAt: result.acceptedAt !== null ? new Date(result.acceptedAt) : null,
          updatedAt: now,
        })
        .where(eq(schema.submission.id, row.id));
    } else {
      nonFiringIds.push(row.id);
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

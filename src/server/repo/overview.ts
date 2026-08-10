// Overview worklist repo (DEC-030). Builds the single GET
// .../events/:eventId/overview payload with joined/grouped queries; repo
// functions are the only code here that touch drizzle row types (DEC-012).
// The aggregation logic below is split into pure helpers (given row arrays)
// so it is unit-testable without a database — see test/overview.test.ts.

import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { findConflicts, type PlacedSession } from "../../domain/schedule";

export interface OverviewPayload {
  triage: { pending: number; accept_queue: number; decline_queue: number };
  review: { plans: number; evaluationsSubmitted: number };
  speakers: { contactsOwing: number; overdueAssignments: number };
  content: { awaitingApproval: number };
  agenda: { unplaced: number; conflicts: number };
  comms: { sentLast7Days: number; lastSentAt: number | null };
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Pure aggregation helpers (no I/O) — unit-tested directly against row
// arrays.
// ---------------------------------------------------------------------------

/** Reduces a grouped `status -> count` query result into the three DEC-030
 * triage buckets. Unknown/other statuses (e.g. accepted, declined) are
 * dropped — the triage card only tracks statuses still awaiting a decision.
 */
export function aggregateTriageCounts(
  rows: { status: string; n: number }[],
): OverviewPayload["triage"] {
  const byStatus = new Map(rows.map((r) => [r.status, r.n]));
  return {
    pending: byStatus.get("pending") ?? 0,
    accept_queue: byStatus.get("accept_queue") ?? 0,
    decline_queue: byStatus.get("decline_queue") ?? 0,
  };
}

/** Speaker contacts with at least one pending task_assignment in the event,
 * deduped by contactId, plus a count of pending assignments overdue
 * (due_date < now). */
export function aggregateSpeakerCounts(
  pendingAssignments: { contactId: string; dueDate: number | null }[],
  now: number,
): OverviewPayload["speakers"] {
  const contactsOwing = new Set(pendingAssignments.map((a) => a.contactId)).size;
  const overdueAssignments = pendingAssignments.filter(
    (a) => a.dueDate !== null && a.dueDate < now,
  ).length;
  return { contactsOwing, overdueAssignments };
}

/** Agenda numbers: unplaced accepted submissions + schedule conflicts
 * (delegated to src/domain/schedule.ts findConflicts, DEC-010). */
export function computeAgendaSummary(
  acceptedSubmissionIds: string[],
  placed: PlacedSession[],
): OverviewPayload["agenda"] {
  const placedIds = new Set(placed.map((p) => p.submissionId));
  return {
    unplaced: acceptedSubmissionIds.filter((id) => !placedIds.has(id)).length,
    conflicts: findConflicts(placed).length,
  };
}

/** Comms numbers: sends in the trailing 7 days + the most recent send. */
export function aggregateCommsCounts(
  sentTimestamps: number[],
  now: number,
): OverviewPayload["comms"] {
  const cutoff = now - SEVEN_DAYS_MS;
  const sentLast7Days = sentTimestamps.filter((t) => t >= cutoff).length;
  const lastSentAt = sentTimestamps.length > 0 ? Math.max(...sentTimestamps) : null;
  return { sentLast7Days, lastSentAt };
}

// ---------------------------------------------------------------------------
// I/O: builds the full payload from joined/grouped queries.
// ---------------------------------------------------------------------------

export async function getOverviewPayload(db: Db, eventId: string, now: number): Promise<OverviewPayload> {
  // --- Triage: one grouped submission-status query.
  const statusRows = await db
    .select({ status: schema.submission.status, n: sql<number>`count(*)` })
    .from(schema.submission)
    .where(eq(schema.submission.eventId, eventId))
    .groupBy(schema.submission.status);
  const triage = aggregateTriageCounts(statusRows.map((r) => ({ status: r.status, n: Number(r.n) })));

  // --- Review: plans on the event + submitted evaluations under them.
  const planCountRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.evaluationPlan)
    .where(eq(schema.evaluationPlan.eventId, eventId));
  const plans = Number(planCountRows[0]?.count ?? 0);

  const evaluationsSubmittedRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.evaluation)
    .innerJoin(schema.evaluationPlan, eq(schema.evaluation.planId, schema.evaluationPlan.id))
    .where(
      and(
        eq(schema.evaluationPlan.eventId, eventId),
        sql`${schema.evaluation.submittedAt} IS NOT NULL`,
      ),
    );
  const evaluationsSubmitted = Number(evaluationsSubmittedRows[0]?.count ?? 0);

  // --- Speakers: pending task_assignment rows joined to task for event
  // scoping + due_date.
  const pendingAssignmentRows = await db
    .select({
      contactId: schema.taskAssignment.contactId,
      dueDate: schema.task.dueDate,
    })
    .from(schema.taskAssignment)
    .innerJoin(schema.task, eq(schema.taskAssignment.taskId, schema.task.id))
    .where(and(eq(schema.task.eventId, eventId), eq(schema.taskAssignment.status, "pending")));
  const speakers = aggregateSpeakerCounts(
    pendingAssignmentRows.map((r) => ({
      contactId: r.contactId,
      dueDate: r.dueDate ? r.dueDate.getTime() : null,
    })),
    now,
  );

  // --- Content: accepted submissions still awaiting content approval.
  const contentRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.submission)
    .where(
      and(
        eq(schema.submission.eventId, eventId),
        eq(schema.submission.status, "accepted"),
        eq(schema.submission.contentStatus, "pending"),
      ),
    );
  const content = { awaitingApproval: Number(contentRows[0]?.count ?? 0) };

  // --- Agenda: accepted submissions + their schedule_slot rows (left join
  // via a separate slot query to avoid an outer-join row explosion when
  // combined with the speaker fan-out below).
  const acceptedRows = await db
    .select({ id: schema.submission.id })
    .from(schema.submission)
    .where(and(eq(schema.submission.eventId, eventId), eq(schema.submission.status, "accepted")));
  const acceptedIds = acceptedRows.map((r) => r.id);

  let placed: PlacedSession[] = [];
  if (acceptedIds.length > 0) {
    const slotRows = await db
      .select({
        submissionId: schema.scheduleSlot.submissionId,
        roomId: schema.scheduleSlot.roomId,
        day: schema.scheduleSlot.day,
        startMin: schema.scheduleSlot.startMin,
        endMin: schema.scheduleSlot.endMin,
      })
      .from(schema.scheduleSlot)
      .innerJoin(schema.submission, eq(schema.scheduleSlot.submissionId, schema.submission.id))
      .where(and(eq(schema.submission.eventId, eventId), eq(schema.submission.status, "accepted")));

    const placedIds = slotRows.map((s) => s.submissionId);
    const participantRows =
      placedIds.length > 0
        ? await db
            .select({
              submissionId: schema.participant.submissionId,
              contactId: schema.participant.contactId,
            })
            .from(schema.participant)
            .where(inArray(schema.participant.submissionId, placedIds))
        : [];
    const speakersBySubmission = new Map<string, string[]>();
    for (const p of participantRows) {
      const arr = speakersBySubmission.get(p.submissionId) ?? [];
      arr.push(p.contactId);
      speakersBySubmission.set(p.submissionId, arr);
    }

    placed = slotRows.map((s) => ({
      submissionId: s.submissionId,
      roomId: s.roomId,
      day: s.day,
      startMin: s.startMin,
      endMin: s.endMin,
      speakerContactIds: speakersBySubmission.get(s.submissionId) ?? [],
    }));
  }
  const agenda = computeAgendaSummary(acceptedIds, placed);

  // --- Comms: email_log sends for the event.
  const emailRows = await db
    .select({ sentAt: schema.emailLog.sentAt })
    .from(schema.emailLog)
    .where(eq(schema.emailLog.eventId, eventId));
  const comms = aggregateCommsCounts(
    emailRows.map((r) => r.sentAt.getTime()),
    now,
  );

  return { triage, review: { plans, evaluationsSubmitted }, speakers, content, agenda, comms };
}

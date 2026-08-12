// Overview worklist repo (DEC-030, DEC-370). Builds the single GET
// .../events/:eventId/overview payload with joined/grouped queries; repo
// functions are the only code here that touch drizzle row types (DEC-012).
// The aggregation logic below is split into pure helpers (given row arrays)
// so it is unit-testable without a database — see test/overview.test.ts.
//
// DEC-370 (payload v2): every v1 aggregate key (triage/review/speakers/
// content/agenda/comms) is retained byte-for-byte on the returned object so
// the nav badge (DEC-369) and app/src/pages/overview/cards.ts keep reading
// `payload.triage.pending` etc. unchanged. DEC-370's prose names the new
// "submissions awaiting triage" rows section `triage` too, which collides
// with the retained v1 counts key of the same name — that collision isn't
// resolvable without renaming one of them, and the v1 key is the one pinned
// by name in this task's brief ("RETAINING every existing key ... byte for
// byte"), so the new rows section is exposed here as `triageQueue` instead.
// Flagged for the client lane (task w1-d) and the scribe.

import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { findConflicts, type Conflict, type PlacedSession } from "../../domain/schedule";
import { formatRef } from "../../domain/ids";
import { chunkIds } from "../../lib/chunk";
import { DEC_370 } from "../../decisions";
void DEC_370;

const DAY_MS = 24 * 60 * 60 * 1000;
const ROW_CAP = 5;

export interface OverviewPayload {
  triage: { pending: number; accept_queue: number; decline_queue: number };
  review: { plans: number; evaluationsSubmitted: number };
  speakers: { contactsOwing: number; overdueAssignments: number };
  content: { awaitingApproval: number };
  agenda: { unplaced: number; conflicts: number };
  comms: { sentLast7Days: number; lastSentAt: number | null };
}

export interface OverviewDeadlines {
  formCloseDate: number | null;
  nextTaskDueDate: number | null;
  planCloseDate: number | null;
  eventStartDate: number | null;
}

export interface OverdueTaskRow {
  assignmentId: string;
  contactId: string;
  contactName: string;
  company: string | null;
  taskId: string;
  taskTitle: string;
  dueDate: number;
  daysLate: number;
}

export interface TriageQueueRow {
  submissionId: string;
  ref: string;
  title: string;
  speakerName: string;
  trackName: string | null;
  // No schema field backs a per-submission "format" (Talk/Workshop/...);
  // DEC-370 names the key but nothing stores the value (SPEC.md's only
  // mention of "format" is a hypothetical CFP form field, not a fixed
  // column). Always null — flagged as an open gap, never fabricated.
  format: string | null;
  submittedAt: number;
}

export interface ContentApprovalRow {
  submissionId: string;
  ref: string;
  title: string;
  speakerName: string;
  fileName: string;
  uploadedAt: number;
  reuploaded: boolean;
}

export interface ConflictRow {
  day: string;
  startMin: number;
  endMin: number;
  roomName: string | null;
  kind: Conflict["kind"];
  entries: { submissionId: string; ref: string; title: string; speakerName: string }[];
}

export interface UnplacedRow {
  submissionId: string;
  ref: string;
  title: string;
  speakerName: string;
  // No stored per-submission session length (autoSchedule takes an
  // organizer-supplied defaultDurationMin at call time, never persisted) —
  // always null, flagged as an open gap rather than fabricated.
  durationMin: number | null;
}

export interface OverviewPayloadV2 extends OverviewPayload {
  deadlines: OverviewDeadlines;
  overdueTasks: { total: number; rows: OverdueTaskRow[] };
  triageQueue: { total: number; oldestSubmittedAt: number | null; rows: TriageQueueRow[] };
  contentApproval: { total: number; reuploadedCount: number; rows: ContentApprovalRow[] };
  agendaWork: {
    unplacedTotal: number;
    conflictTotal: number;
    conflicts: ConflictRow[];
    unplaced: UnplacedRow[];
  };
}

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

/** Smallest non-null/non-undefined value, or null if every value is
 * missing — used across the DEC-370 deadlines strip (each cell tolerates a
 * null source independently). */
export function minNonNull(values: (number | null | undefined)[]): number | null {
  let min: number | null = null;
  for (const v of values) {
    if (v === null || v === undefined) continue;
    if (min === null || v < min) min = v;
  }
  return min;
}

/** DEC-370 overdueTasks rows: attaches `daysLate` (whole days late, clamped
 * to zero) to each already-overdue assignment row. */
export function buildOverdueTaskRows(
  rows: Omit<OverdueTaskRow, "daysLate">[],
  now: number,
): OverdueTaskRow[] {
  return rows.map((r) => ({
    ...r,
    daysLate: Math.max(0, Math.floor((now - r.dueDate) / DAY_MS)),
  }));
}

export interface ConflictSessionInfo {
  day: string;
  startMin: number;
  endMin: number;
  roomId: string | null;
  ref: string;
  title: string;
  speakerName: string;
}

/** DEC-370 agendaWork.conflicts rows: one row per findConflicts() pair
 * (never re-derives conflicts itself), capped to ROW_CAP, resolved against
 * a pre-loaded session/room lookup — never queries inside the loop. */
export function buildConflictRows(
  conflicts: Conflict[],
  sessionById: Map<string, ConflictSessionInfo>,
  roomNameById: Map<string, string>,
  cap = ROW_CAP,
): ConflictRow[] {
  const rows: ConflictRow[] = [];
  for (const c of conflicts.slice(0, cap)) {
    const [aId, bId] = c.submissionIds;
    const a = sessionById.get(aId);
    const b = sessionById.get(bId);
    if (!a || !b) {
      throw new Error(`buildConflictRows: session ${aId}/${bId} not in the loaded set`);
    }
    rows.push({
      day: a.day,
      startMin: a.startMin,
      endMin: a.endMin,
      roomName: a.roomId ? (roomNameById.get(a.roomId) ?? null) : null,
      kind: c.kind,
      entries: [
        { submissionId: aId, ref: a.ref, title: a.title, speakerName: a.speakerName },
        { submissionId: bId, ref: b.ref, title: b.title, speakerName: b.speakerName },
      ],
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// I/O: builds the full payload from joined/grouped queries.
// ---------------------------------------------------------------------------

export async function getOverviewPayload(db: Db, eventId: string, now: number): Promise<OverviewPayloadV2> {
  // --- Event: record ref prefix + start date (DEC-370 deadlines strip).
  const eventRows = await db
    .select({ recordPrefix: schema.event.recordPrefix, startDate: schema.event.startDate })
    .from(schema.event)
    .where(eq(schema.event.id, eventId))
    .limit(1);
  const recordPrefix = eventRows[0]?.recordPrefix ?? "SES";
  const eventStartDate = eventRows[0]?.startDate ? new Date(`${eventRows[0].startDate}T00:00:00Z`).getTime() : null;

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

  // --- Evaluation plan close date: soonest non-null across the event's
  // plans (DEC-370 deadlines strip).
  const planCloseRows = await db
    .select({ closeDate: sql<number | null>`min(${schema.evaluationPlan.closeDate})` })
    .from(schema.evaluationPlan)
    .where(eq(schema.evaluationPlan.eventId, eventId));
  const planCloseDate = planCloseRows[0]?.closeDate == null ? null : Number(planCloseRows[0].closeDate);

  // --- Form close date: the default CFP form's close date (the only form
  // submit.ts and the public CFP treat as "the" form for the event).
  const formRows = await db
    .select({ closeDate: schema.form.closeDate })
    .from(schema.form)
    .where(and(eq(schema.form.eventId, eventId), eq(schema.form.isDefault, true)))
    .limit(1);
  const formCloseDate = formRows[0]?.closeDate ? formRows[0].closeDate.getTime() : null;

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
  const pendingAssignmentsForAgg = pendingAssignmentRows.map((r) => ({
    contactId: r.contactId,
    dueDate: r.dueDate ? r.dueDate.getTime() : null,
  }));
  const speakers = aggregateSpeakerCounts(pendingAssignmentsForAgg, now);
  const nextTaskDueDate = minNonNull(pendingAssignmentsForAgg.map((a) => a.dueDate));

  // --- Overdue task rows (DEC-370 section 01): capped detail rows for the
  // same pending+overdue set aggregateSpeakerCounts already counted above
  // (overdueTasks.total reuses speakers.overdueAssignments — no second
  // count query).
  const overdueDetailRows = await db
    .select({
      assignmentId: schema.taskAssignment.id,
      contactId: schema.taskAssignment.contactId,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      company: schema.contact.company,
      taskId: schema.task.id,
      taskTitle: schema.task.title,
      dueDate: schema.task.dueDate,
    })
    .from(schema.taskAssignment)
    .innerJoin(schema.task, eq(schema.taskAssignment.taskId, schema.task.id))
    .innerJoin(schema.contact, eq(schema.contact.id, schema.taskAssignment.contactId))
    .where(
      and(
        eq(schema.task.eventId, eventId),
        eq(schema.taskAssignment.status, "pending"),
        sql`${schema.task.dueDate} is not null and ${schema.task.dueDate} < ${now}`,
      ),
    )
    .orderBy(schema.task.dueDate)
    .limit(ROW_CAP);
  const overdueTasks = {
    total: speakers.overdueAssignments,
    rows: buildOverdueTaskRows(
      overdueDetailRows.map((r) => ({
        assignmentId: r.assignmentId,
        contactId: r.contactId,
        contactName: `${r.firstName} ${r.lastName}`.trim(),
        company: r.company,
        taskId: r.taskId,
        taskTitle: r.taskTitle,
        dueDate: r.dueDate!.getTime(),
      })),
      now,
    ),
  };

  // --- Triage queue rows (DEC-370 section 02): oldest-first, capped;
  // oldestSubmittedAt is the first row's createdAt (ordering is ascending
  // over the whole pending set, so the first of up to ROW_CAP rows is the
  // global oldest — no separate min() query needed).
  const triageDetailRows = await db
    .select({
      id: schema.submission.id,
      seq: schema.submission.seq,
      title: schema.submission.title,
      trackId: schema.submission.trackId,
      createdAt: schema.submission.createdAt,
    })
    .from(schema.submission)
    .where(and(eq(schema.submission.eventId, eventId), eq(schema.submission.status, "pending")))
    .orderBy(schema.submission.createdAt)
    .limit(ROW_CAP);
  const oldestSubmittedAt = triageDetailRows[0] ? triageDetailRows[0].createdAt.getTime() : null;

  const triageTrackIds = [...new Set(triageDetailRows.map((r) => r.trackId).filter((id): id is string => !!id))];
  const trackNameById = new Map<string, string>();
  if (triageTrackIds.length > 0) {
    const trackRows = await db
      .select({ id: schema.track.id, name: schema.track.name })
      .from(schema.track)
      .where(inArray(schema.track.id, triageTrackIds));
    for (const t of trackRows) trackNameById.set(t.id, t.name);
  }

  // --- Content approval (DEC-370 section 03): accepted + content_status
  // pending. One conditional-aggregate query gives both the total (also
  // v1's content.awaitingApproval) and reuploadedCount (a correlated-EXISTS
  // count over the same set) — never a per-row query.
  const contentAggRows = await db
    .select({
      total: sql<number>`count(*)`,
      reuploaded: sql<number>`count(case when exists (
          select 1 from ${schema.file} f
          where f.submission_id = ${schema.submission.id}
            and f.previous_file_id is not null
            and f.created_at = (select max(f2.created_at) from ${schema.file} f2 where f2.submission_id = ${schema.submission.id})
        ) then 1 end)`,
    })
    .from(schema.submission)
    .where(
      and(
        eq(schema.submission.eventId, eventId),
        eq(schema.submission.status, "accepted"),
        eq(schema.submission.contentStatus, "pending"),
      ),
    );
  const content = { awaitingApproval: Number(contentAggRows[0]?.total ?? 0) };
  const reuploadedCount = Number(contentAggRows[0]?.reuploaded ?? 0);

  const contentDetailRows = await db
    .select({
      id: schema.submission.id,
      seq: schema.submission.seq,
      title: schema.submission.title,
      updatedAt: schema.submission.updatedAt,
    })
    .from(schema.submission)
    .where(
      and(
        eq(schema.submission.eventId, eventId),
        eq(schema.submission.status, "accepted"),
        eq(schema.submission.contentStatus, "pending"),
      ),
    )
    .orderBy(sql`${schema.submission.updatedAt} desc`)
    .limit(ROW_CAP);

  const contentSubmissionIds = contentDetailRows.map((r) => r.id);
  const latestFileBySubmission = new Map<string, { filename: string; uploadedAt: number; reuploaded: boolean }>();
  if (contentSubmissionIds.length > 0) {
    const fileRows = await db
      .select({
        submissionId: schema.file.submissionId,
        filename: schema.file.filename,
        previousFileId: schema.file.previousFileId,
        createdAt: schema.file.createdAt,
      })
      .from(schema.file)
      .where(inArray(schema.file.submissionId, contentSubmissionIds));
    for (const f of fileRows) {
      if (!f.submissionId) continue;
      const existing = latestFileBySubmission.get(f.submissionId);
      if (!existing || f.createdAt.getTime() > existing.uploadedAt) {
        latestFileBySubmission.set(f.submissionId, {
          filename: f.filename,
          uploadedAt: f.createdAt.getTime(),
          reuploaded: f.previousFileId !== null,
        });
      }
    }
  }

  // --- Agenda: accepted submissions + their schedule_slot rows (left join
  // via a separate slot query to avoid an outer-join row explosion when
  // combined with the speaker fan-out below).
  const acceptedRows = await db
    .select({ id: schema.submission.id, seq: schema.submission.seq, title: schema.submission.title })
    .from(schema.submission)
    .where(and(eq(schema.submission.eventId, eventId), eq(schema.submission.status, "accepted")));
  const acceptedIds = acceptedRows.map((r) => r.id);
  const acceptedById = new Map(acceptedRows.map((r) => [r.id, r]));

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

    const placedIds = [...new Set(slotRows.map((s) => s.submissionId))];
    const participantRows: { submissionId: string; contactId: string }[] = [];
    for (const batch of chunkIds(placedIds)) {
      const batchRows = await db
        .select({
          submissionId: schema.participant.submissionId,
          contactId: schema.participant.contactId,
        })
        .from(schema.participant)
        .where(inArray(schema.participant.submissionId, batch));
      participantRows.push(...batchRows);
    }
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
  const conflicts = findConflicts(placed);
  const placedById = new Map(placed.map((p) => [p.submissionId, p]));

  const placedIdSet = new Set(placed.map((p) => p.submissionId));
  const unplacedIds = acceptedIds.filter((id) => !placedIdSet.has(id));
  const unplacedCappedIds = unplacedIds.slice(0, ROW_CAP);

  // --- One combined lead-speaker lookup for every submission id any DEC-370
  // row section below needs a display name for (triage queue rows, content
  // approval rows, unplaced rows, conflict entries) — a single chunked
  // query set rather than one per section.
  const leadSpeakerIds = new Set<string>();
  for (const r of triageDetailRows) leadSpeakerIds.add(r.id);
  for (const r of contentDetailRows) leadSpeakerIds.add(r.id);
  for (const id of unplacedCappedIds) leadSpeakerIds.add(id);
  for (const c of conflicts.slice(0, ROW_CAP)) {
    leadSpeakerIds.add(c.submissionIds[0]);
    leadSpeakerIds.add(c.submissionIds[1]);
  }
  const leadSpeakerNameById = await fetchLeadSpeakerNames(db, [...leadSpeakerIds]);

  const triageQueue = {
    total: triage.pending,
    oldestSubmittedAt,
    rows: triageDetailRows.map((r) => ({
      submissionId: r.id,
      ref: formatRef(recordPrefix, r.seq),
      title: r.title,
      speakerName: leadSpeakerNameById.get(r.id) ?? "",
      trackName: r.trackId ? (trackNameById.get(r.trackId) ?? null) : null,
      format: null,
      submittedAt: r.createdAt.getTime(),
    })),
  };

  const contentApproval = {
    total: content.awaitingApproval,
    reuploadedCount,
    rows: contentDetailRows.map((r): ContentApprovalRow => {
      const latest = latestFileBySubmission.get(r.id);
      return {
        submissionId: r.id,
        ref: formatRef(recordPrefix, r.seq),
        title: r.title,
        speakerName: leadSpeakerNameById.get(r.id) ?? "",
        fileName: latest?.filename ?? "",
        uploadedAt: latest?.uploadedAt ?? r.updatedAt.getTime(),
        reuploaded: latest?.reuploaded ?? false,
      };
    }),
  };

  // --- Room names for the capped conflict rows' rooms only (bounded to at
  // most 2*ROW_CAP ids).
  const conflictRoomIds = [
    ...new Set(
      conflicts
        .slice(0, ROW_CAP)
        .flatMap((c) => c.submissionIds)
        .map((id) => placedById.get(id)?.roomId ?? null)
        .filter((id): id is string => id !== null),
    ),
  ];
  const roomNameById = new Map<string, string>();
  if (conflictRoomIds.length > 0) {
    const roomRows = await db
      .select({ id: schema.room.id, name: schema.room.name })
      .from(schema.room)
      .where(inArray(schema.room.id, conflictRoomIds));
    for (const r of roomRows) roomNameById.set(r.id, r.name);
  }

  const sessionById = new Map<string, ConflictSessionInfo>();
  for (const p of placed) {
    const submission = acceptedById.get(p.submissionId);
    if (!submission) continue;
    sessionById.set(p.submissionId, {
      day: p.day,
      startMin: p.startMin,
      endMin: p.endMin,
      roomId: p.roomId,
      ref: formatRef(recordPrefix, submission.seq),
      title: submission.title,
      speakerName: leadSpeakerNameById.get(p.submissionId) ?? "",
    });
  }

  const agendaWork = {
    unplacedTotal: agenda.unplaced,
    conflictTotal: agenda.conflicts,
    conflicts: buildConflictRows(conflicts, sessionById, roomNameById),
    unplaced: unplacedCappedIds.map((id): UnplacedRow => {
      const submission = acceptedById.get(id);
      if (!submission) throw new Error(`getOverviewPayload: unplaced submission ${id} not in the loaded accepted set`);
      return {
        submissionId: id,
        ref: formatRef(recordPrefix, submission.seq),
        title: submission.title,
        speakerName: leadSpeakerNameById.get(id) ?? "",
        durationMin: null,
      };
    }),
  };

  // --- Comms: one aggregate query, never the whole email_log table
  // (DEC-333/DEC-334: card numbers are SQL aggregates, not materialized
  // rows spread into Math.max).
  const SEVEN_DAYS_MS = 7 * DAY_MS;
  const cutoffMs = now - SEVEN_DAYS_MS;
  const commsRows = await db
    .select({
      sentLast7Days: sql<number>`count(case when ${schema.emailLog.sentAt} >= ${cutoffMs} then 1 end)`,
      lastSentAt: sql<number | null>`max(${schema.emailLog.sentAt})`,
    })
    .from(schema.emailLog)
    .where(eq(schema.emailLog.eventId, eventId));
  const comms = {
    sentLast7Days: Number(commsRows[0]?.sentLast7Days ?? 0),
    lastSentAt: commsRows[0]?.lastSentAt == null ? null : Number(commsRows[0].lastSentAt),
  };

  return {
    triage,
    review: { plans, evaluationsSubmitted },
    speakers,
    content,
    agenda,
    comms,
    deadlines: { formCloseDate, nextTaskDueDate, planCloseDate, eventStartDate },
    overdueTasks,
    triageQueue,
    contentApproval,
    agendaWork,
  };
}

/** Lead speaker (lowest participant.order among role='speaker') display
 * name per submission id, for the given bounded id set — one chunked query
 * set shared across every DEC-370 row section that needs a speaker name. */
async function fetchLeadSpeakerNames(db: Db, submissionIds: string[]): Promise<Map<string, string>> {
  const best = new Map<string, { order: number; name: string }>();
  for (const batch of chunkIds(submissionIds)) {
    if (batch.length === 0) continue;
    const rows = await db
      .select({
        submissionId: schema.participant.submissionId,
        order: schema.participant.order,
        firstName: schema.contact.firstName,
        lastName: schema.contact.lastName,
      })
      .from(schema.participant)
      .innerJoin(schema.contact, eq(schema.contact.id, schema.participant.contactId))
      .where(and(inArray(schema.participant.submissionId, batch), eq(schema.participant.role, "speaker")));
    for (const r of rows) {
      const existing = best.get(r.submissionId);
      if (!existing || r.order < existing.order) {
        best.set(r.submissionId, { order: r.order, name: `${r.firstName} ${r.lastName}`.trim() });
      }
    }
  }
  const out = new Map<string, string>();
  for (const [id, v] of best) out.set(id, v.name);
  return out;
}

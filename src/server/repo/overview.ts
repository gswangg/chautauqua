// Overview worklist repo (DEC-030, DEC-370, DEC-400). Builds the single GET
// .../events/:eventId/overview payload with joined/grouped queries; repo
// functions are the only code here that touch drizzle row types (DEC-012).
// Decomposed from a single 800+ line file to reduce merge contention:
// pure aggregation helpers live in overview/aggregate.ts, pure schedule/
// conflict helpers live in overview/scheduling.ts, and payload types live
// in overview/types.ts. This file re-exports all of them so behavior and
// public import paths (`repo/overview`) are unchanged — callers should not
// need to change their imports. See test/overview.test.ts for the pure
// helpers' unit tests, exercised without a database.
//
// DEC-400 (wire keys): the v1 aggregate {pending, accept_queue,
// decline_queue} ships under the key `triage-counts` (the nav badge and
// app/src/pages/overview/cards.ts read `payload['triage-counts'].pending`),
// and the v2 "submissions awaiting triage" rows section ships under the
// plain key `triage` (per DEC-370's prose). This resolves the DEC-370
// collision between the two sections that both wanted the name `triage`;
// app/src/pages/overview/types.ts is the client-side contract of record for
// these wire keys and is pinned against this file by
// test/overview-payload-contract.test.ts.

import { and, asc, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { findConflicts, parseFormatDurationMin, type BlockedInterval, type PlacedSession } from "../../domain/schedule";
import { formatRef } from "../../domain/ids";
import { chunkIds } from "../../lib/chunk";
import { answerFieldRoleCondition, roleAnswerLabel, roleAnswerMap } from "./form-roles";
import { loadTrackNamesBySubmission } from "./submission-tracks";
import { DEFAULT_AUTO_SCHEDULE_PARAMS, MAX_AGENDA_SCAN } from "./agenda";
import { listBreaksForEvent } from "./breaks";
import { toScheduleBlocks } from "./agenda/payload";
import { ApiError } from "../http";
import { assignmentDueDateSql, attachedAssignment, overdueAssignmentConditions } from "./tasks/crud";
import { visibleSessionConditions } from "./public/gates";
import { ACTIVE_INVITE_STATUSES } from "../../domain/acceptance";
import { DEC_010, DEC_370, DEC_531, DEC_589, DEC_613, DEC_704, DEC_772, DEC_776, DEC_895 } from "../../decisions";
void DEC_010;
void DEC_370;
void DEC_531;
void DEC_589;
void DEC_613;
void DEC_704;
void DEC_772;
void DEC_776;
void DEC_895;

export * from "./overview/types";
export * from "./overview/aggregate";
export * from "./overview/scheduling";

import type { ConflictSessionInfo, FileRowForPick, LeadSpeakerRow, OverviewPayload, OverviewPayloadV2 } from "./overview/types";
import { aggregateTriageCounts, buildOverdueTaskRows, computeAgendaSummary, pickLatestFilePerSubmission, pickLeadSpeakerPerSubmission } from "./overview/aggregate";
import { buildConflictResolutionFor, buildConflictRows, buildPlacementSuggestion } from "./overview/scheduling";

const ROW_CAP = 5;

/** Runs independent reads in ONE database round trip (D1's batch) when the
 * database offers it, else side by side; results come back in query order.
 * Each D1 query costs a round trip whatever its size, so batching is what
 * makes a many-section read cheap. The overview tests' fake databases have
 * no batch and take the Promise.all path, in the same order. */
async function readTogether<T extends readonly unknown[]>(db: Db, queries: T): Promise<{ -readonly [K in keyof T]: Awaited<T[K]> }> {
  const batch = (db as unknown as { batch?: (queries: readonly unknown[]) => Promise<unknown[]> }).batch;
  if (typeof batch === "function") return (await batch.call(db, queries)) as never;
  return (await Promise.all(queries)) as never;
}

// ---------------------------------------------------------------------------
// I/O: builds the full payload from joined/grouped queries.
// ---------------------------------------------------------------------------

export async function getOverviewPayload(db: Db, eventId: string, now: number, timeZone: string): Promise<OverviewPayloadV2> {
  // Three waves (perf): the payload's queries used to run in eight
  // sequential waves, each a database round trip. Now:
  //   1. every query that needs only eventId/now, together;
  //   2. every read that needs only wave 1's rows, together (chunked reads
  //      run their chunks side by side);
  //   3. the lead-speaker lookup, which needs the conflicts computed from
  //      wave 2's participants.
  // Wave 1 is one D1 batch (one round trip); its elements are plain query
  // chains, resolved in array order where there is no batch;
  // waves 2 and 3 are async calls, each issuing its first query in array
  // order. That order is the response order the fake-db tests in
  // test/overview*.test.ts queue.
  const UNPLACED_ACCEPTED_CONDITIONS = and(
    eq(schema.submission.eventId, eventId),
    eq(schema.submission.status, "accepted"),
    sql`not exists (select 1 from ${schema.scheduleSlot} where ${schema.scheduleSlot.submissionId} = ${schema.submission.id})`,
  );
  const DAY_MS = 24 * 60 * 60 * 1000;
  const SEVEN_DAYS_MS = 7 * DAY_MS;
  const cutoffMs = now - SEVEN_DAYS_MS;

  // --- Wave 1.
  const [
    eventRows,
    statusRows,
    planCountRows,
    evaluationsAggRows,
    planCloseRows,
    formRows,
    speakerAggRows,
    overdueAssignmentCountRows,
    overdueDetailRows,
    triageDetailRows,
    contentAggRows,
    contentDetailRows,
    unplacedCountRows,
    unplacedDetailRows,
    slotRows,
    commsRows,
    publishedSessionCountRows,
  ] = await readTogether(db, [
    // --- Event: record ref prefix + start date (DEC-370 deadlines strip).
    db
      .select({ recordPrefix: schema.event.recordPrefix, startDate: schema.event.startDate })
      .from(schema.event)
      .where(eq(schema.event.id, eventId))
      .limit(1),
    // --- Triage: one grouped submission-status query.
    db
      .select({ status: schema.submission.status, n: sql<number>`count(*)` })
      .from(schema.submission)
      .where(eq(schema.submission.eventId, eventId))
      .groupBy(schema.submission.status),
    // --- Review: plans on the event + submitted evaluations under them.
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.evaluationPlan)
      .where(eq(schema.evaluationPlan.eventId, eventId)),
    // DEC-589: submitted vs. started must come from the SAME join pass over
    // the event's plans — a numerator counted against an unrelated
    // denominator (plans) is exactly the "40 of 3 evaluation plans in" bug
    // this fixes. `started` counts evaluation rows that exist (upsertEvaluation
    // is the only insert site, so a row means someone began it) — it is NOT
    // every assignment. The true assigned denominator lives with
    // /plans/:id/progress (resolveAssignments + assignedExcludingRecused +
    // assignedExcludingSaturated) and is deliberately not re-derived here:
    // two resolvers for one count is DEC-613's delay-fuse trap.
    db
      .select({
        started: sql<number>`count(*)`,
        submitted: sql<number>`count(case when ${schema.evaluation.submittedAt} is not null then 1 end)`,
      })
      .from(schema.evaluation)
      .innerJoin(schema.evaluationPlan, eq(schema.evaluation.planId, schema.evaluationPlan.id))
      .where(eq(schema.evaluationPlan.eventId, eventId)),
    // --- Evaluation plan close date: soonest non-null across the event's
    // plans (DEC-370 deadlines strip), carrying that plan's currentRound
    // (DEC-704) so the "Review wave" cell can name its round number.
    db
      .select({ closeDate: schema.evaluationPlan.closeDate, currentRound: schema.evaluationPlan.currentRound })
      .from(schema.evaluationPlan)
      .where(and(eq(schema.evaluationPlan.eventId, eventId), sql`${schema.evaluationPlan.closeDate} is not null`))
      .orderBy(asc(schema.evaluationPlan.closeDate))
      .limit(1),
    // --- Form close date: the default CFP form's close date (the only form
    // submit.ts and the public CFP treat as "the" form for the event).
    db
      .select({ closeDate: schema.form.closeDate })
      .from(schema.form)
      .where(and(eq(schema.form.eventId, eventId), eq(schema.form.isDefault, true)))
      .limit(1),
    // --- Speakers: one conditional-aggregate query over every
    // task_assignment joined to task for event scoping (never row-materialize
    // — matches src/server/repo/tasks/grid.ts's outstandingContacts/overdue
    // aggregate verbatim so the two surfaces can't drift; DEC-531).
    db
      .select({
        outstandingContacts: sql<number>`count(distinct case when ${schema.taskAssignment.status} <> 'complete' then ${schema.taskAssignment.contactId} end)`,
        nextDue: sql<number | null>`min(case when ${schema.taskAssignment.status} <> 'complete' then ${assignmentDueDateSql()} end)`,
      })
      .from(schema.taskAssignment)
      .innerJoin(schema.task, eq(schema.taskAssignment.taskId, schema.task.id))
      .where(and(eq(schema.task.eventId, eventId), attachedAssignment())),
    // DEC-776: the overdue-assignment count is a separate query (rather than
    // folded into speakerAggRows above) because overdueAssignmentConditions
    // composes the roster predicate, which needs a join to `contact` — an
    // assignment for a contact who is no longer an accepted speaker must not
    // inflate this count, matches src/server/repo/tasks/grid.ts's
    // counts.overdue verbatim (DEC-531) so the two surfaces can't drift.
    db
      .select({ count: sql<number>`count(distinct ${schema.taskAssignment.id})` })
      .from(schema.taskAssignment)
      .innerJoin(schema.task, eq(schema.taskAssignment.taskId, schema.task.id))
      .innerJoin(schema.contact, eq(schema.contact.id, schema.taskAssignment.contactId))
      .where(overdueAssignmentConditions(eventId, now, timeZone)),
    // --- Overdue task rows (DEC-370 section 01): capped detail rows for the
    // same overdue set the speakers aggregate above already counted
    // (overdueTasks.total reuses speakers.overdueAssignments — no second
    // count query). DEC-776: the SAME overdueAssignmentConditions predicate
    // (status <> 'complete', not = 'pending', plus the roster join) so the
    // number and the rows describe one set.
    db
      .select({
        assignmentId: schema.taskAssignment.id,
        contactId: schema.taskAssignment.contactId,
        firstName: schema.contact.firstName,
        lastName: schema.contact.lastName,
        company: schema.contact.company,
        taskId: schema.task.id,
        taskTitle: schema.task.title,
        dueDate: schema.task.dueDate,
        assignedAt: schema.taskAssignment.createdAt,
        source: schema.taskAssignment.source,
        assignmentDueDate: schema.taskAssignment.dueDate,
      })
      .from(schema.taskAssignment)
      .innerJoin(schema.task, eq(schema.taskAssignment.taskId, schema.task.id))
      .innerJoin(schema.contact, eq(schema.contact.id, schema.taskAssignment.contactId))
      .where(overdueAssignmentConditions(eventId, now, timeZone))
      .orderBy(asc(assignmentDueDateSql()), asc(schema.taskAssignment.id))
      .limit(ROW_CAP),
    // --- Triage queue rows (DEC-370 section 02): oldest-first, capped.
    db
      .select({
        id: schema.submission.id,
        seq: schema.submission.seq,
        title: schema.submission.title,
        createdAt: schema.submission.createdAt,
      })
      .from(schema.submission)
      .where(and(eq(schema.submission.eventId, eventId), eq(schema.submission.status, "pending")))
      .orderBy(asc(schema.submission.createdAt), asc(schema.submission.id))
      .limit(ROW_CAP),

    // --- Content approval (DEC-370 section 03): accepted + content_status
    // pending. One conditional-aggregate query gives both the total (also
    // v1's content.awaitingApproval) and reuploadedCount (a correlated-EXISTS
    // count over the same set) — never a per-row query.
    db
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
      ),
    db
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
      .orderBy(desc(schema.submission.updatedAt), asc(schema.submission.id))
      .limit(ROW_CAP),

    // --- Agenda unplaced count (DEC-370 wave-56 amendment): a SQL count,
    // never a filter over a materialized accepted-submission array.
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.submission)
      .where(UNPLACED_ACCEPTED_CONDITIONS),
    // --- Agenda unplaced detail rows (DEC-370 section 05): the same
    // predicate as the count above, capped + ordered by seq ascending —
    // this is also unplacedCappedIds (no separate .slice(0, ROW_CAP)).
    db
      .select({ id: schema.submission.id, seq: schema.submission.seq, title: schema.submission.title })
      .from(schema.submission)
      .where(UNPLACED_ACCEPTED_CONDITIONS)
      .orderBy(asc(schema.submission.seq))
      .limit(ROW_CAP),

    // --- Placed sessions (DEC-370 wave-56 amendment): the schedule_slot
    // query is event- and status-scoped by its join to `submission`, and
    // selects submission.seq/title off that SAME join so every placed row
    // carries its own ref/title.
    db
      .select({
        submissionId: schema.scheduleSlot.submissionId,
        roomId: schema.scheduleSlot.roomId,
        day: schema.scheduleSlot.day,
        startMin: schema.scheduleSlot.startMin,
        endMin: schema.scheduleSlot.endMin,
        seq: schema.submission.seq,
        title: schema.submission.title,
      })
      .from(schema.scheduleSlot)
      .innerJoin(schema.submission, eq(schema.scheduleSlot.submissionId, schema.submission.id))
      .where(and(eq(schema.submission.eventId, eventId), eq(schema.submission.status, "accepted")))
      .limit(MAX_AGENDA_SCAN + 1),
    // --- Comms: one aggregate query, never the whole email_log table
    // (DEC-333/DEC-334: card numbers are SQL aggregates, not materialized
    // rows spread into Math.max).
    db
      .select({
        sentLast7Days: sql<number>`count(case when ${schema.emailLog.sentAt} >= ${cutoffMs} then 1 end)`,
        lastSentAt: sql<number | null>`max(${schema.emailLog.sentAt})`,
      })
      .from(schema.emailLog)
      .where(eq(schema.emailLog.eventId, eventId)),
    // DEC-370 amendment (wave 5): "Public pages" quiet-row count -- reuses
    // visibleSessionConditions(), the same gate the public sessions list
    // itself applies, scoped to this event. One count query, never a
    // materialized row list.
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.submission)
      .where(and(eq(schema.submission.eventId, eventId), visibleSessionConditions())),
  ] as const);

  const recordPrefix = eventRows[0]?.recordPrefix ?? "SES";
  const eventStartDate = eventRows[0]?.startDate ? new Date(`${eventRows[0].startDate}T00:00:00Z`).getTime() : null;
  const triage = aggregateTriageCounts(statusRows.map((r) => ({ status: r.status, n: Number(r.n) })));
  const plans = Number(planCountRows[0]?.count ?? 0);
  const evaluationsStarted = Number(evaluationsAggRows[0]?.started ?? 0);
  const evaluationsSubmitted = Number(evaluationsAggRows[0]?.submitted ?? 0);
  const planCloseDate = planCloseRows[0]?.closeDate == null ? null : planCloseRows[0].closeDate.getTime();
  const planRound = planCloseRows[0]?.currentRound ?? null;
  const formCloseDate = formRows[0]?.closeDate ? formRows[0].closeDate.getTime() : null;
  const overdueAssignmentCount = Number(overdueAssignmentCountRows[0]?.count ?? 0);

  const speakers: OverviewPayload["speakers"] = {
    contactsOwing: Number(speakerAggRows[0]?.outstandingContacts ?? 0),
    overdueAssignments: overdueAssignmentCount,
  };
  const nextTaskDueDate =
    speakerAggRows[0]?.nextDue == null ? null : Number(speakerAggRows[0].nextDue);

  // --- Overdue task rows (DEC-370 section 01): capped detail rows for the
  // same overdue set the speakers aggregate above already counted
  // (overdueTasks.total reuses speakers.overdueAssignments — no second
  // count query); overdueDetailRows came back in wave 1 above.
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
        // multi-portal: a portal row's own merged deadline; passing it as the
        // assignment time too keeps DEC-801's late-assignment grace (which
        // only applies to direct rows) out of the computation
        taskDueDate: r.source === "portal" ? r.assignmentDueDate!.getTime() : r.dueDate!.getTime(),
        assignedAt: r.source === "portal" ? r.assignmentDueDate!.getTime() : r.assignedAt!.getTime(),
      })),
      now,
      timeZone,
    ),
  };

  // --- Triage queue rows (DEC-370 section 02): oldest-first, capped;
  // oldestSubmittedAt is the first row's createdAt (ordering is ascending
  // over the whole pending set, so the first of up to ROW_CAP rows is the
  // global oldest — no separate min() query needed). triageDetailRows came
  // back in wave 1 above.
  const oldestSubmittedAt = triageDetailRows[0] ? triageDetailRows[0].createdAt.getTime() : null;

  const content = { awaitingApproval: Number(contentAggRows[0]?.total ?? 0) };
  const reuploadedCount = Number(contentAggRows[0]?.reuploaded ?? 0);
  const unplacedCount = Number(unplacedCountRows[0]?.count ?? 0);
  const comms = {
    sentLast7Days: Number(commsRows[0]?.sentLast7Days ?? 0),
    lastSentAt: commsRows[0]?.lastSentAt == null ? null : Number(commsRows[0].lastSentAt),
  };
  const publishedSessionCount = Number(publishedSessionCountRows[0]?.count ?? 0);

  if (slotRows.length > MAX_AGENDA_SCAN) {
    throw new ApiError(
      "invalid",
      `This overview read would scan more than ${MAX_AGENDA_SCAN} placed sessions`,
    );
  }
  const placedSeqTitleById = new Map<string, { seq: number; title: string }>();
  for (const s of slotRows) placedSeqTitleById.set(s.submissionId, { seq: s.seq, title: s.title });
  const placedIds = [...new Set(slotRows.map((s) => s.submissionId))];
  const placedRoomIds = [...new Set(slotRows.map((s) => s.roomId).filter((id): id is string => id !== null))];
  const placedDays = [...new Set(slotRows.map((s) => s.day))].sort();
  const unplacedById = new Map(unplacedDetailRows.map((r) => [r.id, r]));
  const unplacedCappedIds = unplacedDetailRows.map((r) => r.id);
  // --- DEC-895 amendment (wave 148, w4-ak): the count of unplaced rows the
  // client never receives (the detail query's own ROW_CAP truncation) --
  // computed here (before wave 2 below) so the remainder read
  // can be skipped outright when there is no remainder.
  const unplacedRemainderCount = unplacedCount - unplacedCappedIds.length;

  const contentSubmissionIds = contentDetailRows.map((r) => r.id);
  // --- Placement-suggestion co-presenter fix (DEC-895 amendment, w2-f): a
  // "Place at HH:MM" suggestion must avoid double-booking EVERY active
  // participant on the unplaced submission, not just its lead speaker --
  // so the participant read covers the placed ids AND the capped unplaced
  // ids, and both `placed` and the unplaced-row suggestions below read off
  // the ONE resulting speakersBySubmission map.
  const participantSubmissionIds = [...new Set([...placedIds, ...unplacedCappedIds])];

  // --- Wave 2.
  const [breaks, triageTrackNames, fileRows, participantRows, roomNameById, formatAnswerRows, remainderFormatAnswerRows] =
    await Promise.all([
      // DEC-370 (wave-71 amendment): ONE breaks read for the whole function,
      // shared by conflict detection and the nextFreeSlot suggestions.
      listBreaksForEvent(db, eventId),
      // DEC-855: skips its query entirely when triage has no rows.
      loadTrackNamesBySubmission(
        db,
        triageDetailRows.map((r) => r.id),
      ),
      (async () =>
        contentSubmissionIds.length > 0
          ? db
              .select({
                id: schema.file.id,
                submissionId: schema.file.submissionId,
                filename: schema.file.filename,
                previousFileId: schema.file.previousFileId,
                createdAt: schema.file.createdAt,
              })
              .from(schema.file)
              .where(inArray(schema.file.submissionId, contentSubmissionIds))
          : ([] as { id: string; submissionId: string | null; filename: string; previousFileId: string | null; createdAt: Date }[]))(),
      (async () => {
        const batches = await Promise.all(
          chunkIds(participantSubmissionIds).map((batch) =>
            db
              .select({
                submissionId: schema.participant.submissionId,
                contactId: schema.participant.contactId,
              })
              .from(schema.participant)
              .where(
                and(
                  inArray(schema.participant.submissionId, batch),
                  inArray(schema.participant.inviteStatus, [...ACTIVE_INVITE_STATUSES]),
                ),
              ),
          ),
        );
        return batches.flat();
      })(),
      // --- Room names for every room already in use on the event's placed
      // sessions (DEC-652: this same bounded set doubles as the room-name
      // lookup for both the conflict rows' rooms and the nextFreeSlot
      // suggestion/resolution rooms below -- no extra query).
      (async () => {
        const map = new Map<string, string>();
        if (placedRoomIds.length > 0) {
          const roomRows = await db
            .select({ id: schema.room.id, name: schema.room.name })
            .from(schema.room)
            .where(inArray(schema.room.id, placedRoomIds));
          for (const r of roomRows) map.set(r.id, r.name);
        }
        return map;
      })(),
      // --- DEC-895: each unplaced row's own session_format-role answer,
      // batched exactly like loadDurationMinBySubmission (./agenda) — but
      // this reader returns the raw label, never a defaulted duration, so a
      // row whose format is absent or unparseable can say so (durationMin:
      // null) rather than silently borrowing the event's default.
      (async () => {
        const batches = await Promise.all(
          chunkIds(unplacedCappedIds).map((batch) =>
            db
              .select({
                submissionId: schema.submissionAnswer.submissionId,
                valueJson: schema.submissionAnswer.valueJson,
              })
              .from(schema.submissionAnswer)
              .where(
                and(
                  inArray(schema.submissionAnswer.submissionId, batch),
                  answerFieldRoleCondition("session_format"),
                ),
              ),
          ),
        );
        return batches.flat();
      })(),
      // --- DEC-895 amendment (wave 148, w4-ak): the unplaced REMAINDER's
      // (unplacedTotal minus the capped rows just above) own
      // session_format-role answers. Same UNPLACED_ACCEPTED_CONDITIONS
      // predicate the detail query above already applies, same
      // answerFieldRoleCondition("session_format") as the DEC-895 reader
      // above it, restricted to ids NOT IN unplacedCappedIds -- that
      // exclusion list is never larger than ROW_CAP, so a single NOT IN
      // clause is used rather than chunking. Skipped entirely when there is
      // no remainder.
      (async () => {
        if (unplacedRemainderCount <= 0) return [] as { submissionId: string; valueJson: string }[];
        return db
          .select({
            submissionId: schema.submissionAnswer.submissionId,
            valueJson: schema.submissionAnswer.valueJson,
          })
          .from(schema.submissionAnswer)
          .innerJoin(schema.submission, eq(schema.submission.id, schema.submissionAnswer.submissionId))
          .where(
            and(
              UNPLACED_ACCEPTED_CONDITIONS,
              notInArray(schema.submission.id, unplacedCappedIds),
              answerFieldRoleCondition("session_format"),
            ),
          );
      })(),
    ]);

  const latestFileBySubmission = new Map<string, { filename: string; uploadedAt: number; reuploaded: boolean }>();
  {
    const fileRowsBySubmission = new Map<string, FileRowForPick[]>();
    for (const f of fileRows) {
      if (!f.submissionId) continue;
      const arr = fileRowsBySubmission.get(f.submissionId) ?? [];
      arr.push({ id: f.id, submissionId: f.submissionId, filename: f.filename, previousFileId: f.previousFileId, createdAt: f.createdAt.getTime() });
      fileRowsBySubmission.set(f.submissionId, arr);
    }
    for (const [submissionId, rows] of fileRowsBySubmission) {
      const picked = pickLatestFilePerSubmission(rows);
      if (picked) {
        latestFileBySubmission.set(submissionId, {
          filename: picked.filename,
          uploadedAt: picked.createdAt,
          reuploaded: picked.previousFileId !== null,
        });
      }
    }
  }

  const speakersBySubmission = new Map<string, string[]>();
  for (const p of participantRows) {
    const arr = speakersBySubmission.get(p.submissionId) ?? [];
    arr.push(p.contactId);
    speakersBySubmission.set(p.submissionId, arr);
  }
  const placed: PlacedSession[] = slotRows.map((s) => ({
    submissionId: s.submissionId,
    roomId: s.roomId,
    day: s.day,
    startMin: s.startMin,
    endMin: s.endMin,
    speakerContactIds: speakersBySubmission.get(s.submissionId) ?? [],
  }));
  // DEC-370 (wave-71 amendment): the event's breaks feed conflict detection
  // here too, matching agenda/payload.ts's findConflicts(placedSessions,
  // blocks) — computed exactly ONCE and shared by both the summary count
  // (agenda.conflicts) and the agendaWork rows below, never recomputed
  // blind to breaks a second time.
  const blocks = toScheduleBlocks(breaks);
  const blocked: BlockedInterval[] = breaks.map((b) => ({
    day: b.day,
    startMin: b.startMin,
    endMin: b.startMin + b.durationMin,
  }));
  const conflicts = findConflicts(placed, blocks);
  const agenda = computeAgendaSummary(unplacedCount, conflicts.length);
  const placedById = new Map(placed.map((p) => [p.submissionId, p]));

  // --- One combined lead-speaker lookup for every submission id any DEC-370
  // row section below needs a display name for (triage queue rows, content
  // approval rows, unplaced rows, conflict entries) — a single chunked
  // query set rather than one per section.
  const leadSpeakerIds = new Set<string>();
  for (const r of triageDetailRows) leadSpeakerIds.add(r.id);
  for (const r of contentDetailRows) leadSpeakerIds.add(r.id);
  for (const id of unplacedCappedIds) leadSpeakerIds.add(id);
  for (const c of conflicts.slice(0, ROW_CAP)) {
    for (const id of c.submissionIds) leadSpeakerIds.add(id);
  }

  // --- Wave 3.
  const { nameById: leadSpeakerNameById } = await fetchLeadSpeakers(db, [...leadSpeakerIds]);

  // --- DEC-895 amendment (wave 148, w4-ak): non-null ONLY when every
  // remainder row answered (row count matches the remainder count exactly)
  // and every one of those answers parses to the SAME duration. Mixed,
  // partial, or unparseable ⇒ null (DEC-936: never let one row, or a
  // majority, speak for the rest).
  let unplacedRemainderDurationMin: number | null = null;
  if (unplacedRemainderCount > 0 && remainderFormatAnswerRows.length === unplacedRemainderCount) {
    const remainderDurations = new Set<number>();
    let everyRemainderAnswerParsed = true;
    for (const row of remainderFormatAnswerRows) {
      const durationMin = parseFormatDurationMin(roleAnswerLabel(row.valueJson));
      if (durationMin === null) {
        everyRemainderAnswerParsed = false;
        break;
      }
      remainderDurations.add(durationMin);
    }
    if (everyRemainderAnswerParsed && remainderDurations.size === 1) {
      unplacedRemainderDurationMin = [...remainderDurations][0]!;
    }
  }

  // DEC-010 amendment (wave 66) / DEC-370 (wave-71 amendment): `blocked` was
  // built above (right after `placed`), from the ONE breaks read this
  // function makes — reused here for the §04 nextFreeSlot suggestion calls
  // so a "Place at HH:MM"/"Move REF to HH:MM" suggestion never names a
  // break window, with no second breaks query.
  const formatLabelByUnplacedId = roleAnswerMap(formatAnswerRows);

  const triageQueue = {
    total: triage.pending,
    oldestSubmittedAt,
    rows: triageDetailRows.map((r) => ({
      submissionId: r.id,
      ref: formatRef(recordPrefix, r.seq),
      title: r.title,
      speakerName: leadSpeakerNameById.get(r.id) ?? "",
      trackName: triageTrackNames.get(r.id)?.[0] ?? null,
      format: null,
      submittedAt: r.createdAt.getTime(),
    })),
  };

  const contentApproval = {
    total: content.awaitingApproval,
    reuploadedCount,
    rows: contentDetailRows.map((r) => {
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

  const sessionById = new Map<string, ConflictSessionInfo>();
  for (const p of placed) {
    const seqTitle = placedSeqTitleById.get(p.submissionId);
    if (!seqTitle) continue;
    sessionById.set(p.submissionId, {
      day: p.day,
      startMin: p.startMin,
      endMin: p.endMin,
      roomId: p.roomId,
      ref: formatRef(recordPrefix, seqTitle.seq),
      title: seqTitle.title,
      speakerName: leadSpeakerNameById.get(p.submissionId) ?? "",
    });
  }

  const nextFreeSlotParams = {
    dayStartMin: DEFAULT_AUTO_SCHEDULE_PARAMS.dayStartMin,
    dayEndMin: DEFAULT_AUTO_SCHEDULE_PARAMS.dayEndMin,
    gridMin: DEFAULT_AUTO_SCHEDULE_PARAMS.gridMin,
    defaultDurationMin: DEFAULT_AUTO_SCHEDULE_PARAMS.defaultDurationMin,
  };
  const cappedConflicts = conflicts.slice(0, ROW_CAP);

  // --- DEC-895: suggestions are handed out against a GROWING occupancy set
  // — the first row's accepted suggestion is reserved into
  // suggestionOccupancy before the next row's search runs, so two rows in
  // one payload can never both propose the same room-minute. Starts as a
  // copy of `placed` so it never mutates the array conflicts/resolutions
  // above already computed against.
  const suggestionOccupancy: PlacedSession[] = [...placed];
  const unplacedRows = unplacedCappedIds.map((id) => {
    const submission = unplacedById.get(id);
    if (!submission) throw new Error(`getOverviewPayload: unplaced submission ${id} not in the loaded unplaced-detail set`);
    const format = formatLabelByUnplacedId.get(id) ?? null;
    // DEC-772/DEC-895: the ONE parse — never a magic default when the
    // format carries no parseable duration; the row just says null.
    const durationMin = parseFormatDurationMin(format);
    const speakerContactIds = speakersBySubmission.get(id) ?? [];
    let suggestion = null;
    if (durationMin !== null) {
      suggestion = buildPlacementSuggestion(
        speakerContactIds,
        suggestionOccupancy,
        placedRoomIds,
        placedDays,
        roomNameById,
        nextFreeSlotParams,
        durationMin,
        blocked,
      );
      if (suggestion) {
        suggestionOccupancy.push({
          submissionId: id,
          roomId: suggestion.roomId,
          day: suggestion.day,
          startMin: suggestion.startMin,
          endMin: suggestion.startMin + durationMin,
          speakerContactIds,
        });
      }
    }
    return {
      submissionId: id,
      ref: formatRef(recordPrefix, submission.seq),
      title: submission.title,
      speakerName: leadSpeakerNameById.get(id) ?? "",
      format,
      durationMin,
      suggestion,
    };
  });

  const agendaWork = {
    unplacedTotal: agenda.unplaced,
    conflictTotal: agenda.conflicts,
    conflicts: buildConflictRows(conflicts, sessionById, roomNameById).map((row, idx) => ({
      ...row,
      resolution: buildConflictResolutionFor(
        cappedConflicts[idx]!,
        sessionById,
        placedById,
        placed,
        placedRoomIds,
        placedDays,
        roomNameById,
        nextFreeSlotParams,
        blocked,
      ),
    })),
    unplaced: unplacedRows,
    unplacedRemainderDurationMin,
  };

  return {
    "triage-counts": triage,
    review: { plans, evaluationsSubmitted, evaluationsStarted },
    speakers,
    content,
    agenda,
    comms,
    deadlines: { formCloseDate, nextTaskDueDate, planCloseDate, planRound, eventStartDate },
    overdueTasks,
    triage: triageQueue,
    contentApproval,
    agendaWork,
    publishedSessionCount,
  };
}

/** Lead speaker (lowest participant.order among role='speaker') display
 * name AND contact id per submission id, for the given bounded id set — one
 * chunked query set shared across every DEC-370 row section that needs a
 * speaker name, plus DEC-652's suggestion/resolution search (which needs
 * the contact id, not just its display name, to avoid double-booking that
 * speaker). */
async function fetchLeadSpeakers(
  db: Db,
  submissionIds: string[],
): Promise<{ nameById: Map<string, string>; contactIdById: Map<string, string> }> {
  const rowsBySubmission = new Map<string, LeadSpeakerRow[]>();
  for (const batch of chunkIds(submissionIds)) {
    if (batch.length === 0) continue;
    const rows = await db
      .select({
        submissionId: schema.participant.submissionId,
        order: schema.participant.order,
        contactId: schema.participant.contactId,
        firstName: schema.contact.firstName,
        lastName: schema.contact.lastName,
      })
      .from(schema.participant)
      .innerJoin(schema.contact, eq(schema.contact.id, schema.participant.contactId))
      .where(
        and(
          inArray(schema.participant.submissionId, batch),
          eq(schema.participant.role, "speaker"),
          inArray(schema.participant.inviteStatus, [...ACTIVE_INVITE_STATUSES]),
        ),
      );
    for (const r of rows) {
      const name = `${r.firstName} ${r.lastName}`.trim();
      const arr = rowsBySubmission.get(r.submissionId) ?? [];
      arr.push({ submissionId: r.submissionId, order: r.order, contactId: r.contactId, name });
      rowsBySubmission.set(r.submissionId, arr);
    }
  }
  const nameById = new Map<string, string>();
  const contactIdById = new Map<string, string>();
  for (const [submissionId, rows] of rowsBySubmission) {
    const picked = pickLeadSpeakerPerSubmission(rows);
    if (picked) {
      nameById.set(submissionId, picked.name);
      contactIdById.set(submissionId, picked.contactId);
    }
  }
  return { nameById, contactIdById };
}

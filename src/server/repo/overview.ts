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

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { findConflicts, parseFormatDurationMin, type BlockedInterval, type PlacedSession } from "../../domain/schedule";
import { formatRef } from "../../domain/ids";
import { chunkIds } from "../../lib/chunk";
import { answerFieldRoleCondition, roleAnswerMap } from "./form-roles";
import { loadTrackNamesBySubmission } from "./submission-tracks";
import { DEFAULT_AUTO_SCHEDULE_PARAMS, MAX_AGENDA_SCAN } from "./agenda";
import { listBreaksForEvent } from "./breaks";
import { toScheduleBlocks } from "./agenda/payload";
import { ApiError } from "../http";
import { overdueAssignmentConditions } from "./tasks/crud";
import { visibleSessionConditions } from "./public/gates";
import { ACTIVE_INVITE_STATUSES } from "../../domain/acceptance";
import { DEC_010, DEC_370, DEC_531, DEC_704, DEC_772, DEC_776, DEC_895 } from "../../decisions";
void DEC_010;
void DEC_370;
void DEC_531;
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

// ---------------------------------------------------------------------------
// I/O: builds the full payload from joined/grouped queries.
// ---------------------------------------------------------------------------

export async function getOverviewPayload(db: Db, eventId: string, now: number, timeZone: string): Promise<OverviewPayloadV2> {
  // --- Phase 1 (w49-d, DEC-589 amendment): every query below takes ONLY
  // eventId/now as input — none reads another query's result — so they
  // fire as ONE Promise.all wave instead of ~10 sequential round trips.
  // The array order below is the exact original sequential-await order:
  // Promise.all evaluates its array literal left-to-right, synchronously,
  // so db.select() calls (and the fake-db test harnesses' response-queue
  // cursors in test/overview*.test.ts) fire/consume in this same order —
  // phasing the AWAITs changes nothing about call order or a single output
  // value, only when the round trips are in flight together.
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
  ] = await Promise.all([
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
    // DEC-589: submitted vs. expected must come from the SAME join pass over
    // the event's plans (evaluationsExpected = every assigned evaluation row,
    // submitted or not) — a numerator counted against an unrelated
    // denominator (plans) is exactly the "40 of 3 evaluation plans in" bug
    // this fixes.
    db
      .select({
        expected: sql<number>`count(*)`,
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
        nextDue: sql<number | null>`min(case when ${schema.taskAssignment.status} <> 'complete' then ${schema.task.dueDate} end)`,
      })
      .from(schema.taskAssignment)
      .innerJoin(schema.task, eq(schema.taskAssignment.taskId, schema.task.id))
      .where(eq(schema.task.eventId, eventId)),
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
      })
      .from(schema.taskAssignment)
      .innerJoin(schema.task, eq(schema.taskAssignment.taskId, schema.task.id))
      .innerJoin(schema.contact, eq(schema.contact.id, schema.taskAssignment.contactId))
      .where(overdueAssignmentConditions(eventId, now, timeZone))
      .orderBy(asc(schema.task.dueDate), asc(schema.taskAssignment.id))
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
  ]);

  const recordPrefix = eventRows[0]?.recordPrefix ?? "SES";
  const eventStartDate = eventRows[0]?.startDate ? new Date(`${eventRows[0].startDate}T00:00:00Z`).getTime() : null;
  const triage = aggregateTriageCounts(statusRows.map((r) => ({ status: r.status, n: Number(r.n) })));
  const plans = Number(planCountRows[0]?.count ?? 0);
  const evaluationsExpected = Number(evaluationsAggRows[0]?.expected ?? 0);
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
  // count query); overdueDetailRows came back in Phase 1 above.
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
        taskDueDate: r.dueDate!.getTime(),
        assignedAt: r.assignedAt!.getTime(),
      })),
      now,
      timeZone,
    ),
  };

  // --- Triage queue rows (DEC-370 section 02): oldest-first, capped;
  // oldestSubmittedAt is the first row's createdAt (ordering is ascending
  // over the whole pending set, so the first of up to ROW_CAP rows is the
  // global oldest — no separate min() query needed). triageDetailRows came
  // back in Phase 1 above.
  const oldestSubmittedAt = triageDetailRows[0] ? triageDetailRows[0].createdAt.getTime() : null;

  // --- Phase 2 (w49-d, DEC-589 amendment): triageTrackNames needs
  // triageDetailRows' ids (Phase 1's output) so it can't join Phase 1's
  // wave, but it's independent of contentAggRows/contentDetailRows (which
  // only need eventId) — same array-order-preserves-call-order reasoning
  // as Phase 1. loadTrackNamesBySubmission itself skips the query entirely
  // when given no ids, so this array element never desyncs the fake-db
  // response-queue cursor tests when triage is empty.
  const [triageTrackNames, contentAggRows, contentDetailRows] = await Promise.all([
    loadTrackNamesBySubmission(
      db,
      triageDetailRows.map((r) => r.id),
    ),
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
  ]);
  const content = { awaitingApproval: Number(contentAggRows[0]?.total ?? 0) };
  const reuploadedCount = Number(contentAggRows[0]?.reuploaded ?? 0);

  // --- Phase 2b (w49-d, DEC-589 amendment; w56-b/DEC-370 amendment): fileRows
  // needs contentDetailRows' ids (this Phase's own contentDetailRows above);
  // unplacedCountRows/unplacedDetailRows need only eventId — independent of
  // each other and of fileRows, contiguous with it in the original
  // sequential order, so one more Promise.all wave. w56-b/DEC-370: the old
  // "every accepted submission id/seq/title, no LIMIT" query is gone —
  // agenda.unplaced is now a NOT EXISTS(schedule_slot) COUNT, and the
  // unplaced detail rows are their own LIMIT ROW_CAP query ordered by seq
  // (the placed set below already carries its own seq/title off the
  // schedule_slot join, so the accepted-id array has no remaining reader).
  const UNPLACED_ACCEPTED_CONDITIONS = and(
    eq(schema.submission.eventId, eventId),
    eq(schema.submission.status, "accepted"),
    sql`not exists (select 1 from ${schema.scheduleSlot} where ${schema.scheduleSlot.submissionId} = ${schema.submission.id})`,
  );
  const contentSubmissionIds = contentDetailRows.map((r) => r.id);
  const [fileRows, unplacedCountRows, unplacedDetailRows] = await Promise.all([
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
      : Promise.resolve([] as { id: string; submissionId: string | null; filename: string; previousFileId: string | null; createdAt: Date }[]),
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
  ]);
  const unplacedCount = Number(unplacedCountRows[0]?.count ?? 0);

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

  // --- Placed sessions (DEC-370 wave-56 amendment): the schedule_slot query
  // is already event- and status-scoped by its join to `submission`, so it
  // runs unconditionally (no more gate on a materialized accepted-id list)
  // — and now selects submission.seq/title off that SAME join so every
  // placed row carries its own ref/title (sessionById below no longer needs
  // a second accepted-submission lookup).
  const placedSeqTitleById = new Map<string, { seq: number; title: string }>();
  let placed: PlacedSession[] = [];
  // --- Placement-suggestion co-presenter fix (DEC-895 amendment, w2-f): the
  // ONE speakersBySubmission map below (placed ids AND capped unplaced ids)
  // is also the source for `speakerContactIds` on each unplaced row's own
  // buildPlacementSuggestion call further down this function — never a
  // second lead-only lookup.
  let speakersBySubmission: Map<string, string[]> = new Map();
  // DEC-370 (wave-71 amendment): the event's breaks are read here, joined
  // into the same wave as the placed-session slot read (both need only
  // eventId, and this is the earliest point conflicts get computed) — ONE
  // breaks read for the whole function, reused below by both the
  // conflicts wave and the §04 nextFreeSlot suggestion code, which no
  // longer re-reads it in the Phase 3 wave further down.
  let breaks: Awaited<ReturnType<typeof listBreaksForEvent>> = [];
  {
    // Both elements are wrapped as their own async calls (never a bare
    // `db.select()` chain alongside an async-function element) so BOTH
    // resolve via the native-Promise fast path Promise.all uses — a raw
    // thenable chain mixed with a wrapped async call resolves out of
    // array-literal order (the thenable's own PromiseResolveThenableJob
    // gets queued a tick later than an already-native Promise's direct
    // .then()), which silently reverses the fake-db test harnesses'
    // response-queue cursor. See test/overview*.test.ts's response arrays,
    // which assume array-literal order.
    const [slotRows, breaksRows] = await Promise.all([
      (async () =>
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
          .limit(MAX_AGENDA_SCAN + 1))(),
      listBreaksForEvent(db, eventId),
    ]);
    breaks = breaksRows;

    if (slotRows.length > MAX_AGENDA_SCAN) {
      throw new ApiError(
        "invalid",
        `This overview read would scan more than ${MAX_AGENDA_SCAN} placed sessions`,
      );
    }

    for (const s of slotRows) placedSeqTitleById.set(s.submissionId, { seq: s.seq, title: s.title });

    const placedIds = [...new Set(slotRows.map((s) => s.submissionId))];
    // --- Placement-suggestion co-presenter fix (DEC-895 amendment, w2-f): a
    // "Place at HH:MM" suggestion must avoid double-booking EVERY active
    // participant on the unplaced submission, not just its lead speaker —
    // so this same chunked participant query also covers the capped
    // unplaced ids below, and both `placed` and the unplaced-row suggestion
    // loop read off the ONE resulting speakersBySubmission map.
    const participantSubmissionIds = [...new Set([...placedIds, ...unplacedDetailRows.map((r) => r.id)])];
    const participantRows: { submissionId: string; contactId: string }[] = [];
    for (const batch of chunkIds(participantSubmissionIds)) {
      const batchRows = await db
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
        );
      participantRows.push(...batchRows);
    }
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

  // --- Unplaced rows (DEC-370 wave-56 amendment): unplacedDetailRows is
  // already the <=ROW_CAP, seq-ordered set from the NOT EXISTS query above —
  // no further slicing/filtering against a materialized accepted-id list.
  const unplacedById = new Map(unplacedDetailRows.map((r) => [r.id, r]));
  const unplacedCappedIds = unplacedDetailRows.map((r) => r.id);

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

  // --- Room names for every room already in use on the event's placed
  // sessions (DEC-652: this same bounded set doubles as the room-name
  // lookup for both the conflict rows' rooms and the nextFreeSlot
  // suggestion/resolution rooms below — no extra query).
  const placedRoomIds = [...new Set(placed.map((p) => p.roomId).filter((id): id is string => id !== null))];
  const placedDays = [...new Set(placed.map((p) => p.day))].sort();

  // --- Phase 3 (w49-d, DEC-589 amendment): leadSpeakerIds, placedRoomIds
  // and unplacedCappedIds are all sync-derived from `placed`/earlier phases
  // above (no await between them), and the three lookups they feed are
  // mutually independent of each other's results — one more Promise.all
  // wave, in the original leadSpeaker -> room -> format-answer call order.
  const [{ nameById: leadSpeakerNameById }, roomNameById, formatAnswerRows] =
    await Promise.all([
      fetchLeadSpeakers(db, [...leadSpeakerIds]),
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
        const rows: { submissionId: string; valueJson: string }[] = [];
        if (unplacedCappedIds.length > 0) {
          for (const batch of chunkIds(unplacedCappedIds)) {
            const batchRows = await db
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
              );
            rows.push(...batchRows);
          }
        }
        return rows;
      })(),
    ]);

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
  };

  // --- Comms: one aggregate query, never the whole email_log table
  // (DEC-333/DEC-334: card numbers are SQL aggregates, not materialized
  // rows spread into Math.max).
  const DAY_MS = 24 * 60 * 60 * 1000;
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

  // DEC-370 amendment (wave 5): "Public pages" quiet-row count -- reuses
  // visibleSessionConditions(), the same gate the public sessions list
  // itself applies, scoped to this event. One count query, never a
  // materialized row list.
  const publishedSessionCountRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.submission)
    .where(and(eq(schema.submission.eventId, eventId), visibleSessionConditions()));
  const publishedSessionCount = Number(publishedSessionCountRows[0]?.count ?? 0);

  return {
    "triage-counts": triage,
    review: { plans, evaluationsSubmitted, evaluationsExpected },
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

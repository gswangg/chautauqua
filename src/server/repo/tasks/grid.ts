// J6 onboarding tasks repo (DEC-023): the onboarding grid payload
// (GET /api/v1/events/:eventId/onboarding — DEC-340). Split out of
// repo/tasks.ts for contention decomposition (no behavior change) — see
// repo/tasks.ts's barrel header.

import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { chunkIds } from "../../../lib/chunk";
import { formatRef } from "../../../domain/ids";
import { likeContains } from "../like";
import { chaseableContactExistsForTaskEvent, overdueAssignmentConditions, rosterParticipantConditions } from "./crud";
import { ASSIGNED_LATE_GRACE_DAYS, overdueDayCutoff } from "../../../domain/task-due";

// DEC-789 closed set (mirrors the participant.invite_status column comment
// in db/schema.ts and the app/src/pages/speakers/types.ts InviteStatus type
// the SPA writes through PATCH /submissions/:id/participants/:participantId).
export type GridInviteStatus = "none" | "invited" | "accepted" | "declined";

export interface GridTask {
  id: string;
  kind: string;
  title: string;
  dueDate: number | null;
  required: boolean;
  // CNT-01: the task's free-text brief, so the organizer's edit modal can
  // prefill it without a second round-trip.
  instructions: string | null;
}

export interface GridCell {
  taskId: string;
  assignmentId: string;
  status: string;
  completedAt: number | null;
  fileId: string | null;
  // DEC-920: the roster's file link must name the file, not say "File" —
  // joined from schema.file in the SAME cells query below (never per-cell).
  fileName: string | null;
  fileSizeBytes: number | null;
  lastRemindedAt: number | null;
  // DEC-801: when this assignment was created — the SPA's overdue.ts feeds
  // this and the task's dueDate through effectiveAssignmentDueDate so the
  // badge/cell can't judge a task late before it was assigned.
  assignedAt: number;
}

export interface GridParticipation {
  participantId: string;
  submissionId: string;
  ref: string;
  title: string;
  inviteStatus: GridInviteStatus;
}

export interface GridRow {
  contact: {
    id: string;
    name: string;
    email: string;
    company: string | null;
    hasAccount: boolean;
    // DEC-936: EVERY participation this contact covers on this roster row,
    // ordered by submission seq -- not a lowest-id pick. Always non-empty:
    // rosterParticipantConditions (this row's base condition,
    // DEC-829) guarantees at least one matching participant exists,
    // whatever its invite status.
    participations: GridParticipation[];
  };
  cells: GridCell[];
}

export interface OnboardingGridParams {
  page: number;
  perPage: number;
  q: string | null;
  taskId: string | null;
  status: "pending" | "complete" | null;
  overdueOnly: boolean;
  // DEC-789: an optional roster-wide invite-status filter, ANDed onto the
  // same base row predicate below (never the overdue-count builder, which
  // is DEC-776's separate query). Optional/undefined == no filter, so
  // pre-existing callers that construct this params object without the
  // field keep compiling.
  inviteStatus?: GridInviteStatus | null;
  now: number;
}

export interface OnboardingGridCounts {
  speakers: number;
  outstandingRequired: number;
  overdue: number;
  outstandingContacts: number;
}

export interface OnboardingGrid {
  tasks: GridTask[];
  rows: GridRow[];
  total: number;
  page: number;
  perPage: number;
  counts: OnboardingGridCounts;
  // DEC-801 (wave 58 amendment): the owning event's IANA timezone, so the
  // SPA can apply the same day-label overdue rule the server used to build
  // `counts.overdue`/the overdueOnly filter (w58-f consumes this).
  timezone: string;
}

/** The correlated EXISTS predicate a matching contact must satisfy WHEN a
 * taskId/status/overdueOnly filter is active: at least one task_assignment,
 * for a task in this event, that satisfies EVERY active filter
 * simultaneously (DEC-312: the WHERE is normative — this is the SQL form of
 * app/src/pages/speakers/rowFilters.ts's now-deleted "one cell matching all
 * filters" semantics, preserved exactly per DEC-340). Per DEC-754/DEC-829
 * this is now an ADDITIONAL condition ANDed onto the base row condition
 * (rosterParticipantConditions) rather than the base condition itself —
 * an unfiltered grid must list the whole roster even for participants with
 * zero assignments, which no task_assignment-anchored EXISTS can express. */
function onboardingMatchExists(
  eventId: string,
  taskId: string | null,
  status: "pending" | "complete" | null,
  overdueOnly: boolean,
  now: number,
  timeZone: string,
) {
  const inner = [sql`${schema.task.eventId} = ${eventId}`];
  if (taskId) inner.push(sql`${schema.taskAssignment.taskId} = ${taskId}`);
  if (status) inner.push(sql`${schema.taskAssignment.status} = ${status}`);
  if (overdueOnly) {
    // DEC-801 (wave 58 amendment, J6): the same day-label overdue
    // computation as overdueAssignmentConditions in ./crud (this file's
    // counts.overdue), so the overdueOnly row filter and the count it
    // filters against can never disagree.
    const graceMs = ASSIGNED_LATE_GRACE_DAYS * 24 * 60 * 60 * 1000;
    const cutoff = overdueDayCutoff(now, timeZone);
    const isOverdue = sql`(case when ${schema.task.dueDate} >= ${schema.taskAssignment.createdAt} then ${schema.task.dueDate} < ${cutoff} else ${schema.taskAssignment.createdAt} + ${graceMs} < ${now} end)`;
    inner.push(
      sql`${schema.task.dueDate} is not null and ${schema.taskAssignment.status} <> 'complete' and ${isOverdue}`,
    );
  }
  const innerWhere = sql.join(inner, sql` and `);
  return sql`exists (select 1 from ${schema.taskAssignment} inner join ${schema.task} on ${schema.task.id} = ${schema.taskAssignment.taskId} where ${schema.taskAssignment.contactId} = ${schema.contact.id} and ${innerWhere})`;
}

/** Builds the J6 onboarding grid: a server-paginated, server-filtered,
 * searchable roster (DEC-340, superseding DEC-023's whole-event envelope).
 * Four bounded queries: (i) the event's tasks; (ii) the matching contact-id
 * page (one correlated-EXISTS SELECT + a matching COUNT(*)); (iii) the cells
 * for exactly those page contacts, unfiltered (every task column still
 * renders); (iv) one event-wide filter-independent aggregate for `counts`. */
export async function getOnboardingGrid(db: Db, eventId: string, params: OnboardingGridParams): Promise<OnboardingGrid> {
  // DEC-370 (wave-62 amendment): WAVE 1 — the four reads below share no
  // dependency on each other (none needs whereExpr/timezone), so they issue
  // concurrently rather than as four sequential round trips. Array order is
  // preserved from the pre-wave-62 sequential order for the call-order-based
  // mocks in this file's tests.
  const [taskRows, eventRows, speakersCountRows, countsRow] = await Promise.all([
    db
      .select({
        id: schema.task.id,
        kind: schema.task.kind,
        title: schema.task.title,
        dueDate: schema.task.dueDate,
        required: schema.task.required,
        instructions: schema.task.instructions,
      })
      .from(schema.task)
      .where(eq(schema.task.eventId, eventId))
      .orderBy(sql`${schema.task.dueDate} is null`, sql`${schema.task.dueDate} asc`, sql`${schema.task.title} asc`, sql`${schema.task.id} asc`),
    // DEC-801 (wave 58 amendment): the event row is resolved ONCE here (never
    // a second query, never per row) — this file's own comment at the old
    // DEC-936 fetch site below used to run this same select a second time,
    // after contactIdsInOrder was known; both recordPrefix (DEC-936, for
    // formatRef) and timezone (DEC-801, for the overdue day-label predicates
    // below, which fire BEFORE that later point in the function) come from
    // this one row.
    db
      .select({ recordPrefix: schema.event.recordPrefix, timezone: schema.event.timezone })
      .from(schema.event)
      .where(eq(schema.event.id, eventId))
      .limit(1),
    // DEC-754/DEC-829: `speakers` is the size of the roster itself (the SAME
    // rosterParticipantConditions predicate the base row condition below
    // composes), so it needs no timezone/whereExpr and can join wave 1.
    db
      .select({ count: sql<number>`count(distinct ${schema.contact.id})` })
      .from(schema.participant)
      .innerJoin(schema.submission, eq(schema.submission.id, schema.participant.submissionId))
      .innerJoin(schema.contact, eq(schema.contact.id, schema.participant.contactId))
      .where(rosterParticipantConditions(eventId)),
    // chaseableContactExistsForTaskEvent composes no timezone either, so
    // outstandingRequired/outstandingContacts join wave 1 too.
    db
      .select({
        outstandingRequired: sql<number>`count(distinct case when ${schema.taskAssignment.status} <> 'complete' and ${schema.task.required} = 1 then ${schema.taskAssignment.id} end)`,
        outstandingContacts: sql<number>`count(distinct case when ${schema.taskAssignment.status} <> 'complete' then ${schema.taskAssignment.contactId} end)`,
      })
      .from(schema.taskAssignment)
      .innerJoin(schema.task, eq(schema.task.id, schema.taskAssignment.taskId))
      .where(and(eq(schema.task.eventId, eventId), chaseableContactExistsForTaskEvent())),
  ]);

  const tasks: GridTask[] = taskRows.map((t) => ({
    id: t.id,
    kind: t.kind,
    title: t.title,
    dueDate: t.dueDate ? t.dueDate.getTime() : null,
    required: t.required,
    instructions: t.instructions,
  }));

  const emptyCounts: OnboardingGridCounts = {
    speakers: 0,
    outstandingRequired: 0,
    overdue: 0,
    outstandingContacts: 0,
  };

  const recordPrefix = eventRows[0]?.recordPrefix;
  const timezone = eventRows[0]?.timezone;
  if (recordPrefix === undefined || timezone === undefined) {
    throw new Error(`onboarding grid: event ${eventId} has no record prefix/timezone`);
  }

  const speakersCount = Number(speakersCountRows[0]?.count ?? 0);

  // DEC-829 (widens DEC-754), wave-29 TIER-0 amendment: the base row
  // condition used to be a correlated EXISTS against `contact` (this is the
  // defect docs/verification-log.md:3750-3759 measured — it forces the
  // outer relation to be every contact in the org). It is now
  // rosterParticipantConditions, applied as a real JOIN condition below
  // (participant -> submission scoped to submission.eventId), so the
  // driving relation is the event's own participant/submission rows, not
  // the org contact directory — `contact` is joined by id only for
  // name/company/search/ordering. Semantics unchanged: accepted-submission
  // participants regardless of invite status — still a WIDER question than
  // "who does createTask/assignToAllAccepted expand assignments over"
  // (acceptedSpeakerExistsForContact, still exact for that narrower
  // question). A taskId/status/overdueOnly filter is an ADDITIONAL
  // condition, active only when requested, so an unfiltered grid lists
  // every roster participant (assignments or not) while a filtered grid
  // narrows to those with a matching cell.
  const filterActive = params.taskId !== null || params.status !== null || params.overdueOnly;
  const conditions = [rosterParticipantConditions(eventId)];
  if (filterActive) {
    conditions.push(onboardingMatchExists(eventId, params.taskId, params.status, params.overdueOnly, params.now, timezone));
  }
  // DEC-789/DEC-829: the invite-status filter is a SEPARATE predicate from
  // the base rosterParticipantConditions condition above (which now
  // ranges over ALL four invite statuses, not just ACTIVE_INVITE_STATUSES)
  // -- ANDed here, on the same row query and composing the same
  // rosterParticipantConditions as the base condition, so a filter pill
  // narrows the SAME set the unfiltered grid lists rather than a
  // differently-defined one.
  if (params.inviteStatus) {
    const wantedStatus = params.inviteStatus;
    conditions.push(
      sql`exists (select 1 from ${schema.participant} inner join ${schema.submission} on ${schema.submission.id} = ${schema.participant.submissionId} where ${schema.participant.contactId} = ${schema.contact.id} and ${rosterParticipantConditions(eventId)} and ${schema.participant.inviteStatus} = ${wantedStatus})`,
    );
  }
  if (params.q) {
    const like = likeContains(params.q);
    conditions.push(
      sql`(${schema.contact.firstName} like ${like} escape '\\' or ${schema.contact.lastName} like ${like} escape '\\' or ${schema.contact.email} like ${like} escape '\\')`,
    );
  }
  const whereExpr = and(...conditions);

  const offset = (params.page - 1) * params.perPage;

  // DEC-370 (wave-62 amendment): WAVE 2 — these three reads all need
  // whereExpr/timezone (which is why eventRows had to land in wave 1
  // first), but not each other, so they issue concurrently. Array order
  // matches the pre-wave-62 sequential order (totalRows, contactRows,
  // overdueCountRows) for the call-order-based mocks in this file's tests.
  const [totalRows, contactRows, overdueCountRows] = await Promise.all([
    // DEC-829 wave-29: driving relation is participant JOIN submission
    // (scoped by rosterParticipantConditions's submission.eventId/status
    // conditions above), never `contact` alone — `contact` is joined by id
    // only to read name/company/search/ordering columns. `count(distinct
    // contact.id)` collapses the (rare, DEC-936) case of a contact holding
    // more than one accepted participation on this event to one roster row,
    // matching the page SELECT's GROUP BY below.
    db
      .select({ count: sql<number>`count(distinct ${schema.contact.id})` })
      .from(schema.participant)
      .innerJoin(schema.submission, eq(schema.submission.id, schema.participant.submissionId))
      .innerJoin(schema.contact, eq(schema.contact.id, schema.participant.contactId))
      .where(whereExpr),
    // Same driving relation as totalRows, GROUP BY contact.id so a contact
    // with more than one accepted participation on this event still yields
    // exactly one page row (the non-grouped columns are all functionally
    // dependent on contact.id, which SQLite's bare-column GROUP BY allows).
    db
      .select({
        id: schema.contact.id,
        firstName: schema.contact.firstName,
        lastName: schema.contact.lastName,
        email: schema.contact.email,
        company: schema.contact.company,
        userId: schema.user.id,
      })
      .from(schema.participant)
      .innerJoin(schema.submission, eq(schema.submission.id, schema.participant.submissionId))
      .innerJoin(schema.contact, eq(schema.contact.id, schema.participant.contactId))
      .leftJoin(schema.user, eq(schema.user.contactId, schema.contact.id))
      .where(whereExpr)
      .groupBy(schema.contact.id)
      .orderBy(sql`lower(${schema.contact.lastName}) asc, lower(${schema.contact.firstName}) asc, ${schema.contact.id} asc`)
      .limit(params.perPage)
      .offset(offset),
    // DEC-776: `overdue` is a separate query (rather than folded into the
    // countsRow query above) because it composes overdueAssignmentConditions,
    // which needs a join to `contact` to enforce the roster predicate — a
    // task_assignment for a contact who is no longer an accepted speaker
    // (e.g. their submission was withdrawn after the task was assigned) must
    // not inflate this count.
    db
      .select({ count: sql<number>`count(distinct ${schema.taskAssignment.id})` })
      .from(schema.taskAssignment)
      .innerJoin(schema.task, eq(schema.task.id, schema.taskAssignment.taskId))
      .innerJoin(schema.contact, eq(schema.contact.id, schema.taskAssignment.contactId))
      .where(overdueAssignmentConditions(eventId, params.now, timezone)),
  ]);
  const total = Number(totalRows[0]?.count ?? 0);
  const overdueCount = Number(overdueCountRows[0]?.count ?? 0);

  // A left join to `user` may repeat a row only when a contact has more than
  // one user account, which the app never creates — dedupe defensively.
  const rowsByContact = new Map<string, GridRow>();
  const contactIdsInOrder: string[] = [];
  for (const c of contactRows) {
    let row = rowsByContact.get(c.id);
    if (!row) {
      row = {
        contact: {
          id: c.id,
          name: `${c.firstName} ${c.lastName}`.trim(),
          email: c.email,
          company: c.company,
          hasAccount: false,
          participations: [],
        },
        cells: [],
      };
      rowsByContact.set(c.id, row);
      contactIdsInOrder.push(c.id);
    }
    if (c.userId) row.contact.hasAccount = true;
  }

  // Cells for exactly those page contacts, carrying ALL their cells
  // unfiltered so every task column still renders — chunked per DEC-104 so
  // the page's contact ids never reach inArray unbounded.
  const taskIds = tasks.map((t) => t.id);

  // DEC-370 (wave-62 amendment): WAVE 3 — one Promise.all covering BOTH
  // chunk loops (participations and cells) across every batch of
  // contactIdsInOrder. Neither loop depends on the other's results, so all
  // their per-batch queries issue concurrently. The flat array preserves
  // the pre-wave-62 sequential order (every participation batch, in order,
  // followed by every cell batch, in order) for the call-order-based mocks
  // in this file's tests; results are split back apart by length below so
  // the participation throw still fires (in SOURCE order) before any cell
  // row is processed.
  const contactBatches = contactIdsInOrder.length > 0 ? chunkIds(contactIdsInOrder) : [];
  const participationPromises = contactBatches.map((batch) =>
    // DEC-936: EVERY participation a roster row covers, built from ONE
    // grouped query over the page's contact ids (chunked per DEC-078) —
    // never a subquery per column, never a query per row. Joins participant
    // -> submission composing rosterParticipantConditions (DEC-829, the
    // same predicate the base row condition above requires), ordered by
    // submission seq so a contact with more than one accepted participation
    // lists them in a stable, meaningful order.
    db
      .select({
        contactId: schema.participant.contactId,
        participantId: schema.participant.id,
        submissionId: schema.participant.submissionId,
        submissionSeq: schema.submission.seq,
        submissionTitle: schema.submission.title,
        inviteStatus: schema.participant.inviteStatus,
      })
      .from(schema.participant)
      .innerJoin(schema.submission, eq(schema.submission.id, schema.participant.submissionId))
      .where(and(inArray(schema.participant.contactId, batch), rosterParticipantConditions(eventId)))
      .orderBy(sql`${schema.submission.seq} asc`, sql`${schema.participant.id} asc`),
  );
  const cellPromises =
    taskIds.length > 0
      ? contactBatches.map((batch) =>
          db
            .select({
              assignmentId: schema.taskAssignment.id,
              taskId: schema.taskAssignment.taskId,
              status: schema.taskAssignment.status,
              completedAt: schema.taskAssignment.completedAt,
              fileId: schema.taskAssignment.fileId,
              fileName: schema.file.filename,
              fileSizeBytes: schema.file.sizeBytes,
              lastRemindedAt: schema.taskAssignment.lastRemindedAt,
              contactId: schema.taskAssignment.contactId,
              createdAt: schema.taskAssignment.createdAt,
            })
            .from(schema.taskAssignment)
            .leftJoin(schema.file, eq(schema.file.id, schema.taskAssignment.fileId))
            .where(and(inArray(schema.taskAssignment.contactId, batch), inArray(schema.taskAssignment.taskId, taskIds))),
        )
      : [];
  // Every query in both arrays above is already issued (db.select executes
  // eagerly when built) before this Promise.all runs, so nesting here (to
  // keep the two result shapes distinct for the type checker) does not
  // change issuance order or concurrency — it is still one wave.
  const [participationBatches, cellBatches] = await Promise.all([Promise.all(participationPromises), Promise.all(cellPromises)]);

  for (const participationRows of participationBatches) {
    for (const p of participationRows) {
      const row = rowsByContact.get(p.contactId);
      if (!row) continue;
      row.contact.participations.push({
        participantId: p.participantId,
        submissionId: p.submissionId,
        ref: formatRef(recordPrefix, p.submissionSeq),
        title: p.submissionTitle,
        inviteStatus: p.inviteStatus as GridInviteStatus,
      });
    }
  }

  // rosterParticipantConditions (this row set's base condition,
  // DEC-829) guarantees at least one matching participant per contact —
  // fail loudly instead of silently rendering an impossible empty roster
  // control if that invariant is ever violated.
  for (const row of rowsByContact.values()) {
    if (row.contact.participations.length === 0) {
      throw new Error(`onboarding grid: contact ${row.contact.id} matched the accepted-speaker predicate but has no participant row`);
    }
  }

  for (const cellRows of cellBatches) {
    for (const r of cellRows) {
      const row = rowsByContact.get(r.contactId);
      if (!row) continue;
      // schema.file.filename/sizeBytes are notNull columns (DEC-920) — a
      // non-null fileId whose file row didn't resolve through the join is
      // a broken reference, not a "no file" state. Fail loudly rather
      // than falling back to a generic "Has file" label.
      if (r.fileId != null && r.fileName == null) {
        throw new Error(`onboarding grid: assignment ${r.assignmentId} has fileId ${r.fileId} that does not resolve to a file row`);
      }
      row.cells.push({
        taskId: r.taskId,
        assignmentId: r.assignmentId,
        status: r.status,
        completedAt: r.completedAt ? r.completedAt.getTime() : null,
        fileId: r.fileId,
        fileName: r.fileName,
        fileSizeBytes: r.fileSizeBytes,
        lastRemindedAt: r.lastRemindedAt ? r.lastRemindedAt.getTime() : null,
        assignedAt: r.createdAt.getTime(),
      });
    }
  }

  const rows = contactIdsInOrder.map((id) => rowsByContact.get(id)).filter((r): r is GridRow => r !== undefined);

  // DEC-776 amendment (wave 61): the three header numbers each range over a
  // DIFFERENT population — `speakers` is the roster itself
  // (rosterParticipantConditions: every accepted-submission participant,
  // including 'invited'/'declined'); `outstandingRequired`/`outstandingContacts`
  // and `overdue` both range over the NARROWER "still owes something" set
  // (chaseableContactExistsForTaskEvent / overdueAssignmentConditions:
  // accepted submission AND invite status still 'none' or 'accepted'), so a
  // contact who declines their invite (or whose submission left 'accepted')
  // stops inflating any of the three "open work" counts while still showing
  // up as a roster row.
  const counts: OnboardingGridCounts = countsRow[0]
    ? {
        speakers: speakersCount,
        outstandingRequired: Number(countsRow[0].outstandingRequired),
        overdue: overdueCount,
        outstandingContacts: Number(countsRow[0].outstandingContacts),
      }
    : { ...emptyCounts, speakers: speakersCount, overdue: overdueCount };

  return { tasks, rows, total, page: params.page, perPage: params.perPage, counts, timezone };
}

// J6 onboarding tasks repo (DEC-023): the onboarding grid payload
// (GET /api/v1/events/:eventId/onboarding — DEC-340). Split out of
// repo/tasks.ts for contention decomposition (no behavior change) — see
// repo/tasks.ts's barrel header.

import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { chunkIds } from "../../../lib/chunk";
import { likeContains } from "../like";
import { acceptedSpeakerConditions, acceptedSpeakerExistsForContact, overdueAssignmentConditions } from "./crud";

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
}

export interface GridCell {
  taskId: string;
  assignmentId: string;
  status: string;
  completedAt: number | null;
  fileId: string | null;
  lastRemindedAt: number | null;
}

export interface GridRow {
  contact: {
    id: string;
    name: string;
    email: string;
    company: string | null;
    hasAccount: boolean;
    // DEC-789: the participant row backing this roster contact's invite
    // status control -- participantId/submissionId together name the PATCH
    // target (/submissions/:submissionId/participants/:participantId).
    // Always populated: acceptedSpeakerExistsForContact (this row's base
    // condition) guarantees at least one matching participant exists.
    participantId: string;
    submissionId: string;
    inviteStatus: GridInviteStatus;
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
}

/** The correlated EXISTS predicate a matching contact must satisfy WHEN a
 * taskId/status/overdueOnly filter is active: at least one task_assignment,
 * for a task in this event, that satisfies EVERY active filter
 * simultaneously (DEC-312: the WHERE is normative — this is the SQL form of
 * app/src/pages/speakers/rowFilters.ts's now-deleted "one cell matching all
 * filters" semantics, preserved exactly per DEC-340). Per DEC-754 this is
 * now an ADDITIONAL condition ANDed onto the base row condition
 * (acceptedSpeakerExistsForContact) rather than the base condition itself —
 * an unfiltered grid must list the accepted roster even for speakers with
 * zero assignments, which no task_assignment-anchored EXISTS can express. */
function onboardingMatchExists(
  eventId: string,
  taskId: string | null,
  status: "pending" | "complete" | null,
  overdueOnly: boolean,
  now: number,
) {
  const inner = [sql`${schema.task.eventId} = ${eventId}`];
  if (taskId) inner.push(sql`${schema.taskAssignment.taskId} = ${taskId}`);
  if (status) inner.push(sql`${schema.taskAssignment.status} = ${status}`);
  if (overdueOnly) {
    inner.push(
      sql`${schema.task.dueDate} is not null and ${schema.taskAssignment.status} <> 'complete' and ${schema.task.dueDate} < ${now}`,
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
  const taskRows = await db
    .select({
      id: schema.task.id,
      kind: schema.task.kind,
      title: schema.task.title,
      dueDate: schema.task.dueDate,
      required: schema.task.required,
    })
    .from(schema.task)
    .where(eq(schema.task.eventId, eventId))
    .orderBy(sql`${schema.task.dueDate} is null`, sql`${schema.task.dueDate} asc`, sql`${schema.task.title} asc`, sql`${schema.task.id} asc`);

  const tasks: GridTask[] = taskRows.map((t) => ({
    id: t.id,
    kind: t.kind,
    title: t.title,
    dueDate: t.dueDate ? t.dueDate.getTime() : null,
    required: t.required,
  }));

  const emptyCounts: OnboardingGridCounts = {
    speakers: 0,
    outstandingRequired: 0,
    overdue: 0,
    outstandingContacts: 0,
  };

  if (tasks.length === 0) {
    return { tasks: [], rows: [], total: 0, page: params.page, perPage: params.perPage, counts: emptyCounts };
  }

  // DEC-754: the base row condition is the accepted-speaker predicate
  // (contact-only EXISTS, no join to `contact`) — the SAME set createTask
  // expands assignments over. A taskId/status/overdueOnly filter is an
  // ADDITIONAL condition, active only when requested, so an unfiltered
  // grid lists every accepted speaker (assignments or not) while a
  // filtered grid narrows to those with a matching cell.
  const filterActive = params.taskId !== null || params.status !== null || params.overdueOnly;
  const conditions = [acceptedSpeakerExistsForContact(eventId)];
  if (filterActive) {
    conditions.push(onboardingMatchExists(eventId, params.taskId, params.status, params.overdueOnly, params.now));
  }
  // DEC-789: the invite-status filter is a SEPARATE predicate from the base
  // acceptedSpeakerExistsForContact condition above (which already requires
  // ACTIVE_INVITE_STATUSES) -- ANDed here, on the same row query, so a
  // filter value outside 'none'/'accepted' correctly yields zero rows
  // rather than silently matching the whole roster.
  if (params.inviteStatus) {
    const wantedStatus = params.inviteStatus;
    conditions.push(
      sql`exists (select 1 from ${schema.participant} inner join ${schema.submission} on ${schema.submission.id} = ${schema.participant.submissionId} where ${schema.participant.contactId} = ${schema.contact.id} and ${acceptedSpeakerConditions(eventId)} and ${schema.participant.inviteStatus} = ${wantedStatus})`,
    );
  }
  if (params.q) {
    const like = likeContains(params.q.toLowerCase());
    conditions.push(
      sql`(lower(${schema.contact.firstName}) like ${like} escape '\\' or lower(${schema.contact.lastName}) like ${like} escape '\\' or lower(${schema.contact.email}) like ${like} escape '\\')`,
    );
  }
  const whereExpr = and(...conditions);

  const totalRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.contact)
    .where(whereExpr);
  const total = Number(totalRows[0]?.count ?? 0);

  const offset = (params.page - 1) * params.perPage;
  // DEC-789: the roster row's invite-status control needs a single
  // (participantId, submissionId, inviteStatus) triple per contact. A
  // contact can carry more than one accepted participant row across
  // submissions in the same event; these correlated scalar subqueries
  // (ordered by participant.id for a deterministic pick, same
  // acceptedSpeakerConditions the base row predicate already requires)
  // pick exactly one, in the SAME select as the rest of the row -- no
  // separate query to drift from the row set.
  const participantIdSubquery = sql<string>`(select ${schema.participant.id} from ${schema.participant} inner join ${schema.submission} on ${schema.submission.id} = ${schema.participant.submissionId} where ${schema.participant.contactId} = ${schema.contact.id} and ${acceptedSpeakerConditions(eventId)} order by ${schema.participant.id} asc limit 1)`;
  const submissionIdSubquery = sql<string>`(select ${schema.participant.submissionId} from ${schema.participant} inner join ${schema.submission} on ${schema.submission.id} = ${schema.participant.submissionId} where ${schema.participant.contactId} = ${schema.contact.id} and ${acceptedSpeakerConditions(eventId)} order by ${schema.participant.id} asc limit 1)`;
  const inviteStatusSubquery = sql<string>`(select ${schema.participant.inviteStatus} from ${schema.participant} inner join ${schema.submission} on ${schema.submission.id} = ${schema.participant.submissionId} where ${schema.participant.contactId} = ${schema.contact.id} and ${acceptedSpeakerConditions(eventId)} order by ${schema.participant.id} asc limit 1)`;

  const contactRows = await db
    .select({
      id: schema.contact.id,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      email: schema.contact.email,
      company: schema.contact.company,
      userId: schema.user.id,
      participantId: participantIdSubquery,
      submissionId: submissionIdSubquery,
      inviteStatus: inviteStatusSubquery,
    })
    .from(schema.contact)
    .leftJoin(schema.user, eq(schema.user.contactId, schema.contact.id))
    .where(whereExpr)
    .orderBy(sql`lower(${schema.contact.lastName}) asc, lower(${schema.contact.firstName}) asc, ${schema.contact.id} asc`)
    .limit(params.perPage)
    .offset(offset);

  // A left join to `user` may repeat a row only when a contact has more than
  // one user account, which the app never creates — dedupe defensively.
  const rowsByContact = new Map<string, GridRow>();
  const contactIdsInOrder: string[] = [];
  for (const c of contactRows) {
    let row = rowsByContact.get(c.id);
    if (!row) {
      // acceptedSpeakerExistsForContact (this row set's base condition)
      // guarantees at least one matching participant, so the scalar
      // subqueries above can never come back null here — fail loudly
      // instead of silently defaulting if that invariant is ever violated.
      if (c.participantId == null || c.submissionId == null || c.inviteStatus == null) {
        throw new Error(`onboarding grid: contact ${c.id} matched the accepted-speaker predicate but has no participant row`);
      }
      row = {
        contact: {
          id: c.id,
          name: `${c.firstName} ${c.lastName}`.trim(),
          email: c.email,
          company: c.company,
          hasAccount: false,
          participantId: c.participantId,
          submissionId: c.submissionId,
          inviteStatus: c.inviteStatus as GridInviteStatus,
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
  if (contactIdsInOrder.length > 0 && taskIds.length > 0) {
    for (const batch of chunkIds(contactIdsInOrder)) {
      const cellRows = await db
        .select({
          assignmentId: schema.taskAssignment.id,
          taskId: schema.taskAssignment.taskId,
          status: schema.taskAssignment.status,
          completedAt: schema.taskAssignment.completedAt,
          fileId: schema.taskAssignment.fileId,
          lastRemindedAt: schema.taskAssignment.lastRemindedAt,
          contactId: schema.taskAssignment.contactId,
        })
        .from(schema.taskAssignment)
        .where(and(inArray(schema.taskAssignment.contactId, batch), inArray(schema.taskAssignment.taskId, taskIds)));
      for (const r of cellRows) {
        const row = rowsByContact.get(r.contactId);
        if (!row) continue;
        row.cells.push({
          taskId: r.taskId,
          assignmentId: r.assignmentId,
          status: r.status,
          completedAt: r.completedAt ? r.completedAt.getTime() : null,
          fileId: r.fileId,
          lastRemindedAt: r.lastRemindedAt ? r.lastRemindedAt.getTime() : null,
        });
      }
    }
  }

  const rows = contactIdsInOrder.map((id) => rowsByContact.get(id)).filter((r): r is GridRow => r !== undefined);

  // Event-wide aggregate, filter- and page-independent (DEC-333/334): SQL
  // COUNT forms, never materialized rows. DEC-754: `speakers` is the size
  // of the accepted roster itself (the base row condition), NOT
  // count(distinct taskAssignment.contactId) — an accepted speaker with
  // zero assignments is still one of the `speakers` this grid counts.
  const speakersCountRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.contact)
    .where(acceptedSpeakerExistsForContact(eventId));
  const speakersCount = Number(speakersCountRows[0]?.count ?? 0);

  const countsRow = await db
    .select({
      outstandingRequired: sql<number>`count(distinct case when ${schema.taskAssignment.status} <> 'complete' and ${schema.task.required} = 1 then ${schema.taskAssignment.id} end)`,
      outstandingContacts: sql<number>`count(distinct case when ${schema.taskAssignment.status} <> 'complete' then ${schema.taskAssignment.contactId} end)`,
    })
    .from(schema.taskAssignment)
    .innerJoin(schema.task, eq(schema.task.id, schema.taskAssignment.taskId))
    .where(eq(schema.task.eventId, eventId));

  // DEC-776: `overdue` is a separate query (rather than folded into the
  // count above) because it composes overdueAssignmentConditions, which
  // needs a join to `contact` to enforce the roster predicate — a
  // task_assignment for a contact who is no longer an accepted speaker
  // (e.g. their submission was withdrawn after the task was assigned) must
  // not inflate this count.
  const overdueCountRows = await db
    .select({ count: sql<number>`count(distinct ${schema.taskAssignment.id})` })
    .from(schema.taskAssignment)
    .innerJoin(schema.task, eq(schema.task.id, schema.taskAssignment.taskId))
    .innerJoin(schema.contact, eq(schema.contact.id, schema.taskAssignment.contactId))
    .where(overdueAssignmentConditions(eventId, params.now));
  const overdueCount = Number(overdueCountRows[0]?.count ?? 0);

  const counts: OnboardingGridCounts = countsRow[0]
    ? {
        speakers: speakersCount,
        outstandingRequired: Number(countsRow[0].outstandingRequired),
        overdue: overdueCount,
        outstandingContacts: Number(countsRow[0].outstandingContacts),
      }
    : { ...emptyCounts, speakers: speakersCount, overdue: overdueCount };

  return { tasks, rows, total, page: params.page, perPage: params.perPage, counts };
}

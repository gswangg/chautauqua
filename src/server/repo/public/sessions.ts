// Public/embed repo layer (J10, DEC-022, DEC-274): sessions list + the
// shared hydrateSessions() used by list/agenda/detail. Per DEC-012 this is
// one of the only modules that touches drizzle row types for public data.
// The standalone speaker-hydration query in hydrateSessions applies
// visibleParticipantConditions() directly, since it does not route through
// visibleSubmissionConditions().

import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { formatRef } from "../../../domain/ids";
import { chunkIds } from "../../../lib/chunk";
import { DEC_258 } from "../../../decisions";
import { answerFieldRoleCondition, roleAnswerMap } from "../form-roles";
import { likeContains } from "../like";
import { visibleParticipantConditions, visibleSessionConditions, slotWithinEventRange } from "./gates";
import type { PublicEvent, PublicTrack } from "./event";
import { boundedRowLimit, boundedWindow } from "./bounds";

// Compile-checked dependency marker: every speaker title/company read below
// comes from participant.title_at_time/org_at_time (DEC-258's frozen
// snapshot), never the live contact — no fallback.
void DEC_258;

export interface PublicSpeaker {
  contactId: string;
  firstName: string;
  lastName: string;
  title: string | null;
  company: string | null;
  headshotUrl: string | null;
  bio: string | null;
}

export interface PublicSession {
  id: string;
  ref: string;
  title: string;
  description: string | null;
  // current SEQUENCE for .ics export — bumped by the caller on
  // schedule-affecting changes (DEC-007); threaded through so schedule.ics
  // never has to re-query it.
  icsSequence: number;
  tracks: PublicTrack[];
  speakers: PublicSpeaker[];
  // EMB-01: scheduled placement, when a schedule_slot exists for this
  // submission — all null together when unscheduled. Cards render nothing
  // (not a dash pile) when these are null (see SessionCard in public.tsx).
  day: string | null;
  startMin: number | null;
  endMin: number | null;
  roomName: string | null;
  // EMB-01/EMB-08: the submission's answer to the session_format-role
  // dropdown, when the event's form has that field and an answer was given.
  // null when either is absent — cards/detail render nothing (never a
  // labelled blank) in that case.
  format: string | null;
}

/** Builds the case-insensitive substring condition for the EMB-02 keyword
 * search: submission title OR either name field of a (still
 * visibility-gated, via the caller's join) participant contact. DEC-506:
 * the search term is escaped via likeContains and paired with
 * `ESCAPE '\\'` so a literal `%`/`_` in the query string
 * can't widen into a wildcard match (unescaped LIKE previously let
 * `?q=%` return every visible session). Always parameterized (via the
 * Drizzle `sql` tag), never string-concatenated into SQL. */
export function searchCondition(q: string) {
  const like = likeContains(q);
  return or(
    sql`${schema.submission.title} LIKE ${like} ESCAPE '\\'`,
    sql`${schema.contact.firstName} LIKE ${like} ESCAPE '\\'`,
    sql`${schema.contact.lastName} LIKE ${like} ESCAPE '\\'`,
  );
}

/** DEC-774: format-filter predicate — an EXISTS on submission_answer for
 * the role-tagged session_format field (form_field.role, DEC-592/DEC-755)
 * with an exact value match (valueJson is the JSON-encoded answer, so the
 * compare is against JSON.stringify of the requested format — never a
 * substring/LIKE match). Added directly to baseConditions (shared by every
 * trackId/day branch below) rather than a new join, so it composes with
 * every existing branch without multiplying them. */
export function formatFilterCondition(format: string) {
  return sql`EXISTS (SELECT 1 FROM ${schema.submissionAnswer} INNER JOIN ${schema.formField} ON ${schema.formField.id} = ${schema.submissionAnswer.formFieldId} WHERE ${schema.submissionAnswer.submissionId} = ${schema.submission.id} AND ${schema.formField.role} = ${"session_format"} AND ${schema.submissionAnswer.valueJson} = ${JSON.stringify(format)})`;
}

/** DEC-774: room-filter predicate — an EXISTS on schedule_slot for the
 * requested room_id, bounded to the event's own date range (DEC-318, same
 * rule as slotWithinEventRange/dayFilterJoinCondition) so a slot dated
 * outside the event window can't satisfy the filter. An unplaced session
 * has no matching row and is excluded while a room filter is active — this
 * is a separate EXISTS (not the day branch's innerJoin), so it composes
 * with every trackId/day branch without multiplying them. */
function roomFilterCondition(event: Pick<PublicEvent, "startDate" | "endDate">, roomId: string) {
  return sql`EXISTS (SELECT 1 FROM ${schema.scheduleSlot} WHERE ${schema.scheduleSlot.submissionId} = ${schema.submission.id} AND ${schema.scheduleSlot.roomId} = ${roomId} AND ${schema.scheduleSlot.day} >= ${event.startDate} AND ${schema.scheduleSlot.day} <= ${event.endDate})`;
}

/** DEC-634: day-filter join condition — joins schedule_slot to the
 * submission being tested and applies the SAME event-window rule
 * (slotWithinEventRange, DEC-318) that already decides whether a session
 * reports a day at all in hydrateSessions below, plus the requested day.
 * A submission with no in-window slot never joins a row here, so it
 * matches no day filter — identical to how it renders unscheduled. Callers
 * innerJoin schema.scheduleSlot on this condition (never a post-filter),
 * so LIMIT/OFFSET and COUNT see the identical predicate. */
function dayFilterJoinCondition(event: Pick<PublicEvent, "startDate" | "endDate">, day: string) {
  return and(
    eq(schema.scheduleSlot.submissionId, schema.submission.id),
    slotWithinEventRange(event),
    eq(schema.scheduleSlot.day, day),
  );
}

/** DEC-534: the sessions list's ordering join — the same submission_id +
 * slotWithinEventRange bound that dayFilterJoinCondition and hydrateSessions
 * already apply, minus the day equality. schedule_slot has at most one row
 * per submission_id (unique index — the same assumption hydrateSessions'
 * batched slot read relies on), so this leftJoin cannot multiply rows.
 * Shared by the trackId-only and unfiltered branches below, which otherwise
 * have no schedule_slot join to order by. */
function scheduleOrderJoinCondition(event: Pick<PublicEvent, "startDate" | "endDate">) {
  return and(eq(schema.scheduleSlot.submissionId, schema.submission.id), slotWithinEventRange(event));
}

/** DEC-534: ONE shared ordering expression for every branch of the sessions
 * list — scheduled rows sort by day, then startMin, then endMin; every
 * unscheduled row (schedule_slot.day IS NULL — the day-filtered branches
 * never see this case, since dayFilterJoinCondition's innerJoin excludes
 * unscheduled rows entirely) sorts after every scheduled row. title, then
 * id are the final tiebreakers throughout — id keeps the page order
 * deterministic under DISTINCT even when two sessions share a title (the
 * property DEC-534 already required of the pre-existing title/id order).
 * A single `sql` template (mirrors submissions/list.ts's orderByForSort
 * pattern) rather than an array of asc()/desc() calls, so it composes as
 * ONE .orderBy() argument in every branch below. */
function sessionOrderBy() {
  return sql`case when ${schema.scheduleSlot.day} is null then 1 else 0 end asc, ${schema.scheduleSlot.day} asc, ${schema.scheduleSlot.startMin} asc, ${schema.scheduleSlot.endMin} asc, ${schema.submission.title} asc, ${schema.submission.id} asc`;
}

/** Distinct, visibility-gated, optionally track/day-filtered and/or keyword-
 * filtered submission ids for an event, ordered by title — the stable
 * pagination order for the sessions list. Track filtering (DEC-080) is a
 * single innerJoin on submission_track with eq(trackId) in the main query
 * — one bound param, no id list at all. Day filtering (DEC-634) is a single
 * innerJoin on schedule_slot via dayFilterJoinCondition — same event-window
 * rule as hydrateSessions, so a session with no in-window slot never
 * matches. Keyword search (EMB-02) joins contact (already reachable via
 * participant, which every query here joins for the visibility gate) and
 * filters server-side only — the visibility gate conditions are always
 * included alongside it, never bypassed.
 * DEC-418: bounded by `limit` (SQL LIMIT, not a JS .slice()) — at SPEC.md:73-76
 * scale the unbounded query would return thousands of rows from D1 to
 * render 24 cards. Callers pair this with countVisibleSubmissions() for the
 * page total. */
async function getVisibleSubmissionIdsOrdered(
  db: Db,
  event: Pick<PublicEvent, "id" | "startDate" | "endDate">,
  trackId: string | null,
  q: string | null,
  day: string | null,
  limit: number,
  offset: number,
  format: string | null,
  roomId: string | null,
): Promise<Array<{ id: string }>> {
  const baseConditions = [eq(schema.submission.eventId, event.id), visibleSessionConditions()];
  if (q) baseConditions.push(searchCondition(q));
  if (format) baseConditions.push(formatFilterCondition(format));
  if (roomId) baseConditions.push(roomFilterCondition(event, roomId));

  if (trackId && day) {
    const query = db
      .selectDistinct({ id: schema.submission.id, title: schema.submission.title })
      .from(schema.submission)
      .leftJoin(
        schema.participant,
        and(eq(schema.participant.submissionId, schema.submission.id), visibleParticipantConditions()),
      )
      .leftJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
      .innerJoin(schema.submissionTrack, eq(schema.submissionTrack.submissionId, schema.submission.id))
      .innerJoin(schema.scheduleSlot, dayFilterJoinCondition(event, day))
      .where(and(...baseConditions, eq(schema.submissionTrack.trackId, trackId)))
      .orderBy(sessionOrderBy())
      .limit(limit);
    const rows = await (offset > 0 ? query.offset(offset) : query);
    return rows;
  }

  if (trackId) {
    const query = db
      .selectDistinct({ id: schema.submission.id, title: schema.submission.title })
      .from(schema.submission)
      .leftJoin(
        schema.participant,
        and(eq(schema.participant.submissionId, schema.submission.id), visibleParticipantConditions()),
      )
      .leftJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
      .innerJoin(schema.submissionTrack, eq(schema.submissionTrack.submissionId, schema.submission.id))
      .leftJoin(schema.scheduleSlot, scheduleOrderJoinCondition(event))
      .where(and(...baseConditions, eq(schema.submissionTrack.trackId, trackId)))
      // DEC-534: shared ordering — see sessionOrderBy(). submission.id
      // remains a tiebreaker (title alone is not unique), and stays safe
      // under DISTINCT since it's already in the selectDistinct projection.
      .orderBy(sessionOrderBy())
      .limit(limit);
    // DEC-516: offset() is only chained when non-zero — page-1 (offset 0)
    // stays the identical query shape whether windowed or cumulative, so
    // existing fake-db-chain harnesses that stub .limit() as the terminal
    // call keep working unmodified.
    const rows = await (offset > 0 ? query.offset(offset) : query);
    return rows;
  }

  if (day) {
    const query = db
      .selectDistinct({ id: schema.submission.id, title: schema.submission.title })
      .from(schema.submission)
      .leftJoin(
        schema.participant,
        and(eq(schema.participant.submissionId, schema.submission.id), visibleParticipantConditions()),
      )
      .leftJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
      .innerJoin(schema.scheduleSlot, dayFilterJoinCondition(event, day))
      .where(and(...baseConditions))
      .orderBy(sessionOrderBy())
      .limit(limit);
    const rows = await (offset > 0 ? query.offset(offset) : query);
    return rows;
  }

  const query = db
    .selectDistinct({ id: schema.submission.id, title: schema.submission.title })
    .from(schema.submission)
    .leftJoin(
      schema.participant,
      and(eq(schema.participant.submissionId, schema.submission.id), visibleParticipantConditions()),
    )
    .leftJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
    .leftJoin(schema.scheduleSlot, scheduleOrderJoinCondition(event))
    .where(and(...baseConditions))
    // DEC-534: shared ordering — see sessionOrderBy() (title/id tiebreaker
    // rationale unchanged from the trackId branch above).
    .orderBy(sessionOrderBy())
    .limit(limit);
  const rows = await (offset > 0 ? query.offset(offset) : query);
  return rows;
}

/** Total count of distinct visibility-gated (optionally track/day/keyword
 * filtered) submissions for an event — the identical joins and where-
 * conditions as getVisibleSubmissionIdsOrdered(), but a single count(distinct)
 * row instead of materializing every id. Used alongside the bounded id query
 * above to compute the page total without an unbounded scan. */
async function countVisibleSubmissions(
  db: Db,
  event: Pick<PublicEvent, "id" | "startDate" | "endDate">,
  trackId: string | null,
  q: string | null,
  day: string | null,
  format: string | null,
  roomId: string | null,
): Promise<number> {
  const baseConditions = [eq(schema.submission.eventId, event.id), visibleSessionConditions()];
  if (q) baseConditions.push(searchCondition(q));
  if (format) baseConditions.push(formatFilterCondition(format));
  if (roomId) baseConditions.push(roomFilterCondition(event, roomId));

  if (trackId && day) {
    const rows = await db
      .select({ count: sql<number>`count(distinct ${schema.submission.id})` })
      .from(schema.submission)
      .leftJoin(
        schema.participant,
        and(eq(schema.participant.submissionId, schema.submission.id), visibleParticipantConditions()),
      )
      .leftJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
      .innerJoin(schema.submissionTrack, eq(schema.submissionTrack.submissionId, schema.submission.id))
      .innerJoin(schema.scheduleSlot, dayFilterJoinCondition(event, day))
      .where(and(...baseConditions, eq(schema.submissionTrack.trackId, trackId)));
    return Number(rows[0]?.count ?? 0);
  }

  if (trackId) {
    const rows = await db
      .select({ count: sql<number>`count(distinct ${schema.submission.id})` })
      .from(schema.submission)
      .leftJoin(
        schema.participant,
        and(eq(schema.participant.submissionId, schema.submission.id), visibleParticipantConditions()),
      )
      .leftJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
      .innerJoin(schema.submissionTrack, eq(schema.submissionTrack.submissionId, schema.submission.id))
      .where(and(...baseConditions, eq(schema.submissionTrack.trackId, trackId)));
    return Number(rows[0]?.count ?? 0);
  }

  if (day) {
    const rows = await db
      .select({ count: sql<number>`count(distinct ${schema.submission.id})` })
      .from(schema.submission)
      .leftJoin(
        schema.participant,
        and(eq(schema.participant.submissionId, schema.submission.id), visibleParticipantConditions()),
      )
      .leftJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
      .innerJoin(schema.scheduleSlot, dayFilterJoinCondition(event, day))
      .where(and(...baseConditions));
    return Number(rows[0]?.count ?? 0);
  }

  const rows = await db
    .select({ count: sql<number>`count(distinct ${schema.submission.id})` })
    .from(schema.submission)
    .leftJoin(
      schema.participant,
      and(eq(schema.participant.submissionId, schema.submission.id), visibleParticipantConditions()),
    )
    .leftJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
    .where(and(...baseConditions));
  return Number(rows[0]?.count ?? 0);
}

/** Hydrates a set of submission ids with their tracks and visible speakers,
 * preserving `ids` order. DEC-274 (amendment wave 23): the public visibility
 * gate (eventId scoping + visibleSessionConditions()) is enforced HERE, at
 * the submission read itself, as defence in depth — callers are not trusted
 * to have already filtered.
 * DEC-318: schedule_slot reads are bounded to the event's own date range —
 * a slot dated outside it renders as unscheduled (day/startMin/endMin/
 * roomName null), which the existing card renderer already handles. */
export async function hydrateSessions(
  db: Db,
  ids: string[],
  event: Pick<PublicEvent, "id" | "recordPrefix" | "startDate" | "endDate">,
): Promise<PublicSession[]> {
  if (ids.length === 0) return [];

  const subRows: {
    id: string;
    seq: number;
    title: string;
    description: string | null;
    icsSequence: number;
  }[] = [];
  for (const batch of chunkIds(ids)) {
    const batchRows = await db
      .select({
        id: schema.submission.id,
        seq: schema.submission.seq,
        title: schema.submission.title,
        description: schema.submission.description,
        icsSequence: schema.submission.icsSequence,
      })
      .from(schema.submission)
      .where(
        and(inArray(schema.submission.id, batch), eq(schema.submission.eventId, event.id), visibleSessionConditions()),
      );
    subRows.push(...batchRows);
  }
  const subById = new Map(subRows.map((r) => [r.id, r]));

  const trackRows: {
    submissionId: string;
    id: string;
    name: string;
    color: string | null;
  }[] = [];
  for (const batch of chunkIds(ids)) {
    const batchRows = await db
      .select({
        submissionId: schema.submissionTrack.submissionId,
        id: schema.track.id,
        name: schema.track.name,
        color: schema.track.color,
      })
      .from(schema.submissionTrack)
      .innerJoin(
        schema.track,
        and(eq(schema.submissionTrack.trackId, schema.track.id), eq(schema.track.eventId, event.id)),
      )
      .where(inArray(schema.submissionTrack.submissionId, batch))
      .orderBy(asc(schema.track.position));
    trackRows.push(...batchRows);
  }
  const tracksBySubmission = new Map<string, PublicTrack[]>();
  for (const t of trackRows) {
    const list = tracksBySubmission.get(t.submissionId) ?? [];
    list.push({ id: t.id, name: t.name, color: t.color });
    tracksBySubmission.set(t.submissionId, list);
  }

  const speakerRows: {
    submissionId: string;
    order: number;
    contactId: string;
    firstName: string;
    lastName: string;
    title: string | null;
    company: string | null;
    headshotUrl: string | null;
    bio: string | null;
  }[] = [];
  for (const batch of chunkIds(ids)) {
    const batchRows = await db
      .select({
        submissionId: schema.participant.submissionId,
        order: schema.participant.order,
        contactId: schema.contact.id,
        firstName: schema.contact.firstName,
        lastName: schema.contact.lastName,
        title: schema.participant.titleAtTime,
        company: schema.participant.orgAtTime,
        headshotUrl: schema.contact.headshotUrl,
        bio: schema.contact.bio,
      })
      .from(schema.participant)
      .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
      .where(and(inArray(schema.participant.submissionId, batch), visibleParticipantConditions()))
      .orderBy(asc(schema.participant.order), asc(schema.contact.id));
    speakerRows.push(...batchRows);
  }
  const speakersBySubmission = new Map<string, PublicSpeaker[]>();
  for (const s of speakerRows) {
    const list = speakersBySubmission.get(s.submissionId) ?? [];
    list.push({
      contactId: s.contactId,
      firstName: s.firstName,
      lastName: s.lastName,
      title: s.title,
      company: s.company,
      headshotUrl: s.headshotUrl,
      bio: s.bio,
    });
    speakersBySubmission.set(s.submissionId, list);
  }

  // EMB-01: schedule_slot is at most one row per submission (unique index
  // on submission_id), leftJoin room so an unroomed ("TBD") slot still
  // yields day/start/end with roomName: null.
  const slotRows: {
    submissionId: string;
    day: string;
    startMin: number;
    endMin: number;
    roomName: string | null;
  }[] = [];
  for (const batch of chunkIds(ids)) {
    const batchRows = await db
      .select({
        submissionId: schema.scheduleSlot.submissionId,
        day: schema.scheduleSlot.day,
        startMin: schema.scheduleSlot.startMin,
        endMin: schema.scheduleSlot.endMin,
        roomName: schema.room.name,
      })
      .from(schema.scheduleSlot)
      .leftJoin(schema.room, eq(schema.scheduleSlot.roomId, schema.room.id))
      .where(and(inArray(schema.scheduleSlot.submissionId, batch), slotWithinEventRange(event)));
    slotRows.push(...batchRows);
  }
  const slotBySubmission = new Map(slotRows.map((r) => [r.submissionId, r]));

  // EMB-01/EMB-08: format is hydrated in ONE batched query over
  // submission_answer per id chunk (never per row) — mirrors the
  // tracks/speakers/slot batches above. An event whose form has no
  // field_session_format field simply yields zero rows here.
  const formatRows: { submissionId: string; valueJson: string }[] = [];
  for (const batch of chunkIds(ids)) {
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
    formatRows.push(...batchRows);
  }
  const formatBySubmission = roleAnswerMap(formatRows);

  return ids
    .map((id) => subById.get(id))
    .filter((row): row is NonNullable<typeof row> => row !== undefined)
    .map((row) => ({
      id: row.id,
      ref: formatRef(event.recordPrefix, row.seq),
      title: row.title,
      description: row.description,
      icsSequence: row.icsSequence,
      tracks: tracksBySubmission.get(row.id) ?? [],
      speakers: speakersBySubmission.get(row.id) ?? [],
      day: slotBySubmission.get(row.id)?.day ?? null,
      startMin: slotBySubmission.get(row.id)?.startMin ?? null,
      endMin: slotBySubmission.get(row.id)?.endMin ?? null,
      roomName: slotBySubmission.get(row.id)?.roomName ?? null,
      format: formatBySubmission.get(row.id) ?? null,
    }));
}

export interface PublicSessionsPage {
  items: PublicSession[];
  total: number;
}

/** Sessions list surface (DEC-022): visibility-gated, optionally filtered
 * by trackId and/or keyword (EMB-02: title or a visible speaker's first/last
 * name, case-insensitive substring, server-side only), show-more paginated
 * by page/perPage. */
export async function getPublicSessions(
  db: Db,
  event: PublicEvent,
  opts: {
    trackId: string | null;
    page: number;
    perPage: number;
    q?: string | null;
    window?: boolean;
    day?: string | null;
    format?: string | null;
    roomId?: string | null;
  },
): Promise<PublicSessionsPage> {
  const q = opts.q ?? null;
  const day = opts.day ?? null;
  const format = opts.format ?? null;
  const roomId = opts.roomId ?? null;
  // DEC-516: `window` opts into a real one-page LIMIT+OFFSET (boundedWindow)
  // for the paged JSON feeds; defaults to false so every existing HTML call
  // site keeps getting boundedRowLimit's cumulative prefix (pages 1..page
  // concatenated), which the show-more list depends on to re-render the
  // whole list-so-far on every click.
  const { limit, offset } = opts.window
    ? boundedWindow(opts.page, opts.perPage)
    : { limit: boundedRowLimit(opts.page, opts.perPage), offset: 0 };
  // Sequenced (not Promise.all'd): hydrateSessions' own select() calls stay
  // contiguous right after the id query, matching every existing fake-db
  // harness in test/public.test.ts that numbers db.select() calls by
  // position; the count query's separate select() runs last instead.
  const ordered = await getVisibleSubmissionIdsOrdered(
    db,
    event,
    opts.trackId,
    q,
    day,
    limit,
    offset,
    format,
    roomId,
  );
  const pageIds = ordered.map((r) => r.id);
  const items = await hydrateSessions(db, pageIds, event);
  const total = await countVisibleSubmissions(db, event, opts.trackId, q, day, format, roomId);
  return { items, total };
}

/** A single session by id, still visibility-gated — used by schedule.ics to
 * make sure only publicly-visible sessions can be exported. */
export async function getPublicSessionsByIds(
  db: Db,
  event: PublicEvent,
  ids: string[],
): Promise<PublicSession[]> {
  if (ids.length === 0) return [];
  const visibleRows: { id: string }[] = [];
  for (const batch of chunkIds(ids)) {
    const batchRows = await db
      .selectDistinct({ id: schema.submission.id })
      .from(schema.submission)
      .where(
        and(
          eq(schema.submission.eventId, event.id),
          inArray(schema.submission.id, batch),
          visibleSessionConditions(),
        ),
      );
    visibleRows.push(...batchRows);
  }
  const visibleIds = new Set(visibleRows.map((r) => r.id));
  const orderedVisible = ids.filter((id) => visibleIds.has(id));
  return hydrateSessions(db, orderedVisible, event);
}

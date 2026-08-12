// Public/embed repo layer (J10, DEC-022, DEC-274): sessions list + the
// shared hydrateSessions() used by list/agenda/detail. Per DEC-012 this is
// one of the only modules that touches drizzle row types for public data.
// The standalone speaker-hydration query in hydrateSessions applies
// visibleParticipantConditions() directly, since it does not route through
// visibleSubmissionConditions().

import { and, asc, eq, inArray, like, or, sql } from "drizzle-orm";
import type { Db } from "../../context";
import * as schema from "../../../db/schema";
import { formatRef } from "../../../domain/ids";
import { chunkIds } from "../../../lib/chunk";
import { DEC_258 } from "../../../decisions";
import { visibleParticipantConditions, visibleSessionConditions, slotWithinEventRange } from "./gates";
import type { PublicEvent, PublicTrack } from "./event";

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
}

/** Builds the case-insensitive substring condition for the EMB-02 keyword
 * search: submission title OR either name field of a (still
 * visibility-gated, via the caller's join) participant contact. Sqlite LIKE
 * is case-insensitive over ASCII by default — no LOWER() needed. Always
 * parameterized (Drizzle `like()`), never string-concatenated into SQL. */
function searchCondition(q: string) {
  const pattern = `%${q}%`;
  return or(
    like(schema.submission.title, pattern),
    like(schema.contact.firstName, pattern),
    like(schema.contact.lastName, pattern),
  );
}

/** Distinct, visibility-gated, optionally track-filtered and/or keyword-
 * filtered submission ids for an event, ordered by title — the stable
 * pagination order for the sessions list. Track filtering (DEC-080) is a
 * single innerJoin on submission_track with eq(trackId) in the main query
 * — one bound param, no id list at all. Keyword search (EMB-02) joins
 * contact (already reachable via participant, which every query here joins
 * for the visibility gate) and filters server-side only — the visibility
 * gate conditions are always included alongside it, never bypassed.
 * DEC-418: bounded by `limit` (SQL LIMIT, not a JS .slice()) — at SPEC.md:73-76
 * scale the unbounded query would return thousands of rows from D1 to
 * render 24 cards. Callers pair this with countVisibleSubmissions() for the
 * page total. */
async function getVisibleSubmissionIdsOrdered(
  db: Db,
  eventId: string,
  trackId: string | null,
  q: string | null,
  limit: number,
): Promise<Array<{ id: string }>> {
  const baseConditions = [eq(schema.submission.eventId, eventId), visibleSessionConditions()];
  if (q) baseConditions.push(searchCondition(q));

  if (trackId) {
    const rows = await db
      .selectDistinct({ id: schema.submission.id, title: schema.submission.title })
      .from(schema.submission)
      .leftJoin(
        schema.participant,
        and(eq(schema.participant.submissionId, schema.submission.id), visibleParticipantConditions()),
      )
      .leftJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
      .innerJoin(schema.submissionTrack, eq(schema.submissionTrack.submissionId, schema.submission.id))
      .where(and(...baseConditions, eq(schema.submissionTrack.trackId, trackId)))
      .orderBy(asc(schema.submission.title))
      .limit(limit);
    return rows;
  }

  const rows = await db
    .selectDistinct({ id: schema.submission.id, title: schema.submission.title })
    .from(schema.submission)
    .leftJoin(
      schema.participant,
      and(eq(schema.participant.submissionId, schema.submission.id), visibleParticipantConditions()),
    )
    .leftJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
    .where(and(...baseConditions))
    .orderBy(asc(schema.submission.title))
    .limit(limit);
  return rows;
}

/** Total count of distinct visibility-gated (optionally track/keyword
 * filtered) submissions for an event — the identical joins and where-
 * conditions as getVisibleSubmissionIdsOrdered(), but a single count(distinct)
 * row instead of materializing every id. Used alongside the bounded id query
 * above to compute the page total without an unbounded scan. */
async function countVisibleSubmissions(
  db: Db,
  eventId: string,
  trackId: string | null,
  q: string | null,
): Promise<number> {
  const baseConditions = [eq(schema.submission.eventId, eventId), visibleSessionConditions()];
  if (q) baseConditions.push(searchCondition(q));

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

/** Hydrates a set of submission ids (already visibility-checked by the
 * caller) with their tracks and visible speakers, preserving `ids` order.
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
      .where(inArray(schema.submission.id, batch));
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
      .orderBy(asc(schema.participant.order));
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
  opts: { trackId: string | null; page: number; perPage: number; q?: string | null },
): Promise<PublicSessionsPage> {
  const limit = opts.page * opts.perPage;
  const q = opts.q ?? null;
  // Sequenced (not Promise.all'd): hydrateSessions' own select() calls stay
  // contiguous right after the id query, matching every existing fake-db
  // harness in test/public.test.ts that numbers db.select() calls by
  // position; the count query's separate select() runs last instead.
  const ordered = await getVisibleSubmissionIdsOrdered(db, event.id, opts.trackId, q, limit);
  const pageIds = ordered.map((r) => r.id);
  const items = await hydrateSessions(db, pageIds, event);
  const total = await countVisibleSubmissions(db, event.id, opts.trackId, q);
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

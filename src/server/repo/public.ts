// Public/embed repo layer (J10, DEC-022, DEC-274): the ONLY query source for
// the five public surfaces (/e/:eventSlug/*, /embed/:eventSlug/*). DEC-274
// splits the visibility gate into two distinct conditions: session gates
// (submission.status='accepted' AND submission.content_status='approved',
// via visibleSessionConditions() — no reference to participant) and
// participant gates (participant.visible=1 AND participant.invite_status IN
// ('none','accepted'), DEC-108, via visibleParticipantConditions()).
// Session-rooted queries (list/agenda/detail) use visibleSessionConditions()
// alone and left-join participant — a session with zero participants, or
// whose participants are all hidden, is still publicly visible with
// speakers: []. Speaker-rooted queries (getPublicSpeakers/
// getPublicSpeakerDetail) still use visibleSubmissionConditions(), the AND
// of both gates, since a hidden/uninvited participant must never appear as
// a speaker. Per DEC-012 this is the only module that touches drizzle row
// types for public data. The standalone speaker-hydration query in
// hydrateSessions applies visibleParticipantConditions() directly, since it
// does not route through visibleSubmissionConditions().

import { and, asc, eq, gte, inArray, lte, like, or, sql } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { formatRef } from "../../domain/ids";
import { chunkIds } from "../../lib/chunk";
import { DEC_258 } from "../../decisions";

// Compile-checked dependency marker: every speaker title/company read below
// comes from participant.title_at_time/org_at_time (DEC-258's frozen
// snapshot), never the live contact — no fallback.
void DEC_258;

// ---------------------------------------------------------------------------
// Shared visibility gate
// ---------------------------------------------------------------------------

/**
 * Session-only visibility gate (DEC-274): submission.status='accepted' AND
 * submission.content_status='approved'. Contains NO reference to
 * schema.participant — a session with zero participants, or whose
 * participants are all hidden, still satisfies this gate. Use this (not
 * visibleSubmissionConditions()) for every session-rooted public query.
 */
export function visibleSessionConditions() {
  return and(eq(schema.submission.status, "accepted"), eq(schema.submission.contentStatus, "approved"));
}

/**
 * Participant-only visibility gate (DEC-274, DEC-108): participant.visible=1
 * AND participant.invite_status IN ('none','accepted') — 'none' is the
 * never-invited (solo/no-coordination) case, 'accepted' is invite-accepted;
 * any other invite state must never make a participant publicly visible.
 * Callers must join `participant` for this to apply.
 */
export function visibleParticipantConditions() {
  return and(
    eq(schema.participant.visible, true),
    // two literals, bounded — DEC-104-exempt
    inArray(schema.participant.inviteStatus, ["none", "accepted"]),
  );
}

/**
 * Single-sourced visibility condition (DEC-022, DEC-274): the AND of the
 * session gate and the participant gate. Callers MUST join `participant`
 * into the query (innerJoin on participant.submissionId = submission.id)
 * for the participant.visible check to apply. Use this only for
 * speaker-rooted queries (getPublicSpeakers/getPublicSpeakerDetail) — a
 * hidden/uninvited participant must never appear as a speaker. Session-
 * rooted queries must use visibleSessionConditions() instead, so a
 * speakerless or all-hidden-speaker session remains publicly visible.
 */
export function visibleSubmissionConditions() {
  return and(visibleSessionConditions(), visibleParticipantConditions());
}

/**
 * DEC-318: bounds a schedule_slot read to the event's own [startDate,
 * endDate] range. A slot dated outside this range must never publish —
 * the session it belongs to instead renders as unscheduled (all schedule
 * fields null). Kept in the SQL WHERE per DEC-312, never a post-filter in
 * the mapper, so page counts / embed JSON / .ics bodies all agree.
 */
function slotWithinEventRange(event: { startDate: string; endDate: string }) {
  return and(gte(schema.scheduleSlot.day, event.startDate), lte(schema.scheduleSlot.day, event.endDate));
}

// ---------------------------------------------------------------------------
// Event / tracks / rooms
// ---------------------------------------------------------------------------

export interface PublicEvent {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  startDate: string;
  endDate: string;
  location: string | null;
  timezone: string;
  recordPrefix: string;
  brandingJson: string | null;
}

export async function getPublicEventBySlug(db: Db, slug: string): Promise<PublicEvent | null> {
  const rows = await db.select().from(schema.event).where(eq(schema.event.slug, slug)).limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.orgId,
    name: row.name,
    slug: row.slug,
    startDate: row.startDate,
    endDate: row.endDate,
    location: row.location,
    timezone: row.timezone,
    recordPrefix: row.recordPrefix,
    brandingJson: row.brandingJson,
  };
}

export interface PublicTrack {
  id: string;
  name: string;
  color: string | null;
}

export async function getPublicTracks(db: Db, eventId: string): Promise<PublicTrack[]> {
  const rows = await db
    .select({ id: schema.track.id, name: schema.track.name, color: schema.track.color })
    .from(schema.track)
    .where(eq(schema.track.eventId, eventId))
    .orderBy(asc(schema.track.position));
  return rows;
}

// ---------------------------------------------------------------------------
// Sessions (list + agenda hydration share this)
// ---------------------------------------------------------------------------

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
 * gate conditions are always included alongside it, never bypassed. */
async function getVisibleSubmissionIdsOrdered(
  db: Db,
  eventId: string,
  trackId: string | null,
  q: string | null,
): Promise<Array<{ id: string; title: string }>> {
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
      .orderBy(asc(schema.submission.title));
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
    .orderBy(asc(schema.submission.title));
  return rows;
}

/** Hydrates a set of submission ids (already visibility-checked by the
 * caller) with their tracks and visible speakers, preserving `ids` order.
 * DEC-318: schedule_slot reads are bounded to the event's own date range —
 * a slot dated outside it renders as unscheduled (day/startMin/endMin/
 * roomName null), which the existing card renderer already handles. */
async function hydrateSessions(
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
      .innerJoin(schema.track, eq(schema.submissionTrack.trackId, schema.track.id))
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
  const ordered = await getVisibleSubmissionIdsOrdered(db, event.id, opts.trackId, opts.q ?? null);
  const total = ordered.length;
  const pageIds = ordered.slice(0, opts.page * opts.perPage).map((r) => r.id);
  const items = await hydrateSessions(db, pageIds, event);
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

// ---------------------------------------------------------------------------
// Speakers / gallery
// ---------------------------------------------------------------------------

export interface PublicSpeakerWithSessions extends PublicSpeaker {
  sessions: Array<{ id: string; title: string }>;
}

/** Speakers surface (DEC-022): alphabetical by surname, each with the list
 * of their visible sessions at this event. Gallery reuses this (headshot
 * grid is a rendering choice, not a different query). `q` (DEC-151) is an
 * optional case-insensitive name-search filter over first/last/full name,
 * applied server-side so both the directory and gallery search forms stay
 * JS-free GETs. */
export async function getPublicSpeakers(
  db: Db,
  eventId: string,
  opts?: { q?: string | null },
): Promise<PublicSpeakerWithSessions[]> {
  const conditions = [eq(schema.submission.eventId, eventId), visibleSubmissionConditions()];
  const q = opts?.q?.trim();
  if (q) {
    const pattern = `%${q}%`;
    conditions.push(
      or(
        sql`${schema.contact.firstName} LIKE ${pattern} COLLATE NOCASE`,
        sql`${schema.contact.lastName} LIKE ${pattern} COLLATE NOCASE`,
        sql`(${schema.contact.firstName} || ' ' || ${schema.contact.lastName}) LIKE ${pattern} COLLATE NOCASE`,
      )!,
    );
  }

  const rows = await db
    .select({
      contactId: schema.contact.id,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      title: schema.participant.titleAtTime,
      company: schema.participant.orgAtTime,
      headshotUrl: schema.contact.headshotUrl,
      bio: schema.contact.bio,
      submissionId: schema.submission.id,
      submissionTitle: schema.submission.title,
    })
    .from(schema.participant)
    .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .where(and(...conditions))
    .orderBy(asc(schema.contact.lastName), asc(schema.contact.firstName), asc(schema.submission.title));

  const bySpeaker = new Map<string, PublicSpeakerWithSessions>();
  for (const row of rows) {
    let speaker = bySpeaker.get(row.contactId);
    if (!speaker) {
      speaker = {
        contactId: row.contactId,
        firstName: row.firstName,
        lastName: row.lastName,
        title: row.title,
        company: row.company,
        headshotUrl: row.headshotUrl,
        bio: row.bio,
        sessions: [],
      };
      bySpeaker.set(row.contactId, speaker);
    }
    speaker.sessions.push({ id: row.submissionId, title: row.submissionTitle });
  }
  // rows are already ordered by lastName/firstName; Map preserves first-seen
  // insertion order, so this reflects that ordering.
  return [...bySpeaker.values()];
}

// ---------------------------------------------------------------------------
// Drill-in detail pages (DEC-151, EMB-05/EMB-08/EMB-13)
// ---------------------------------------------------------------------------

/** Schedule placement (day/startMin/endMin/room) for a batch of submission
 * ids, event-scoped. A submission with no row is unscheduled — callers treat
 * that as all-null fields rather than an error. DEC-318: bounded to the
 * event's own date range. */
async function getScheduleInfoForSubmissions(
  db: Db,
  event: Pick<PublicEvent, "id" | "startDate" | "endDate">,
  ids: string[],
): Promise<Map<string, { day: string; startMin: number; endMin: number; roomId: string | null; roomName: string | null }>> {
  const out = new Map<string, { day: string; startMin: number; endMin: number; roomId: string | null; roomName: string | null }>();
  if (ids.length === 0) return out;

  const slotRows: { submissionId: string; day: string; startMin: number; endMin: number; roomId: string | null }[] = [];
  for (const batch of chunkIds(ids)) {
    const batchRows = await db
      .select({
        submissionId: schema.scheduleSlot.submissionId,
        day: schema.scheduleSlot.day,
        startMin: schema.scheduleSlot.startMin,
        endMin: schema.scheduleSlot.endMin,
        roomId: schema.scheduleSlot.roomId,
      })
      .from(schema.scheduleSlot)
      .where(and(inArray(schema.scheduleSlot.submissionId, batch), slotWithinEventRange(event)));
    slotRows.push(...batchRows);
  }

  // bounded by the event's physical room count (~15) — DEC-078 exemption
  const roomIds = [...new Set(slotRows.map((r) => r.roomId).filter((id): id is string => id !== null))];
  const roomRows =
    roomIds.length === 0
      ? []
      : await db
          .select({ id: schema.room.id, name: schema.room.name })
          .from(schema.room)
          .where(and(inArray(schema.room.id, roomIds), eq(schema.room.eventId, event.id)));
  const roomNameById = new Map(roomRows.map((r) => [r.id, r.name]));

  for (const row of slotRows) {
    out.set(row.submissionId, {
      day: row.day,
      startMin: row.startMin,
      endMin: row.endMin,
      roomId: row.roomId,
      roomName: row.roomId ? roomNameById.get(row.roomId) ?? null : null,
    });
  }
  return out;
}

export interface PublicSpeakerDetailSession {
  id: string;
  title: string;
  day: string | null;
  startMin: number | null;
  endMin: number | null;
  room: string | null;
  trackNames: string[];
}

export interface PublicSpeakerDetail {
  contactId: string;
  firstName: string;
  lastName: string;
  title: string | null;
  company: string | null;
  bio: string | null;
  headshotUrl: string | null;
  sessions: PublicSpeakerDetailSession[];
}

/** Speaker drill-in (DEC-151, EMB-05/EMB-13): reuses visibleSubmissionConditions
 * verbatim, scoped to a single contact within a single event — a contact with
 * zero visible submissions at this event returns null, so the route 404s
 * exactly as an unknown id would (never leaks that a hidden speaker exists). */
export async function getPublicSpeakerDetail(
  db: Db,
  event: PublicEvent,
  contactId: string,
): Promise<PublicSpeakerDetail | null> {
  const rows = await db
    .select({
      contactId: schema.contact.id,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      title: schema.participant.titleAtTime,
      company: schema.participant.orgAtTime,
      bio: schema.contact.bio,
      headshotUrl: schema.contact.headshotUrl,
      submissionId: schema.submission.id,
      submissionTitle: schema.submission.title,
    })
    .from(schema.participant)
    .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .where(and(eq(schema.submission.eventId, event.id), eq(schema.contact.id, contactId), visibleSubmissionConditions()))
    .orderBy(asc(schema.submission.title));

  if (rows.length === 0) return null;

  const submissionIds = [...new Set(rows.map((r) => r.submissionId))];
  const scheduleInfo = await getScheduleInfoForSubmissions(db, event, submissionIds);

  const trackRows: { submissionId: string; name: string }[] = [];
  for (const batch of chunkIds(submissionIds)) {
    const batchRows = await db
      .select({ submissionId: schema.submissionTrack.submissionId, name: schema.track.name })
      .from(schema.submissionTrack)
      .innerJoin(schema.track, eq(schema.submissionTrack.trackId, schema.track.id))
      .where(inArray(schema.submissionTrack.submissionId, batch))
      .orderBy(asc(schema.track.position));
    trackRows.push(...batchRows);
  }
  const trackNamesBySubmission = new Map<string, string[]>();
  for (const t of trackRows) {
    const list = trackNamesBySubmission.get(t.submissionId) ?? [];
    list.push(t.name);
    trackNamesBySubmission.set(t.submissionId, list);
  }

  const first = rows[0];
  if (!first) return null;
  return {
    contactId: first.contactId,
    firstName: first.firstName,
    lastName: first.lastName,
    title: first.title,
    company: first.company,
    bio: first.bio,
    headshotUrl: first.headshotUrl,
    sessions: rows.map((r) => {
      const slot = scheduleInfo.get(r.submissionId);
      return {
        id: r.submissionId,
        title: r.submissionTitle,
        day: slot?.day ?? null,
        startMin: slot?.startMin ?? null,
        endMin: slot?.endMin ?? null,
        room: slot?.roomName ?? null,
        trackNames: trackNamesBySubmission.get(r.submissionId) ?? [],
      };
    }),
  };
}

export interface PublicSessionDetail {
  id: string;
  ref: string;
  title: string;
  description: string | null;
  tracks: PublicTrack[];
  day: string | null;
  startMin: number | null;
  endMin: number | null;
  roomId: string | null;
  roomName: string | null;
  speakers: PublicSpeaker[];
}

/** Session drill-in (DEC-151, EMB-08): visibility-gated exactly like
 * getPublicSessionsByIds, singular; unscheduled sessions get null
 * day/startMin/endMin/room rather than being excluded (a session can be
 * publicly visible before it lands on the agenda). */
export async function getPublicSessionDetail(
  db: Db,
  event: PublicEvent,
  submissionId: string,
): Promise<PublicSessionDetail | null> {
  const visibleRows = await db
    .selectDistinct({ id: schema.submission.id })
    .from(schema.submission)
    .where(
      and(eq(schema.submission.eventId, event.id), eq(schema.submission.id, submissionId), visibleSessionConditions()),
    );
  if (visibleRows.length === 0) return null;

  const [session] = await hydrateSessions(db, [submissionId], event);
  if (!session) return null;

  const scheduleInfo = await getScheduleInfoForSubmissions(db, event, [submissionId]);
  const slot = scheduleInfo.get(submissionId);

  return {
    id: session.id,
    ref: session.ref,
    title: session.title,
    description: session.description,
    tracks: session.tracks,
    day: slot?.day ?? null,
    startMin: slot?.startMin ?? null,
    endMin: slot?.endMin ?? null,
    roomId: slot?.roomId ?? null,
    roomName: slot?.roomName ?? null,
    speakers: session.speakers,
  };
}

// ---------------------------------------------------------------------------
// Agenda / schedule
// ---------------------------------------------------------------------------

export interface PublicAgendaItem {
  submissionId: string;
  ref: string;
  title: string;
  description: string | null;
  day: string;
  startMin: number;
  endMin: number;
  roomId: string | null;
  roomName: string | null;
  icsSequence: number;
  tracks: PublicTrack[];
  speakers: PublicSpeaker[];
}

/** Agenda/schedule surface (DEC-022): visibility-gated scheduled sessions,
 * grouped by day by the caller. Rooms come along for the per-day time grid. */
export async function getPublicAgenda(db: Db, event: PublicEvent): Promise<PublicAgendaItem[]> {
  const rows = await db
    .selectDistinct({
      submissionId: schema.scheduleSlot.submissionId,
      day: schema.scheduleSlot.day,
      startMin: schema.scheduleSlot.startMin,
      endMin: schema.scheduleSlot.endMin,
      roomId: schema.scheduleSlot.roomId,
    })
    .from(schema.scheduleSlot)
    .innerJoin(schema.submission, eq(schema.scheduleSlot.submissionId, schema.submission.id))
    .where(and(eq(schema.submission.eventId, event.id), visibleSessionConditions(), slotWithinEventRange(event)))
    .orderBy(asc(schema.scheduleSlot.day), asc(schema.scheduleSlot.startMin));

  if (rows.length === 0) return [];

  // roomIds is bounded by the event's physical room count (~15) — a
  // DEC-078 bounded-list exemption, so this inArray stays unchunked.
  const roomIds = [...new Set(rows.map((r) => r.roomId).filter((id): id is string => id !== null))];
  const roomRows =
    roomIds.length === 0
      ? []
      : await db
          .select({ id: schema.room.id, name: schema.room.name })
          .from(schema.room)
          .where(and(inArray(schema.room.id, roomIds), eq(schema.room.eventId, event.id)));
  const roomNameById = new Map(roomRows.map((r) => [r.id, r.name]));

  const ids = rows.map((r) => r.submissionId);
  const sessions = await hydrateSessions(db, ids, event);
  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  return rows
    .map((row) => {
      const session = sessionById.get(row.submissionId);
      if (!session) return null;
      const item: PublicAgendaItem = {
        submissionId: row.submissionId,
        ref: session.ref,
        title: session.title,
        description: session.description,
        day: row.day,
        startMin: row.startMin,
        endMin: row.endMin,
        roomId: row.roomId,
        roomName: row.roomId ? roomNameById.get(row.roomId) ?? null : null,
        icsSequence: session.icsSequence,
        tracks: session.tracks,
        speakers: session.speakers,
      };
      return item;
    })
    .filter((item): item is PublicAgendaItem => item !== null);
}

/** Id-scoped agenda lookup (DEC-078, DEC-310): mirrors getPublicAgenda's
 * column set, join, visibility gate, room lookup and hydration exactly, but
 * scopes the scheduleSlot scan to the requested submission ids (chunked per
 * DEC-078) instead of hydrating the whole published agenda. Used by
 * schedule.ics so an itinerary export for a handful of ids doesn't pay for a
 * full-event scan. */
export async function getPublicAgendaByIds(
  db: Db,
  event: PublicEvent,
  ids: string[],
): Promise<PublicAgendaItem[]> {
  if (ids.length === 0) return [];

  const rows: {
    submissionId: string;
    day: string;
    startMin: number;
    endMin: number;
    roomId: string | null;
  }[] = [];
  for (const batch of chunkIds(ids)) {
    const batchRows = await db
      .selectDistinct({
        submissionId: schema.scheduleSlot.submissionId,
        day: schema.scheduleSlot.day,
        startMin: schema.scheduleSlot.startMin,
        endMin: schema.scheduleSlot.endMin,
        roomId: schema.scheduleSlot.roomId,
      })
      .from(schema.scheduleSlot)
      .innerJoin(schema.submission, eq(schema.scheduleSlot.submissionId, schema.submission.id))
      .where(
        and(
          eq(schema.submission.eventId, event.id),
          inArray(schema.scheduleSlot.submissionId, batch),
          visibleSessionConditions(),
          slotWithinEventRange(event),
        ),
      );
    rows.push(...batchRows);
  }
  rows.sort((a, b) => (a.day === b.day ? a.startMin - b.startMin : a.day < b.day ? -1 : 1));

  if (rows.length === 0) return [];

  // roomIds is bounded by the event's physical room count (~15) — a
  // DEC-078 bounded-list exemption, so this inArray stays unchunked.
  const roomIds = [...new Set(rows.map((r) => r.roomId).filter((id): id is string => id !== null))];
  const roomRows =
    roomIds.length === 0
      ? []
      : await db
          .select({ id: schema.room.id, name: schema.room.name })
          .from(schema.room)
          .where(and(inArray(schema.room.id, roomIds), eq(schema.room.eventId, event.id)));
  const roomNameById = new Map(roomRows.map((r) => [r.id, r.name]));

  const sessionIds = rows.map((r) => r.submissionId);
  const sessions = await hydrateSessions(db, sessionIds, event);
  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  return rows
    .map((row) => {
      const session = sessionById.get(row.submissionId);
      if (!session) return null;
      const item: PublicAgendaItem = {
        submissionId: row.submissionId,
        ref: session.ref,
        title: session.title,
        description: session.description,
        day: row.day,
        startMin: row.startMin,
        endMin: row.endMin,
        roomId: row.roomId,
        roomName: row.roomId ? roomNameById.get(row.roomId) ?? null : null,
        icsSequence: session.icsSequence,
        tracks: session.tracks,
        speakers: session.speakers,
      };
      return item;
    })
    .filter((item): item is PublicAgendaItem => item !== null);
}

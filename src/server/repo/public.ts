// Public/embed repo layer (J10, DEC-022): the ONLY query source for the five
// public surfaces (/e/:eventSlug/*, /embed/:eventSlug/*). Every query below
// enforces the shared visibility gate — submission.status='accepted' AND
// submission.content_status='approved' AND participant.visible=1 — in SQL
// via visibleSubmissionConditions(), never in application code, so it can
// never accidentally be skipped by a caller. Per DEC-012 this is the only
// module that touches drizzle row types for public data.

import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db } from "../context";
import * as schema from "../../db/schema";
import { formatRef } from "../../domain/ids";

// ---------------------------------------------------------------------------
// Shared visibility gate
// ---------------------------------------------------------------------------

/**
 * Single-sourced visibility condition (DEC-022). Callers MUST join
 * `participant` into the query (innerJoin on participant.submissionId =
 * submission.id) for the participant.visible check to apply — every query
 * below does this.
 */
export function visibleSubmissionConditions() {
  return and(
    eq(schema.submission.status, "accepted"),
    eq(schema.submission.contentStatus, "approved"),
    eq(schema.participant.visible, true),
  );
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
}

/** Distinct, visibility-gated, optionally track-filtered submission ids for
 * an event, ordered by title — the stable pagination order for the sessions
 * list. Track filtering mirrors the two-step inArray pattern used by the
 * admin submissions list (server/repo/submissions.ts): resolve matching
 * submission ids from submission_track first, then narrow. */
async function getVisibleSubmissionIdsOrdered(
  db: Db,
  eventId: string,
  trackId: string | null,
): Promise<Array<{ id: string; title: string }>> {
  const conditions = [eq(schema.submission.eventId, eventId), visibleSubmissionConditions()];

  if (trackId) {
    const trackRows = await db
      .select({ submissionId: schema.submissionTrack.submissionId })
      .from(schema.submissionTrack)
      .where(eq(schema.submissionTrack.trackId, trackId));
    const ids = trackRows.map((r) => r.submissionId);
    if (ids.length === 0) return [];
    conditions.push(inArray(schema.submission.id, ids));
  }

  const rows = await db
    .selectDistinct({ id: schema.submission.id, title: schema.submission.title })
    .from(schema.submission)
    .innerJoin(schema.participant, eq(schema.participant.submissionId, schema.submission.id))
    .where(and(...conditions))
    .orderBy(asc(schema.submission.title));
  return rows;
}

/** Hydrates a set of submission ids (already visibility-checked by the
 * caller) with their tracks and visible speakers, preserving `ids` order. */
async function hydrateSessions(
  db: Db,
  ids: string[],
  recordPrefix: string,
): Promise<PublicSession[]> {
  if (ids.length === 0) return [];

  const subRows = await db
    .select({
      id: schema.submission.id,
      seq: schema.submission.seq,
      title: schema.submission.title,
      description: schema.submission.description,
      icsSequence: schema.submission.icsSequence,
    })
    .from(schema.submission)
    .where(inArray(schema.submission.id, ids));
  const subById = new Map(subRows.map((r) => [r.id, r]));

  const trackRows = await db
    .select({
      submissionId: schema.submissionTrack.submissionId,
      id: schema.track.id,
      name: schema.track.name,
      color: schema.track.color,
    })
    .from(schema.submissionTrack)
    .innerJoin(schema.track, eq(schema.submissionTrack.trackId, schema.track.id))
    .where(inArray(schema.submissionTrack.submissionId, ids))
    .orderBy(asc(schema.track.position));
  const tracksBySubmission = new Map<string, PublicTrack[]>();
  for (const t of trackRows) {
    const list = tracksBySubmission.get(t.submissionId) ?? [];
    list.push({ id: t.id, name: t.name, color: t.color });
    tracksBySubmission.set(t.submissionId, list);
  }

  const speakerRows = await db
    .select({
      submissionId: schema.participant.submissionId,
      order: schema.participant.order,
      contactId: schema.contact.id,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      title: schema.contact.title,
      company: schema.contact.company,
      headshotUrl: schema.contact.headshotUrl,
      bio: schema.contact.bio,
    })
    .from(schema.participant)
    .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
    .where(and(inArray(schema.participant.submissionId, ids), eq(schema.participant.visible, true)))
    .orderBy(asc(schema.participant.order));
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

  return ids
    .map((id) => subById.get(id))
    .filter((row): row is NonNullable<typeof row> => row !== undefined)
    .map((row) => ({
      id: row.id,
      ref: formatRef(recordPrefix, row.seq),
      title: row.title,
      description: row.description,
      icsSequence: row.icsSequence,
      tracks: tracksBySubmission.get(row.id) ?? [],
      speakers: speakersBySubmission.get(row.id) ?? [],
    }));
}

export interface PublicSessionsPage {
  items: PublicSession[];
  total: number;
}

/** Sessions list surface (DEC-022): visibility-gated, optionally filtered
 * by trackId, show-more paginated by page/perPage. */
export async function getPublicSessions(
  db: Db,
  event: PublicEvent,
  opts: { trackId: string | null; page: number; perPage: number },
): Promise<PublicSessionsPage> {
  const ordered = await getVisibleSubmissionIdsOrdered(db, event.id, opts.trackId);
  const total = ordered.length;
  const pageIds = ordered.slice(0, opts.page * opts.perPage).map((r) => r.id);
  const items = await hydrateSessions(db, pageIds, event.recordPrefix);
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
  const visibleRows = await db
    .selectDistinct({ id: schema.submission.id })
    .from(schema.submission)
    .innerJoin(schema.participant, eq(schema.participant.submissionId, schema.submission.id))
    .where(
      and(eq(schema.submission.eventId, event.id), inArray(schema.submission.id, ids), visibleSubmissionConditions()),
    );
  const visibleIds = new Set(visibleRows.map((r) => r.id));
  const orderedVisible = ids.filter((id) => visibleIds.has(id));
  return hydrateSessions(db, orderedVisible, event.recordPrefix);
}

// ---------------------------------------------------------------------------
// Speakers / gallery
// ---------------------------------------------------------------------------

export interface PublicSpeakerWithSessions extends PublicSpeaker {
  sessions: Array<{ id: string; title: string }>;
}

/** Speakers surface (DEC-022): alphabetical by surname, each with the list
 * of their visible sessions at this event. Gallery reuses this (headshot
 * grid is a rendering choice, not a different query). */
export async function getPublicSpeakers(db: Db, eventId: string): Promise<PublicSpeakerWithSessions[]> {
  const rows = await db
    .select({
      contactId: schema.contact.id,
      firstName: schema.contact.firstName,
      lastName: schema.contact.lastName,
      title: schema.contact.title,
      company: schema.contact.company,
      headshotUrl: schema.contact.headshotUrl,
      bio: schema.contact.bio,
      submissionId: schema.submission.id,
      submissionTitle: schema.submission.title,
    })
    .from(schema.participant)
    .innerJoin(schema.contact, eq(schema.participant.contactId, schema.contact.id))
    .innerJoin(schema.submission, eq(schema.participant.submissionId, schema.submission.id))
    .where(and(eq(schema.submission.eventId, eventId), visibleSubmissionConditions()))
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
    .innerJoin(schema.participant, eq(schema.participant.submissionId, schema.submission.id))
    .where(and(eq(schema.submission.eventId, event.id), visibleSubmissionConditions()))
    .orderBy(asc(schema.scheduleSlot.day), asc(schema.scheduleSlot.startMin));

  if (rows.length === 0) return [];

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
  const sessions = await hydrateSessions(db, ids, event.recordPrefix);
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
